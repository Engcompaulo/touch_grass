// catalog.test.js — Testes de propriedade (property-based) do módulo catalog.js.
//
// Cobre as Correctness Properties 1, 4, 5, 6 e 7 do design (tasks 4.2 a 4.6),
// exercitando a camada de lógica pura de seleção e adição/remoção de jogos.
// Cada propriedade roda no mínimo 100 iterações (numRuns: 100) com geradores
// customizados. As funções de catalog.js são puras: não tocam no DOM nem no
// localStorage, não lançam e nunca mutam a Sessao recebida.

import { describe, it, expect } from "vitest";
import fc from "fast-check";

import {
  CATALOGO_PADRAO,
  alternarSelecao,
  adicionarJogoPersonalizado,
  removerJogo,
  jogosSelecionados,
} from "../src/js/catalog.js";

// --- Geradores customizados ---------------------------------------------

// Gera uma lista de jogos com nomes mutuamente distintos (ignorando caixa e
// espaços das extremidades) e ids únicos. Isso evita colisões acidentais que
// atrapalhariam as checagens de duplicidade.
const arbJogos = fc
  .array(
    fc.record({
      nomeBase: fc
        .string({ minLength: 1, maxLength: 56 })
        .filter((s) => s.trim().length >= 1),
      selecionado: fc.boolean(),
      personalizado: fc.boolean(),
      valorPontuacao: fc.integer({ min: 1, max: 1000 }),
    }),
    { minLength: 0, maxLength: 8 }
  )
  .map((registros) => {
    const vistos = new Set();
    const jogos = [];
    registros.forEach((r, i) => {
      const base = r.nomeBase.trim();
      const chave = base.toLocaleLowerCase();
      if (vistos.has(chave)) {
        return; // descarta nomes equivalentes para manter unicidade
      }
      vistos.add(chave);
      jogos.push({
        id: `jogo-${i}-${chave.slice(0, 10)}`,
        nome: base,
        selecionado: r.selecionado,
        personalizado: r.personalizado,
        valorPontuacao: r.valorPontuacao,
      });
    });
    return jogos;
  });

// Gera uma Sessao arbitrária com um catálogo coerente.
const arbSessao = arbJogos.map((jogos) => ({
  versao: 1,
  etapa: "jogos",
  jogos,
  jogadores: [],
  registros: [],
  resultado: { apurado: false, vencedores: [], empate: false, classificacao: [] },
}));

// Conjunto de nomes selecionados (chaves normalizadas) de uma Sessao.
function chavesSelecionadas(sessao) {
  return new Set(
    jogosSelecionados(sessao).map((j) => j.nome.trim().toLocaleLowerCase())
  );
}

