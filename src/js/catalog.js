// catalog.js — Catálogo pré-definido e seleção de jogos (R1, R2).
//
// Este módulo é o dono do CATALOGO_PADRAO e concentra a lógica de marcação,
// adição de jogos personalizados e remoção. Todas as funções são puras: não
// tocam no DOM nem no localStorage, não lançam exceções e nunca mutam a Sessao
// recebida — sempre retornam uma nova Sessao. As validações de nome e de
// duplicidade reutilizam os helpers de validation.js. As mensagens são em
// português do Brasil.

import { validarNomeJogo, nomesEquivalentes } from "./validation.js";

// Valor de pontuação padrão de um jogo quando o grupo não define outro (R4.3).
// Mantido aqui para o catálogo nascer consistente; scoring.js é o dono da
// configuração de pontuação em si.
const VALOR_PONTUACAO_PADRAO = 1;

// Catálogo pré-definido com, no mínimo, 6 jogos de mesa conhecidos (R1.1).
// Cada jogo nasce não selecionado, não personalizado e com o valor de
// pontuação padrão. Os ids são slugs estáveis.
export const CATALOGO_PADRAO = [
  { id: "uno", nome: "Uno", selecionado: false, personalizado: false, valorPontuacao: VALOR_PONTUACAO_PADRAO },
  { id: "domino", nome: "Dominoes", selecionado: false, personalizado: false, valorPontuacao: VALOR_PONTUACAO_PADRAO },
  { id: "damas", nome: "Checkers", selecionado: false, personalizado: false, valorPontuacao: VALOR_PONTUACAO_PADRAO },
  { id: "baralho", nome: "Cards", selecionado: false, personalizado: false, valorPontuacao: VALOR_PONTUACAO_PADRAO },
  { id: "xadrez", nome: "Chess", selecionado: false, personalizado: false, valorPontuacao: VALOR_PONTUACAO_PADRAO },
  { id: "jogo-da-velha", nome: "Tic-Tac-Toe", selecionado: false, personalizado: false, valorPontuacao: VALOR_PONTUACAO_PADRAO },
];

// Gera um id estável para um Jogo_Personalizado. Usa crypto.randomUUID quando
// disponível; caso contrário, cai para um identificador baseado em tempo e
// aleatoriedade, suficiente para unicidade dentro da Sessao.
function gerarIdPersonalizado() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `jogo-${crypto.randomUUID()}`;
  }
  return `jogo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Alterna o estado de seleção de um jogo do catálogo (marcar/desmarcar).
 * Retorna uma nova Sessao sem mutar a original (R1.2, R1.3). Se o jogoId não
 * existir, devolve uma cópia equivalente da Sessao, sem alterações.
 * @param {object} sessao
 * @param {string} jogoId
 * @returns {object} nova Sessao
 */
export function alternarSelecao(sessao, jogoId) {
  const jogos = sessao.jogos.map((jogo) =>
    jogo.id === jogoId ? { ...jogo, selecionado: !jogo.selecionado } : { ...jogo }
  );
  return { ...sessao, jogos };
}

/**
 * Adiciona um Jogo_Personalizado ao catálogo da Sessao já marcado como
 * selecionado (R2.2). Valida o tamanho do nome (1..60 após trim, R2.3) e a
 * duplicidade ignorando caixa e espaços das extremidades contra todos os jogos
 * já presentes no catálogo (R2.4).
 *
 * Em sucesso retorna `{ ok: true, sessao }` com uma nova Sessao; em erro
 * retorna `{ ok: false, sessao, erro }` com a Sessao inalterada (nova cópia).
 * Nunca muta a Sessao original.
 * @param {object} sessao
 * @param {string} nomeBruto
 * @returns {{ ok: boolean, sessao: object, erro?: string }}
 */
export function adicionarJogoPersonalizado(sessao, nomeBruto) {
  const validacao = validarNomeJogo(nomeBruto);
  if (!validacao.valido) {
    return { ok: false, sessao: { ...sessao, jogos: [...sessao.jogos] }, erro: validacao.erro };
  }

  const nome = validacao.nome;

  // Duplicidade: compara contra o nome de qualquer jogo já no catálogo,
  // ignorando caixa e espaços das extremidades (R2.4).
  const jaExiste = sessao.jogos.some((jogo) => nomesEquivalentes(jogo.nome, nome));
  if (jaExiste) {
    return {
      ok: false,
      sessao: { ...sessao, jogos: [...sessao.jogos] },
      erro: "That game is already on the list.",
    };
  }

  const novoJogo = {
    id: gerarIdPersonalizado(),
    nome,
    selecionado: true,
    personalizado: true,
    valorPontuacao: VALOR_PONTUACAO_PADRAO,
  };

  const jogos = [...sessao.jogos.map((jogo) => ({ ...jogo })), novoJogo];
  return { ok: true, sessao: { ...sessao, jogos } };
}

/**
 * Remove um jogo do catálogo da Sessao, retirando-o do conjunto de
 * Jogos_Selecionados (R2.5). Retorna uma nova Sessao sem mutar a original.
 * Se o jogoId não existir, devolve uma cópia equivalente da Sessao.
 * @param {object} sessao
 * @param {string} jogoId
 * @returns {object} nova Sessao
 */
export function removerJogo(sessao, jogoId) {
  const jogos = sessao.jogos
    .filter((jogo) => jogo.id !== jogoId)
    .map((jogo) => ({ ...jogo }));
  return { ...sessao, jogos };
}

/**
 * Retorna apenas os jogos marcados como selecionados (Jogos_Selecionados).
 * Devolve cópias para preservar a imutabilidade da Sessao.
 * @param {object} sessao
 * @returns {object[]}
 */
export function jogosSelecionados(sessao) {
  return sessao.jogos
    .filter((jogo) => jogo.selecionado)
    .map((jogo) => ({ ...jogo }));
}
