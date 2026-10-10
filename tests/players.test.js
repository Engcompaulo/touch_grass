// Testes de propriedade para o módulo de cadastro de jogadores (players.js).
//
// Cobrem as Correctness Properties 8 a 12 do design (tarefas 5.2 a 5.6).
// Cada propriedade é implementada por um único teste fast-check com no mínimo
// 100 iterações, usando geradores customizados que restringem o espaço de
// entrada de forma inteligente.
//
// Framework: Vitest + fast-check (conforme a Testing Strategy do design).

import { describe, it, expect } from "vitest";
import fc from "fast-check";

import {
  adicionarJogador,
  removerJogador,
  podeProsseguir,
  LIMITE_JOGADORES,
  MINIMO_JOGADORES,
} from "../src/js/players.js";

import { normalizarNome, nomesEquivalentes } from "../src/js/validation.js";

// ---------------------------------------------------------------------------
// Geradores customizados
// ---------------------------------------------------------------------------

// Nome cujo conteúdo APÓS trim tem de 1 a 40 caracteres e não é composto só de
// espaços. Garantimos isso gerando um núcleo visível (sem espaços nas pontas)
// e, opcionalmente, cercando-o de espaços das extremidades.
const arbNomeValido = fc
  .tuple(
    // Núcleo: 1..40 caracteres cujo primeiro e último caractere não são espaço.
    fc
      .string({ minLength: 1, maxLength: 40 })
      .map((s) => s.replace(/\s/g, "x"))
      .filter((s) => s.trim().length >= 1 && s.trim().length <= 40),
    // Espaços à esquerda e à direita (das extremidades).
    fc.stringMatching(/^ {0,5}$/),
    fc.stringMatching(/^ {0,5}$/)
  )
  .map(([nucleo, esq, dir]) => `${esq}${nucleo}${dir}`)
  .filter((valor) => {
    const t = valor.trim();
    return t.length >= 1 && t.length <= 40;
  });

// Jogador já cadastrado (id + nome não vazio após trim).
const arbJogador = fc.record({
  id: fc.uuid(),
  nome: arbNomeValido.map((v) => v.trim()),
});

// Lista de jogadores com nomes distintos (sob a equivalência caixa/espaços),
// de tamanho controlado. Evita colisões acidentais no estado base.
function listaJogadoresDistintos(minLength, maxLength) {
  return fc
    .array(arbJogador, { minLength, maxLength })
    .map((jogadores) => {
      const vistos = [];
      const resultado = [];
      for (const j of jogadores) {
        if (!vistos.some((n) => nomesEquivalentes(n, j.nome))) {
          vistos.push(j.nome);
          resultado.push(j);
        }
      }
      // Garante ids únicos atribuindo um índice determinístico.
      return resultado.map((j, i) => ({ ...j, id: `base-${i}-${j.id}` }));
    });
}

// Sessao mínima a partir de uma lista de jogadores e registros.
function criarSessaoBase(jogadores, registros = []) {
  return {
    versao: 1,
    etapa: "jogadores",
    jogos: [],
    jogadores,
    registros,
    resultado: { apurado: false, vencedores: [], empate: false, classificacao: [] },
  };
}

// Variação de um nome que difere apenas em caixa e espaços das extremidades.
function arbVariacaoEquivalente(nome) {
  return fc
    .tuple(
      fc.stringMatching(/^ {0,5}$/),
      fc.stringMatching(/^ {0,5}$/),
      fc.array(fc.boolean(), { minLength: nome.length, maxLength: nome.length })
    )
    .map(([esq, dir, caixas]) => {
      let corpo = "";
      for (let i = 0; i < nome.length; i++) {
        const ch = nome[i];
        corpo += caixas[i] ? ch.toLocaleUpperCase() : ch.toLocaleLowerCase();
      }
      return `${esq}${corpo}${dir}`;
    });
}

