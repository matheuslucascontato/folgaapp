import { defineConfig } from "vitest/config";
export default defineConfig({
  test: { include: ["tests/backend/**/*.integration.ts"], testTimeout: 30000 },
});
