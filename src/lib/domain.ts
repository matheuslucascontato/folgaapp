import { z } from "zod";
import Decimal from "decimal.js";
export const groups = [
  "Moradia e contas",
  "Alimentação e dia a dia",
  "Transporte e trabalho",
  "Dívidas e compromissos",
  "Lazer e pessoais",
  "A identificar",
] as const;
const id = z.string().min(1).max(100);
export const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = new Date(v + "T12:00:00Z");
    return !isNaN(+d) && d.toISOString().slice(0, 10) === v;
  }, "Data inválida");
const cents = z.number().int().safe();
export const accountSchema = z.object({
  id,
  name: z.string().min(1).max(100),
  opening: cents,
  date,
  reserve: z.boolean(),
  archived: z.boolean(),
});
export const movementSchema = z.object({
  id,
  description: z.string().min(1).max(200),
  amount: cents.positive(),
  account: id,
  category: z.string().max(100),
  date,
  status: z.enum(["realizado", "previsto", "provavel"]),
  type: z.enum([
    "income",
    "expense",
    "transfer-in",
    "transfer-out",
    "refund",
    "loan",
    "adjustment",
    "adjustment-out",
  ]),
  note: z.string().max(1000).default(""),
  pair: id.optional(),
  original: id.optional(),
  occurrence: id.optional(),
  batch: id.optional(),
  activity: z.string().max(100).optional(),
  debt: id.optional(),
  receipt: id.optional(),
  competence: date.optional(),
});
export const ruleSchema = z.object({
  id,
  description: z.string().min(1),
  amount: cents.positive(),
  account: id,
  start: date,
  end: date.optional(),
  count: z.number().int().positive().max(600).optional(),
  subscription: z.boolean(),
  payroll: z.boolean(),
  category: z.string(),
  active: z.boolean(),
});
export const occurrenceSchema = z.object({
  id,
  rule: id,
  date,
  amount: cents.positive(),
  paid: id.optional(),
  cancelled: z.boolean().default(false),
});
export const debtSchema = z.object({
  id,
  creditor: z.string().min(1),
  kind: z.string(),
  balance: cents.nonnegative(),
  base: date,
  installment: cents.nonnegative(),
  remaining: z.number().int().nonnegative(),
  rate: z
    .string()
    .nullable()
    .refine((v) => v === null || /^\d+(\.\d+)?$/.test(v)),
  cet: z.string().optional(),
  due: date,
  overdue: z.boolean(),
  payroll: z.boolean(),
  note: z.string(),
});
export const contractSchema = z.object({
  id,
  description: z.string().min(1),
  total: cents.positive(),
  start: date,
  end: date,
  receipts: z.array(
    z.object({
      date,
      amount: cents.nonnegative(),
      status: z.enum(["previsto", "provavel", "realizado"]),
      account: id,
      paid: id.optional(),
    }),
  ),
});
export const taskSchema = z.object({
  id,
  title: z.string(),
  due: date,
  status: z.enum(["aberta", "concluida"]),
  potential: cents.nonnegative(),
  confirmed: cents.nonnegative(),
  effect: date.optional(),
});
export const stateSchema = z.object({
  version: z.literal(1),
  profile: z
    .object({
      name: z.string().max(100),
      timezone: z.literal("America/Sao_Paulo"),
      salaryNet: z.boolean().nullable(),
    })
    .default({ name: "", timezone: "America/Sao_Paulo", salaryNet: null }),
  onboarding: z.number().int().min(0).max(4),
  reserve: cents.nonnegative(),
  categories: z.array(z.string().min(1)).max(100),
  accounts: z.array(accountSchema),
  movements: z.array(movementSchema),
  rules: z.array(ruleSchema),
  occurrences: z.array(occurrenceSchema),
  debts: z.array(debtSchema),
  contracts: z.array(contractSchema),
  tasks: z.array(taskSchema),
  batches: z.array(
    z.object({ id, hash: z.string(), account: id, undone: z.boolean() }),
  ),
  cardDetails: z.array(
    z.object({
      id,
      payment: id,
      category: z.string(),
      amount: cents.positive(),
    }),
  ),
  activities: z.array(
    z.object({
      id,
      name: z.string(),
      platformNet: z.boolean(),
      costsComplete: z.boolean(),
    }),
  ),
});
export type State = z.infer<typeof stateSchema>;
export type Movement = z.infer<typeof movementSchema>;
export type Debt = z.infer<typeof debtSchema>;
export const uid = () => crypto.randomUUID();
export const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export const brl = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    n / 100,
  );
