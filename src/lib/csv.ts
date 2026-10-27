import {
  money,
  date,
  State,
  Movement,
  uid,
  validate,
  removeMovement,
} from "./domain";
export const safeCell = (v: string) =>
  /^[\s]*[=+\-@\t\r]/.test(v) ? `'${v}` : v;
export function csv(rows: (string | number)[][]) {
  return (
    "\uFEFF" +
    rows
      .map((row) =>
        row
          .map(
            (v) =>
              '"' +
              (typeof v === "number" ? String(v) : safeCell(v)).replaceAll(
                '"',
                '""',
              ) +
              '"',
          )
          .join(";"),
      )
      .join("\r\n")
  );
}
export function parseCSV(text: string) {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false;
  const delimiter = text.split("\n")[0].includes(";") ? ";" : ",";
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === delimiter && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (quoted) throw Error("Aspas CSV não fechadas");
  row.push(cell);
  if (row.some(Boolean)) rows.push(row);
  return rows.map((r) => r.map((c) => c.replace(/^\uFEFF/, "")));
}
export async function hash(text: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)),
    ),
  )
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
export function preview(
  rows: string[][],
  mapping: { description: number; date: number; amount: number; type: number },
  s: State,
  account: string,
) {
  return rows.slice(1).map((r, i) => {
    try {
      let d = r[mapping.date];
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(d)) d = d.split("/").reverse().join("-");
      date.parse(d);
      const amount = money(r[mapping.amount]);
      if (amount <= 0) throw Error("Valor deve ser positivo");
      const t = r[mapping.type]?.toLowerCase();
      if (!["entrada", "despesa"].includes(t))
        throw Error(
          "Tipo deve ser entrada ou despesa; revise transferências manualmente",
        );
      const m: Movement = {
        id: uid(),
        description: r[mapping.description],
        date: d,
        amount,
        type: t === "entrada" ? "income" : "expense",
        account,
        category: "A identificar",
        status: "realizado",
        note: "",
      };
      if (!m.description) throw Error("Descrição obrigatória");
      return {
        line: i + 2,
        movement: m,
        error: "",
        duplicate: s.movements.some(
          (x) =>
            x.account === account &&
            x.date === m.date &&
            x.amount === m.amount &&
            x.type === m.type &&
            x.description.trim().toLowerCase() ===
              m.description.trim().toLowerCase(),
        ),
      };
    } catch (e) {
      return {
        line: i + 2,
        movement: null,
        error: (e as Error).message,
        duplicate: false,
      };
    }
  });
}
export function importBatch(
  s: State,
  batchId: string,
  fileHash: string,
  account: string,
  ms: Movement[],
  allowRepeat = false,
) {
  if (s.batches.some((b) => b.id === batchId)) return s;
  if (
    s.batches.some(
      (b) => b.hash === fileHash && b.account === account && !b.undone,
    ) &&
    !allowRepeat
  )
    throw Error("Arquivo já importado. Confirme explicitamente a repetição.");
  const next = structuredClone(s);
  next.batches.push({ id: batchId, hash: fileHash, account, undone: false });
  next.movements.push(...ms.map((m) => ({ ...m, account, batch: batchId })));
  return validate(next);
}
export function undoBatch(s: State, id: string) {
  s.movements
    .filter((m) => m.batch === id)
    .forEach((m) => removeMovement(s, m.id));
  const b = s.batches.find((b) => b.id === id);
  if (b) b.undone = true;
  return s;
}
