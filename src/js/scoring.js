// scoring.js — Configuração de pontuação customizável por jogo (R4).
//
// Este módulo é lógica pura: não toca no DOM, não acessa o localStorage e não
// lança exceções. As operações de mutação recebem uma Sessao e devolvem uma
// nova Sessao (ou um objeto de resultado { ok, sessao, erro? }), sem mutar a
// Sessao original nem seus objetos aninhados. Reutiliza as validações de
// validation.js. Mensagens em português do Brasil.

import { validarValorPontuacao } from "./validation.js";

// Valor de pontuação padrão atribuído a um Jogo_Selecionado quando o grupo
// não define um Valor_Pontuacao (R4.3).
export const VALOR_PONTUACAO_PADRAO = 1;

/**
 * Define o Valor_Pontuacao de um Jogo_Selecionado da Sessao (R4.2, R4.4).
 *
 * O valor passa pela validação de validarValorPontuacao (inteiro de 1 a 1000
 * inclusive). Em caso de sucesso, retorna uma nova Sessao com o valor
 * associado ao jogo. Em caso de erro de validação — ou quando o jogo não é
 * encontrado — a Sessao é devolvida inalterada e o Valor_Pontuacao previamente
 * associado ao jogo é preservado.
 *
 * A função é pura: não muta a Sessao original nem o jogo alvo; cria cópias
 * rasas da Sessao, do array de jogos e do jogo alterado.
 *
 * @param {object} sessao
 * @param {string} jogoId
 * @param {unknown} valorBruto
 * @returns {{ ok: boolean, sessao: object, erro?: string }}
 */
export function definirValorPontuacao(sessao, jogoId, valorBruto) {
  const jogos = Array.isArray(sessao?.jogos) ? sessao.jogos : [];
  const indice = jogos.findIndex((jogo) => jogo.id === jogoId);

  if (indice === -1) {
    // Jogo inexistente: não há valor anterior a alterar; rejeita sem efeito.
    return {
      ok: false,
      sessao,
      erro: "The given game was not found in the session.",
    };
  }

  const resultado = validarValorPontuacao(valorBruto);
  if (!resultado.valido) {
    // Preserva o valor anterior devolvendo a Sessao inalterada (R4.4).
    return { ok: false, sessao, erro: resultado.erro };
  }

  // Cria uma nova Sessao com o jogo alterado, sem mutar os originais.
  const jogosAtualizados = jogos.map((jogo, i) =>
    i === indice ? { ...jogo, valorPontuacao: resultado.valor } : jogo
  );

  return {
    ok: true,
    sessao: { ...sessao, jogos: jogosAtualizados },
  };
}

/**
 * Retorna o Valor_Pontuacao vigente de um jogo (R4.3).
 *
 * Devolve o valor associado ao jogo quando ele for um inteiro válido entre 1 e
 * 1000; caso o jogo não exista ou não tenha um valor válido associado, devolve
 * o VALOR_PONTUACAO_PADRAO.
 *
 * @param {object} sessao
 * @param {string} jogoId
 * @returns {number}
 */
export function valorVigente(sessao, jogoId) {
  const jogos = Array.isArray(sessao?.jogos) ? sessao.jogos : [];
  const jogo = jogos.find((j) => j.id === jogoId);

  if (!jogo) {
    return VALOR_PONTUACAO_PADRAO;
  }

  const resultado = validarValorPontuacao(jogo.valorPontuacao);
  return resultado.valido ? resultado.valor : VALOR_PONTUACAO_PADRAO;
}
