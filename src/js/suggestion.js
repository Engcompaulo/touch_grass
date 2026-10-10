// Módulo de sugestão por IA com fallback local (R5, R9).
//
// Este arquivo contém a LÓGICA PURA da sugestão: montagem do prompt, parsing e
// filtragem da resposta e geração da sequência local de fallback. O cliente
// Ollama assíncrono (`solicitarSugestao`) é implementado em uma etapa posterior.
//
// Toda a interface e as mensagens estão em português do Brasil.

/**
 * Endpoint base do serviço Ollama (Suggestion_Service) acessível localmente.
 * Configurável para preservar o espírito do Requisito 9.4.
 * @type {string}
 */
export const OLLAMA_BASE_URL = "http://localhost:11434";

/**
 * Modelo open-weight leve usado para gerar a sequência sugerida.
 * @type {string}
 */
export const OLLAMA_MODELO = "llama3.2";

/**
 * Tempo máximo de espera (em milissegundos) pela resposta do Suggestion_Service
 * antes de recorrer ao fallback local (R5.2, R5.4).
 * @type {number}
 */
export const TIMEOUT_MS = 30000;

/**
 * Normaliza um nome de jogo para comparação, ignorando caixa e espaços das
 * extremidades. Função auxiliar pura.
 * @param {string} nome
 * @returns {string}
 */
function chaveNome(nome) {
  return String(nome ?? "").trim().toLowerCase();
}

/**
 * Monta o prompt enviado ao modelo a partir dos jogos selecionados e do número
 * de jogadores. O texto resultante inclui o nome de cada jogo selecionado e o
 * número de jogadores (R5.1 / Property 17).
 *
 * @param {{ id: string, nome: string }[]} jogos - Jogos selecionados da Sessao.
 * @param {number} numJogadores - Quantidade de jogadores cadastrados.
 * @returns {string} Prompt em português do Brasil.
 */
export function montarPrompt(jogos, numJogadores) {
  const lista = Array.isArray(jogos) ? jogos : [];
  const nomes = lista.map((jogo) => jogo && jogo.nome).filter((nome) => typeof nome === "string" && nome.trim() !== "");

  const listaFormatada = nomes.map((nome, indice) => `${indice + 1}. ${nome}`).join("\n");

  return [
    "You are an organizer of board game nights.",
    `We have ${numJogadores} players present.`,
    "The available board games are:",
    listaFormatada,
    "",
    "Suggest an order of matches for the night using only the games listed above.",
    "Each available game must appear at least once.",
    "Reply only with the numbered list of matches, one game name per line, with no extra comments.",
  ].join("\n");
}

/**
 * Faz o parse da resposta textual do modelo em uma lista de nomes de jogos.
 * Cada linha não vazia vira um item; prefixos comuns de lista (numeração,
 * marcadores) são removidos. Função pura.
 *
 * @param {string} texto - Resposta textual do modelo.
 * @returns {string[]} Lista de nomes de jogos na ordem em que aparecem.
 */
export function parsearResposta(texto) {
  if (typeof texto !== "string") {
    return [];
  }

  return texto
    .split(/\r?\n/)
    .map((linha) => linha.trim())
    // Remove numeração ("1.", "1)", "1 -") e marcadores ("-", "*", "•") do início.
    .map((linha) => linha.replace(/^\s*(?:\d+\s*[.)\-]\s*|[-*•]\s*)/, "").trim())
    .filter((linha) => linha !== "");
}

/**
 * Filtra a sequência mantendo apenas os nomes correspondentes a Jogos_Selecionados,
 * preservando a ordem relativa dos nomes restantes (R5.3, R5.6 / Property 18).
 * A correspondência ignora caixa e espaços das extremidades; os nomes retornados
 * usam o nome canônico do Jogo_Selecionado.
 *
 * @param {string[]} sequenciaNomes - Nomes de jogos propostos.
 * @param {{ id: string, nome: string }[]} jogosSelecionados - Jogos marcados na Sessao.
 * @returns {string[]} Subsequência contendo apenas jogos selecionados.
 */
export function filtrarSequencia(sequenciaNomes, jogosSelecionados) {
  const sequencia = Array.isArray(sequenciaNomes) ? sequenciaNomes : [];
  const selecionados = Array.isArray(jogosSelecionados) ? jogosSelecionados : [];

  const canonicoPorChave = new Map();
  for (const jogo of selecionados) {
    if (jogo && typeof jogo.nome === "string") {
      canonicoPorChave.set(chaveNome(jogo.nome), jogo.nome);
    }
  }

  const resultado = [];
  for (const nome of sequencia) {
    const canonico = canonicoPorChave.get(chaveNome(nome));
    if (canonico !== undefined) {
      resultado.push(canonico);
    }
  }
  return resultado;
}

/**
 * Gera uma Sequencia_Sugerida local (round-robin) como fallback quando a IA está
 * indisponível. A sequência cobre cada Jogo_Selecionado ao menos uma vez e não
 * inclui nenhum jogo que não seja selecionado (R5.4, R5.5, R9.5 / Property 19).
 *
 * O comprimento acompanha o número de jogadores (ao menos uma rodada completa de
 * todos os jogos), mantendo o fluxo da noite proporcional ao grupo.
 *
 * @param {{ id: string, nome: string }[]} jogosSelecionados - Jogos marcados na Sessao.
 * @param {number} numJogadores - Quantidade de jogadores cadastrados.
 * @returns {string[]} Sequência de nomes de jogos.
 */
