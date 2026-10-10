import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
    env: { LOG_LEVEL: "silent" },
    // `server-only` throws outside a React Server environment; stub it for unit tests.
    alias: {
      // fileURLToPath, not `.pathname`: a folder name with spaces must not stay percent-encoded.
      "server-only": fileURLToPath(new URL("./tests/unit/stubs/server-only.ts", import.meta.url)),
    },
  },
});
