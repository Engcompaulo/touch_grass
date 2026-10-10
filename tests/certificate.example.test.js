// Testes por exemplo do módulo certificate.js (R8 — Certificado do Vencedor).
//
// Cobrem a tarefa 14.3:
//   - montarCertificado sem apuração é rejeitado com { ok: false } (R8.4).
//   - imprimirCertificado aciona window.print do navegador (R8.5), verificado
//     com um stub mínimo de window no ambiente node.
//
// O ambiente de teste é "node" (sem DOM completo). Para R8.5 instalamos um
// stub mínimo de globalThis.window com window.print mockado e o removemos ao
// final para não vazar entre os testes. Conteúdo em português do Brasil.

import { describe, it, expect, vi, afterEach } from "vitest";

import {
  montarCertificado,
  imprimirCertificado,
} from "../src/js/certificate.js";

describe("certificate.js — exemplos de montagem (R8.4)", () => {
  it("rejeita a montagem quando não há apuração (resultado.apurado !== true)", () => {
    const sessaoNaoApurada = {
      versao: 1,
      etapa: "resultado",
      jogos: [],
      jogadores: [],
      registros: [],
      resultado: { apurado: false, vencedores: [], empate: false, classificacao: [] },
    };

    const resultado = montarCertificado(sessaoNaoApurada);

    expect(resultado.ok).toBe(false);
    expect(resultado.certificado).toBeUndefined();
    expect(typeof resultado.erro).toBe("string");
  });

  it("rejeita a montagem quando a Sessao não tem resultado algum", () => {
    const resultado = montarCertificado({ versao: 1, etapa: "resultado" });

    expect(resultado.ok).toBe(false);
    expect(resultado.certificado).toBeUndefined();
  });
});

describe("certificate.js — impressão do certificado (R8.5)", () => {
  // Guarda o descritor original de window para restaurar após cada teste.
  const tinhaWindow = Object.prototype.hasOwnProperty.call(globalThis, "window");
  const windowOriginal = globalThis.window;

  afterEach(() => {
    // Remove/restaura o stub de window para não vazar entre os testes.
    if (tinhaWindow) {
      globalThis.window = windowOriginal;
    } else {
      delete globalThis.window;
    }
    vi.restoreAllMocks();
  });

  it("aciona window.print ao imprimir o certificado", () => {
    const printMock = vi.fn();
    // Stub mínimo de window com apenas o que imprimirCertificado usa.
    globalThis.window = { print: printMock };

    imprimirCertificado();

    expect(printMock).toHaveBeenCalledTimes(1);
  });

  it("não lança quando window.print não é uma função disponível", () => {
    globalThis.window = {};
    expect(() => imprimirCertificado()).not.toThrow();
  });
});
