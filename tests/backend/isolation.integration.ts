import { test, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { empty, uid, generate, pay } from "../../src/lib/domain";
import { importBatch } from "../../src/lib/csv";
test("A/B/anônimo, referências, concorrência e atomicidade pelo Supabase real local", async () => {
  const url = process.env.SUPABASE_TEST_URL!,
    key = process.env.SUPABASE_TEST_KEY!,
    admin = createClient(url, process.env.SUPABASE_TEST_ADMIN!, {
      auth: { persistSession: false },
    });
  const a = createClient(url, key, { auth: { persistSession: false } }),
    b = createClient(url, key, { auth: { persistSession: false } }),
    anon = createClient(url, key, { auth: { persistSession: false } });
  const ids: string[] = [];
  try {
    for (const client of [a, b]) {
      const email = `folga-${uid()}@example.test`,
        password = uid() + "aA1!";
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      expect(error).toBeNull();
      ids.push(data.user!.id);
      expect(
        (await client.auth.signInWithPassword({ email, password })).error,
      ).toBeNull();
    }
    const sa = empty();
    sa.accounts.push({
      id: "A",
      name: "Fictícia A",
      opening: 10000,
      date: "2026-01-01",
      reserve: false,
      archived: false,
    });
    const sb = empty();
    sb.accounts.push({
      id: "B",
      name: "Fictícia B",
      opening: 90000,
      date: "2026-01-01",
      reserve: false,
      archived: false,
    });
    expect(
      (
        await a.rpc("save_financial_data", {
          payload: sa,
          expected_revision: 0,
        })
      ).error,
    ).toBeNull();
    expect(
      (
        await b.rpc("save_financial_data", {
          payload: sb,
          expected_revision: 0,
        })
      ).error,
    ).toBeNull();
    expect(
      (await a.from("financial_data").select().eq("user_id", ids[1])).data,
    ).toEqual([]);
    expect(
      (
        await a
          .from("financial_data")
          .update({ data: sa })
          .eq("user_id", ids[1])
          .select()
      ).data,
    ).toEqual([]);
    expect(
      (await a.from("financial_data").delete().eq("user_id", ids[1]).select())
        .data,
    ).toEqual([]);
    expect(
      (await a.from("financial_data").insert({ user_id: ids[1], data: sa }))
        .error,
    ).not.toBeNull();
    const ar = await anon.from("financial_data").select();
    expect(ar.error !== null || ar.data?.length === 0).toBe(true);
    expect(
      (
        await anon.rpc("save_financial_data", {
          payload: sa,
          expected_revision: 0,
        })
      ).error,
    ).not.toBeNull();
    const invalid = structuredClone(sa);
    invalid.movements.push({
      id: "bad",
      description: "Referência B",
      amount: 10,
      account: "B",
      category: "A identificar",
      date: "2026-10-10",
      status: "realizado",
      type: "expense",
      note: "",
    });
    expect(
      (
        await a.rpc("save_financial_data", {
          payload: invalid,
          expected_revision: 1,
        })
      ).error,
    ).not.toBeNull();
    expect(
      (await a.from("financial_data").select("revision").single()).data
        ?.revision,
    ).toBe(1);
    sa.rules.push({
      id: "r",
      description: "Conta",
      amount: 1000,
      account: "A",
      start: "2026-10-10",
      count: 1,
      subscription: false,
      payroll: false,
      category: "Moradia e contas",
      active: true,
    });
    generate(sa, "2026-10-10");
    pay(sa, sa.occurrences[0].id);
    pay(sa, sa.occurrences[0].id);
    expect(
      (
        await a.rpc("save_financial_data", {
          payload: sa,
          expected_revision: 1,
        })
      ).error,
    ).toBeNull();
    expect(
      (
        await a.rpc("save_financial_data", {
          payload: sa,
          expected_revision: 1,
        })
      ).error,
    ).not.toBeNull();
    let saved = (await a.from("financial_data").select().single()).data;
    expect(saved.data.movements).toHaveLength(1);
    const imported = importBatch(sa, "batch", "hash", "A", [
      {
        id: "import",
        description: "CSV fictício",
        amount: 100,
        account: "A",
        category: "A identificar",
        date: "2026-10-10",
        status: "realizado",
        type: "expense",
        note: "",
      },
    ]);
    const repeated = importBatch(imported, "batch", "hash", "A", []);
    expect(
      (
        await a.rpc("save_financial_data", {
          payload: repeated,
          expected_revision: 2,
        })
      ).error,
    ).toBeNull();
    const broken = structuredClone(repeated);
    broken.movements.push({
      id: "partial",
      description: "Transferência incompleta",
      amount: 500,
      account: "A",
      category: "A identificar",
      date: "2026-10-10",
      status: "realizado",
      type: "transfer-out",
      note: "",
      pair: "broken",
    });
    expect(
      (
        await a.rpc("save_financial_data", {
          payload: broken,
          expected_revision: 3,
        })
      ).error,
    ).not.toBeNull();
    saved = (await a.from("financial_data").select().single()).data;
    expect(saved.revision).toBe(3);
    expect(saved.data.movements).toHaveLength(2);
  } finally {
    for (const id of ids) await admin.auth.admin.deleteUser(id);
  }
});
