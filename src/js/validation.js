// Módulo de validações puras da Scoreboard_App.
// Todas as funções são puras: não tocam no DOM, não acessam o localStorage
// e não lançam exceções. Retornam resultados no formato { valido, ..., erro? }
// com mensagens em português do Brasil.

/**
 * Normaliza um nome removendo os espaços das extremidades.
 * Valores que não sejam string resultam em string vazia.
 * @param {string} valor
 * @returns {string}
 */
export function normalizarNome(valor) {
  if (typeof valor !== "string") {
    return "";
  }
  return valor.trim();
}

/**
 * Valida o nome de um Jogo_Personalizado.
 * Regra: após remover os espaços das extremidades, deve conter de 1 a 60 caracteres.
 * @param {string} valor
 * @returns {{ valido: boolean, nome?: string, erro?: string }}
 */
export function validarNomeJogo(valor) {
  const nome = normalizarNome(valor);
  if (nome.length < 1 || nome.length > 60) {
    return {
      valido: false,
      erro: "The game name must be 1 to 60 characters long.",
    };
  }
  return { valido: true, nome };
}

/**
 * Valida o nome de um Jogador.
 * Regra: após remover os espaços das extremidades, deve conter de 1 a 40 caracteres.
 * @param {string} valor
 * @returns {{ valido: boolean, nome?: string, erro?: string }}
 */
export function validarNomeJogador(valor) {
  const nome = normalizarNome(valor);
  if (nome.length < 1 || nome.length > 40) {
    return {
      valido: false,
      erro: "The player name must be 1 to 40 characters long.",
    };
  }
  return { valido: true, nome };
}

/**
 * Valida um Valor_Pontuacao.
 * Regra: deve ser um número inteiro entre 1 e 1000 inclusive.
 * Aceita strings numéricas inteiras (ex.: "500"); rejeita floats, NaN,
 * strings não numéricas, valores fora do intervalo e tipos inesperados.
 * @param {unknown} valor
 * @returns {{ valido: boolean, valor?: number, erro?: string }}
 */
export function validarValorPontuacao(valor) {
  const erro = {
    valido: false,
    erro: "The point value must be a whole number between 1 and 1000.",
  };

  let numero;
  if (typeof valor === "number") {
    numero = valor;
  } else if (typeof valor === "string") {
    const texto = valor.trim();
    // Rejeita string vazia e qualquer formato que não seja um inteiro puro
    // (sem sinal de ponto decimal, notação científica ou caracteres extras).
    if (texto === "" || !/^[+-]?\d+$/.test(texto)) {
      return erro;
    }
    numero = Number(texto);
  } else {
    return erro;
  }

  if (!Number.isInteger(numero) || numero < 1 || numero > 1000) {
    return erro;
  }

  return { valido: true, valor: numero };
}

/**
 * Compara dois nomes ignorando a caixa (maiúsculas/minúsculas) e os espaços
 * das extremidades.
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
export function nomesEquivalentes(a, b) {
  return normalizarNome(a).toLocaleLowerCase() === normalizarNome(b).toLocaleLowerCase();
}
