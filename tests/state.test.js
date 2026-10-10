// Testes de propriedade do módulo de estado e persistência (state.js).
//
// Property 3: Round trip de persistência da Sessao.
// Para qualquer Sessao válida, salvarSessao seguido de carregarSessao produz
// uma Sessao equivalente (mesmos jogos selecionados, jogadores, registros e
// resultado).

import { describe, it, beforeEach } from "vitest";
import fc from "fast-check";
import {
  STORAGE_KEY,
  VERSAO_SESSAO,
  carregarSessao,
  salvarSessao,
} from "../src/js/state.js";

// Etapas possíveis do fluxo (ver flow.js no design).
const ETAPAS = [
  "jogos",
  "jogadores",
  "pontuacao",
  "sugestao",
  "registro",
  "apuracao",
];

// Gera um nome não vazio e serializável de forma estável em JSON.
const arbNome = fc.string({ minLength: 1, maxLength: 20 });

// Gera um identificador estável (slug/uuid simplificado).
const arbId = fc
  .string({ minLength: 1, maxLength: 12 })
  .map((s) => `id-${s}`);

// Gera um Jogo coerente com o modelo do design.
const arbJogo = fc.record({
  id: arbId,
  nome: arbNome,
  selecionado: fc.boolean(),
  personalizado: fc.boolean(),
  valorPontuacao: fc.integer({ min: 1, max: 1000 }),
});

// Gera um Jogador coerente com o modelo do design.
const arbJogador = fc.record({
  id: arbId,
  nome: arbNome,
});

// Gera um Registro de partida coerente com o modelo do design.
const arbRegistro = fc.record({
  id: arbId,
  jogoId: arbId,
  jogadorId: arbId,
  pontos: fc.integer({ min: 1, max: 1000 }),
  ordem: fc.integer({ min: 0, max: 1000 }),
  timestamp: fc.integer({ min: 0, max: 2_000_000_000_000 }),
});

// Gera um Vencedor coerente com o modelo do design.
const arbVencedor = fc.record({
  nome: arbNome,
  total: fc.integer({ min: 0, max: 100000 }),
});

// Gera uma entrada de classificação.
const arbClassificacao = fc.record({
  nome: arbNome,
  total: fc.integer({ min: 0, max: 100000 }),
});

// Gera um Resultado coerente com o modelo do design.
const arbResultado = fc.record({
  apurado: fc.boolean(),
  vencedores: fc.array(arbVencedor, { maxLength: 5 }),
  empate: fc.boolean(),
  classificacao: fc.array(arbClassificacao, { maxLength: 10 }),
});

// Gerador customizado de uma Sessao válida (passa por pareceSessaoValida e é
// estável sob um round trip JSON).
const arbSessao = fc.record({
  versao: fc.constant(VERSAO_SESSAO),
  etapa: fc.constantFrom(...ETAPAS),
  jogos: fc.array(arbJogo, { maxLength: 8 }),
  jogadores: fc.array(arbJogador, { maxLength: 8 }),
  registros: fc.array(arbRegistro, { maxLength: 10 }),
  resultado: arbResultado,
});

describe("state.js — persistência da Sessao", () => {
  beforeEach(() => {
    // Garante um localStorage limpo entre as execuções.
    localStorage.clear();
  });

  // Feature: board-game-scoreboard, Property 3
  it("faz round trip de persistência: salvar e carregar produz Sessao equivalente", () => {
    fc.assert(
      fc.property(arbSessao, (sessao) => {
        // Isola cada iteração: nenhum resíduo de execuções anteriores.
        localStorage.removeItem(STORAGE_KEY);

        const resultadoSalvar = salvarSessao(sessao);
        if (!resultadoSalvar.ok) {
          throw new Error(
            `salvarSessao falhou inesperadamente: ${resultadoSalvar.erro}`
          );
        }

        const carregada = carregarSessao();

        // A Sessao carregada deve ser equivalente à original em todos os
        // campos relevantes: jogos (e seleção), jogadores, registros e
        // resultado. A comparação profunda via JSON cobre a equivalência.
        return (
          JSON.stringify(carregada) === JSON.stringify(sessao)
        );
      }),
      { numRuns: 100 }
    );
  });
});
