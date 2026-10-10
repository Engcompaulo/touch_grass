// certificate.js — Certificado do Vencedor_Do_Dia (R8).
//
// Este módulo cuida da geração e exibição do Certificado a partir do resultado
// já apurado da Sessao (ver results.js — `apurarVencedor`). Ele é dividido em:
//
//  - `montarCertificado(sessao)`: LÓGICA PURA. A partir de `sessao.resultado`
//    apurado, monta o modelo de dados do Certificado (um ou mais vencedores,
//    com seus totais, e a indicação de empate). Não toca no DOM e nunca lança;
//    rejeita quando não há apuração (R8.4) devolvendo `{ ok: false, erro }`.
//  - `renderizarCertificado(certificado)`: toca o DOM para exibir o Certificado.
//    É defensiva quanto ao DOM (não lança quando `document` está ausente).
//  - `imprimirCertificado()`: aciona a impressão do navegador via
//    `window.print` (R8.5), de forma defensiva (só chama se existir).
//
// Todo o conteúdo é em português do Brasil (R10.4).

/** Identificador do contêiner do Certificado no DOM. */
export const ID_CERTIFICADO = "certificado";

/** Título fixo exibido no Certificado. */
const TITULO_CERTIFICADO = "Winner of the Day Certificate";

/**
 * Verifica, de forma defensiva, se há um `document` utilizável no ambiente.
 * @returns {boolean}
 */
function temDocumento() {
  return typeof document !== "undefined" && document !== null;
}

/**
 * Retorna o elemento usado como raiz para anexar o contêiner do Certificado
 * quando ele ainda não existe. Prefere `<main id="app">`; cai para `<body>` e,
 * por fim, para o `documentElement`.
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
 * Normaliza, de forma defensiva, a lista de vencedores de um resultado apurado
 * em uma lista de `{ nome, total }`, descartando entradas inválidas.
 *
 * @param {unknown} vencedores
 * @returns {{ nome: string, total: number }[]}
 */
function normalizarVencedores(vencedores) {
  if (!Array.isArray(vencedores)) {
    return [];
  }
  return vencedores
    .filter((v) => v != null && typeof v === "object")
    .map((v) => ({
      nome: typeof v.nome === "string" ? v.nome : String(v.nome ?? ""),
      total: Number.isFinite(Number(v.total)) ? Number(v.total) : 0,
    }));
}

/**
 * Monta o modelo de dados do Certificado a partir do resultado apurado da
 * Sessao (R8.2, R8.3, R8.4).
 *
 * Regras:
 *  - Exige que a Sessao tenha um resultado apurado (`resultado.apurado === true`).
 *    Caso contrário, rejeita a geração e devolve uma mensagem indicando que o
 *    vencedor precisa ser apurado antes (R8.4), sem efeito colateral.
 *  - Em sucesso, devolve `{ ok: true, certificado }`, onde `certificado` contém
 *    o título, o(s) Vencedor_Do_Dia (nome e total), a indicação de empate e a
 *    quantidade de vencedores. Com exatamente um vencedor, o Certificado traz o
 *    nome e o total daquele jogador (R8.2); em empate, traz todos os jogadores
 *    empatados com seus totais (R8.3).
 *
 * Função pura: não toca no DOM, não acessa o armazenamento e nunca lança.
 *
 * @param {object} sessao
 * @returns {{ ok: boolean, certificado?: {
 *   titulo: string,
 *   empate: boolean,
 *   vencedores: { nome: string, total: number }[],
 *   quantidadeVencedores: number
 * }, erro?: string }}
 */
export function montarCertificado(sessao) {
  const resultado = sessao && sessao.resultado;

  // Exige apuração prévia (R8.4). Qualquer coisa diferente de um resultado
  // efetivamente apurado é rejeitada sem efeito colateral.
  if (!resultado || resultado.apurado !== true) {
    return {
      ok: false,
      erro: "O vencedor precisa ser apurado antes de gerar o certificado.",
    };
  }

  const vencedores = normalizarVencedores(resultado.vencedores);

  // Empate quando há mais de um vencedor. Preferimos a flag do resultado quando
  // disponível, mas derivamos da quantidade de vencedores de forma defensiva.
  const empate =
    typeof resultado.empate === "boolean"
      ? resultado.empate
      : vencedores.length > 1;

  const certificado = {
    titulo: TITULO_CERTIFICADO,
    empate,
    vencedores,
    quantidadeVencedores: vencedores.length,
  };

  return { ok: true, certificado };
}

