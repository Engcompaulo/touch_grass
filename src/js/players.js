// players.js — Cadastro de jogadores da Sessao (R3).
//
// Módulo de lógica pura: não toca no DOM, não acessa o localStorage e não lança
// exceções. As operações de mutação (`adicionarJogador`, `removerJogador`)
// recebem uma Sessao e retornam `{ ok, sessao, erro? }` com mensagens em
// português do Brasil, SEM mutar a Sessao original — sempre devolvem uma nova
// Sessao (cópia rasa com a lista de jogadores recriada).
//
// Reutiliza as validações puras de validation.js:
//   - validarNomeJogador: nome deve ter de 1 a 40 caracteres após trim (R3.1/R3.2)
//   - nomesEquivalentes: compara nomes ignorando caixa e espaços (R3.6)

import { validarNomeJogador, nomesEquivalentes } from "./validation.js";

// Limite máximo de jogadores cadastrados numa Sessao (R3.5).
export const LIMITE_JOGADORES = 20;

// Mínimo de jogadores para prosseguir ao restante do fluxo (R3.3/R3.4).
export const MINIMO_JOGADORES = 4;

// Gera um identificador estável e único para um Jogador. Usa crypto.randomUUID
// quando disponível (navegadores modernos e Node >= 16); caso contrário, cai
// para um fallback baseado em tempo + aleatoriedade, suficiente para IDs locais.
function gerarIdJogador() {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    // Ignora e usa o fallback abaixo.
  }
  return `jogador-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
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
 * Adiciona um Jogador à Sessao.
 *
 * Regras (R3.1, R3.2, R3.5, R3.6):
 *  - O nome, após remoção dos espaços das extremidades, deve ter de 1 a 40
 *    caracteres; caso contrário, rejeita sem alterar a lista.
 *  - A Sessao deve possuir menos de 20 jogadores; ao atingir o limite, rejeita.
 *  - O nome não pode coincidir com o de um jogador já cadastrado, ignorando
 *    caixa e espaços das extremidades; coincidindo, rejeita.
 *  - Em caso de sucesso, inclui o jogador usando o nome sem os espaços das
 *    extremidades e devolve uma nova Sessao (sem mutar a original).
 *
 * @param {object} sessao
 * @param {string} nomeBruto
 * @returns {{ ok: boolean, sessao: object, erro?: string }}
 */
export function adicionarJogador(sessao, nomeBruto) {
  const jogadores = listaJogadores(sessao);

  // Validação de tamanho do nome (R3.1/R3.2). validarNomeJogador já aplica trim.
  const validacao = validarNomeJogador(nomeBruto);
  if (!validacao.valido) {
    return { ok: false, sessao, erro: validacao.erro };
  }
  const nome = validacao.nome;

  // Limite de 20 jogadores (R3.5). Checado antes da duplicidade para que uma
  // Sessao cheia sempre informe o limite.
  if (jogadores.length >= LIMITE_JOGADORES) {
    return {
      ok: false,
      sessao,
      erro: `O limite de ${LIMITE_JOGADORES} jogadores foi atingido.`,
    };
  }

  // Duplicidade insensível a caixa e espaços das extremidades (R3.6).
  const jaExiste = jogadores.some((jogador) =>
    nomesEquivalentes(jogador.nome, nome)
  );
  if (jaExiste) {
    return {
      ok: false,
      sessao,
      erro: "That player name is already in use.",
    };
  }

  // Sucesso: cria o novo jogador e devolve uma nova Sessao sem mutar a original.
  const novoJogador = { id: gerarIdJogador(), nome };
  const novaSessao = {
    ...sessao,
    jogadores: [...jogadores, novoJogador],
  };
  return { ok: true, sessao: novaSessao };
}

/**
 * Remove um Jogador da Sessao.
 *
 * Regras (R3.7, R3.8):
 *  - A remoção só é permitida quando NÃO existe nenhum registro no
 *    Registro_Pontos associado ao jogador (nenhum ponto registrado).
 *  - Se houver ao menos 1 registro associado, impede a remoção e mantém a
 *    lista inalterada, exibindo mensagem explicativa.
 *  - Em caso de sucesso, retira o jogador e devolve uma nova Sessao (sem mutar
 *    a original).
 *
 * @param {object} sessao
 * @param {string} jogadorId
 * @returns {{ ok: boolean, sessao: object, erro?: string }}
 */
export function removerJogador(sessao, jogadorId) {
  const jogadores = listaJogadores(sessao);
  const registros = listaRegistros(sessao);

  const existe = jogadores.some((jogador) => jogador.id === jogadorId);
  if (!existe) {
    return {
      ok: false,
      sessao,
      erro: "Player not found in the session.",
    };
  }

  // Impede a remoção quando houver qualquer ponto/registro associado (R3.8).
  const temRegistros = registros.some(
    (registro) => registro && registro.jogadorId === jogadorId
  );
  if (temRegistros) {
    return {
      ok: false,
      sessao,
      erro: "You cannot remove a player who already has points recorded.",
    };
  }

  // Sucesso (R3.7): remove o jogador e devolve uma nova Sessao sem mutar a original.
  const novaSessao = {
    ...sessao,
    jogadores: jogadores.filter((jogador) => jogador.id !== jogadorId),
  };
  return { ok: true, sessao: novaSessao };
}

/**
 * Indica se a Sessao possui jogadores suficientes para prosseguir ao restante
 * do fluxo (sugestão de sequência e registro de pontos).
 *
 * Retorna verdadeiro se e somente se a quantidade de jogadores cadastrados
 * está entre 4 e 20 inclusive (R3.3/R3.4).
 *
 * @param {object} sessao
 * @returns {boolean}
 */
export function podeProsseguir(sessao) {
  const quantidade = listaJogadores(sessao).length;
  return quantidade >= MINIMO_JOGADORES && quantidade <= LIMITE_JOGADORES;
}
