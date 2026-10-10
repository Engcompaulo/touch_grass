// Teste de propriedade do módulo certificate.js (R8 — Certificado do Vencedor).
//
// Esta propriedade do design corresponde a exatamente um teste de propriedade
// fast-check com no mínimo 100 iterações:
//   - Property 25 (tarefa 14.2): o certificado reflete todos os vencedores
//     apurados — para qualquer resultado apurado válido, montarCertificado
//     contém o nome de cada Vencedor_Do_Dia e o respectivo total (R8.2, R8.3).
// Conteúdo e comentários em português do Brasil.

import { describe, it, expect } from "vitest";
import fc from "fast-check";

import { montarCertificado } from "../src/js/certificate.js";

// Gerador de nome de jogador (não vazio após aparar espaços).
const arbNome = fc
  .string({ minLength: 1, maxLength: 20 })
  .filter((s) => s.trim().length > 0);

// Gerador de total de pontos (inteiro finito, podendo ser 0).
const arbTotal = fc.integer({ min: 0, max: 10000 });

// Gerador de um vencedor { nome, total }.
const arbVencedor = fc.record({ nome: arbNome, total: arbTotal });

// Gerador de uma lista de um ou mais vencedores apurados.
const arbVencedores = fc.array(arbVencedor, { minLength: 1, maxLength: 20 });

// Monta uma Sessao com um resultado já apurado contendo os vencedores dados.
// A classificação espelha os vencedores (suficiente para a propriedade), e o
// campo `empate` é derivado da quantidade de vencedores.
function sessaoApurada(vencedores) {
  return {
    versao: 1,
    etapa: "resultado",
    jogos: [],
    jogadores: [],
    registros: [],
    resultado: {
      apurado: true,
      vencedores,
      empate: vencedores.length > 1,
      classificacao: vencedores.map((v) => ({ nome: v.nome, total: v.total })),
    },
  };
}

describe("certificate.js — propriedade do certificado", () => {
  // Feature: board-game-scoreboard, Property 25
  it("Property 25: o certificado reflete todos os vencedores apurados (R8.2, R8.3)", () => {
    fc.assert(
      fc.property(arbVencedores, (vencedores) => {
        const sessao = sessaoApurada(vencedores);

        const resultado = montarCertificado(sessao);

        // Com apuração válida, a montagem deve ter sucesso.
        expect(resultado.ok).toBe(true);
        expect(resultado.certificado).toBeTruthy();

        const certificado = resultado.certificado;

        // O certificado traz exatamente a mesma quantidade de vencedores.
        expect(certificado.vencedores).toHaveLength(vencedores.length);
        expect(certificado.quantidadeVencedores).toBe(vencedores.length);

        // Cada Vencedor_Do_Dia aparece no certificado com seu nome e total.
        for (let i = 0; i < vencedores.length; i += 1) {
          const esperado = vencedores[i];
          const obtido = certificado.vencedores[i];
          expect(obtido.nome).toBe(esperado.nome);
          expect(obtido.total).toBe(esperado.total);
        }
      }),
      { numRuns: 100 }
    );
  });
});
