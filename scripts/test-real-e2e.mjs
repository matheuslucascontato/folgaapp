import fs from "node:fs";
import { execFileSync, spawn } from "node:child_process";
const cfg = fs.existsSync(".local-backend.json")
  ? JSON.parse(fs.readFileSync(".local-backend.json", "utf8"))
  : JSON.parse(
      execFileSync("node_modules/.bin/supabase", ["status", "-o", "json"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      }),
    );
const env = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: cfg.API_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: cfg.ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: cfg.SERVICE_ROLE_KEY,
  TEST_SUPABASE_URL: cfg.API_URL,
  TEST_SUPABASE_KEY: cfg.ANON_KEY,
  TEST_SUPABASE_ADMIN: cfg.SERVICE_ROLE_KEY,
  TEST_BASE_URL: "http://127.0.0.1:3001",
};
const server = spawn(
  "node_modules/.bin/next",
  ["dev", "--port", "3001", "--hostname", "127.0.0.1"],
  { env, stdio: ["ignore", "pipe", "pipe"] },
);
server.stdout.on("data", () => {});
server.stderr.on("data", () => {});
try {
  let ready = false;
  for (let i = 0; i < 120; i++) {
    try {
      const r = await fetch(env.TEST_BASE_URL + "/login");
      if (r.ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!ready) throw Error("Servidor de teste não iniciou");
  const runner = spawn(
    "node_modules/.bin/playwright",
    ["test", "real.spec.ts"],
    { env, stdio: "inherit" },
  );
  const status = await new Promise((r) => runner.on("exit", r));
  process.exitCode = status ?? 1;
} finally {
  server.kill("SIGTERM");
}
