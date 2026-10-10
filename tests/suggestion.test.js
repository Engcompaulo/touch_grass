// suggestion.test.js — Testes de propriedade (property-based) do módulo suggestion.js.
//
// Cobre as Correctness Properties 17, 18 e 19 do design (tasks 10.2, 10.3, 10.4),
// exercitando a camada de LÓGICA PURA da sugestão por IA:
//   - Property 17 (10.2): montarPrompt inclui cada jogo e o nº de jogadores (R5.1)
//   - Property 18 (10.3): filtrarSequencia mantém só selecionados preservando a
//     ordem relativa (R5.3, R5.6)
//   - Property 19 (10.4): gerarSequenciaLocal cobre cada jogo >=1 vez e nada além
//     (R5.4, R5.5, R9.5)
// Cada propriedade roda no mínimo 100 iterações (numRuns: 100) com geradores
// customizados. As funções são puras: não tocam no DOM, no localStorage, nem
// fazem I/O. Conteúdo e comentários em português do Brasil.

import { describe, it, expect } from "vitest";
import fc from "fast-check";

import {
  montarPrompt,
  filtrarSequencia,
  gerarSequenciaLocal,
} from "../src/js/suggestion.js";

// --- Geradores customizados ---------------------------------------------

// Normaliza um nome para comparação (ignora caixa e espaços das extremidades),
// espelhando a chave interna usada por filtrarSequencia.
function chaveNome(nome) {
  return String(nome ?? "").trim().toLocaleLowerCase();
}

// Gera uma lista NÃO VAZIA de Jogos_Selecionados com nomes mutuamente distintos
// (ignorando caixa/espaços) e ids únicos. Os nomes têm miolo não vazio para
// sobreviverem ao trim das funções sob teste.
const arbJogosSelecionados = fc
  .array(
    fc
      .string({ minLength: 1, maxLength: 40 })
      .filter((s) => s.trim().length >= 1 && s.trim().length <= 40),
    { minLength: 1, maxLength: 8 }
  )
  .map((nomes) => {
    const vistos = new Set();
    const jogos = [];
    nomes.forEach((bruto, i) => {
      const nome = bruto.trim();
      const chave = chaveNome(nome);
      if (vistos.has(chave)) {
        return; // descarta nomes equivalentes para manter unicidade
      }
      vistos.add(chave);
      jogos.push({
        id: `jogo-${i}-${chave.slice(0, 10)}`,
        nome,
        selecionado: true,
        personalizado: false,
      });
    });
    return jogos;
  })
  // Após a deduplicação a lista continua não vazia (ao menos o primeiro nome).
  .filter((jogos) => jogos.length >= 1);

// Número de jogadores plausível para uma noite de jogos (R3: 4 a 20).
const arbNumJogadores = fc.integer({ min: 4, max: 20 });

// --- Property 17 (task 10.2) --------------------------------------------
// Feature: board-game-scoreboard, Property 17
describe("Property 17: O prompt da IA inclui os jogos e o número de jogadores (R5.1)", () => {
  it("montarPrompt contém o nome de cada jogo selecionado e o número de jogadores", () => {
    fc.assert(
      fc.property(arbJogosSelecionados, arbNumJogadores, (jogos, numJogadores) => {
        const prompt = montarPrompt(jogos, numJogadores);

        // O texto é uma string não vazia.
        expect(typeof prompt).toBe("string");
        expect(prompt.length).toBeGreaterThan(0);

        // O número de jogadores aparece no prompt.
        expect(prompt).toContain(String(numJogadores));

        // O nome de cada jogo selecionado aparece no prompt.
        for (const jogo of jogos) {
          expect(prompt).toContain(jogo.nome);
        }
      }),
      { numRuns: 100 }
    );
  });
});

