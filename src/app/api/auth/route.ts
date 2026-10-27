import { sameOrigin, publicOrigin } from "@/lib/request";
import { NextRequest, NextResponse } from "next/server";
import { serverClient } from "@/lib/supabase";
import { z } from "zod";
export async function POST(req: NextRequest) {
  try {
    if (!sameOrigin(req)) throw Error("Origem inválida");
    const { email, password, action } = z
      .object({
        email: z.email().optional(),
        password: z.string().min(8).max(128).optional(),
        action: z.enum(["login", "signup", "recover", "update", "logout"]),
      })
      .parse(await req.json());
    const db = await serverClient();
    let error;
    if (action === "logout") ({ error } = await db.auth.signOut());
    else if (action === "recover")
      ({ error } = await db.auth.resetPasswordForEmail(email!, {
        redirectTo: publicOrigin(req) + "/auth/confirm?next=/login?recovery=1",
      }));
    else if (action === "update") {
      const {
        data: { user },
      } = await db.auth.getUser();
      if (!user) throw Error("Link expirado. Solicite nova recuperação.");
      ({ error } = await db.auth.updateUser({ password }));
    } else if (action === "signup")
      ({ error } = await db.auth.signUp({
        email: email!,
        password: password!,
        options: { emailRedirectTo: publicOrigin(req) + "/auth/confirm" },
      }));
    else
      ({ error } = await db.auth.signInWithPassword({
        email: email!,
        password: password!,
      }));
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
