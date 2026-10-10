// Testes unitários das validações puras (src/js/validation.js).
// Tarefa 3.2 — casos de borda de tamanho de nomes e de valores de pontuação.
// Validates: Requirements 2.3, 3.2, 4.4

import { describe, it, expect } from "vitest";
import {
  normalizarNome,
  validarNomeJogo,
  validarNomeJogador,
  validarValorPontuacao,
  nomesEquivalentes,
} from "../src/js/validation.js";

// Gera uma string de comprimento exato com um caractere repetido.
function texto(tamanho, caractere = "a") {
  return caractere.repeat(tamanho);
}

describe("normalizarNome", () => {
  it("remove os espaços das extremidades", () => {
    expect(normalizarNome("  Uno  ")).toBe("Uno");
  });

  it("preserva espaços internos", () => {
    expect(normalizarNome("  Jogo da Velha  ")).toBe("Jogo da Velha");
  });

  it("retorna string vazia para valores que não são string", () => {
    expect(normalizarNome(null)).toBe("");
    expect(normalizarNome(undefined)).toBe("");
    expect(normalizarNome(42)).toBe("");
    expect(normalizarNome({})).toBe("");
  });
});

describe("validarNomeJogo (1..60 após trim)", () => {
  // Validates: Requirements 2.3
  it("rejeita tamanho 0 (vazio)", () => {
    const r = validarNomeJogo("");
    expect(r.valido).toBe(false);
    expect(r.nome).toBeUndefined();
    expect(r.erro).toBeTruthy();
  });

  it("rejeita nome composto apenas por espaços (vazio após trim)", () => {
    const r = validarNomeJogo("     ");
    expect(r.valido).toBe(false);
    expect(r.erro).toBeTruthy();
  });

  it("aceita tamanho 1 (limite inferior)", () => {
    const r = validarNomeJogo(texto(1));
    expect(r.valido).toBe(true);
    expect(r.nome).toBe(texto(1));
  });

  it("aceita tamanho 40 (dentro do intervalo)", () => {
    const r = validarNomeJogo(texto(40));
    expect(r.valido).toBe(true);
    expect(r.nome).toBe(texto(40));
  });

  it("aceita tamanho 60 (limite superior)", () => {
    const r = validarNomeJogo(texto(60));
    expect(r.valido).toBe(true);
    expect(r.nome).toBe(texto(60));
  });

  it("rejeita tamanho 61 (acima do limite superior)", () => {
    const r = validarNomeJogo(texto(61));
    expect(r.valido).toBe(false);
    expect(r.nome).toBeUndefined();
    expect(r.erro).toBeTruthy();
  });

  it("aplica o trim antes de medir o tamanho", () => {
    const r = validarNomeJogo("  " + texto(60) + "  ");
    expect(r.valido).toBe(true);
    expect(r.nome).toBe(texto(60));
  });
});

describe("validarNomeJogador (1..40 após trim)", () => {
  // Validates: Requirements 3.2
  it("rejeita tamanho 0 (vazio)", () => {
    const r = validarNomeJogador("");
    expect(r.valido).toBe(false);
    expect(r.nome).toBeUndefined();
    expect(r.erro).toBeTruthy();
  });

  it("rejeita nome composto apenas por espaços (vazio após trim)", () => {
    const r = validarNomeJogador("   ");
    expect(r.valido).toBe(false);
    expect(r.erro).toBeTruthy();
  });

  it("aceita tamanho 1 (limite inferior)", () => {
    const r = validarNomeJogador(texto(1));
    expect(r.valido).toBe(true);
    expect(r.nome).toBe(texto(1));
  });

  it("aceita tamanho 40 (limite superior)", () => {
    const r = validarNomeJogador(texto(40));
    expect(r.valido).toBe(true);
    expect(r.nome).toBe(texto(40));
  });

  it("rejeita tamanho 41 (acima do limite superior)", () => {
    const r = validarNomeJogador(texto(41));
    expect(r.valido).toBe(false);
    expect(r.nome).toBeUndefined();
    expect(r.erro).toBeTruthy();
  });

  it("aplica o trim antes de medir o tamanho", () => {
    const r = validarNomeJogador("  " + texto(40) + "  ");
    expect(r.valido).toBe(true);
    expect(r.nome).toBe(texto(40));
  });
});

