// main.js — Bootstrap da aplicação Placar da Noite de Jogos (R10).
//
// Este é o ponto de entrada do frontend: orquestra a camada de UI/DOM, ligando
// os módulos de lógica pura (state, catalog, players, scoring, suggestion,
// scoreboard, results, flow, certificate) aos controles declarados no
// index.html. Nenhuma regra de negócio vive aqui — este arquivo apenas:
//
//   1. Carrega a Sessao do localStorage (ou cria uma nova com o CATALOGO_PADRAO).
//   2. Renderiza a etapa atual e as listas dinâmicas a partir da Sessao.
//   3. Liga os handlers do DOM às funções dos módulos.
//   4. Persiste a Sessao após cada mutação relevante (R10.5).
//
// É defensivo quanto ao DOM: cada acesso a elemento é verificado antes do uso,
// de modo que a ausência de um controle não quebra o bootstrap. Todo o conteúdo
// é em português do Brasil (R10.4).

import { carregarSessao, salvarSessao } from "./state.js";
import { CATALOGO_PADRAO, alternarSelecao, adicionarJogoPersonalizado, removerJogo, jogosSelecionados } from "./catalog.js";
import { adicionarJogador, removerJogador } from "./players.js";
import { definirValorPontuacao, valorVigente } from "./scoring.js";
import { solicitarSugestao } from "./suggestion.js";
import { registrarPartida, desfazerUltimo, totaisPorJogador, ordenarClassificacao } from "./scoreboard.js";
import { apurarVencedor } from "./results.js";
import { renderizarEtapa, avancar, voltar } from "./flow.js";
import { montarCertificado, renderizarCertificado } from "./certificate.js";
import { exibirMensagem, mostrarCarregando } from "./ui.js";

// ---------------------------------------------------------------------------
// Estado em memória
// ---------------------------------------------------------------------------
//
// A Sessao é a fonte única de verdade. É mantida nesta variável de módulo e
// substituída (nunca mutada) a cada operação; `renderizarTudo` reflete o novo
// estado na tela e `persistir` o grava no localStorage.
let sessao = null;

// Carrega a Sessao do localStorage. Se não houver sessão nova nasce com o
// catálogo padrão; `carregarSessao` devolve uma Sessao sem catálogo quando
// começa do zero, então garantimos o CATALOGO_PADRAO para sessões vazias.
function inicializarSessao() {
  const carregada = carregarSessao();
  const semJogos = !carregada || !Array.isArray(carregada.jogos) || carregada.jogos.length === 0;
  if (semJogos) {
    return { ...carregada, jogos: CATALOGO_PADRAO.map((jogo) => ({ ...jogo })) };
  }
  return carregada;
}

// Persiste a Sessao atual no localStorage (R10.5). Em falha de gravação (ex.:
// quota), avisa o usuário sem interromper o fluxo em memória.
function persistir() {
  const resultado = salvarSessao(sessao);
  if (resultado && resultado.ok === false) {
    exibirMensagem(
      resultado.erro || "Could not save the session to local storage.",
      "aviso"
    );
  }
}

// Aplica uma nova Sessao, re-renderiza e persiste. Centraliza o ciclo
// mutação → render → persistência usado por todos os handlers.
function aplicarSessao(novaSessao) {
  sessao = novaSessao;
  renderizarTudo();
  persistir();
}

// ---------------------------------------------------------------------------
// Helpers de DOM
// ---------------------------------------------------------------------------

function porId(id) {
  return typeof document !== "undefined" && document
    ? document.getElementById(id)
    : null;
}

// Esvazia um elemento, de forma defensiva.
function limpar(elemento) {
  if (elemento) {
    elemento.replaceChildren();
  }
}

// ---------------------------------------------------------------------------
// Renderização das listas dinâmicas a partir da Sessao
// ---------------------------------------------------------------------------

