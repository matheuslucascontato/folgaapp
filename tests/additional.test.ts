import { it, expect } from "vitest";
import {
  empty,
  addLoan,
  receiveContract,
  validate,
  projection,
  totals,
  balance,
  removeMovement,
  Movement,
} from "../src/lib/domain";
function base() {
  const s = empty();
  s.accounts.push({
    id: "a",
    name: "Conta fictícia",
    opening: 0,
    date: "2026-01-01",
    reserve: false,
    archived: false,
  });
  return s;
}
it("empréstimo realizado aumenta caixa e passivo sem renda, previsto não antecipa passivo", () => {
  const s = base();
  const m: Movement = {
    id: "loan",
    description: "Empréstimo fictício",
    amount: 100000,
    account: "a",
    date: "2026-10-10",
    status: "realizado",
    type: "loan",
    category: "A identificar",
    note: "",
  };
  addLoan(s, m);
  validate(s);
  expect(balance(s, "a", "2026-10-10")).toBe(100000);
  expect(totals(s).income).toBe(0);
  expect(s.debts[0].balance).toBe(100000);
  expect(s.debts[0].rate).toBeNull();
  const next = base();
  addLoan(next, { ...m, id: "planned", status: "previsto" });
  expect(next.debts).toHaveLength(0);
});
it("recebimento de contrato idempotente, sem dupla previsão e reversível", () => {
  const s = base();
  s.contracts.push({
    id: "c",
    description: "Contrato fictício",
    total: 360000,
    start: "2026-10-01",
    end: "2026-12-31",
    receipts: [
      { date: "2026-10-15", amount: 260000, status: "previsto", account: "a" },
      { date: "2026-11-15", amount: 100000, status: "previsto", account: "a" },
    ],
  });
  receiveContract(s, "c", 0, "2026-10-15");
  receiveContract(s, "c", 0, "2026-10-15");
  expect(s.movements).toHaveLength(1);
  validate(s);
  expect(projection(s, "2026-12-31", false, "2026-10-15").closing).toBe(360000);
  removeMovement(s, s.movements[0].id);
  expect(s.contracts[0].receipts[0].status).toBe("previsto");
  expect(s.movements).toHaveLength(0);
});
it("transferência sem par é rejeitada pelo mesmo domínio que atende os dois modos", () => {
  const s = base();
  s.movements.push({
    id: "m",
    description: "Par incompleto",
    amount: 10,
    account: "a",
    category: "A identificar",
    date: "2026-10-10",
    status: "realizado",
    type: "transfer-out",
    note: "",
  });
  expect(() => validate(s)).toThrow("Transferência sem par");
});
it("pagamento não pode virar previsão/receita mantendo ocorrência paga", async () => {
  const { generate, pay } = await import("../src/lib/domain");
  const s = base();
  s.rules.push({
    id: "r",
    description: "Compromisso fictício",
    amount: 1000,
    account: "a",
    start: "2026-10-01",
    count: 1,
    subscription: false,
    payroll: false,
    category: "A identificar",
    active: true,
  });
  generate(s, "2026-10-01");
  pay(s, s.occurrences[0].id);
  s.movements[0].type = "income";
  expect(() => validate(s)).toThrow("Pagamento deve ser despesa");
});
