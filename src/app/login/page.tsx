"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
export default function Login() {
  const router = useRouter();
  const [action, setAction] = useState("login");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const configured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
  return (
    <main className="auth panel">
      <Link className="brand" href="/">
        FOLGA
      </Link>
      <h1>Um pouco mais de clareza.</h1>
      {!configured ? (
        <div role="status" className="notice">
          Modo real ainda não configurado. Defina NEXT_PUBLIC_SUPABASE_URL e
          NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY e aplique a migration.{" "}
          <Link href="/demo">Explorar a demonstração fictícia</Link>.
        </div>
      ) : (
        <>
          <p>Entre por e-mail. Não pedimos dados bancários.</p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setMessage("");
              const f = new FormData(e.currentTarget);
              const mode = new URLSearchParams(location.search).has("recovery")
                ? "update"
                : action;
              try {
                const r = await fetch("/api/auth", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    action: mode,
                    email: f.get("email"),
                    password: f.get("password") || undefined,
                  }),
                });
                const data = await r.json();
                if (!r.ok) throw Error(data.error);
                if (mode === "login" || mode === "update") {
                  router.push("/app");
                  router.refresh();
                } else
                  setMessage(
                    mode === "signup"
                      ? "Confira seu e-mail para confirmar o cadastro."
                      : "Se a conta existir, enviaremos instruções de recuperação.",
                  );
              } catch (e) {
                setMessage((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              E-mail
              <input type="email" name="email" required autoComplete="email" />
            </label>
            {action !== "recover" && (
              <label>
                Senha (mínimo 8 caracteres)
                <input
                  name="password"
                  type="password"
                  minLength={8}
                  required
                  autoComplete={
                    action === "signup" ? "new-password" : "current-password"
                  }
                />
              </label>
            )}
            <button disabled={busy}>
              {busy
                ? "Aguarde…"
                : new URLSearchParams(
                      typeof window === "undefined"
                        ? ""
                        : window.location.search,
                    ).has("recovery")
                  ? "Salvar nova senha"
                  : action === "login"
                    ? "Entrar"
                    : action === "signup"
                      ? "Criar conta"
                      : "Enviar recuperação"}
            </button>
          </form>
          <div className="actions">
            <button
              className="text"
              onClick={() =>
                setAction(action === "signup" ? "login" : "signup")
              }
            >
              {action === "signup" ? "Já tenho conta" : "Criar conta"}
            </button>
            <button className="text" onClick={() => setAction("recover")}>
              Esqueci minha senha
            </button>
          </div>
        </>
      )}
      {message && <p role="status">{message}</p>}
    </main>
  );
}
