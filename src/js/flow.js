// flow.js — Controle das seis etapas sequenciais da Sessao (R10).
//
// A aplicação organiza a experiência em seis etapas distintas, apresentadas uma
// por vez (R10.2): seleção de jogos, cadastro de jogadores, configuração de
// pontuação, sugestão de sequência, registro de pontos e apuração do vencedor.
//
// Este módulo separa a LÓGICA PURA de navegação (etapaAtual, avancar, voltar)
// da ORQUESTRAÇÃO de UI (renderizarEtapa). As funções puras não tocam o DOM,
// não lançam e nunca mutam a Sessao recebida — sempre devolvem uma nova Sessao.
// A navegação ocorre em passos de no máximo uma posição e nunca ultrapassa a
// primeira nem a última etapa (R10.2). O avanço valida as pré-condições de cada
// etapa: ao menos 1 Jogo_Selecionado na etapa "jogos" (R1.4) e ao menos 4
// jogadores na etapa "jogadores" (R3.4). Todas as mensagens estão em português
// do Brasil (R10.4).

import { jogosSelecionados } from "./catalog.js";
import { podeProsseguir, MINIMO_JOGADORES } from "./players.js";
import { exibirMensagem } from "./ui.js";

/**
 * Sequência oficial das seis etapas do fluxo, na ordem de apresentação (R10.2).
 * A ordem dos elementos define o avanço e o retorno em passos unitários.
 * @type {string[]}
 */
export const ETAPAS = [
  "jogos",
  "jogadores",
  "pontuacao",
  "sugestao",
  "registro",
  "apuracao",
];

/**
 * Retorna o índice da etapa dentro de ETAPAS, com fallback defensivo para 0
 * (primeira etapa) quando o valor é desconhecido ou ausente.
 * @param {string} etapa
 * @returns {number}
 */
function indiceEtapa(etapa) {
  const indice = ETAPAS.indexOf(etapa);
  return indice >= 0 ? indice : 0;
}

/**
 * Retorna a etapa atual da Sessao.
 *
 * Usa `sessao.etapa` quando corresponde a uma das etapas conhecidas; caso
 * contrário (campo ausente, nulo ou com valor inválido), recai para a primeira
 * etapa (R10.1).
 *
 * @param {object} sessao
 * @returns {string} uma das etapas de ETAPAS
 */
export function etapaAtual(sessao) {
  const etapa = sessao && typeof sessao.etapa === "string" ? sessao.etapa : null;
  return ETAPAS[indiceEtapa(etapa)];
}

/**
 * Verifica as pré-condições para avançar a partir de uma determinada etapa.
 *
 * Regras (R1.4, R3.4):
 *  - "jogos": exige ao menos 1 Jogo_Selecionado.
 *  - "jogadores": exige ao menos 4 jogadores (via `podeProsseguir`).
 *  - demais etapas: sem pré-condição de avanço.
 *
 * @param {object} sessao
 * @param {string} etapa
 * @returns {{ ok: boolean, erro?: string }}
 */
function validarAvanco(sessao, etapa) {
  if (etapa === "jogos") {
    // R1.4: enquanto o conjunto de Jogos_Selecionados estiver vazio, impede o
    // avanço para a etapa seguinte.
    if (jogosSelecionados(sessao).length < 1) {
      return {
        ok: false,
        erro: "Select at least 1 game to continue.",
      };
    }
    return { ok: true };
  }

  if (etapa === "jogadores") {
    // R3.4: exige ao menos 4 jogadores cadastrados para prosseguir.
    if (!podeProsseguir(sessao)) {
      return {
        ok: false,
        erro: `Add at least ${MINIMO_JOGADORES} players to continue.`,
      };
    }
    return { ok: true };
  }

  return { ok: true };
}

