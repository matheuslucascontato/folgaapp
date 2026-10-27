import { sameOrigin } from "@/lib/request";
import { NextRequest, NextResponse } from "next/server";
import { serverClient } from "@/lib/supabase";
import { empty, stateSchema, validate } from "@/lib/domain";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const db = await serverClient();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user)
      return NextResponse.json(
        { error: "Entre na sua conta" },
        { status: 401 },
      );
    const { data, error } = await db
      .from("financial_data")
      .select("data,revision")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw error;
    return NextResponse.json(data || { data: empty(), revision: 0 }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
export async function PUT(req: NextRequest) {
  try {
    if (!sameOrigin(req))
      return NextResponse.json({ error: "Origem inválida" }, { status: 403 });
    const db = await serverClient();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user)
      return NextResponse.json(
        { error: "Entre na sua conta" },
        { status: 401 },
      );
    const body = await req.json();
    const state = validate(stateSchema.parse(body.data));
    const { data, error } = await db.rpc("save_financial_data", {
      payload: state,
      expected_revision: body.revision,
    });
    if (error) throw error;
    return NextResponse.json(
      { revision: data },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 409 });
  }
}