// --- Property 18 (task 10.3) --------------------------------------------
// Feature: board-game-scoreboard, Property 18
describe("Property 18: A filtragem mantém apenas jogos selecionados preservando a ordem (R5.3, R5.6)", () => {
  it("filtrarSequencia retorna uma subsequência só de selecionados na ordem relativa original", () => {
    fc.assert(
      fc.property(
        arbJogosSelecionados,
        // Ruído: nomes de jogos que NÃO estão entre os selecionados.
        fc.array(
          fc
            .string({ minLength: 1, maxLength: 20 })
            .filter((s) => s.trim().length >= 1),
          { minLength: 0, maxLength: 6 }
        ),
        // Instruções para montar a sequência de entrada misturando selecionados
        // (por índice, podendo repetir e variar caixa/espaços) e ruído.
        fc.array(
          fc.record({
            tipo: fc.constantFrom("sel", "ruido"),
            indice: fc.nat(),
            caixaAlta: fc.boolean(),
            esq: fc.stringOf(fc.constantFrom(" ", "\t"), { maxLength: 3 }),
            dir: fc.stringOf(fc.constantFrom(" ", "\t"), { maxLength: 3 }),
          }),
          { minLength: 0, maxLength: 20 }
        ),
        (jogos, ruidoNomes, instrucoes) => {
          // Ruído efetivo: apenas nomes que não colidem com os selecionados.
          const chavesSelecionadas = new Set(jogos.map((j) => chaveNome(j.nome)));
          const ruido = ruidoNomes.filter(
            (n) => !chavesSelecionadas.has(chaveNome(n))
          );

          // Monta a sequência de entrada e, em paralelo, o esperado: apenas os
          // nomes canônicos dos selecionados, na mesma ordem relativa.
          const entrada = [];
          const esperado = [];
          for (const inst of instrucoes) {
            if (inst.tipo === "sel") {
              const jogo = jogos[inst.indice % jogos.length];
              const base = inst.caixaAlta
                ? jogo.nome.toLocaleUpperCase()
                : jogo.nome.toLocaleLowerCase();
              entrada.push(`${inst.esq}${base}${inst.dir}`);
              // O resultado usa o nome canônico do Jogo_Selecionado.
              esperado.push(jogo.nome);
            } else if (ruido.length > 0) {
              entrada.push(ruido[inst.indice % ruido.length]);
              // Ruído não entra no esperado.
            }
          }

          const resultado = filtrarSequencia(entrada, jogos);

          // A subsequência filtrada é exatamente a dos selecionados, em ordem.
          expect(resultado).toEqual(esperado);

          // Reforço: todo item do resultado é um Jogo_Selecionado.
          for (const nome of resultado) {
            expect(chavesSelecionadas.has(chaveNome(nome))).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// --- Property 19 (task 10.4) --------------------------------------------
// Feature: board-game-scoreboard, Property 19
describe("Property 19: A sequência local cobre todos os jogos selecionados e nada além deles (R5.4, R5.5, R9.5)", () => {
  it("gerarSequenciaLocal inclui cada jogo selecionado ao menos uma vez e nenhum não selecionado", () => {
    fc.assert(
      fc.property(arbJogosSelecionados, arbNumJogadores, (jogos, numJogadores) => {
        const sequencia = gerarSequenciaLocal(jogos, numJogadores);

        // Retorna um array não vazio para conjunto de selecionados não vazio.
        expect(Array.isArray(sequencia)).toBe(true);
        expect(sequencia.length).toBeGreaterThan(0);

        const chavesSequencia = new Set(sequencia.map((n) => chaveNome(n)));
        const chavesSelecionadas = new Set(jogos.map((j) => chaveNome(j.nome)));

        // Cobertura: cada jogo selecionado aparece ao menos uma vez.
        for (const chave of chavesSelecionadas) {
          expect(chavesSequencia.has(chave)).toBe(true);
        }

        // Nada além: todo item da sequência é um jogo selecionado.
        for (const chave of chavesSequencia) {
          expect(chavesSelecionadas.has(chave)).toBe(true);
        }
      }),
      { numRuns: 100 }
    );
  });
});