export const human = (d: string) => d.split("-").reverse().join("/");
export function money(v: string) {
  const clean = v.trim().replace(/R\$\s?/g, "");
  if (!/^-?(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d{1,2})?$/.test(clean))
    throw Error("Use valor brasileiro, como 1.250,50");
  const n = new Decimal(clean.replaceAll(".", "").replace(",", "."))
    .mul(100)
    .toNumber();
  if (!Number.isSafeInteger(n)) throw Error("Valor fora do limite");
  return n;
}
export function monthDate(base: string, offset: number) {
  const [y, m, d] = base.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1 + offset, 1, 12));
  const last = new Date(
    Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0),
  ).getUTCDate();
  return `${first.getUTCFullYear()}-${String(first.getUTCMonth() + 1).padStart(2, "0")}-${String(Math.min(d, last)).padStart(2, "0")}`;
}
export const monthEnd = (d: string) => {
  const [y, m] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0, 12)).toISOString().slice(0, 10);
};
export function empty(): State {
  return {
    version: 1,
    profile: { name: "", timezone: "America/Sao_Paulo", salaryNet: null },
    onboarding: 0,
    reserve: 0,
    categories: [...groups],
    accounts: [],
    movements: [],
    rules: [],
    occurrences: [],
    debts: [],
    contracts: [],
    tasks: [],
    batches: [],
    cardDetails: [],
    activities: [],
  };
}
export function validate(s: State) {
  stateSchema.parse(s);
  const magnitude = new Decimal(s.reserve)
    .plus(
      s.accounts.reduce((n, a) => n.plus(Math.abs(a.opening)), new Decimal(0)),
    )
    .plus(s.movements.reduce((n, m) => n.plus(m.amount), new Decimal(0)))
    .plus(s.occurrences.reduce((n, o) => n.plus(o.amount), new Decimal(0)));
  if (magnitude.gt(Number.MAX_SAFE_INTEGER))
    throw Error("Volume financeiro excede o limite seguro em centavos");
  const unique = (xs: { id: string }[]) => {
    if (new Set(xs.map((x) => x.id)).size !== xs.length)
      throw Error("Identificador duplicado");
  };
  [
    s.accounts,
    s.movements,
    s.rules,
    s.occurrences,
    s.debts,
    s.contracts,
    s.tasks,
    s.batches,
    s.cardDetails,
    s.activities,
  ].forEach(unique);
  const accounts = new Set(s.accounts.map((a) => a.id));
  for (const m of s.movements) {
    if (!s.categories.includes(m.category)) throw Error("Categoria inválida");
    if (m.type.startsWith("transfer-") && !m.pair)
      throw Error("Transferência sem par");
    if (m.status === "provavel" && m.type !== "income")
      throw Error("Apenas renda pode ser provável");
    if (!accounts.has(m.account)) throw Error("Conta inválida");
    if (m.debt && !s.debts.some((d) => d.id === m.debt))
      throw Error("Dívida inválida");
    if (
      m.original &&
      !s.movements.some((x) => x.id === m.original && x.type === "expense")
    )
      throw Error("Despesa original não encontrada");
    if (m.pair) {
      const legs = s.movements.filter((x) => x.pair === m.pair);
      if (
        legs.length !== 2 ||
        legs[0].account === legs[1].account ||
        legs[0].amount !== legs[1].amount ||
        legs[0].date !== legs[1].date ||
        legs[0].status !== legs[1].status ||
        !legs.some((x) => x.type === "transfer-in") ||
        !legs.some((x) => x.type === "transfer-out")
      )
        throw Error("Transferência inconsistente");
    }
  }
  for (const r of s.rules) {
    if (!accounts.has(r.account)) throw Error("Conta da recorrência inválida");
    if (r.end && r.end < r.start)
      throw Error("Último vencimento anterior ao primeiro");
  }
  for (const o of s.occurrences) {
    if (!s.rules.some((r) => r.id === o.rule)) throw Error("Regra inválida");
    if (
      o.paid &&
      !s.movements.some((m) => m.id === o.paid && m.occurrence === o.id)
    )
      throw Error("Pagamento inválido");
    if (o.paid) {
      const payment = s.movements.find((m) => m.id === o.paid)!;
      if (
        payment.type !== "expense" ||
        payment.status !== "realizado" ||
        payment.amount !== o.amount
      )
        throw Error(
          "Pagamento deve ser despesa realizada no valor da ocorrência",
        );
    }
    if (s.movements.filter((m) => m.occurrence === o.id).length > 1)
      throw Error("Pagamento duplicado");
  }
  for (const b of s.batches)
    if (!accounts.has(b.account)) throw Error("Conta do lote inválida");
  for (const c of s.contracts) {
    if (c.end < c.start) throw Error("Fim de contrato anterior ao início");
    for (const [i, r] of c.receipts.entries()) {
      if (!accounts.has(r.account)) throw Error("Conta do contrato inválida");
      if (
        r.paid &&
        !s.movements.some(
          (m) => m.id === r.paid && m.receipt === `${c.id}:${i}`,
        )
      )
        throw Error("Recebimento inválido");
    }
  }
  for (const detail of s.cardDetails) {
    const p = s.movements.find(
      (m) => m.id === detail.payment && m.type === "expense",
    );
    if (
      !p ||
      s.cardDetails
        .filter((d) => d.payment === p.id)
        .reduce((a, b) => a + b.amount, 0) > p.amount
    )
      throw Error("Detalhes excedem pagamento da fatura");
  }
  return s;
}
export function balance(s: State, account?: string, at = today()) {
  return s.accounts
    .filter((a) => (!account || a.id === account) && a.date <= at)
    .reduce(
      (sum, a) =>
        sum +
        a.opening +
        s.movements
          .filter(
            (m) =>
              m.account === a.id &&
              m.status === "realizado" &&
              m.date >= a.date &&
              m.date <= at,
          )
          .reduce((v, m) => v + signed(m), 0),
      0,
    );
}
export function signed(m: Movement) {
  return ["expense", "transfer-out", "adjustment-out"].includes(m.type)
    ? -m.amount
    : m.amount;
}
export function totals(s: State) {
  return {
    income: s.movements
      .filter((m) => m.status === "realizado" && m.type === "income")
      .reduce((a, m) => a + m.amount, 0),
    gross: s.movements
      .filter((m) => m.status === "realizado" && m.type === "expense")
      .reduce((a, m) => a + m.amount, 0),
    net: s.movements
      .filter(
        (m) =>
          m.status === "realizado" && ["expense", "refund"].includes(m.type),
      )
      .reduce((a, m) => a + (m.type === "refund" ? -m.amount : m.amount), 0),
  };
}
export function generate(s: State, from = today()) {
  for (const r of s.rules.filter((r) => r.active)) {
    for (let i = 0; i < 600; i++) {
      const d = monthDate(r.start, i);
      if (d > monthDate(from, 12)) break;
      if ((r.end && d > r.end) || (r.count && i >= r.count)) break;
      if (!s.occurrences.some((o) => o.rule === r.id && o.date === d))
        s.occurrences.push({
          id: `${r.id}:${d}`,
          rule: r.id,
          date: d,
          amount: r.amount,
          cancelled: false,
        });
    }
  }
  return s;
}
export function pay(s: State, id: string) {
  const o = s.occurrences.find((x) => x.id === id);
  if (!o) throw Error("Ocorrência não encontrada");
  if (o.paid) return s;
  const r = s.rules.find((x) => x.id === o.rule)!;
  if (o.cancelled) throw Error("Ocorrência cancelada");
  if (r.payroll) throw Error("Desconto em folha não gera saída adicional");
  const mid = uid();
  s.movements.push({
    id: mid,
    description: r.description,
    amount: o.amount,
    account: r.account,
    category: r.category,
    date: today(),
    status: "realizado",
    type: "expense",
    note: "",
    occurrence: o.id,
  });
  o.paid = mid;
  return s;
}
export function unpay(s: State, id: string) {
  const o = s.occurrences.find((x) => x.id === id)!;
  if (o.paid) removeMovement(s, o.paid);
  delete o.paid;
  return s;
}
export function removeMovement(s: State, id: string) {
  const m = s.movements.find((x) => x.id === id);
  if (!m) return;
  s.movements = s.movements.filter(
    (x) => x.id !== id && (!m.pair || x.pair !== m.pair),
  );
  s.movements.forEach((x) => {
    if (x.original === id) delete x.original;
  });
  s.cardDetails = s.cardDetails.filter((x) => x.payment !== id);
  s.contracts.forEach((c) =>
    c.receipts.forEach((r) => {
      if (r.paid === id) {
        delete r.paid;
        r.status = "previsto";
      }
    }),
  );
  s.occurrences.forEach((o) => {
    if (o.paid === id) delete o.paid;
  });
}
export function projection(
  s: State,
  end: string,
  probable = false,
  now = today(),
) {
  const available = s.accounts.filter((a) => !a.reserve);
  let value = available.reduce((n, a) => n + balance(s, a.id, now), 0);
  let min = value;
  const start = value;
  const events: { date: string; amount: number; label: string }[] = [];
  for (const m of s.movements.filter(
    (m) =>
      m.status !== "realizado" &&
      (m.status !== "provavel" || probable) &&
      available.some((a) => a.id === m.account),
  )) {
    if (m.date <= end)
      events.push({
        date: m.date < now ? now : m.date,
        amount: signed(m),
        label: m.description,
      });
  }
  for (const o of s.occurrences.filter(
    (o) => !o.paid && !o.cancelled && o.date <= end,
  )) {
    const r = s.rules.find((r) => r.id === o.rule)!;
    if (!r.payroll && available.some((a) => a.id === r.account))
      events.push({
        date: o.date < now ? now : o.date,
        amount: -o.amount,
        label: r.description,
      });
  }
  for (const c of s.contracts)
    for (const r of c.receipts)
      if (
        r.status !== "realizado" &&
        (r.status !== "provavel" || probable) &&
        r.date <= end &&
        available.some((a) => a.id === r.account)
      )
        events.push({
          date: r.date < now ? now : r.date,
          amount: r.amount,
          label: c.description,
        });
  events.sort((a, b) => a.date.localeCompare(b.date) || a.amount - b.amount);
  const steps = events.map((e) => {
    value += e.amount;
    min = Math.min(min, value);
    return { ...e, balance: value };
  });
  const missing = [];
  for (const c of s.contracts) {
    const scheduled = c.receipts.reduce((n, r) => n + r.amount, 0);
    if (scheduled !== c.total)
      missing.push(
        `Contrato ${c.description}: cronograma soma ${brl(scheduled)} de ${brl(c.total)}`,
      );
  }

  if (s.onboarding < 4)
    missing.push("Conclua ou revise o cadastro de entradas e compromissos");
  if (!s.accounts.length)
    missing.push("Cadastre uma conta e seu saldo inicial");
  if (
    !s.movements.some(
      (m) => m.type === "income" && m.status === "previsto" && m.date >= now,
    ) &&
    !s.contracts.some((c) =>
      c.receipts.some((r) => r.status === "previsto" && r.date >= now),
    )
  )
    missing.push("Informe a próxima entrada confirmada");
  return { start, min, closing: value, folga: min - s.reserve, steps, missing };
}
export function activityResult(s: State, name: string) {
  const ms = s.movements.filter(
    (m) => m.activity === name && m.status === "realizado",
  );
  return ms.reduce(
    (a, m) =>
      a +
      (m.type === "income" ? m.amount : m.type === "expense" ? -m.amount : 0),
    0,
  );
}
export function released(s: State, month: string) {
  return s.rules
    .filter(
      (r) =>
        (r.end && r.end.slice(0, 7) === monthDate(month, -1).slice(0, 7)) ||
        (r.count &&
          monthDate(r.start, r.count - 1).slice(0, 7) ===
            monthDate(month, -1).slice(0, 7)),
    )
    .reduce((a, r) => a + r.amount, 0);
}
export function simulate(
  debts: Debt[],
  extra: number,
  method: "snowball" | "avalanche",
) {
  if (!Number.isSafeInteger(extra) || extra < 0)
    throw Error("Extra deve ser não negativo em centavos");
  const excluded = debts.filter(
    (d) =>
      d.rate === null ||
      !new Decimal(d.rate).isFinite() ||
      new Decimal(d.rate).isNegative() ||
      d.overdue ||
      d.balance <= 0 ||
      d.installment <= 0,
  );
  const valid = debts.filter((d) => !excluded.includes(d));
  const budget = valid.reduce((a, d) => a + d.installment, extra);
  const balances = new Map(valid.map((d) => [d.id, d.balance]));
  const rows: {
    month: number;
    paid: number;
    interest: number;
    balance: number;
  }[] = [];
  const order: string[] = [];
  let interest = 0;
  const warnings: string[] = [];
  for (const d of valid) {
    const rate = new Decimal(d.rate!).div(100);
    if (rate.mul(d.balance).gte(d.installment))
      warnings.push(`${d.creditor}: parcela não cobre juros`);
    if (!rate.isZero()) {
      const factor = rate.add(1).pow(d.remaining);
      const expected = new Decimal(d.balance)
        .mul(rate)
        .mul(factor)
        .div(factor.minus(1));
      if (expected.minus(d.installment).abs().gt(100))
        warnings.push(`${d.creditor}: prazo e parcela não reconciliam`);
    }
  }
  monthsLoop: for (
    let month = 1;
    month <= 600 && [...balances.values()].some((b) => b > 0);
    month++
  ) {
    let mi = 0,
      paid = 0;
    const active = valid.filter((d) => balances.get(d.id)! > 0);
    for (const d of active) {
      const fee = new Decimal(balances.get(d.id)!)
        .mul(d.rate!)
        .div(100)
        .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
        .toNumber();
      if (
        !Number.isSafeInteger(fee) ||
        !Number.isSafeInteger(balances.get(d.id)! + fee) ||
        !Number.isSafeInteger(interest + mi + fee)
      ) {
        warnings.push("Projeção excede limite seguro de cálculo");
        break monthsLoop;
      }
      mi += fee;
      balances.set(d.id, balances.get(d.id)! + fee);
    }
    let remaining = budget;
    for (const d of active) {
      const p = Math.min(d.installment, balances.get(d.id)!, remaining);
      balances.set(d.id, balances.get(d.id)! - p);
      remaining -= p;
      paid += p;
    }
    active.sort((a, b) =>
      method === "snowball"
        ? balances.get(a.id)! - balances.get(b.id)!
        : new Decimal(b.rate!).cmp(a.rate!),
    );
    for (const d of active) {
      if (!order.includes(d.creditor)) order.push(d.creditor);
      const p = Math.min(remaining, balances.get(d.id)!);
      balances.set(d.id, balances.get(d.id)! - p);
      remaining -= p;
      paid += p;
    }
    interest += mi;
    const balance = [...balances.values()].reduce((a, b) => a + b, 0);
    rows.push({ month, paid, interest: mi, balance });
    if (balance > 0 && paid <= mi) {
      warnings.push("Amortização negativa: orçamento não reduz o saldo");
      break;
    }
  }
  const feasible =
    valid.length > 0 && [...balances.values()].every((b) => b === 0);
  if (!feasible && rows.length === 600)
    warnings.push("Limite de 600 meses atingido");
  return {
    rows,
    interest,
    months: feasible ? rows.length : null,
    excluded,
    order,
    warnings,
    budget,
  };
}
export function audit(s: State, now = today()) {
  const alerts: {
    id: string;
    title: string;
    why: string;
    certainty: string;
    movements: string[];
    potential: number;
  }[] = [];
  for (const r of s.rules.filter((r) => r.active && r.subscription))
    alerts.push({
      id: r.id,
      title: `Revisar assinatura: ${r.description}`,
      why: "Marcada explicitamente como assinatura; uso não foi inferido.",
      certainty: "Cadastro confirmado",
      movements: [],
      potential: r.amount,
    });
  for (const m of s.movements.filter((m) => m.category === "A identificar"))
    alerts.push({
      id: m.id,
      title: `Identificar: ${m.description}`,
      why: "Finalidade ainda não informada.",
      certainty: "Cadastro confirmado",
      movements: [m.id],
      potential: 0,
    });
  const seen = new Set<string>();
  for (const m of s.movements.filter((m) => m.type === "expense")) {
    const normalized = m.description.trim().toLowerCase();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    const similar = s.movements.filter(
      (x) =>
        x.type === "expense" &&
        x.description.trim().toLowerCase() === normalized &&
        x.amount === m.amount,
    );
    if (similar.length > 1)
      alerts.push({
        id: `repeat:${m.id}`,
        title: `Revisar repetição: ${m.description}`,
        why:
          new Set(similar.map((x) => x.date.slice(0, 7))).size > 1
            ? "Mesmo valor e descrição em meses distintos. Não comprova assinatura."
            : "Pagamentos parecidos. Podem ser legítimos.",
        certainty: "Sugestão",
        movements: similar.map((x) => x.id),
        potential: 0,
      });
  }
  for (const a of s.activities.filter((a) => !a.costsComplete))
    alerts.push({
      id: a.id,
      title: `Custos incompletos: ${a.name}`,
      why: "Combustível/manutenção ou outros custos não confirmados.",
      certainty: "Informação ausente",
      movements: s.movements
        .filter((m) => m.activity === a.name)
        .map((m) => m.id),
      potential: 0,
    });
  const next =
    s.movements
      .filter(
        (m) => m.type === "income" && m.status === "previsto" && m.date >= now,
      )
      .sort((a, b) => a.date.localeCompare(b.date))[0]?.date || monthEnd(now);
  for (const o of s.occurrences.filter(
    (o) => !o.paid && !o.cancelled && o.date < next,
  )) {
    const r = s.rules.find((r) => r.id === o.rule)!;
    if (!r.payroll)
      alerts.push({
        id: o.id,
        title: `Vencimento: ${r.description}`,
        why: `Vence em ${human(o.date)}, antes da próxima entrada ou do fim do mês.`,
        certainty: "Compromisso cadastrado",
        movements: [],
        potential: 0,
      });
  }
  for (const r of s.rules.filter(
    (r) => r.end && r.end >= now && r.end <= monthDate(now, 2),
  ))
    alerts.push({
      id: `end:${r.id}`,
      title: `Compromisso encerrando: ${r.description}`,
      why: `Fim em ${human(r.end!)}; reduz compromissos, não cria renda.`,
      certainty: "Cadastro",
      movements: [],
      potential: r.amount,
    });
  return alerts;
}