describe("validarValorPontuacao (inteiro 1..1000)", () => {
  // Validates: Requirements 4.4

  describe("valores numéricos válidos nos limites", () => {
    it("aceita 1 (limite inferior)", () => {
      const r = validarValorPontuacao(1);
      expect(r.valido).toBe(true);
      expect(r.valor).toBe(1);
    });

    it("aceita 1000 (limite superior)", () => {
      const r = validarValorPontuacao(1000);
      expect(r.valido).toBe(true);
      expect(r.valor).toBe(1000);
    });

    it("aceita um inteiro intermediário", () => {
      const r = validarValorPontuacao(500);
      expect(r.valido).toBe(true);
      expect(r.valor).toBe(500);
    });
  });

  describe("valores fora do intervalo", () => {
    it("rejeita 0 (abaixo do limite inferior)", () => {
      const r = validarValorPontuacao(0);
      expect(r.valido).toBe(false);
      expect(r.valor).toBeUndefined();
      expect(r.erro).toBeTruthy();
    });

    it("rejeita 1001 (acima do limite superior)", () => {
      const r = validarValorPontuacao(1001);
      expect(r.valido).toBe(false);
      expect(r.valor).toBeUndefined();
      expect(r.erro).toBeTruthy();
    });

    it("rejeita valores negativos", () => {
      const r = validarValorPontuacao(-5);
      expect(r.valido).toBe(false);
      expect(r.erro).toBeTruthy();
    });
  });

  describe("valores não inteiros", () => {
    it("rejeita NaN", () => {
      const r = validarValorPontuacao(NaN);
      expect(r.valido).toBe(false);
      expect(r.erro).toBeTruthy();
    });

    it("rejeita um float numérico", () => {
      const r = validarValorPontuacao(10.5);
      expect(r.valido).toBe(false);
      expect(r.erro).toBeTruthy();
    });

    it("rejeita Infinity", () => {
      const r = validarValorPontuacao(Infinity);
      expect(r.valido).toBe(false);
      expect(r.erro).toBeTruthy();
    });
  });

  describe("strings", () => {
    it("aceita string de inteiro puro dentro do intervalo", () => {
      const r = validarValorPontuacao("500");
      expect(r.valido).toBe(true);
      expect(r.valor).toBe(500);
    });

    it("aceita string de inteiro com espaços nas extremidades", () => {
      const r = validarValorPontuacao("  7  ");
      expect(r.valido).toBe(true);
      expect(r.valor).toBe(7);
    });

    it("rejeita string não numérica", () => {
      const r = validarValorPontuacao("abc");
      expect(r.valido).toBe(false);
      expect(r.erro).toBeTruthy();
    });

    it("rejeita string vazia", () => {
      const r = validarValorPontuacao("");
      expect(r.valido).toBe(false);
      expect(r.erro).toBeTruthy();
    });

    it("rejeita string de float", () => {
      const r = validarValorPontuacao("10.5");
      expect(r.valido).toBe(false);
      expect(r.erro).toBeTruthy();
    });

    it("rejeita string com valor fora do intervalo", () => {
      const r = validarValorPontuacao("1001");
      expect(r.valido).toBe(false);
      expect(r.erro).toBeTruthy();
    });
  });

  describe("tipos inesperados", () => {
    it("rejeita null", () => {
      const r = validarValorPontuacao(null);
      expect(r.valido).toBe(false);
      expect(r.erro).toBeTruthy();
    });

    it("rejeita undefined", () => {
      const r = validarValorPontuacao(undefined);
      expect(r.valido).toBe(false);
      expect(r.erro).toBeTruthy();
    });

    it("rejeita objetos e arrays", () => {
      expect(validarValorPontuacao({}).valido).toBe(false);
      expect(validarValorPontuacao([5]).valido).toBe(false);
      expect(validarValorPontuacao(true).valido).toBe(false);
    });
  });
});

describe("nomesEquivalentes", () => {
  it("considera equivalentes nomes que diferem apenas em caixa", () => {
    expect(nomesEquivalentes("Uno", "uno")).toBe(true);
    expect(nomesEquivalentes("XADREZ", "xadrez")).toBe(true);
  });

  it("considera equivalentes nomes que diferem apenas em espaços nas extremidades", () => {
    expect(nomesEquivalentes("  Dominó  ", "Dominó")).toBe(true);
  });

  it("considera equivalentes combinando caixa e espaços", () => {
    expect(nomesEquivalentes("  JoGo Da Velha ", "jogo da velha")).toBe(true);
  });

  it("distingue nomes realmente diferentes", () => {
    expect(nomesEquivalentes("Uno", "Dominó")).toBe(false);
  });

  it("preserva a distinção de espaços internos", () => {
    expect(nomesEquivalentes("Jogo da Velha", "JogodaVelha")).toBe(false);
  });
});
