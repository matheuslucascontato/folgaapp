// Backend local descartável: serviços oficiais GoTrue/PostgREST + PostgreSQL.
import { execFileSync as exec } from "node:child_process";
import { randomBytes, createHmac } from "node:crypto";
import fs from "node:fs";
import http from "node:http";
const docker = (...args) => {
  try {
    return exec("docker", args, { stdio: ["ignore", "pipe", "pipe"] });
  } catch {
    throw Error(
      "Docker falhou em " +
        args.slice(0, 2).join(" ") +
        ". Verifique os serviços locais; argumentos sensíveis não são registrados.",
    );
  }
};
const secret = randomBytes(48).toString("hex");
function jwt(role) {
  const head = Buffer.from(
      JSON.stringify({ alg: "HS256", typ: "JWT" }),
    ).toString("base64url"),
    body = Buffer.from(
      JSON.stringify({
        role,
        iss: "supabase-local",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 86400,
      }),
    ).toString("base64url");
  return (
    head +
    "." +
    body +
    "." +
    createHmac("sha256", secret)
      .update(head + "." + body)
      .digest("base64url")
  );
}
try {
  docker("network", "create", "folga-services");
} catch {}
for (const name of ["folga-auth", "folga-rest", "folga-auth-db"]) {
  try {
    docker("rm", "-f", name);
  } catch {}
}
docker(
  "run",
  "-d",
  "--name",
  "folga-auth-db",
  "--network",
  "folga-services",
  "-e",
  "POSTGRES_HOST_AUTH_METHOD=trust",
  "postgres:15-alpine",
);
for (let i = 0; i < 30; i++) {
  try {
    docker("exec", "folga-auth-db", "pg_isready", "-U", "postgres");
    break;
  } catch {
    await new Promise((r) => setTimeout(r, 500));
  }
}
docker(
  "exec",
  "folga-auth-db",
  "psql",
  "-U",
  "postgres",
  "-v",
  "ON_ERROR_STOP=1",
  "-c",
  "create schema auth; alter role postgres set search_path=auth,public; create role authenticated nologin; create role anon nologin; create role service_role nologin bypassrls; create role authenticator login noinherit; grant anon,authenticated,service_role to authenticator;",
);
const authEnv = {
  GOTRUE_API_HOST: "0.0.0.0",
  GOTRUE_API_PORT: "9999",
  API_EXTERNAL_URL: "http://127.0.0.1:54321",
  GOTRUE_SITE_URL: "http://127.0.0.1:3001",
  GOTRUE_URI_ALLOW_LIST: "http://127.0.0.1:3001/**",
  GOTRUE_DB_DRIVER: "postgres",
  GOTRUE_DB_DATABASE_URL:
    "postgres://postgres@folga-auth-db:5432/postgres?sslmode=disable",
  GOTRUE_DB_NAMESPACE: "auth",
  GOTRUE_JWT_SECRET: secret,
  GOTRUE_JWT_EXP: "3600",
  GOTRUE_JWT_AUD: "authenticated",
  GOTRUE_JWT_DEFAULT_GROUP_NAME: "authenticated",
  GOTRUE_JWT_ADMIN_ROLES: "service_role",
  GOTRUE_DISABLE_SIGNUP: "false",
  GOTRUE_EXTERNAL_EMAIL_ENABLED: "true",
  GOTRUE_MAILER_AUTOCONFIRM: "true",
};
docker(
  "run",
  "-d",
  "--name",
  "folga-auth",
  "--network",
  "folga-services",
  "-p",
  "127.0.0.1:54323:9999",
  ...Object.entries(authEnv).flatMap(([k, v]) => ["-e", `${k}=${v}`]),
  "ghcr.io/supabase/gotrue:v2.197.0",
);
let ready = false;
for (let i = 0; i < 120; i++) {
  try {
    const r = await fetch("http://127.0.0.1:54323/health");
    if (r.ok) {
      ready = true;
      break;
    }
  } catch {}
  await new Promise((r) => setTimeout(r, 500));
}
if (!ready)
  throw Error(
    "GoTrue não iniciou; examine docker logs folga-auth (somente fixtures).",
  );
const bootstrap =
  "grant usage on schema auth,public to authenticated,anon,service_role; grant execute on function auth.uid() to authenticated,anon,service_role;";
docker(
  "exec",
  "folga-auth-db",
  "psql",
  "-U",
  "postgres",
  "-v",
  "ON_ERROR_STOP=1",
  "-c",
  bootstrap,
);
for (const file of fs.readdirSync("supabase/migrations").sort()) {
  exec(
    "docker",
    [
      "exec",
      "-i",
      "folga-auth-db",
      "psql",
      "-U",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
    ],
    {
      input: fs.readFileSync("supabase/migrations/" + file),
      stdio: ["pipe", "pipe", "pipe"],
    },
  );
}
docker(
  "exec",
  "folga-auth-db",
  "psql",
  "-U",
  "postgres",
  "-v",
  "ON_ERROR_STOP=1",
  "-c",
  "grant all on all tables in schema public to service_role; grant execute on all functions in schema public to service_role;",
);
docker(
  "run",
  "-d",
  "--name",
  "folga-rest",
  "--network",
  "folga-services",
  "-p",
  "127.0.0.1:54324:3000",
  "-e",
  "PGRST_DB_URI=postgres://authenticator@folga-auth-db:5432/postgres",
  "-e",
  "PGRST_DB_SCHEMAS=public",
  "-e",
  "PGRST_DB_ANON_ROLE=anon",
  "-e",
  `PGRST_JWT_SECRET=${secret}`,
  "ghcr.io/supabase/postgrest:v16.5",
);
const cfg = {
  API_URL: "http://127.0.0.1:54321",
  ANON_KEY: jwt("anon"),
  SERVICE_ROLE_KEY: jwt("service_role"),
};
fs.writeFileSync(".local-backend.json", JSON.stringify(cfg), { mode: 0o600 });
http
  .createServer((req, res) => {
    const isAuth = req.url.startsWith("/auth/v1");
    const target = http.request(
      {
        hostname: "127.0.0.1",
        port: isAuth ? 54323 : 54324,
        path: req.url.replace(isAuth ? "/auth/v1" : "/rest/v1", "") || "/",
        method: req.method,
        headers: req.headers,
      },
      (r) => {
        res.writeHead(r.statusCode || 500, r.headers);
        r.pipe(res);
      },
    );
    target.on("error", () => {
      res.writeHead(502);
      res.end("Backend local não disponível");
    });
    req.pipe(target);
  })
  .listen(54321, "127.0.0.1", () =>
    console.log(
      "Backend local oficial de testes disponível (sem chaves nos logs).",
    ),
  );
