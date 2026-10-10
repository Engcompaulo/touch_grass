// results.js — Apuração do Vencedor_Do_Dia (R7).
//
// Este módulo apura o resultado final da Sessao a partir do Registro_Pontos:
// identifica o(s) jogador(es) de maior total (Vencedor_Do_Dia), sinaliza
// empate quando mais de um jogador compartilha o total máximo e produz a
// classificação completa ordenada (total decrescente; em empate, nome em ordem
// alfabética crescente). Exige ao menos um registro para apurar — sem registros
// a operação é rejeitada e o estado permanece inalterado (R7.4).
//
// A lógica de apuração é pura: recebe uma Sessao e devolve uma NOVA Sessao
// (sem mutar a original), com o campo `resultado` preenchido. Além disso, o
// resultado é persistido no armazenamento local via state.salvarSessao (R7.5).
// Uma eventual falha de persistência (ex.: quota) não invalida a apuração: o
// retorno continua `ok: true` com a nova Sessao já apurada, apenas registrando
// a mensagem de erro de gravação em `erro`.
//
// A fonte de verdade dos totais é o próprio Registro_Pontos: cada Registro
// guarda `jogadorId` e `pontos` (cópia do Valor_Pontuacao vigente no momento
// do registro). Somamos os `pontos` por jogador para obter o total de cada um.
// Jogadores cadastrados sem nenhum ponto entram na classificação com total 0.

import { salvarSessao } from "./state.js";

// Garante que o campo `jogadores` da Sessao seja sempre tratado como array.
function listaJogadores(sessao) {
  return sessao && Array.isArray(sessao.jogadores) ? sessao.jogadores : [];
}

// Garante que o campo `registros` da Sessao seja sempre tratado como array.
function listaRegistros(sessao) {
  return sessao && Array.isArray(sessao.registros) ? sessao.registros : [];
}

// Converte, de forma defensiva, os pontos de um registro para um número finito.
// Registros sem pontos válidos contribuem com 0.
function pontosDoRegistro(registro) {
  const pontos = registro && Number(registro.pontos);
  return Number.isFinite(pontos) ? pontos : 0;
}

// Calcula o total de pontos de cada Jogador a partir do Registro_Pontos.
//
// Retorna uma entrada por jogador cadastrado (inclusive os com total 0),
// preservando o nome para exibição e ordenação. Registros cujo `jogadorId`
// não corresponde a nenhum jogador cadastrado são ignorados de forma
// defensiva.
//
// @param {object} sessao
// @returns {{ jogadorId: string, nome: string, total: number }[]}
function totaisPorJogador(sessao) {
  const jogadores = listaJogadores(sessao);
  const registros = listaRegistros(sessao);

  // Inicializa o total de cada jogador cadastrado em 0.
  const totalPorId = new Map();
  for (const jogador of jogadores) {
    if (jogador && typeof jogador.id === "string") {
      totalPorId.set(jogador.id, 0);
    }
  }

  // Soma os pontos de cada registro ao jogador correspondente.
  for (const registro of registros) {
    const id = registro && registro.jogadorId;
    if (totalPorId.has(id)) {
      totalPorId.set(id, totalPorId.get(id) + pontosDoRegistro(registro));
    }
  }

  return jogadores
    .filter((jogador) => jogador && typeof jogador.id === "string")
    .map((jogador) => ({
      jogadorId: jogador.id,
      nome: jogador.nome,
      total: totalPorId.get(jogador.id) ?? 0,
    }));
}

// Ordena a classificação por total decrescente e, em empate de total, por nome
// em ordem alfabética crescente (R7.2). Pura: não muta o array recebido.
//
// A comparação de nomes usa localeCompare com sensibilidade de base para um
// ordenamento alfabético estável e amigável ao português do Brasil.
//
// @param {{ nome: string, total: number }[]} totais
// @returns {{ nome: string, total: number }[]}
function ordenarClassificacao(totais) {
  const copia = Array.isArray(totais) ? [...totais] : [];
  return copia.sort((a, b) => {
    if (b.total !== a.total) {
      return b.total - a.total;
    }
    return String(a.nome).localeCompare(String(b.nome), "pt-BR", {
      sensitivity: "base",
    });
  });
}

/**
 * Apura o(s) Vencedor_Do_Dia da Sessao.
 *
 * Regras (R7.1 a R7.5):
 *  - Exige ao menos um registro no Registro_Pontos; sem registros, rejeita a
 *    apuração e mantém o estado da Sessao inalterado (R7.4).
 *  - Identifica como Vencedor_Do_Dia o(s) jogador(es) com a maior soma de
 *    pontos (R7.1).
 *  - Sinaliza `empate = true` quando mais de um jogador compartilha o total
 *    máximo, listando todos como vencedores (R7.3).
 *  - Produz a classificação completa ordenada por total decrescente e, em
 *    empate, por nome crescente (R7.2).
 *  - Persiste o resultado no armazenamento local via state.salvarSessao (R7.5)
 *    e grava `sessao.resultado = { apurado: true, vencedores, empate,
 *    classificacao }`.
 *
 * Não muta a Sessao original: devolve sempre uma nova Sessao em caso de
 * sucesso. Nunca lança.
 *
 * @param {object} sessao
 * @returns {{
 *   ok: boolean,
 *   sessao: object,
 *   vencedores?: { nome: string, total: number }[],
 *   empate?: boolean,
 *   classificacao?: { nome: string, total: number }[],
 *   erro?: string
 * }}
 */
export function apurarVencedor(sessao) {
  const registros = listaRegistros(sessao);

  // Exige ao menos uma partida registrada (R7.4).
  if (registros.length === 0) {
    return {
      ok: false,
      sessao,
      erro: "You must record at least one match to determine the winner.",
    };
  }

  // Classificação completa (total desc, nome asc) a partir dos totais (R7.2).
  const classificacaoCompleta = ordenarClassificacao(totaisPorJogador(sessao));

  // Maior total: primeiro elemento da classificação ordenada.
  const totalMaximo = classificacaoCompleta.length
    ? classificacaoCompleta[0].total
    : 0;

  // Vencedores: todos os jogadores que compartilham o total máximo (R7.1/R7.3).
  const vencedores = classificacaoCompleta
    .filter((entrada) => entrada.total === totalMaximo)
    .map((entrada) => ({ nome: entrada.nome, total: entrada.total }));

  // Empate quando mais de um jogador alcança o total máximo (R7.3).
  const empate = vencedores.length > 1;

  // Classificação exposta no retorno e persistida: apenas nome e total.
  const classificacao = classificacaoCompleta.map((entrada) => ({
    nome: entrada.nome,
    total: entrada.total,
  }));

  const resultado = {
    apurado: true,
    vencedores,
    empate,
    classificacao,
  };

  // Nova Sessao com o resultado apurado, sem mutar a original.
  const novaSessao = {
    ...sessao,
    resultado,
  };

  // Persiste o resultado no armazenamento local (R7.5). Falha de gravação não
  // invalida a apuração em memória; apenas é sinalizada em `erro`.
  const persistencia = salvarSessao(novaSessao);

  return {
    ok: true,
    sessao: novaSessao,
    vencedores,
    empate,
    classificacao,
    ...(persistencia && persistencia.ok === false
      ? { erro: persistencia.erro }
      : {}),
  };
}