// Catálogo: um item marcável por jogo (R1.1). Clicar no item alterna a seleção.
function renderizarCatalogo() {
  const lista = porId("lista-catalogo");
  if (!lista) return;
  limpar(lista);

  const jogos = Array.isArray(sessao.jogos) ? sessao.jogos : [];
  for (const jogo of jogos) {
    const item = document.createElement("li");
    item.className = "catalogo__item jogo";
    if (jogo.selecionado) {
      item.classList.add("selecionado");
    }
    item.dataset.selecionado = jogo.selecionado ? "true" : "false";
    item.dataset.jogoId = jogo.id;
    if (jogo.personalizado) {
      item.classList.add("jogo--personalizado");
      item.dataset.personalizado = "true";
    }

    const rotulo = document.createElement("label");
    rotulo.className = "jogo__rotulo";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "jogo__checkbox";
    checkbox.checked = !!jogo.selecionado;
    checkbox.addEventListener("change", () => {
      aplicarSessao(alternarSelecao(sessao, jogo.id));
    });

    const nome = document.createElement("span");
    nome.className = "jogo__nome";
    nome.textContent = jogo.nome;

    rotulo.appendChild(checkbox);
    rotulo.appendChild(nome);
    item.appendChild(rotulo);

    // Qualquer jogo do catálogo pode ser removido da base — tanto os
    // personalizados (R2.5) quanto os do catálogo padrão. `removerJogo` remove
    // o jogo por id e o retira do conjunto de Jogos_Selecionados.
    const remover = document.createElement("button");
    remover.type = "button";
    remover.className = "jogo__remover";
    remover.textContent = "Remove";
    remover.setAttribute("aria-label", `Remove ${jogo.nome}`);
    remover.addEventListener("click", () => {
      aplicarSessao(removerJogo(sessao, jogo.id));
    });
    item.appendChild(remover);

    lista.appendChild(item);
  }
}

// Lista resumida dos Jogos_Selecionados (catálogo marcado + personalizados).
function renderizarSelecionados() {
  const lista = porId("lista-jogos-selecionados");
  if (!lista) return;
  limpar(lista);

  const selecionados = jogosSelecionados(sessao);
  if (selecionados.length === 0) {
    const vazio = document.createElement("li");
    vazio.className = "lista-selecionados__vazio";
    vazio.textContent = "No games selected yet.";
    lista.appendChild(vazio);
    return;
  }

  for (const jogo of selecionados) {
    const item = document.createElement("li");
    item.className = "selecionado-item";
    item.dataset.jogoId = jogo.id;

    const nome = document.createElement("span");
    nome.className = "selecionado-item__nome";
    nome.textContent = jogo.nome;
    item.appendChild(nome);

    const remover = document.createElement("button");
    remover.type = "button";
    remover.className = "jogo__remover selecionado-item__remover";
    remover.textContent = "Remove";
    remover.setAttribute("aria-label", `Remove ${jogo.nome}`);
    remover.addEventListener("click", () => {
      // Personalizado: remove do catálogo; de catálogo: apenas desmarca.
      const nova = jogo.personalizado
        ? removerJogo(sessao, jogo.id)
        : alternarSelecao(sessao, jogo.id);
      aplicarSessao(nova);
    });
    item.appendChild(remover);

    lista.appendChild(item);
  }
}

// Lista de jogadores cadastrados, cada um com botão de remover (R3).
function renderizarJogadores() {
  const lista = porId("lista-jogadores");
  if (!lista) return;
  limpar(lista);

  const jogadores = Array.isArray(sessao.jogadores) ? sessao.jogadores : [];
  for (const jogador of jogadores) {
    const item = document.createElement("li");
    item.className = "jogador";
    item.dataset.jogadorId = jogador.id;

    const nome = document.createElement("span");
    nome.className = "jogador__nome";
    nome.textContent = jogador.nome;
    item.appendChild(nome);

    const remover = document.createElement("button");
    remover.type = "button";
    remover.className = "jogador__remover";
    remover.textContent = "Remove";
    remover.setAttribute("aria-label", `Remove ${jogador.nome}`);
    remover.addEventListener("click", () => {
      const res = removerJogador(sessao, jogador.id);
      if (!res.ok) {
        exibirMensagem(res.erro, "erro");
        return;
      }
      aplicarSessao(res.sessao);
    });
    item.appendChild(remover);

    lista.appendChild(item);
  }
}

// Um input numérico de Valor_Pontuacao por Jogo_Selecionado (R4.1).
function renderizarPontuacao() {
  const lista = porId("lista-pontuacao");
  if (!lista) return;
  limpar(lista);

  const selecionados = jogosSelecionados(sessao);
  for (const jogo of selecionados) {
    const item = document.createElement("li");
    item.className = "pontuacao-jogo";
    item.dataset.jogoId = jogo.id;

    const inputId = `pontuacao-${jogo.id}`;

    const rotulo = document.createElement("label");
    rotulo.className = "pontuacao-jogo__nome";
    rotulo.setAttribute("for", inputId);
    rotulo.textContent = jogo.nome;
    item.appendChild(rotulo);

    const input = document.createElement("input");
    input.type = "number";
    input.id = inputId;
    input.className = "pontuacao-jogo__valor";
    input.min = "1";
    input.max = "1000";
    input.step = "1";
    input.value = String(valorVigente(sessao, jogo.id));
    input.addEventListener("change", () => {
      const res = definirValorPontuacao(sessao, jogo.id, Number(input.value));
      if (!res.ok) {
        exibirMensagem(res.erro, "erro");
        // Restaura o valor vigente no campo (preserva o anterior — R4.4).
        input.value = String(valorVigente(sessao, jogo.id));
        return;
      }
      aplicarSessao(res.sessao);
    });
    item.appendChild(input);

    lista.appendChild(item);
  }
}

