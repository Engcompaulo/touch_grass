import { defineConfig } from "vitest/config";

// Configuração dos testes do Board Game Scoreboard.
// Ambiente padrão "node" com um polyfill leve de localStorage (setup.js),
// porque o ambiente jsdom não inicializa sobre o monte 9p do WSL (/mnt/d).
// Pool "forks" evita o crash (SIGABRT) do pool de threads padrão no WSL.
// Execução sempre em modo single-run via o script "test" (vitest --run).
export default defineConfig({
  test: {
    environment: "node",
    pool: "forks",
    setupFiles: ["./tests/setup.js"],
    include: ["tests/**/*.test.js"],
    globals: true,
  },
});