/**
 * Renderiza o Certificado no DOM (R8.2, R8.3).
 *
 * Localiza o contêiner do Certificado (`#certificado`), criando-o na raiz da
 * aplicação quando ainda não existe, e preenche-o com o título, uma linha de
 * destaque adequada (um vencedor ou empate) e a lista de Vencedores_Do_Dia com
 * seus respectivos totais de pontos. Também insere o controle de impressão
 * (R8.5), que aciona `imprimirCertificado`.
 *
 * É defensiva quanto ao DOM: quando `document` está ausente ou o `certificado`
 * é inválido, retorna sem efeito e sem lançar.
 *
 * @param {{ empate?: boolean, vencedores?: { nome: string, total: number }[] }} certificado
 * @returns {void}
 */
export function renderizarCertificado(certificado) {
  if (!temDocumento() || certificado == null || typeof certificado !== "object") {
    return;
  }

  const raiz = obterRaiz();
  if (!raiz) {
    return;
  }

  let container = document.getElementById(ID_CERTIFICADO);
  if (!container) {
    container = document.createElement("section");
    container.id = ID_CERTIFICADO;
    container.className = "certificado";
    raiz.appendChild(container);
  }

  const vencedores = normalizarVencedores(certificado.vencedores);
  const empate =
    typeof certificado.empate === "boolean"
      ? certificado.empate
      : vencedores.length > 1;

  // Monta a estrutura do Certificado do zero a cada render.
  const fragmento = document.createDocumentFragment();

  const titulo = document.createElement("h2");
  titulo.className = "certificado__titulo";
  titulo.textContent =
    typeof certificado.titulo === "string" && certificado.titulo
      ? certificado.titulo
      : TITULO_CERTIFICADO;
  fragmento.appendChild(titulo);

  const destaque = document.createElement("p");
  destaque.className = "certificado__destaque";
  destaque.textContent = empate
    ? "Winners of the Day (tie):"
    : "Winner of the Day:";
  fragmento.appendChild(destaque);

  const lista = document.createElement("ul");
  lista.className = "certificado__vencedores";
  for (const vencedor of vencedores) {
    const item = document.createElement("li");
    item.className = "certificado__vencedor";

    const nome = document.createElement("span");
    nome.className = "certificado__nome";
    nome.textContent = vencedor.nome;

    const total = document.createElement("span");
    total.className = "certificado__total";
    const sufixo = vencedor.total === 1 ? "point" : "points";
    total.textContent = `${vencedor.total} ${sufixo}`;

    item.appendChild(nome);
    item.appendChild(document.createTextNode(" — "));
    item.appendChild(total);
    lista.appendChild(item);
  }
  fragmento.appendChild(lista);

  // Controle de impressão (R8.5).
  const botaoImprimir = document.createElement("button");
  botaoImprimir.type = "button";
  botaoImprimir.className = "certificado__imprimir";
  botaoImprimir.textContent = "Print certificate";
  botaoImprimir.addEventListener("click", () => imprimirCertificado());
  fragmento.appendChild(botaoImprimir);

  // Substitui qualquer conteúdo anterior pela nova renderização.
  container.replaceChildren(fragmento);
}

/**
 * Aciona a função de impressão do navegador para salvar/imprimir o Certificado
 * (R8.5).
 *
 * Defensiva: só chama `window.print` quando `window` e a função existem; caso
 * contrário, retorna sem efeito e sem lançar.
 *
 * @returns {void}
 */
export function imprimirCertificado() {
  if (typeof window !== "undefined" && window && typeof window.print === "function") {
    window.print();
  }
}
