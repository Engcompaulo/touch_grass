// suggestion.integration.test.js — Testes de integração do cliente Ollama
// com degradação graciosa (task 10.6, R5.2, R5.4, R5.5, R9.5).
//
// Exercitam a função assíncrona `solicitarSugestao`, que faz um `fetch` POST
// ao Suggestion_Service (Ollama) com timeout de 30s via AbortController e cai
// para a sequência local gerada em JavaScript em qualquer falha (timeout, erro
// de rede, status HTTP não-2xx ou resposta sem jogos válidos).
//
// Usam `vi.useFakeTimers()` para controlar o relógio (avançar os 30s do
// timeout) e um `global.fetch` mockado para simular cada cenário. Timers e
// mocks são restaurados após cada teste. Conteúdo em português do Brasil.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { solicitarSugestao, TIMEOUT_MS } from "../src/js/suggestion.js";

// Sessao de referência: dois jogos selecionados (Uno, Xadrez) e um NÃO
// selecionado (Damas), além de quatro jogadores. Serve a todos os cenários.
function sessaoReferencia() {
  return {
    versao: 1,
    etapa: "sugestao",
    jogos: [
      { id: "uno", nome: "Uno", selecionado: true, personalizado: false },
      { id: "xadrez", nome: "Xadrez", selecionado: true, personalizado: false },
      { id: "damas", nome: "Damas", selecionado: false, personalizado: false },
    ],
    jogadores: [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }],
    registros: [],
    resultado: { apurado: false, vencedores: [], empate: false, classificacao: [] },
  };
}

describe("suggestion.js — integração do cliente Ollama com fallback (task 10.6)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    // Remove qualquer fetch mockado deixado no escopo global.
    delete global.fetch;
  });

  it("resposta válida resolve com origem 'ia' e sequência filtrada (R5.2)", async () => {
    // O modelo devolve um jogo não selecionado (Banco Imobiliário) que precisa
    // ser filtrado; os selecionados (Uno, Xadrez) preservam a ordem relativa.
    global.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        response: "1. Uno\n2. Banco Imobiliario\n3. Xadrez\n4. Uno",
      }),
    }));

    const resultado = await solicitarSugestao(sessaoReferencia());

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(resultado.origem).toBe("ia");
    // Apenas jogos selecionados, na ordem relativa da resposta (Damas ausente).
    expect(resultado.sequencia).toEqual(["Uno", "Xadrez", "Uno"]);
    // No caminho feliz não há mensagem de indisponibilidade.
    expect(resultado.mensagem).toBeUndefined();
  });

  it("timeout (fetch nunca resolve + avançar 30s) cai para origem 'local' com mensagem (R5.4)", async () => {
    // fetch que só se resolve/rejeita quando o AbortController dispara.
    global.fetch = vi.fn(
      (_url, opts) =>
        new Promise((_resolve, reject) => {
          const signal = opts && opts.signal;
          if (signal) {
            signal.addEventListener("abort", () => {
              reject(new DOMException("Aborted", "AbortError"));
            });
          }
        })
    );

    const promessa = solicitarSugestao(sessaoReferencia());

    // Avança o relógio além do timeout de 30s para disparar o abort.
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS + 1);

    const resultado = await promessa;

    expect(resultado.origem).toBe("local");
    // Fallback cobre os jogos selecionados e exclui os não selecionados.
    expect(resultado.sequencia).toContain("Uno");
    expect(resultado.sequencia).toContain("Xadrez");
    expect(resultado.sequencia).not.toContain("Damas");
    // Mensagem de indisponibilidade da IA presente.
    expect(typeof resultado.mensagem).toBe("string");
    expect(resultado.mensagem.length).toBeGreaterThan(0);
  });

  it("erro de rede (fetch rejeita) cai para origem 'local' (R5.5)", async () => {
    global.fetch = vi.fn(async () => {
      throw new Error("rede indisponível");
    });

    const resultado = await solicitarSugestao(sessaoReferencia());

    expect(resultado.origem).toBe("local");
    expect(resultado.sequencia).toContain("Uno");
    expect(resultado.sequencia).toContain("Xadrez");
    expect(resultado.sequencia).not.toContain("Damas");
    expect(typeof resultado.mensagem).toBe("string");
    expect(resultado.mensagem.length).toBeGreaterThan(0);
  });

  it("status HTTP não-2xx cai para origem 'local' (R5.5, R9.5)", async () => {
    global.fetch = vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({}),
    }));

    const resultado = await solicitarSugestao(sessaoReferencia());

    expect(resultado.origem).toBe("local");
    expect(resultado.sequencia).toContain("Uno");
    expect(resultado.sequencia).toContain("Xadrez");
    expect(resultado.sequencia).not.toContain("Damas");
    expect(typeof resultado.mensagem).toBe("string");
    expect(resultado.mensagem.length).toBeGreaterThan(0);
  });
});
