// scoreboard.js — Registro de pontos, undo e classificação (R6, R4.5).
//
// Módulo de lógica pura: não toca no DOM, não acessa o localStorage e não lança
// exceções. As operações de mutação (`registrarPartida`, `desfazerUltimo`)
// recebem uma Sessao e devolvem `{ ok, sessao, erro? }` com mensagens em
// português do Brasil, SEM mutar a Sessao original — sempre devolvem uma nova
// Sessao (cópia rasa com a lista de registros recriada).
//
// Cada Registro guarda uma CÓPIA do Valor_Pontuacao vigente no momento do
// registro (campo `pontos`), de modo que alterações futuras no valor de um
// jogo não afetam partidas já registradas (R4.5). O campo `ordem` é um inteiro
// incremental que permite desfazer apenas o último registro (R6.4). O campo
// `timestamp` guarda o epoch em milissegundos do momento do registro.

import { valorVigente } from "./scoring.js";

// Gera um identificador estável e único para um Registro. Usa
// crypto.randomUUID quando disponível (navegadores modernos e Node >= 16);
// caso contrário, cai para um fallback baseado em tempo + aleatoriedade,
// suficiente para IDs locais.
function gerarIdRegistro() {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    // Ignora e usa o fallback abaixo.
  }
  return `registro-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// Garante que o campo `jogos` da Sessao seja sempre tratado como array.
function listaJogos(sessao) {
  return sessao && Array.isArray(sessao.jogos) ? sessao.jogos : [];
}

// Garante que o campo `jogadores` da Sessao seja sempre tratado como array.
function listaJogadores(sessao) {
  return sessao && Array.isArray(sessao.jogadores) ? sessao.jogadores : [];
}

// Garante que o campo `registros` da Sessao seja sempre tratado como array.
function listaRegistros(sessao) {
  return sessao && Array.isArray(sessao.registros) ? sessao.registros : [];
}

/**
 * Registra o resultado de uma partida: o jogo disputado e o jogador vencedor
 * (R6.1, R6.3).
 *
 * Regras:
 *  - O jogo precisa existir na Sessao e estar entre os Jogos_Selecionados;
 *    caso contrário, rejeita sem alterar o Registro_Pontos (R6.3).
 *  - O jogador vencedor precisa existir na Sessao; caso contrário, rejeita sem
 *    efeito colateral (R6.3).
 *  - Em caso de sucesso, soma o Valor_Pontuacao vigente do jogo ao vencedor
 *    gravando um novo Registro com: `pontos` (cópia do valor vigente no
 *    momento — R4.5), `ordem` (incremental) e `timestamp` (epoch ms) (R6.1).
 *  - A função é pura: devolve uma nova Sessao sem mutar a original.
 *
 * @param {object} sessao
 * @param {string} jogoId
 * @param {string} jogadorId
 * @returns {{ ok: boolean, sessao: object, erro?: string }}
 */
export function registrarPartida(sessao, jogoId, jogadorId) {
  const jogos = listaJogos(sessao);
  const jogadores = listaJogadores(sessao);
  const registros = listaRegistros(sessao);

  // Valida o jogo: precisa existir e estar selecionado (R6.3).
  const jogo = jogos.find((j) => j && j.id === jogoId);
  if (!jogo) {
    return {
      ok: false,
      sessao,
      erro: "A game is required and must be one of the selected games.",
    };
  }
  if (!jogo.selecionado) {
    return {
      ok: false,
      sessao,
      erro: "A game is required and must be one of the selected games.",
    };
  }

  // Valida o jogador vencedor: precisa existir na Sessao (R6.3).
  const jogador = jogadores.find((p) => p && p.id === jogadorId);
  if (!jogador) {
    return {
      ok: false,
      sessao,
      erro: "A winning player is required and must be registered in the session.",
    };
  }

  // Soma o Valor_Pontuacao vigente do jogo, gravando uma cópia em `pontos`
  // para que alterações futuras no valor não afetem este registro (R4.5).
  const pontos = valorVigente(sessao, jogoId);

  // `ordem` incremental: a maior ordem existente + 1 (ou 1 na primeira partida).
  const maiorOrdem = registros.reduce(
    (max, registro) =>
      registro && typeof registro.ordem === "number" && registro.ordem > max
        ? registro.ordem
        : max,
    0
  );

  const novoRegistro = {
    id: gerarIdRegistro(),
    jogoId,
    jogadorId,
    pontos,
    ordem: maiorOrdem + 1,
    timestamp: Date.now(),
  };

  const novaSessao = {
    ...sessao,
    registros: [...registros, novoRegistro],
  };
  return { ok: true, sessao: novaSessao };
}

/**
 * Desfaz o último registro de partida, subtraindo os pontos somados naquele
 * registro e removendo-o do Registro_Pontos (R6.4, R6.5).
 *
 * Regras:
 *  - Rejeita quando não houver nenhum registro para desfazer (R6.5).
 *  - O "último" registro é o de maior `ordem`; ao removê-lo, os totais voltam
 *    exatamente ao estado imediatamente anterior ao registro, pois o total de
 *    cada jogador é derivado da lista de registros (ver `totaisPorJogador`).
 *  - A função é pura: devolve uma nova Sessao sem mutar a original.
 *
 * @param {object} sessao
 * @returns {{ ok: boolean, sessao: object, erro?: string }}
 */
export function desfazerUltimo(sessao) {
  const registros = listaRegistros(sessao);

  if (registros.length === 0) {
    return {
      ok: false,
      sessao,
      erro: "There is no record to undo.",
    };
  }

  // Encontra o índice do registro de maior `ordem` (o último registrado).
  let indiceUltimo = 0;
  let maiorOrdem = -Infinity;
  for (let i = 0; i < registros.length; i += 1) {
    const registro = registros[i];
    const ordem =
      registro && typeof registro.ordem === "number" ? registro.ordem : -Infinity;
    if (ordem >= maiorOrdem) {
      maiorOrdem = ordem;
      indiceUltimo = i;
    }
  }

  const novaSessao = {
    ...sessao,
    registros: registros.filter((_, i) => i !== indiceUltimo),
  };
  return { ok: true, sessao: novaSessao };
}

/**
 * Calcula o total de pontos de cada jogador a partir do Registro_Pontos (R6.2).
 *
 * Percorre todos os jogadores cadastrados (inclusive os que ainda não
 * pontuaram, cujo total é 0) e soma os `pontos` dos registros associados a
 * cada um. A ordem segue a ordem de cadastro dos jogadores; use
 * `ordenarClassificacao` para obter o ranking.
 *
 * @param {object} sessao
 * @returns {{ jogadorId: string, nome: string, total: number }[]}
 */
export function totaisPorJogador(sessao) {
  const jogadores = listaJogadores(sessao);
  const registros = listaRegistros(sessao);

  // Soma os pontos por jogadorId em um único passo sobre os registros.
  const totalPorId = new Map();
  for (const registro of registros) {
    if (!registro || typeof registro.jogadorId !== "string") {
      continue;
    }
    const pontos = typeof registro.pontos === "number" ? registro.pontos : 0;
    totalPorId.set(registro.jogadorId, (totalPorId.get(registro.jogadorId) || 0) + pontos);
  }

  return jogadores.map((jogador) => ({
    jogadorId: jogador.id,
    nome: jogador.nome,
    total: totalPorId.get(jogador.id) || 0,
  }));
}

/**
 * Ordena uma lista de totais produzindo a classificação final (R6.2).
 *
 * A ordenação é por `total` decrescente e, em caso de empate no total, por
 * `nome` crescente (ordem alfabética). A comparação de nomes usa
 * `localeCompare` com sensibilidade "base" para uma ordenação alfabética
 * estável e previsível em português.
 *
 * A função é pura: não muta a lista recebida; devolve uma nova lista ordenada.
 *
 * @param {{ nome: string, total: number }[]} totais
 * @returns {{ nome: string, total: number }[]}
 */
export function ordenarClassificacao(totais) {
  const lista = Array.isArray(totais) ? totais.slice() : [];
  return lista.sort((a, b) => {
    const totalA = typeof a.total === "number" ? a.total : 0;
    const totalB = typeof b.total === "number" ? b.total : 0;
    if (totalB !== totalA) {
      return totalB - totalA; // total decrescente
    }
    const nomeA = typeof a.nome === "string" ? a.nome : "";
    const nomeB = typeof b.nome === "string" ? b.nome : "";
    return nomeA.localeCompare(nomeB, "pt", { sensitivity: "base" }); // nome crescente
  });
}
