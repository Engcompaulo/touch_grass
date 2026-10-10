// state.js — Modelo de estado (Sessao) e persistência no localStorage.
//
// Este módulo é a fonte única de verdade do Board Game Scoreboard. A Sessao é
// um objeto serializável em JSON, persistido na máquina do usuário via
// localStorage, sem envio a servidor externo (R10.5). As operações de leitura
// são resilientes: dados ausentes ou corrompidos resultam numa nova Sessao
// limpa. A gravação nunca lança — falhas de quota são sinalizadas no retorno.

// Chave única usada no localStorage para persistir a Sessao.
export const STORAGE_KEY = "board-game-scoreboard:sessao";

// Versão do esquema de dados, para eventual migração futura do localStorage.
export const VERSAO_SESSAO = 1;

// Primeira etapa do fluxo das seis etapas (ver flow.js).
const ETAPA_INICIAL = "jogos";

// Cria o Resultado não apurado padrão de uma nova Sessao.
function criarResultadoVazio() {
  return {
    apurado: false,
    vencedores: [],
    empate: false,
    classificacao: [],
  };
}

// Cria uma nova Sessao vazia.
//
// Por padrão, o catálogo de jogos (`jogos`) começa vazio. O módulo catalog.js
// (tarefa 4.1) é o dono do CATALOGO_PADRAO; para evitar dependência circular e
// permitir que a Sessao seja criada mesmo antes de catalog.js existir, o
// catálogo pode ser injetado opcionalmente via `catalogoPadrao`. Quem possui o
// catálogo (ex.: o bootstrap em main.js) passa `CATALOGO_PADRAO` para que uma
// Sessao nova já nasça com o catálogo carregado.
export function criarSessao(catalogoPadrao = []) {
  return {
    versao: VERSAO_SESSAO,
    etapa: ETAPA_INICIAL,
    // Clona cada jogo do catálogo para que a Sessao não compartilhe
    // referências mutáveis com a constante CATALOGO_PADRAO.
    jogos: Array.isArray(catalogoPadrao)
      ? catalogoPadrao.map((jogo) => ({ ...jogo }))
      : [],
    jogadores: [],
    registros: [],
    resultado: criarResultadoVazio(),
  };
}

// Verifica, de forma defensiva, se um valor desserializado tem o formato
// mínimo de uma Sessao. Dados que não batem são tratados como corrompidos.
function pareceSessaoValida(valor) {
  return (
    valor != null &&
    typeof valor === "object" &&
    typeof valor.etapa === "string" &&
    Array.isArray(valor.jogos) &&
    Array.isArray(valor.jogadores) &&
    Array.isArray(valor.registros) &&
    valor.resultado != null &&
    typeof valor.resultado === "object"
  );
}

// Carrega a Sessao do localStorage.
//
// Retorna uma nova Sessao vazia quando não há dados persistidos, quando o JSON
// é inválido, quando o localStorage está indisponível ou quando os dados não
// têm o formato esperado (corrompidos). Nunca lança.
export function carregarSessao() {
  let bruto = null;
  try {
    bruto = localStorage.getItem(STORAGE_KEY);
  } catch {
    // localStorage pode estar indisponível (ex.: modo restrito). Trata como
    // ausência de dados e devolve uma Sessao nova.
    return criarSessao();
  }

  if (bruto == null) {
    return criarSessao();
  }

  try {
    const dados = JSON.parse(bruto);
    if (!pareceSessaoValida(dados)) {
      return criarSessao();
    }
    return dados;
  } catch {
    // JSON inválido/corrompido: começa uma Sessao limpa.
    return criarSessao();
  }
}

// Persiste a Sessao no localStorage, serializando em JSON.
//
// Não lança em nenhuma circunstância. Em caso de falha (ex.: quota excedida ou
// localStorage indisponível), devolve `{ ok: false, erro }`; em sucesso,
// devolve `{ ok: true }`.
export function salvarSessao(sessao) {
  try {
    const json = JSON.stringify(sessao);
    localStorage.setItem(STORAGE_KEY, json);
    return { ok: true };
  } catch (e) {
    const erro =
      e && typeof e.message === "string"
        ? e.message
        : "Could not save the session to local storage.";
    return { ok: false, erro };
  }
}
