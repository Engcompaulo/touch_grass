// Testes de propriedade do controle das seis etapas (flow.js).
//
// Property 2 (tarefa 13.2): Avanço exige ao menos um jogo selecionado.
//   Para uma Sessao na etapa "jogos" sem nenhum Jogo_Selecionado, avancar
//   retorna ok=false e mantém a etapa inalterada. Valida R1.4.
//
// Property 26 (tarefa 13.3): A navegação percorre as etapas em passos unitários
//   dentro dos limites. Para qualquer sequência válida de operações
//   avancar/voltar, a etapa resultante permanece entre as seis etapas, muda no
//   máximo uma posição por operação e nunca ultrapassa a primeira nem a última.
//   Valida R10.2.

import { describe, it } from "vitest";
import fc from "fast-check";
import { ETAPAS, etapaAtual, avancar, voltar } from "../src/js/flow.js";

// Gera um nome não vazio e estável.
const arbNome = fc.string({ minLength: 1, maxLength: 20 });

// Gera um identificador estável.
const arbId = fc.string({ minLength: 1, maxLength: 12 }).map((s) => `id-${s}`);

// Gera um Jogo coerente com o modelo do design, com seleção parametrizável.
function arbJogo(selecionado) {
  return fc.record({
    id: arbId,
    nome: arbNome,
    selecionado: fc.constant(selecionado),
    personalizado: fc.boolean(),
    valorPontuacao: fc.integer({ min: 1, max: 1000 }),
  });
}

// Gera um Jogador coerente com o modelo do design.
const arbJogador = fc.record({ id: arbId, nome: arbNome });

// Gera uma lista de jogos SEM nenhum selecionado (todos com selecionado=false).
const arbJogosNenhumSelecionado = fc.array(arbJogo(false), { maxLength: 8 });

describe("flow.js — avanço exige ao menos um jogo selecionado (Property 2)", () => {
  // Feature: board-game-scoreboard, Property 2
  it("na etapa 'jogos' sem jogos selecionados, avancar falha e preserva a etapa", () => {
    fc.assert(
      fc.property(arbJogosNenhumSelecionado, (jogos) => {
        const sessao = {
          versao: 1,
          etapa: "jogos",
          jogos,
          jogadores: [],
          registros: [],
          resultado: {
            apurado: false,
            vencedores: [],
            empate: false,
            classificacao: [],
          },
        };

        const resultado = avancar(sessao);

        // R1.4: sem Jogos_Selecionados o avanço é bloqueado.
        if (resultado.ok !== false) {
          return false;
        }
        // A etapa permanece "jogos" (inalterada) na Sessao devolvida.
        if (etapaAtual(resultado.sessao) !== "jogos") {
          return false;
        }
        // A Sessao original também permanece na etapa "jogos".
        return etapaAtual(sessao) === "jogos";
      }),
      { numRuns: 100 }
    );
  });
});

// Monta uma Sessao que satisfaz TODAS as pré-condições de avanço:
//  - ao menos 1 jogo selecionado (R1.4);
//  - ao menos 4 jogadores (R3.4).
// Assim, uma sequência de avancar/voltar pode percorrer livremente as etapas.
function montarSessaoNavegavel(etapa, jogos, jogadores) {
  return {
    versao: 1,
    etapa,
    jogos,
    jogadores,
    registros: [],
    resultado: {
      apurado: false,
      vencedores: [],
      empate: false,
      classificacao: [],
    },
  };
}

// Jogos com pelo menos um selecionado.
const arbJogosComSelecionado = fc
  .tuple(arbJogo(true), fc.array(arbJogo(false), { maxLength: 7 }))
  .map(([selecionado, resto]) => [selecionado, ...resto]);

// De 4 a 20 jogadores (satisfaz o mínimo de prosseguir).
const arbJogadoresSuficientes = fc.array(arbJogador, {
  minLength: 4,
  maxLength: 20,
});

// Operações de navegação.
const arbOperacoes = fc.array(fc.constantFrom("avancar", "voltar"), {
  minLength: 1,
  maxLength: 30,
});

describe("flow.js — navegação em passos unitários dentro dos limites (Property 26)", () => {
  // Feature: board-game-scoreboard, Property 26
  it("cada operação muda a etapa em no máximo uma posição e nunca sai dos limites", () => {
    fc.assert(
      fc.property(
        arbJogosComSelecionado,
        arbJogadoresSuficientes,
        fc.constantFrom(...ETAPAS),
        arbOperacoes,
        (jogos, jogadores, etapaInicial, operacoes) => {
          let sessao = montarSessaoNavegavel(etapaInicial, jogos, jogadores);

          const ultimo = ETAPAS.length - 1;

          for (const op of operacoes) {
            const indiceAntes = ETAPAS.indexOf(etapaAtual(sessao));

            if (op === "avancar") {
              const resultado = avancar(sessao);
              sessao = resultado.sessao;
            } else {
              sessao = voltar(sessao);
            }

            const indiceDepois = ETAPAS.indexOf(etapaAtual(sessao));

            // A etapa resultante é sempre uma das seis etapas conhecidas.
            if (indiceDepois < 0 || indiceDepois > ultimo) {
              return false;
            }

            // Muda no máximo uma posição por operação (passo unitário).
            if (Math.abs(indiceDepois - indiceAntes) > 1) {
              return false;
            }

            // Nunca ultrapassa a primeira nem a última etapa.
            if (indiceDepois < 0 || indiceDepois > ultimo) {
              return false;
            }
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