export function receiveContract(
  s: State,
  contractId: string,
  index: number,
  actualDate = today(),
) {
  const c = s.contracts.find((c) => c.id === contractId);
  if (!c) throw Error("Contrato não encontrado");
  const r = c.receipts[index];
  if (!r || r.paid || r.amount === 0) return s;
  const key = `${c.id}:${index}`;
  const found = s.movements.find((m) => m.receipt === key);
  if (found) {
    r.paid = found.id;
    r.status = "realizado";
    return s;
  }
  const mid = uid();
  s.movements.push({
    id: mid,
    description: c.description,
    amount: r.amount,
    account: r.account,
    category: "Transporte e trabalho",
    date: actualDate,
    status: "realizado",
    type: "income",
    note: "Recebimento de contrato",
    receipt: key,
  });
  r.status = "realizado";
  r.paid = mid;
  return s;
}
export function addLoan(s: State, m: Movement) {
  if (m.status !== "realizado") {
    s.movements.push(m);
    return;
  }
  const id = uid();
  s.debts.push({
    id,
    creditor: m.description,
    kind: "Empréstimo recebido",
    balance: m.amount,
    base: m.date,
    installment: 0,
    remaining: 0,
    rate: null,
    due: m.date,
    overdue: false,
    payroll: false,
    note: "Passivo criado com a entrada de caixa. Complete as condições antes de simular.",
  });
  m.debt = id;
  s.movements.push(m);
}
export function expenseGroups(s: State, month = today().slice(0, 7)) {
  return s.categories
    .map((category) => ({
      category,
      amount: s.movements
        .filter(
          (m) =>
            m.date.startsWith(month) &&
            m.status === "realizado" &&
            m.category === category &&
            ["expense", "refund"].includes(m.type),
        )
        .reduce((n, m) => n + (m.type === "refund" ? -m.amount : m.amount), 0),
    }))
    .filter((x) => x.amount !== 0);
}

export function contractAverage(c: State["contracts"][number]) {
  const start = c.start.split("-").map(Number),
    end = c.end.split("-").map(Number);
  const months = (end[0] - start[0]) * 12 + end[1] - start[1] + 1;
  return new Decimal(c.total)
    .div(months)
    .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
    .toNumber();
}
