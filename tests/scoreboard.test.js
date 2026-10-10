// Testes de propriedade do módulo scoreboard.js (R6 — registro, undo e
// classificação) e da imutabilidade dos registros (R4.5).
//
// Cada propriedade do design corresponde a exatamente um teste de propriedade
// fast-check com no mínimo 100 iterações. As propriedades aqui cobrem:
//   - Property 20 (tarefa 8.2): registrar soma o valor vigente ao vencedor (R6.1)
//   - Property 21 (tarefa 8.3): a classificação é ordenada por total
//     decrescente e nome crescente em empates (R6.2)
//   - Property 22 (tarefa 8.4): registro sem jogo ou sem vencedor é rejeitado
//     sem efeito colateral (R6.3)
//   - Property 23 (tarefa 8.5): registrar e desfazer é um round trip (R6.4)
//   - Property 16 (tarefa 8.6): alterar o valor de pontuação não afeta
//     registros anteriores (R4.5)
// Conteúdo e comentários em português do Brasil.

import { describe, it, expect } from "vitest";
import fc from "fast-check";

import {
  registrarPartida,
  desfazerUltimo,
  totaisPorJogador,
  ordenarClassificacao,
} from "../src/js/scoreboard.js";
import { definirValorPontuacao, valorVigente } from "../src/js/scoring.js";

// Gerador de nome não vazio (após trim), curto e estável.
const arbNome = fc
  .string({ minLength: 1, maxLength: 12 })
  .map((s) => s.trim())
  .filter((s) => s.length > 0);

// Gerador de valor de pontuação válido (inteiro de 1 a 1000 inclusive).
const arbValorPontuacao = fc.integer({ min: 1, max: 1000 });

// Gera uma lista de jogos selecionados, cada um com id único e um
// valorPontuacao válido. Entre 1 e 5 jogos.
const arbJogos = fc
  .array(arbValorPontuacao, { minLength: 1, maxLength: 5 })
  .map((valores) =>
    valores.map((valor, i) => ({
      id: `jogo-${i}`,
      nome: `Jogo ${i}`,
      selecionado: true,
      personalizado: false,
      valorPontuacao: valor,
    }))
  );

// Gera uma lista de jogadores com id único e nome. Entre 1 e 6 jogadores.
const arbJogadores = fc
  .array(arbNome, { minLength: 1, maxLength: 6 })
  .map((nomes) =>
    nomes.map((nome, i) => ({ id: `jogador-${i}`, nome: `${nome}-${i}` }))
  );

// Monta uma Sessao válida com jogos selecionados (com valorPontuacao) e
// jogadores, sem registros iniciais.
function sessaoBase(jogos, jogadores) {
  return {
    versao: 1,
    etapa: "registro",
    jogos,
    jogadores,
    registros: [],
    resultado: { apurado: false, vencedores: [], empate: false, classificacao: [] },
  };
}

// Gerador de uma Sessao válida (jogos selecionados + jogadores).
const arbSessao = fc
  .tuple(arbJogos, arbJogadores)
  .map(([jogos, jogadores]) => sessaoBase(jogos, jogadores));

// Mapa auxiliar: total por jogadorId a partir dos totaisPorJogador.
function totalPorIdDe(sessao) {
  const mapa = new Map();
  for (const t of totaisPorJogador(sessao)) {
    mapa.set(t.jogadorId, t.total);
  }
  return mapa;
}

