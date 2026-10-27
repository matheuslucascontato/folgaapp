import { publicOrigin } from "@/lib/request";
import { NextRequest, NextResponse } from "next/server";
import { serverClient } from "@/lib/supabase";
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (code) {
    const db = await serverClient();
    const { error } = await db.auth.exchangeCodeForSession(code);
    if (!error) {
      const next = req.nextUrl.searchParams.get("next");
      return NextResponse.redirect(
        new URL(
          next === "/login?recovery=1" ? next : "/app",
          publicOrigin(req),
        ),
      );
    }
  }
  return NextResponse.redirect(
    new URL("/login?error=Link%20inválido%20ou%20expirado", publicOrigin(req)),
  );
}