// ---------------------------------------------------------------------------
// Property 8 (tarefa 5.2) — Nome de jogador válido é aceito com trim aplicado.
// ---------------------------------------------------------------------------
describe("players — Property 8: nome válido é aceito com trim", () => {
  // Feature: board-game-scoreboard, Property 8
  it("adiciona o jogador com o nome sem espaços das extremidades quando o nome é válido, há vaga e não é duplicado", () => {
    fc.assert(
      fc.property(
        // Base com menos de 20 jogadores para garantir vaga.
        listaJogadoresDistintos(0, LIMITE_JOGADORES - 1),
        arbNomeValido,
        (jogadoresBase, nomeBruto) => {
          const nomeEsperado = normalizarNome(nomeBruto);

          // Pré-condição: o novo nome não pode coincidir com um já existente.
          fc.pre(
            !jogadoresBase.some((j) => nomesEquivalentes(j.nome, nomeEsperado))
          );

          const sessao = criarSessaoBase(jogadoresBase);
          const resultado = adicionarJogador(sessao, nomeBruto);

          expect(resultado.ok).toBe(true);
          // A lista cresceu em exatamente um jogador.
          expect(resultado.sessao.jogadores.length).toBe(
            jogadoresBase.length + 1
          );
          // O jogador incluído tem o nome com trim aplicado.
          const incluido =
            resultado.sessao.jogadores[resultado.sessao.jogadores.length - 1];
          expect(incluido.nome).toBe(nomeEsperado);
          // A Sessao original não foi mutada.
          expect(sessao.jogadores.length).toBe(jogadoresBase.length);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 9 (tarefa 5.3) — Nome de tamanho inválido é rejeitado sem efeito.
// ---------------------------------------------------------------------------
describe("players — Property 9: nome de tamanho inválido é rejeitado", () => {
  // Gera nomes cujo conteúdo após trim é vazio (0) ou maior que 40.
  const arbNomeInvalido = fc.oneof(
    // Vazio após trim: só espaços (ou string vazia).
    fc.stringMatching(/^ {0,10}$/),
    // Mais de 40 caracteres após trim: núcleo de 41..80 sem espaços nas pontas.
    fc
      .string({ minLength: 41, maxLength: 80 })
      .map((s) => s.replace(/\s/g, "x"))
      .filter((s) => s.trim().length > 40)
  );

  // Feature: board-game-scoreboard, Property 9
  it("rejeita a adição e mantém a lista de jogadores inalterada", () => {
    fc.assert(
      fc.property(
        listaJogadoresDistintos(0, LIMITE_JOGADORES - 1),
        arbNomeInvalido,
        (jogadoresBase, nomeBruto) => {
          const t = normalizarNome(nomeBruto);
          // Garante que o nome é de fato inválido por tamanho.
          fc.pre(t.length < 1 || t.length > 40);

          const sessao = criarSessaoBase(jogadoresBase);
          const antes = sessao.jogadores.slice();
          const resultado = adicionarJogador(sessao, nomeBruto);

          expect(resultado.ok).toBe(false);
          // Lista inalterada em quantidade e conteúdo.
          expect(resultado.sessao.jogadores).toEqual(antes);
          expect(sessao.jogadores).toEqual(antes);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 10 (tarefa 5.4) — Jogador duplicado é rejeitado (caixa/espaços).
// ---------------------------------------------------------------------------
describe("players — Property 10: jogador duplicado é rejeitado", () => {
  // Feature: board-game-scoreboard, Property 10
  it("rejeita variação que difere apenas em caixa e espaços das extremidades e mantém a lista inalterada", () => {
    fc.assert(
      fc.property(
        // Pelo menos 1 jogador na base, com vaga para o teste de duplicata.
        listaJogadoresDistintos(1, LIMITE_JOGADORES - 1),
        fc.nat(),
        (jogadoresBase, indiceBruto) => {
          const alvo =
            jogadoresBase[indiceBruto % jogadoresBase.length];

          return fc.assert(
            fc.property(arbVariacaoEquivalente(alvo.nome), (variacao) => {
              // Confirma que a variação é equivalente ao nome do alvo.
              fc.pre(nomesEquivalentes(variacao, alvo.nome));

              const sessao = criarSessaoBase(jogadoresBase);
              const antes = sessao.jogadores.slice();
              const resultado = adicionarJogador(sessao, variacao);

              expect(resultado.ok).toBe(false);
              expect(resultado.sessao.jogadores).toEqual(antes);
              expect(sessao.jogadores).toEqual(antes);
            }),
            { numRuns: 5 }
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 11 (tarefa 5.5) — podeProsseguir ⇔ 4..20 jogadores.
// ---------------------------------------------------------------------------
describe("players — Property 11: podeProsseguir equivale ao intervalo", () => {
  // Feature: board-game-scoreboard, Property 11
  it("retorna verdadeiro se e somente se a quantidade de jogadores está entre 4 e 20 inclusive", () => {
    fc.assert(
      fc.property(
        // Cobre quantidades de 0 até além do limite para exercitar ambos os lados.
        fc.integer({ min: 0, max: LIMITE_JOGADORES + 5 }),
        (quantidade) => {
          const jogadores = Array.from({ length: quantidade }, (_, i) => ({
            id: `j-${i}`,
            nome: `Jogador ${i}`,
          }));
          const sessao = criarSessaoBase(jogadores);

          const esperado =
            quantidade >= MINIMO_JOGADORES && quantidade <= LIMITE_JOGADORES;
          expect(podeProsseguir(sessao)).toBe(esperado);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 12 (tarefa 5.6) — remoção permitida sse e somente se sem registros.
// ---------------------------------------------------------------------------
describe("players — Property 12: remoção condicionada à ausência de pontos", () => {
  // Feature: board-game-scoreboard, Property 12
  it("remove o jogador se e somente se não há registro associado; caso contrário falha e mantém a lista", () => {
    fc.assert(
      fc.property(
        listaJogadoresDistintos(1, LIMITE_JOGADORES),
        fc.nat(),
        // Decide quais jogadores terão registros associados.
        fc.array(fc.boolean(), { minLength: 1, maxLength: LIMITE_JOGADORES }),
        (jogadoresBase, indiceBruto, flagsRegistro) => {
          const alvo = jogadoresBase[indiceBruto % jogadoresBase.length];

          // Monta registros para os jogadores marcados em flagsRegistro.
          const registros = [];
          let ordem = 0;
          jogadoresBase.forEach((j, i) => {
            if (flagsRegistro[i % flagsRegistro.length]) {
              registros.push({
                id: `r-${i}`,
                jogoId: "jogo-x",
                jogadorId: j.id,
                pontos: 1,
                ordem: ordem++,
                timestamp: 0,
              });
            }
          });

          const sessao = criarSessaoBase(jogadoresBase, registros);
          const antes = sessao.jogadores.slice();
          const alvoTemRegistro = registros.some(
            (r) => r.jogadorId === alvo.id
          );

          const resultado = removerJogador(sessao, alvo.id);

          if (alvoTemRegistro) {
            // Falha e lista inalterada.
            expect(resultado.ok).toBe(false);
            expect(resultado.sessao.jogadores).toEqual(antes);
          } else {
            // Sucesso: o jogador alvo não aparece mais; os demais permanecem.
            expect(resultado.ok).toBe(true);
            expect(
              resultado.sessao.jogadores.some((j) => j.id === alvo.id)
            ).toBe(false);
            expect(resultado.sessao.jogadores.length).toBe(antes.length - 1);
          }
          // A Sessao original nunca é mutada.
          expect(sessao.jogadores).toEqual(antes);
        }
      ),
      { numRuns: 100 }
    );
  });
});
