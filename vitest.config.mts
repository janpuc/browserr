import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    // Stub the `server-only` marker so server modules can be unit-tested.
    alias: { "server-only": new URL("./test/server-only-stub.js", import.meta.url).pathname },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
