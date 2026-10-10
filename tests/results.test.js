// Testes de propriedade do módulo results.js (R7 — apuração do Vencedor_Do_Dia).
//
// Cada propriedade do design corresponde a exatamente um teste de propriedade
// fast-check com no mínimo 100 iterações. A propriedade aqui coberta é:
//   - Property 24 (tarefa 9.2): os vencedores apurados por `apurarVencedor` são
//     exatamente os jogadores de maior total, e `empate` é verdadeiro se e
//     somente se mais de um jogador compartilha esse total máximo (R7.1, R7.3).
// Conteúdo e comentários em português do Brasil.

import { describe, it, expect } from "vitest";
import fc from "fast-check";

import { apurarVencedor } from "../src/js/results.js";

// Gerador de um conjunto de jogadores com nomes ÚNICOS. Nomes únicos tornam a
// comparação do conjunto de vencedores por nome exata e sem ambiguidade.
// Cada jogador recebe um id estável derivado do seu índice.
const arbJogadores = fc
  .uniqueArray(
    fc
      .string({ minLength: 1, maxLength: 10 })
      .filter((s) => s.trim().length > 0)
      .map((s) => s.trim()),
    { minLength: 1, maxLength: 6, selector: (s) => s.toLowerCase() }
  )
  .map((nomes) =>
    nomes.map((nome, i) => ({ id: `jogador-${i}`, nome }))
  );

// Monta uma Sessao com os jogadores informados e uma lista de registros. Cada
// registro referencia um `jogadorId` existente e carrega uma cópia de `pontos`
// (o Valor_Pontuacao vigente no momento do registro). O gerador de registros é
// construído a partir dos jogadores já sorteados, garantindo que todo
// `jogadorId` aponte para um jogador real da Sessao.
function arbSessao() {
  return arbJogadores.chain((jogadores) => {
    const arbRegistro = fc.record({
      jogoId: fc.constant("jogo-x"),
      // Referencia sempre um jogador existente da Sessao.
      jogadorId: fc.constantFrom(...jogadores.map((j) => j.id)),
      // Pontos positivos (inteiros de 1 a 50): modela o Valor_Pontuacao somado
      // por partida vencida.
      pontos: fc.integer({ min: 1, max: 50 }),
    });

    // Ao menos um registro é exigido para apurar (R7.4).
    return fc
      .array(arbRegistro, { minLength: 1, maxLength: 30 })
      .map((registrosBrutos) => ({
        registros: registrosBrutos.map((r, i) => ({
          id: `registro-${i}`,
          ...r,
          ordem: i + 1,
          timestamp: i,
        })),
        jogadores,
      }))
      .map(({ registros, jogadores: js }) => ({
        versao: 1,
        etapa: "resultado",
        jogos: [{ id: "jogo-x", nome: "Jogo", selecionado: true, personalizado: false }],
        jogadores: js,
        registros,
        resultado: { apurado: false, vencedores: [], empate: false, classificacao: [] },
      }));
  });
}

// Calcula, de forma independente da implementação, o total de cada jogador
// cadastrado somando os `pontos` dos registros associados ao seu id.
function totaisEsperados(sessao) {
  const total = new Map();
  for (const j of sessao.jogadores) {
    total.set(j.id, 0);
  }
  for (const r of sessao.registros) {
    if (total.has(r.jogadorId)) {
      total.set(r.jogadorId, total.get(r.jogadorId) + r.pontos);
    }
  }
  return total;
}

describe("results.js — propriedades da apuração do Vencedor_Do_Dia", () => {
  // Feature: board-game-scoreboard, Property 24
  it("Property 24: os vencedores são exatamente os jogadores de maior total (R7.1, R7.3)", () => {
    fc.assert(
      fc.property(arbSessao(), (sessao) => {
        const resultado = apurarVencedor(sessao);

        // Com ao menos um registro, a apuração deve ter sucesso (R7.4).
        expect(resultado.ok).toBe(true);

        // Totais esperados calculados de forma independente da implementação.
        const totais = totaisEsperados(sessao);
        const totalMaximo = Math.max(...totais.values());

        // Conjunto esperado de vencedores: nomes dos jogadores cujo total é o
        // máximo. Como os nomes são únicos no gerador, o nome identifica o
        // jogador de forma inequívoca.
        const nomesEsperados = new Set(
          sessao.jogadores
            .filter((j) => totais.get(j.id) === totalMaximo)
            .map((j) => j.nome)
        );

        // Conjunto apurado de vencedores a partir do retorno de apurarVencedor.
        const nomesApurados = new Set(resultado.vencedores.map((v) => v.nome));

        // Os conjuntos devem coincidir em tamanho e conteúdo.
        expect(nomesApurados.size).toBe(nomesEsperados.size);
        for (const nome of nomesEsperados) {
          expect(nomesApurados.has(nome)).toBe(true);
        }

        // Todo vencedor apurado deve ter exatamente o total máximo.
        for (const v of resultado.vencedores) {
          expect(v.total).toBe(totalMaximo);
        }

        // Empate é verdadeiro se e somente se há mais de um jogador no máximo.
        expect(resultado.empate).toBe(nomesEsperados.size > 1);
      }),
      { numRuns: 100 }
    );
  });
});
