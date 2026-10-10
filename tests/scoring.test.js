// Testes de propriedade do módulo scoring.js (R4 — pontuação por jogo).
//
// Cada propriedade do design corresponde a exatamente um teste de propriedade
// fast-check com no mínimo 100 iterações. As propriedades aqui cobrem:
//   - Property 13 (tarefa 6.2): definir e ler o valor é consistente (R4.2)
//   - Property 14 (tarefa 6.3): valor de pontuação padrão é 1 (R4.3)
//   - Property 15 (tarefa 6.4): valor inválido é rejeitado preservando o
//     anterior (R4.4)
// Conteúdo e comentários em português do Brasil.

import { describe, it, expect } from "vitest";
import fc from "fast-check";

import {
  VALOR_PONTUACAO_PADRAO,
  definirValorPontuacao,
  valorVigente,
} from "../src/js/scoring.js";

// Gerador de id de jogo (slug simples, não vazio).
const arbJogoId = fc
  .string({ minLength: 1, maxLength: 12 })
  .filter((s) => s.trim().length > 0)
  .map((s) => `jogo-${encodeURIComponent(s)}`);

// Gerador de valor de pontuação válido (inteiro de 1 a 1000 inclusive).
const arbValorPontuacao = fc.integer({ min: 1, max: 1000 });

// Monta uma Sessao mínima com uma lista de jogos. Os jogos nascem sem a
// propriedade valorPontuacao definida, salvo quando informado, para exercitar
// tanto o caminho do padrão quanto o do valor explícito.
function sessaoComJogos(jogos) {
  return {
    versao: 1,
    etapa: "pontuacao",
    jogos,
    jogadores: [],
    registros: [],
    resultado: { apurado: false, vencedores: [], empate: false, classificacao: [] },
  };
}

describe("scoring.js — propriedades de pontuação por jogo", () => {
  // Feature: board-game-scoreboard, Property 13
  it("Property 13: definir e ler o valor de pontuação é consistente (R4.2)", () => {
    fc.assert(
      fc.property(arbJogoId, arbValorPontuacao, (jogoId, valor) => {
        // Sessao com um Jogo_Selecionado ainda sem valor definido.
        const sessao = sessaoComJogos([
          { id: jogoId, nome: "Jogo", selecionado: true, personalizado: false },
        ]);

        const resultado = definirValorPontuacao(sessao, jogoId, valor);

        // A definição com inteiro de 1..1000 deve ter sucesso...
        expect(resultado.ok).toBe(true);
        // ...e o valor vigente deve ser exatamente o valor definido.
        expect(valorVigente(resultado.sessao, jogoId)).toBe(valor);
      }),
      { numRuns: 100 }
    );
  });

  // Feature: board-game-scoreboard, Property 14
  it("Property 14: valor de pontuação padrão é 1 (R4.3)", () => {
    fc.assert(
      fc.property(arbJogoId, (jogoId) => {
        // Jogo_Selecionado sem nenhum Valor_Pontuacao associado.
        const sessao = sessaoComJogos([
          { id: jogoId, nome: "Jogo", selecionado: true, personalizado: false },
        ]);

        // Na ausência de valor definido, o vigente é o padrão (1).
        expect(valorVigente(sessao, jogoId)).toBe(VALOR_PONTUACAO_PADRAO);
        expect(valorVigente(sessao, jogoId)).toBe(1);
      }),
      { numRuns: 100 }
    );
  });

  // Feature: board-game-scoreboard, Property 15
  it("Property 15: valor inválido é rejeitado preservando o anterior (R4.4)", () => {
    // Gera valores genuinamente inválidos: não inteiros, inteiros < 1 ou > 1000.
    const arbValorInvalido = fc.oneof(
      // Floats não inteiros (dentro e fora da faixa).
      fc
        .double({ min: -2000, max: 2000, noNaN: true })
        .filter((n) => !Number.isInteger(n)),
      // Inteiros abaixdo do mínimo (<= 0).
      fc.integer({ min: -5000, max: 0 }),
      // Inteiros acima do máximo (> 1000).
      fc.integer({ min: 1001, max: 100000 }),
      // Tipos inesperados que não representam inteiros de 1..1000.
      fc.constantFrom(NaN, Infinity, -Infinity, null, undefined, true, false, "abc", "", "1.5", {}, [])
    );

    fc.assert(
      fc.property(
        arbJogoId,
        arbValorPontuacao,
        arbValorInvalido,
        (jogoId, valorAnterior, valorInvalido) => {
          // Jogo já com um valor válido previamente associado.
          const sessao = sessaoComJogos([
            {
              id: jogoId,
              nome: "Jogo",
              selecionado: true,
              personalizado: false,
              valorPontuacao: valorAnterior,
            },
          ]);

          const resultado = definirValorPontuacao(sessao, jogoId, valorInvalido);

          // A alteração inválida deve ser rejeitada...
          expect(resultado.ok).toBe(false);
          // ...e o valor anterior deve ser preservado.
          expect(valorVigente(resultado.sessao, jogoId)).toBe(valorAnterior);
        }
      ),
      { numRuns: 100 }
    );
  });
});
