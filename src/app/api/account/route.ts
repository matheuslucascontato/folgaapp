import { sameOrigin } from "@/lib/request";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { serverClient } from "@/lib/supabase";
import { z } from "zod";
export async function DELETE(req: NextRequest) {
  try {
    if (!sameOrigin(req)) throw Error("Origem inválida");
    const body = z
      .object({
        password: z.string().min(8),
        confirmation: z.literal("EXCLUIR"),
      })
      .parse(await req.json());
    const db = await serverClient();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user?.email)
      return NextResponse.json({ error: "Sessão inválida" }, { status: 401 });
    const { error } = await db.auth.signInWithPassword({
      email: user.email,
      password: body.password,
    });
    if (error) throw Error("Reautenticação falhou");
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY)
      throw Error(
        "Exclusão de conta exige configuração administrativa no servidor",
      );
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } },
    );
    const result = await admin.auth.admin.deleteUser(user.id);
    if (result.error) throw result.error;
    await db.auth.signOut();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