// Lista numerada da Sequencia_Sugerida (R5.3). Preenchida sob demanda ao
// solicitar a sugestão; aqui apenas garantimos a classe que o CSS numera.
function prepararListaSequencia() {
  const lista = porId("lista-sequencia");
  if (lista && !lista.classList.contains("sequencia")) {
    lista.classList.add("sequencia");
  }
}

function renderizarSequencia(sequencia) {
  const lista = porId("lista-sequencia");
  if (!lista) return;
  limpar(lista);
  for (const nome of sequencia) {
    const item = document.createElement("li");
    item.className = "sequencia__item";
    item.textContent = nome;
    lista.appendChild(item);
  }
}

// Preenche os selects de jogo e jogador do formulário de registro (R6).
function renderizarSelecoesRegistro() {
  const selectJogo = porId("select-jogo-registro");
  if (selectJogo) {
    const anterior = selectJogo.value;
    limpar(selectJogo);
    for (const jogo of jogosSelecionados(sessao)) {
      const opcao = document.createElement("option");
      opcao.value = jogo.id;
      opcao.textContent = jogo.nome;
      selectJogo.appendChild(opcao);
    }
    if (anterior) selectJogo.value = anterior;
  }

  const selectJogador = porId("select-jogador-registro");
  if (selectJogador) {
    const anterior = selectJogador.value;
    limpar(selectJogador);
    const jogadores = Array.isArray(sessao.jogadores) ? sessao.jogadores : [];
    for (const jogador of jogadores) {
      const opcao = document.createElement("option");
      opcao.value = jogador.id;
      opcao.textContent = jogador.nome;
      selectJogador.appendChild(opcao);
    }
    if (anterior) selectJogador.value = anterior;
  }
}

// Placar/classificação parcial, ordenado por total desc e nome asc (R6.2).
function renderizarPlacar() {
  const lista = porId("placar-classificacao");
  if (!lista) return;
  if (!lista.classList.contains("classificacao")) {
    lista.classList.add("classificacao");
  }
  limpar(lista);

  const classificacao = ordenarClassificacao(totaisPorJogador(sessao));
  for (const entrada of classificacao) {
    const item = document.createElement("li");
    item.className = "classificacao__item";

    const nome = document.createElement("span");
    nome.className = "classificacao__nome";
    nome.textContent = entrada.nome;

    const total = document.createElement("span");
    total.className = "classificacao__total";
    const sufixo = entrada.total === 1 ? "point" : "points";
    total.textContent = `${entrada.total} ${sufixo}`;

    item.appendChild(nome);
    item.appendChild(total);
    lista.appendChild(item);
  }
}

// Exibe o resultado da apuração (vencedor(es), empate e classificação) (R7).
function renderizarResultado() {
  const area = porId("resultado-apuracao");
  if (!area) return;
  limpar(area);

  const resultado = sessao.resultado;
  if (!resultado || resultado.apurado !== true) {
    return;
  }

  const vencedores = Array.isArray(resultado.vencedores) ? resultado.vencedores : [];
  const titulo = document.createElement("p");
  titulo.className = "resultado-apuracao__titulo";
  titulo.textContent = resultado.empate
    ? "Winners of the Day (tie):"
    : "Winner of the Day:";
  area.appendChild(titulo);

  const listaVencedores = document.createElement("ul");
  listaVencedores.className = "resultado-apuracao__vencedores";
  for (const vencedor of vencedores) {
    const item = document.createElement("li");
    const sufixo = vencedor.total === 1 ? "point" : "points";
    item.textContent = `${vencedor.nome} — ${vencedor.total} ${sufixo}`;
    listaVencedores.appendChild(item);
  }
  area.appendChild(listaVencedores);
}

// Re-renderiza toda a UI a partir da Sessao: etapa atual + listas dinâmicas.
function renderizarTudo() {
  renderizarEtapa(sessao);
  renderizarCatalogo();
  renderizarSelecionados();
  renderizarJogadores();
  renderizarPontuacao();
  prepararListaSequencia();
  renderizarSelecoesRegistro();
  renderizarPlacar();
  renderizarResultado();
}

// ---------------------------------------------------------------------------
// Ligação dos handlers aos controles do DOM
// ---------------------------------------------------------------------------

