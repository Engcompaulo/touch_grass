// Polyfill leve de localStorage para os testes rodarem no ambiente "node".
// O ambiente jsdom não inicializa sobre o monte 9p do WSL (/mnt/d), então
// fornecemos uma implementação mínima e suficiente de localStorage.
class MemoryStorage {
  constructor() {
    this.map = new Map();
  }
  get length() {
    return this.map.size;
  }
  getItem(chave) {
    const k = String(chave);
    return this.map.has(k) ? this.map.get(k) : null;
  }
  setItem(chave, valor) {
    this.map.set(String(chave), String(valor));
  }
  removeItem(chave) {
    this.map.delete(String(chave));
  }
  clear() {
    this.map.clear();
  }
  key(indice) {
    return Array.from(this.map.keys())[indice] ?? null;
  }
}

if (typeof globalThis.localStorage === "undefined") {
  globalThis.localStorage = new MemoryStorage();
}