/**
 * Avança para a próxima etapa, em um único passo, se as pré-condições da etapa
 * atual forem satisfeitas (R10.2).
 *
 * - Na etapa "jogos" exige ao menos 1 Jogo_Selecionado (R1.4).
 * - Na etapa "jogadores" exige ao menos 4 jogadores (R3.4).
 * - Nunca ultrapassa a última etapa: estando na última, retorna `ok = false`
 *   mantendo a etapa inalterada.
 * - Avança no máximo UMA posição por chamada.
 *
 * Função pura: não toca o DOM e devolve uma nova Sessao sem mutar a original.
 *
 * @param {object} sessao
 * @returns {{ ok: boolean, sessao: object, erro?: string }}
 */
export function avancar(sessao) {
  const etapa = etapaAtual(sessao);
  const indice = indiceEtapa(etapa);

  // Limite superior: não ultrapassa a última etapa (R10.2).
  if (indice >= ETAPAS.length - 1) {
    return {
      ok: false,
      sessao,
      erro: "You are already on the last step.",
    };
  }

  // Pré-condições da etapa atual (R1.4, R3.4).
  const validacao = validarAvanco(sessao, etapa);
  if (!validacao.ok) {
    return { ok: false, sessao, erro: validacao.erro };
  }

  // Avança exatamente uma posição, devolvendo uma nova Sessao.
  const novaSessao = { ...sessao, etapa: ETAPAS[indice + 1] };
  return { ok: true, sessao: novaSessao };
}

/**
 * Volta uma única etapa (R10.2). Estando na primeira etapa, permanece nela.
 *
 * Função pura: não toca o DOM e devolve uma nova Sessao sem mutar a original.
 *
 * @param {object} sessao
 * @returns {object} nova Sessao
 */
export function voltar(sessao) {
  const indice = indiceEtapa(etapaAtual(sessao));

  // Limite inferior: não passa da primeira etapa (R10.2).
  if (indice <= 0) {
    return { ...sessao, etapa: ETAPAS[0] };
  }

  return { ...sessao, etapa: ETAPAS[indice - 1] };
}

/**
 * Orquestra a renderização da etapa atual (R10.1, R10.2, R10.3).
 *
 * Mantém a interface com uma etapa visível por vez: localiza, de forma
 * defensiva, as seções associadas a cada etapa (um elemento com atributo
 * `data-etapa` igual ao nome da etapa, ou id `etapa-<nome>`) e exibe apenas a
 * seção da etapa atual, ocultando as demais. Também sincroniza o atributo
 * `data-etapa-atual` do contêiner raiz, útil para estilização por etapa.
 *
 * É defensivo quanto ao DOM: quando não há `document` utilizável, apenas retorna
 * sem efeito, sem lançar. A lógica pura de navegação permanece em `avancar`,
 * `voltar` e `etapaAtual`.
 *
 * @param {object} sessao
 * @returns {void}
 */
export function renderizarEtapa(sessao) {
  if (typeof document === "undefined" || document === null) {
    return;
  }

  const atual = etapaAtual(sessao);

  // Sincroniza o indicador de etapa no contêiner raiz, quando existir.
  const raiz = document.getElementById("app") || document.body || null;
  if (raiz && raiz.dataset) {
    raiz.dataset.etapaAtual = atual;
  }

  // Mostra apenas a seção da etapa atual e oculta as demais (uma por vez).
  ETAPAS.forEach((etapa) => {
    const secao =
      document.querySelector(`[data-etapa="${etapa}"]`) ||
      document.getElementById(`etapa-${etapa}`);
    if (!secao) {
      return;
    }
    const ehAtual = etapa === atual;
    secao.hidden = !ehAtual;
    if (secao.setAttribute) {
      secao.setAttribute("aria-hidden", ehAtual ? "false" : "true");
    }
  });

  // Nova sessão inicia na etapa de seleção de jogos (R10.1); mensagem de
  // orientação opcional por etapa pode ser adicionada aqui no futuro.
  if (atual === "jogos" && jogosSelecionados(sessao).length < 1) {
    exibirMensagem("Select at least 1 game to continue.", "aviso");
  }
}