export function gerarSequenciaLocal(jogosSelecionados, numJogadores) {
  const selecionados = (Array.isArray(jogosSelecionados) ? jogosSelecionados : [])
    .filter((jogo) => jogo && typeof jogo.nome === "string" && jogo.nome.trim() !== "");

  if (selecionados.length === 0) {
    return [];
  }

  const nomes = selecionados.map((jogo) => jogo.nome);

  // Número de partidas: ao menos uma rodada completa de todos os jogos; se houver
  // mais jogadores que jogos, estende para que a noite acompanhe o tamanho do grupo.
  const jogadores = Number.isInteger(numJogadores) && numJogadores > 0 ? numJogadores : 0;
  const totalPartidas = Math.max(nomes.length, jogadores);

  const sequencia = [];
  for (let i = 0; i < totalPartidas; i += 1) {
    sequencia.push(nomes[i % nomes.length]);
  }
  return sequencia;
}

// Mensagem exibida ao Grupo quando a sugestão por IA não pôde ser usada e o
// fluxo recorre à sequência gerada localmente (R5.4, R5.5, R9.5).
const MENSAGEM_IA_INDISPONIVEL =
  "The AI suggestion is unavailable; showing a locally generated sequence.";

/**
 * Extrai a lista de Jogos_Selecionados de uma Sessao, de forma defensiva.
 * Aceita tanto o formato de Sessao (com `jogos` e marcação `selecionado`)
 * quanto a ausência de dados, retornando sempre um array.
 * @param {object} sessao
 * @returns {{ id?: string, nome: string }[]}
 */
function extrairSelecionados(sessao) {
  const jogos = sessao && Array.isArray(sessao.jogos) ? sessao.jogos : [];
  return jogos.filter((jogo) => jogo && jogo.selecionado === true);
}

/**
 * Conta o número de Jogadores cadastrados na Sessao, de forma defensiva.
 * @param {object} sessao
 * @returns {number}
 */
function contarJogadores(sessao) {
  return sessao && Array.isArray(sessao.jogadores) ? sessao.jogadores.length : 0;
}

/**
 * Solicita ao Suggestion_Service (Ollama) uma Sequencia_Sugerida de partidas e
 * degrada graciosamente para a geração local em qualquer falha (R5.2, R5.4,
 * R5.5, R9.5).
 *
 * Fluxo:
 *  1. Monta o prompt a partir dos Jogos_Selecionados e do número de Jogadores.
 *  2. Envia um `fetch` POST para `${OLLAMA_BASE_URL}/api/generate`, cancelando a
 *     requisição com um `AbortController` após `TIMEOUT_MS` (30s).
 *  3. Em resposta HTTP 2xx recebida dentro do prazo, faz o parse do texto e
 *     aplica `filtrarSequencia` (filtragem defensiva, R5.6) para manter apenas
 *     Jogos_Selecionados. Se sobrar ao menos um jogo, usa origem "ia".
 *  4. Em timeout, erro de rede, status HTTP não-2xx ou resposta que não produza
 *     nenhum jogo selecionado válido, recorre a `gerarSequenciaLocal` com origem
 *     "local" e uma mensagem de indisponibilidade.
 *
 * Esta função NUNCA lança exceção e NUNCA interrompe o fluxo da aplicação: toda
 * falha resulta no fallback local.
 *
 * @param {object} sessao - A Sessao atual (jogos, jogadores, etc.).
 * @returns {Promise<{ sequencia: string[], origem: "ia" | "local", mensagem?: string }>}
 */
export async function solicitarSugestao(sessao) {
  const selecionados = extrairSelecionados(sessao);
  const numJogadores = contarJogadores(sessao);

  // Prepara o fallback local uma única vez para reaproveitar em qualquer falha.
  const sequenciaLocal = gerarSequenciaLocal(selecionados, numJogadores);
  const resultadoLocal = {
    sequencia: sequenciaLocal,
    origem: "local",
    mensagem: MENSAGEM_IA_INDISPONIVEL,
  };

  const prompt = montarPrompt(selecionados, numJogadores);

  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), TIMEOUT_MS);

  try {
    const resposta = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODELO,
        prompt,
        stream: false,
      }),
      signal: controlador.signal,
    });

    // HTTP não-2xx → fallback local (R5.5).
    if (!resposta || !resposta.ok) {
      return resultadoLocal;
    }

    const dados = await resposta.json();
    // O endpoint /api/generate (stream: false) devolve o texto em `response`.
    const texto = dados && typeof dados.response === "string" ? dados.response : "";

    const nomes = parsearResposta(texto);
    const sequenciaFiltrada = filtrarSequencia(nomes, selecionados);

    // Resposta sem nenhum Jogo_Selecionado válido → fallback local (R5.5).
    if (sequenciaFiltrada.length === 0) {
      return resultadoLocal;
    }

    return { sequencia: sequenciaFiltrada, origem: "ia" };
  } catch {
    // Timeout (abort) ou erro de rede → fallback local (R5.4, R5.5, R9.5).
    return resultadoLocal;
  } finally {
    clearTimeout(temporizador);
  }
}