describe("scoreboard.js — propriedades de registro e classificação", () => {
  // Feature: board-game-scoreboard, Property 20
  it("Property 20: registrar uma partida soma o valor vigente ao vencedor (R6.1)", () => {
    fc.assert(
      fc.property(
        arbSessao,
        fc.nat(),
        fc.nat(),
        (sessao, iJogo, iJogador) => {
          const jogo = sessao.jogos[iJogo % sessao.jogos.length];
          const jogador = sessao.jogadores[iJogador % sessao.jogadores.length];

          const totaisAntes = totalPorIdDe(sessao);
          const esperado = valorVigente(sessao, jogo.id);

          const resultado = registrarPartida(sessao, jogo.id, jogador.id);
          expect(resultado.ok).toBe(true);

          const totaisDepois = totalPorIdDe(resultado.sessao);

          // O total do vencedor cresce exatamente pelo valor vigente.
          expect(totaisDepois.get(jogador.id)).toBe(
            (totaisAntes.get(jogador.id) || 0) + esperado
          );

          // Os demais jogadores permanecem inalterados.
          for (const outro of sessao.jogadores) {
            if (outro.id === jogador.id) continue;
            expect(totaisDepois.get(outro.id)).toBe(totaisAntes.get(outro.id) || 0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: board-game-scoreboard, Property 21
  it("Property 21: a classificação é ordenada por total decrescente e nome crescente em empates (R6.2)", () => {
    fc.assert(
      fc.property(
        arbSessao,
        fc.array(fc.tuple(fc.nat(), fc.nat()), { minLength: 0, maxLength: 15 }),
        (sessaoInicial, partidas) => {
          // Registra uma sequência arbitrária de partidas.
          let sessao = sessaoInicial;
          for (const [iJogo, iJogador] of partidas) {
            const jogo = sessao.jogos[iJogo % sessao.jogos.length];
            const jogador = sessao.jogadores[iJogador % sessao.jogadores.length];
            const r = registrarPartida(sessao, jogo.id, jogador.id);
            sessao = r.sessao;
          }

          const classificacao = ordenarClassificacao(totaisPorJogador(sessao));

          // Verifica a ordem para cada par consecutivo.
          for (let i = 0; i + 1 < classificacao.length; i += 1) {
            const atual = classificacao[i];
            const proximo = classificacao[i + 1];
            // Total não crescente.
            expect(atual.total).toBeGreaterThanOrEqual(proximo.total);
            // Em empate de total, nome em ordem alfabética ascendente.
            if (atual.total === proximo.total) {
              const cmp = atual.nome.localeCompare(proximo.nome, "pt", {
                sensitivity: "base",
              });
              expect(cmp).toBeLessThanOrEqual(0);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: board-game-scoreboard, Property 22
  it("Property 22: registro sem jogo ou sem vencedor é rejeitado sem efeito colateral (R6.3)", () => {
    // Ids que garantidamente não existem na Sessao.
    const arbIdInexistente = fc.oneof(
      fc.constantFrom(null, undefined, ""),
      fc
        .string({ maxLength: 10 })
        .map((s) => `inexistente-${encodeURIComponent(s)}`)
    );

    fc.assert(
      fc.property(
        arbSessao,
        fc.nat(),
        fc.nat(),
        arbIdInexistente,
        arbIdInexistente,
        (sessao, iJogo, iJogador, jogoRuim, jogadorRuim) => {
          const jogoBom = sessao.jogos[iJogo % sessao.jogos.length];
          const jogadorBom = sessao.jogadores[iJogador % sessao.jogadores.length];
          const registrosAntes = sessao.registros;

          // Caso 1: jogo ausente/inválido, jogador válido.
          const r1 = registrarPartida(sessao, jogoRuim, jogadorBom.id);
          expect(r1.ok).toBe(false);
          expect(r1.sessao.registros).toBe(registrosAntes);

          // Caso 2: jogo válido, jogador ausente/inválido.
          const r2 = registrarPartida(sessao, jogoBom.id, jogadorRuim);
          expect(r2.ok).toBe(false);
          expect(r2.sessao.registros).toBe(registrosAntes);

          // Caso 3: ambos ausentes/inválidos.
          const r3 = registrarPartida(sessao, jogoRuim, jogadorRuim);
          expect(r3.ok).toBe(false);
          expect(r3.sessao.registros).toBe(registrosAntes);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: board-game-scoreboard, Property 23
  it("Property 23: registrar e desfazer é um round trip (R6.4)", () => {
    fc.assert(
      fc.property(
        arbSessao,
        fc.array(fc.tuple(fc.nat(), fc.nat()), { minLength: 0, maxLength: 10 }),
        fc.nat(),
        fc.nat(),
        (sessaoInicial, partidasPrevias, iJogo, iJogador) => {
          // Primeiro, aplica um histórico arbitrário de partidas.
          let sessao = sessaoInicial;
          for (const [a, b] of partidasPrevias) {
            const jogo = sessao.jogos[a % sessao.jogos.length];
            const jogador = sessao.jogadores[b % sessao.jogadores.length];
            sessao = registrarPartida(sessao, jogo.id, jogador.id).sessao;
          }

          const totaisAntes = totalPorIdDe(sessao);
          const qtdAntes = sessao.registros.length;

          // Registra mais uma partida e, em seguida, desfaz.
          const jogo = sessao.jogos[iJogo % sessao.jogos.length];
          const jogador = sessao.jogadores[iJogador % sessao.jogadores.length];
          const aposRegistro = registrarPartida(sessao, jogo.id, jogador.id);
          expect(aposRegistro.ok).toBe(true);
          expect(aposRegistro.sessao.registros.length).toBe(qtdAntes + 1);

          const aposDesfazer = desfazerUltimo(aposRegistro.sessao);
          expect(aposDesfazer.ok).toBe(true);

          // A quantidade de registros volta ao valor anterior.
          expect(aposDesfazer.sessao.registros.length).toBe(qtdAntes);

          // Os totais de todos os jogadores voltam ao estado anterior.
          const totaisDepois = totalPorIdDe(aposDesfazer.sessao);
          for (const p of sessao.jogadores) {
            expect(totaisDepois.get(p.id) || 0).toBe(totaisAntes.get(p.id) || 0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: board-game-scoreboard, Property 16
  it("Property 16: alterar o valor de pontuação não afeta registros anteriores (R4.5)", () => {
    fc.assert(
      fc.property(
        arbSessao,
        fc.nat(),
        fc.nat(),
        arbValorPontuacao,
        (sessao, iJogo, iJogador, novoValor) => {
          const jogo = sessao.jogos[iJogo % sessao.jogos.length];
          const jogador = sessao.jogadores[iJogador % sessao.jogadores.length];

          // Registra uma partida com o valor vigente original.
          const valorOriginal = valorVigente(sessao, jogo.id);
          const aposRegistro = registrarPartida(sessao, jogo.id, jogador.id);
          expect(aposRegistro.ok).toBe(true);

          const totalAposRegistro = totalPorIdDe(aposRegistro.sessao).get(
            jogador.id
          );
          expect(totalAposRegistro).toBe(valorOriginal);

          // Agora altera o valor de pontuação do mesmo jogo.
          const aposAlterar = definirValorPontuacao(
            aposRegistro.sessao,
            jogo.id,
            novoValor
          );
          expect(aposAlterar.ok).toBe(true);
          expect(valorVigente(aposAlterar.sessao, jogo.id)).toBe(novoValor);

          // O registro anterior NÃO muda: o total do jogador continua igual.
          const totalAposAlterar = totalPorIdDe(aposAlterar.sessao).get(
            jogador.id
          );
          expect(totalAposAlterar).toBe(valorOriginal);

          // Um novo registro passa a usar o novo valor.
          const aposNovoRegistro = registrarPartida(
            aposAlterar.sessao,
            jogo.id,
            jogador.id
          );
          expect(aposNovoRegistro.ok).toBe(true);
          const totalFinal = totalPorIdDe(aposNovoRegistro.sessao).get(
            jogador.id
          );
          expect(totalFinal).toBe(valorOriginal + novoValor);
        }
      ),
      { numRuns: 100 }
    );
  });
});
