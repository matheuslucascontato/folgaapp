import fs from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
let config;
try {
  config = fs.existsSync(".local-backend.json")
    ? JSON.parse(fs.readFileSync(".local-backend.json", "utf8"))
    : JSON.parse(
        execFileSync("node_modules/.bin/supabase", ["status", "-o", "json"], {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
        }),
      );
} catch {
  console.error(
    "Supabase local indisponível. Execute npx supabase start antes destes testes.",
  );
  process.exit(1);
}
const result = spawnSync(
  "node_modules/.bin/vitest",
  ["run", "--config", "vitest.backend.config.ts"],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      SUPABASE_TEST_URL: config.API_URL,
      SUPABASE_TEST_KEY: config.ANON_KEY,
      SUPABASE_TEST_ADMIN: config.SERVICE_ROLE_KEY,
    },
  },
);
process.exit(result.status ?? 1);