// --- Property 1 (task 4.2) ----------------------------------------------
// Feature: board-game-scoreboard, Property 1
describe("Property 1: Alternância de seleção é um round trip (R1.2, R1.3)", () => {
  it("alternar duas vezes restaura o estado; alternar uma vez inverte", () => {
    fc.assert(
      fc.property(
        // Sessao com ao menos um jogo, para que haja um id a alternar.
        arbSessao.filter((s) => s.jogos.length >= 1),
        fc.nat(),
        (sessao, indice) => {
          const alvo = sessao.jogos[indice % sessao.jogos.length];
          const estadoOriginal = alvo.selecionado;

          const umaVez = alternarSelecao(sessao, alvo.id);
          const alvoUmaVez = umaVez.jogos.find((j) => j.id === alvo.id);
          // Uma aplicação inverte o estado de seleção do jogo alvo.
          expect(alvoUmaVez.selecionado).toBe(!estadoOriginal);

          const duasVezes = alternarSelecao(umaVez, alvo.id);
          const alvoDuasVezes = duasVezes.jogos.find((j) => j.id === alvo.id);
          // Duas aplicações restauram o estado original.
          expect(alvoDuasVezes.selecionado).toBe(estadoOriginal);

          // A Sessao original não foi mutada.
          expect(alvo.selecionado).toBe(estadoOriginal);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// --- Property 4 (task 4.3) ----------------------------------------------
// Feature: board-game-scoreboard, Property 4
describe("Property 4: Nome de jogo válido é aceito com trim aplicado (R2.2)", () => {
  it("nome válido (1..60 após trim) e não duplicado é adicionado sem espaços das extremidades", () => {
    fc.assert(
      fc.property(
        arbSessao,
        // Nome com miolo de 1..60 caracteres, cercado por espaços arbitrários.
        fc.record({
          miolo: fc
            .string({ minLength: 1, maxLength: 60 })
            .filter((s) => {
              const t = s.trim();
              return t.length >= 1 && t.length <= 60;
            }),
          esqParc: fc.stringOf(fc.constantFrom(" ", "\t"), { maxLength: 4 }),
          dirParc: fc.stringOf(fc.constantFrom(" ", "\t"), { maxLength: 4 }),
        }),
        (sessao, { miolo, esqParc, dirParc }) => {
          const esperado = miolo.trim();
          // Pula casos em que o nome colide com um jogo já no catálogo.
          const colide = sessao.jogos.some(
            (j) => j.nome.trim().toLocaleLowerCase() === esperado.toLocaleLowerCase()
          );
          fc.pre(!colide);

          const nomeBruto = `${esqParc}${miolo}${dirParc}`;
          const resultado = adicionarJogoPersonalizado(sessao, nomeBruto);

          expect(resultado.ok).toBe(true);
          const adicionado = resultado.sessao.jogos.find((j) => j.nome === esperado);
          expect(adicionado).toBeDefined();
          // Nome gravado sem espaços das extremidades.
          expect(adicionado.nome).toBe(esperado);
          // Jogo personalizado entra já selecionado.
          expect(adicionado.selecionado).toBe(true);
          expect(adicionado.personalizado).toBe(true);
          // A Sessao original não foi mutada.
          expect(sessao.jogos.find((j) => j.id === adicionado.id)).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });
});

// --- Property 5 (task 4.4) ----------------------------------------------
// Feature: board-game-scoreboard, Property 5
describe("Property 5: Nome de jogo com tamanho inválido é rejeitado sem efeito colateral (R2.3)", () => {
  it("nome vazio após trim ou com mais de 60 caracteres é rejeitado e os selecionados ficam inalterados", () => {
    fc.assert(
      fc.property(
        arbSessao,
        // Alterna entre nomes vazios (só espaços) e nomes com trim > 60.
        fc.oneof(
          fc.stringOf(fc.constantFrom(" ", "\t", "\n"), { maxLength: 10 }),
          fc
            .string({ minLength: 61, maxLength: 120 })
            .filter((s) => s.trim().length > 60)
        ),
        (sessao, nomeBruto) => {
          const antes = chavesSelecionadas(sessao);
          const qtdAntes = sessao.jogos.length;

          const resultado = adicionarJogoPersonalizado(sessao, nomeBruto);

          // Adição rejeitada com mensagem de erro.
          expect(resultado.ok).toBe(false);
          expect(typeof resultado.erro).toBe("string");

          // Conjunto de Jogos_Selecionados inalterado.
          const depois = chavesSelecionadas(resultado.sessao);
          expect(depois).toEqual(antes);
          // Nenhum jogo foi acrescentado ao catálogo.
          expect(resultado.sessao.jogos.length).toBe(qtdAntes);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// --- Property 6 (task 4.5) ----------------------------------------------
// Feature: board-game-scoreboard, Property 6
describe("Property 6: Jogo duplicado é rejeitado ignorando caixa e espaços (R2.4)", () => {
  it("variação de caixa/espaços de um jogo já presente é rejeitada e o conjunto fica inalterado", () => {
    fc.assert(
      fc.property(
        // Sessao com ao menos um jogo no catálogo para duplicar.
        arbSessao.filter((s) => s.jogos.length >= 1),
        fc.nat(),
        fc.record({
          esq: fc.stringOf(fc.constantFrom(" ", "\t"), { maxLength: 4 }),
          dir: fc.stringOf(fc.constantFrom(" ", "\t"), { maxLength: 4 }),
          caixaAlta: fc.boolean(),
        }),
        (sessao, indice, { esq, dir, caixaAlta }) => {
          const alvo = sessao.jogos[indice % sessao.jogos.length];
          const base = alvo.nome.trim();
          const variacao = `${esq}${caixaAlta ? base.toLocaleUpperCase() : base.toLocaleLowerCase()}${dir}`;

          const antes = chavesSelecionadas(sessao);
          const qtdAntes = sessao.jogos.length;

          const resultado = adicionarJogoPersonalizado(sessao, variacao);

          // Rejeitado por duplicidade.
          expect(resultado.ok).toBe(false);
          expect(resultado.erro).toBe("That game is already on the list.");

          // Conjunto de jogos e de selecionados inalterado.
          expect(resultado.sessao.jogos.length).toBe(qtdAntes);
          expect(chavesSelecionadas(resultado.sessao)).toEqual(antes);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// --- Property 7 (task 4.6) ----------------------------------------------
// Feature: board-game-scoreboard, Property 7
describe("Property 7: Remoção retira o jogo dos selecionados (R2.5)", () => {
  it("após removerJogo em um jogo personalizado selecionado, ele some dos Jogos_Selecionados", () => {
    fc.assert(
      fc.property(
        arbSessao,
        fc
          .string({ minLength: 1, maxLength: 60 })
          .filter((s) => s.trim().length >= 1 && s.trim().length <= 60),
        (sessaoBase, nomeNovo) => {
          // Garante que o nome novo não colide com o catálogo existente.
          const alvoNome = nomeNovo.trim();
          const colide = sessaoBase.jogos.some(
            (j) => j.nome.trim().toLocaleLowerCase() === alvoNome.toLocaleLowerCase()
          );
          fc.pre(!colide);

          // Primeiro adiciona um jogo personalizado (nasce selecionado).
          const add = adicionarJogoPersonalizado(sessaoBase, nomeNovo);
          expect(add.ok).toBe(true);
          const adicionado = add.sessao.jogos.find((j) => j.nome === alvoNome);
          expect(adicionado).toBeDefined();

          // Confirma que ele está entre os selecionados antes da remoção.
          const idsSelecionadosAntes = jogosSelecionados(add.sessao).map((j) => j.id);
          expect(idsSelecionadosAntes).toContain(adicionado.id);

          // Agora remove-o.
          const removida = removerJogo(add.sessao, adicionado.id);
          const idsSelecionadosDepois = jogosSelecionados(removida).map((j) => j.id);

          // O jogo removido não aparece mais entre os Jogos_Selecionados.
          expect(idsSelecionadosDepois).not.toContain(adicionado.id);
          // E saiu do catálogo por completo.
          expect(removida.jogos.find((j) => j.id === adicionado.id)).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Sanidade: o catálogo padrão tem no mínimo 6 jogos (R1.1), base das Sessões.
describe("CATALOGO_PADRAO", () => {
  it("possui no mínimo 6 jogos pré-definidos", () => {
    expect(CATALOGO_PADRAO.length).toBeGreaterThanOrEqual(6);
  });
});