function ligarFormularioJogoPersonalizado() {
  const form = porId("form-jogo-personalizado");
  const input = porId("input-jogo-personalizado");
  if (!form) return;
  form.addEventListener("submit", (evento) => {
    evento.preventDefault();
    const valor = input ? input.value : "";
    const res = adicionarJogoPersonalizado(sessao, valor);
    if (!res.ok) {
      exibirMensagem(res.erro, "erro");
      return;
    }
    if (input) input.value = "";
    aplicarSessao(res.sessao);
  });
}

function ligarFormularioJogador() {
  const form = porId("form-jogador");
  const input = porId("input-jogador");
  if (!form) return;
  form.addEventListener("submit", (evento) => {
    evento.preventDefault();
    const valor = input ? input.value : "";
    const res = adicionarJogador(sessao, valor);
    if (!res.ok) {
      exibirMensagem(res.erro, "erro");
      return;
    }
    if (input) input.value = "";
    aplicarSessao(res.sessao);
  });
}

function ligarSugestao() {
  const botao = porId("btn-sugerir-sequencia");
  if (!botao) return;
  botao.addEventListener("click", async () => {
    mostrarCarregando(true);
    botao.disabled = true;
    try {
      const { sequencia, origem, mensagem } = await solicitarSugestao(sessao);
      renderizarSequencia(sequencia);
      if (origem === "local" && mensagem) {
        exibirMensagem(mensagem, "aviso");
      } else {
        exibirMensagem("Suggested sequence ready.", "ok");
      }
    } finally {
      mostrarCarregando(false);
      botao.disabled = false;
    }
  });
}

function ligarRegistro() {
  const form = porId("form-registro");
  if (form) {
    form.addEventListener("submit", (evento) => {
      evento.preventDefault();
      const selectJogo = porId("select-jogo-registro");
      const selectJogador = porId("select-jogador-registro");
      const jogoId = selectJogo ? selectJogo.value : "";
      const jogadorId = selectJogador ? selectJogador.value : "";
      const res = registrarPartida(sessao, jogoId, jogadorId);
      if (!res.ok) {
        exibirMensagem(res.erro, "erro");
        return;
      }
      aplicarSessao(res.sessao);
    });
  }

  const botaoDesfazer = porId("btn-desfazer-registro");
  if (botaoDesfazer) {
    botaoDesfazer.addEventListener("click", () => {
      const res = desfazerUltimo(sessao);
      if (!res.ok) {
        exibirMensagem(res.erro, "erro");
        return;
      }
      aplicarSessao(res.sessao);
    });
  }
}

function ligarApuracao() {
  const botao = porId("btn-apurar-vencedor");
  if (!botao) return;
  botao.addEventListener("click", () => {
    const res = apurarVencedor(sessao);
    if (!res.ok) {
      exibirMensagem(res.erro, "erro");
      return;
    }
    // apurarVencedor já persiste o resultado; sincroniza o estado em memória
    // e re-renderiza (não repersiste para evitar gravação dupla).
    sessao = res.sessao;
    renderizarTudo();
    if (res.erro) {
      exibirMensagem(res.erro, "aviso");
    } else {
      exibirMensagem("Winner determined successfully.", "ok");
    }
  });
}

function ligarCertificado() {
  const botao = porId("btn-gerar-certificado");
  if (!botao) return;
  botao.addEventListener("click", () => {
    const res = montarCertificado(sessao);
    if (!res.ok) {
      exibirMensagem(res.erro, "erro");
      return;
    }
    renderizarCertificado(res.certificado);
  });
}

function ligarNavegacao() {
  const botaoVoltar = porId("btn-voltar");
  if (botaoVoltar) {
    botaoVoltar.addEventListener("click", () => {
      aplicarSessao(voltar(sessao));
    });
  }

  const botaoAvancar = porId("btn-avancar");
  if (botaoAvancar) {
    botaoAvancar.addEventListener("click", () => {
      const res = avancar(sessao);
      if (!res.ok) {
        exibirMensagem(res.erro, "erro");
        return;
      }
      aplicarSessao(res.sessao);
    });
  }
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

// Inicializa a aplicação: carrega o estado, liga os handlers e faz o primeiro
// render. Exportada para permitir inicialização manual em testes.
export function iniciar() {
  sessao = inicializarSessao();

  ligarFormularioJogoPersonalizado();
  ligarFormularioJogador();
  ligarSugestao();
  ligarRegistro();
  ligarApuracao();
  ligarCertificado();
  ligarNavegacao();

  renderizarTudo();
  // Grava o estado inicial (ex.: sessão nova com o catálogo padrão) (R10.5).
  persistir();
}

// Registra o bootstrap em DOMContentLoaded, de forma defensiva. Se o DOM já
// estiver pronto quando o módulo carregar, inicia imediatamente.
if (typeof document !== "undefined" && document) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar, { once: true });
  } else {
    iniciar();
  }
}
