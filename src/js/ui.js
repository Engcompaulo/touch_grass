// Módulo de helpers de UI (R10).
//
// Reúne utilitários de interface que tocam o DOM: exibição de mensagens na área
// de notificações e controle do indicador de carregamento da sugestão.
//
// O código é defensivo quanto ao DOM: funciona em um navegador com DOM real,
// localiza (e cria, quando necessário) os contêineres de que depende e não lança
// exceção quando `document` está ausente (ex.: ambiente sem DOM). Todos os
// rótulos e mensagens estão em português do Brasil (R10.4).

/** Identificador do contêiner da área de notificações no DOM. */
export const ID_NOTIFICACOES = "area-notificacoes";

/** Identificador do indicador de carregamento da sugestão no DOM. */
export const ID_CARREGANDO = "indicador-carregando";

/** Tipos de mensagem aceitos e a classe CSS correspondente. */
const CLASSES_POR_TIPO = {
  erro: "notificacao--erro",
  aviso: "notificacao--aviso",
  ok: "notificacao--ok",
};

/** Tipo usado quando o informado não é reconhecido. */
const TIPO_PADRAO = "aviso";

/** Texto exibido no indicador de carregamento da sugestão. */
const TEXTO_CARREGANDO = "Generating sequence suggestion...";

/**
 * Verifica, de forma defensiva, se há um `document` utilizável no ambiente.
 * @returns {boolean}
 */
function temDocumento() {
  return typeof document !== "undefined" && document !== null;
}

/**
 * Retorna o elemento usado como raiz para anexar contêineres criados
 * dinamicamente. Prefere `<main id="app">`; cai para `<body>` e, por fim, para o
 * `documentElement`.
 * @returns {Element | null}
 */
function obterRaiz() {
  if (!temDocumento()) {
    return null;
  }
  return (
    document.getElementById("app") ||
    document.body ||
    document.documentElement ||
    null
  );
}

/**
 * Localiza o contêiner da área de notificações, criando-o quando ainda não
 * existe no DOM. Retorna `null` quando não há DOM utilizável.
 * @returns {HTMLElement | null}
 */
function obterAreaNotificacoes() {
  if (!temDocumento()) {
    return null;
  }

  let area = document.getElementById(ID_NOTIFICACOES);
  if (area) {
    return area;
  }

  const raiz = obterRaiz();
  if (!raiz) {
    return null;
  }

  area = document.createElement("div");
  area.id = ID_NOTIFICACOES;
  area.className = "area-notificacoes";
  // Expõe o papel de região de status para tecnologias assistivas.
  area.setAttribute("role", "status");
  area.setAttribute("aria-live", "polite");
  raiz.appendChild(area);
  return area;
}

/**
 * Localiza o indicador de carregamento da sugestão, criando-o quando ainda não
 * existe no DOM. Retorna `null` quando não há DOM utilizável.
 * @returns {HTMLElement | null}
 */
function obterIndicadorCarregando() {
  if (!temDocumento()) {
    return null;
  }

  let indicador = document.getElementById(ID_CARREGANDO);
  if (indicador) {
    return indicador;
  }

  const raiz = obterRaiz();
  if (!raiz) {
    return null;
  }

  indicador = document.createElement("div");
  indicador.id = ID_CARREGANDO;
  indicador.className = "indicador-carregando";
  indicador.setAttribute("role", "status");
  indicador.setAttribute("aria-live", "polite");
  indicador.textContent = TEXTO_CARREGANDO;
  // Começa oculto; o estado visível é controlado por `mostrarCarregando`.
  indicador.hidden = true;
  raiz.appendChild(indicador);
  return indicador;
}

/**
 * Exibe uma mensagem na área de notificações, aplicando a classe correspondente
 * ao tipo (R10.4). Localiza ou cria o contêiner de notificações no DOM.
 *
 * Não lança exceção quando o DOM está ausente: nesse caso, a função apenas
 * retorna sem efeito.
 *
 * @param {string} texto - Texto da mensagem (em português do Brasil).
 * @param {"erro" | "aviso" | "ok"} [tipo] - Tipo da mensagem; valores não
 *   reconhecidos recaem em "aviso".
 * @returns {void}
 */
export function exibirMensagem(texto, tipo) {
  const area = obterAreaNotificacoes();
  if (!area) {
    return;
  }

  const tipoNormalizado = Object.prototype.hasOwnProperty.call(CLASSES_POR_TIPO, tipo)
    ? tipo
    : TIPO_PADRAO;

  const notificacao = document.createElement("div");
  notificacao.className = `notificacao ${CLASSES_POR_TIPO[tipoNormalizado]}`;
  notificacao.dataset.tipo = tipoNormalizado;
  notificacao.textContent = texto == null ? "" : String(texto);

  // Mensagens de erro recebem papel assertivo para leitura imediata.
  if (tipoNormalizado === "erro") {
    notificacao.setAttribute("role", "alert");
  }

  // Substitui a notificação anterior: apenas a mensagem mais recente é exibida.
  area.replaceChildren(notificacao);
}

/**
 * Mostra ou esconde o indicador de carregamento da sugestão (R5.2). Localiza ou
 * cria o indicador no DOM e alterna sua visibilidade.
 *
 * Não lança exceção quando o DOM está ausente: nesse caso, a função apenas
 * retorna sem efeito.
 *
 * @param {boolean} ativo - `true` para exibir o indicador; `false` para ocultá-lo.
 * @returns {void}
 */
export function mostrarCarregando(ativo) {
  const indicador = obterIndicadorCarregando();
  if (!indicador) {
    return;
  }

  const visivel = ativo === true;
  indicador.hidden = !visivel;
  indicador.setAttribute("aria-busy", visivel ? "true" : "false");
}
