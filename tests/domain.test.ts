import { describe, it, expect } from "vitest";
import * as D from "../src/lib/domain";
import { importBatch, undoBatch, parseCSV, preview, csv } from "../src/lib/csv";
const now = "2026-10-10";
function state() {
  const s = D.empty();
  s.accounts = [
    {
      id: "a",
      name: "Conta",
      date: "2026-01-01",
      opening: 10000,
      reserve: false,
      archived: false,
    },
    {
      id: "b",
      name: "Outra",
      date: "2026-01-01",
      opening: 0,
      reserve: false,
      archived: false,
    },
  ];
  return s;
}
function movement(overrides: Partial<D.Movement> = {}): D.Movement {
  return {
    id: D.uid(),
    description: "Exemplo",
    amount: 10000,
    account: "a",
    category: "A identificar",
    date: now,
    status: "realizado",
    type: "expense",
    note: "",
    ...overrides,
  };
}
function rule(s: D.State, payroll = false) {
  s.rules.push({
    id: "r",
    description: "Parcela",
    amount: 27000,
    account: "a",
    start: "2026-10-10",
    count: 2,
    subscription: false,
    payroll,
    category: "Dívidas e compromissos",
    active: true,
  });
  return D.generate(s, now);
}
const debt = (o: Partial<D.Debt> = {}): D.Debt => ({
  id: "d",
  creditor: "Exemplo",
  kind: "Empréstimo",
  balance: 10000,
  base: now,
  installment: 3000,
  remaining: 4,
  rate: "0",
  due: now,
  overdue: false,
  payroll: false,
  note: "",
  ...o,
});
describe("Regras de caixa", () => {
  it("transferência atômica mantém consolidado e não vira receita/despesa", () => {
    const s = state();
    s.movements.push(
      movement({ amount: 2500, type: "transfer-out", pair: "p" }),
      movement({ amount: 2500, type: "transfer-in", account: "b", pair: "p" }),
    );
    D.validate(s);
    expect(D.balance(s, "a", now)).toBe(7500);
    expect(D.balance(s, "b", now)).toBe(2500);
    expect(D.balance(s, undefined, now)).toBe(10000);
    expect(D.totals(s)).toEqual({ income: 0, gross: 0, net: 0 });
  });
  it("rejeita transferência para mesma conta e par incompleto", () => {
    const s = state();
    s.movements.push(movement({ type: "transfer-out", pair: "p" }));
    expect(() => D.validate(s)).toThrow();
    s.movements.push(movement({ type: "transfer-in", pair: "p" }));
    expect(() => D.validate(s)).toThrow();
  });
  it("1400 líquidos e consignado 270 não geram outra saída", () => {
    const s = rule(state(), true);
    s.accounts[0].opening = 0;
    s.movements.push(movement({ amount: 140000, type: "income" }));
    expect(D.projection(s, "2026-10-30", false, now).closing).toBe(140000);
  });
  it("contrato tem caixa 2600/1000/0, sem depósito pela média", () => {
    const s = state();
    s.accounts[0].opening = 0;
    s.contracts.push({
      id: "c",
      description: "Trimestre",
      total: 360000,
      start: "2026-10-01",
      end: "2026-12-31",
      receipts: [
        {
          date: "2026-10-15",
          amount: 260000,
          account: "a",
          status: "previsto",
        },
        {
          date: "2026-11-15",
          amount: 100000,
          account: "a",
          status: "previsto",
        },
      ],
    });
    expect(D.projection(s, "2026-10-31", false, now).closing).toBe(260000);
    expect(D.projection(s, "2026-11-30", false, now).closing).toBe(360000);
    expect(D.projection(s, "2026-12-31", false, now).closing).toBe(360000);
  });
  it("repasse líquido menos custos não desconta plataforma novamente", () => {
    const s = state();
    s.movements.push(
      movement({ amount: 180000, type: "income", activity: "Motorista" }),
      movement({ amount: 60000, activity: "Motorista" }),
    );
    expect(D.activityResult(s, "Motorista")).toBe(120000);
  });
  it("última parcela novembro libera 400 em dezembro sem renda fictícia", () => {
    const s = state();
    s.rules.push({
      id: "r",
      description: "Última",
      amount: 40000,
      account: "a",
      start: "2026-11-10",
      end: "2026-11-10",
      subscription: false,
      payroll: false,
      category: "x",
      active: true,
    });
    expect(D.released(s, "2026-12-01")).toBe(40000);
    expect(s.movements).toHaveLength(0);
  });
  it("geração e pagamento repetidos são idempotentes e reversíveis", () => {
    const s = rule(state());
    D.generate(s, now);
    expect(s.occurrences).toHaveLength(2);
    D.pay(s, s.occurrences[0].id);
    D.pay(s, s.occurrences[0].id);
    expect(s.movements).toHaveLength(1);
    D.unpay(s, s.occurrences[0].id);
    expect(s.movements).toHaveLength(0);
    expect(s.occurrences[0].paid).toBeUndefined();
  });
  it("estorno zera despesa líquida e preserva bruto e histórico", () => {
    const s = state();
    const m = movement();
    s.movements.push(m, movement({ type: "refund", original: m.id }));
    expect(D.totals(s)).toEqual({ gross: 10000, net: 0, income: 0 });
    expect(s.movements).toHaveLength(2);
  });
  it("saldo final positivo não esconde déficit antes da entrada", () => {
    const s = state();
    s.movements.push(
      movement({ amount: 15000, date: "2026-10-11", status: "previsto" }),
      movement({
        amount: 100000,
        date: "2026-10-12",
        type: "income",
        status: "previsto",
      }),
    );
    const p = D.projection(s, "2026-10-12", false, now);
    expect(p.folga).toBe(-5000);
    expect(p.closing).toBe(95000);
  });
  it("inclui saldo inicial no mínimo e saída antes de entrada", () => {
    const s = state();
    s.movements.push(
      movement({ amount: 15000, status: "previsto" }),
      movement({ amount: 100000, type: "income", status: "previsto" }),
    );
    expect(D.projection(s, now, false, now).min).toBe(-5000);
  });
  it("renda provável separada, atraso imediato, reserva não duplica", () => {
    const s = state();
    s.accounts[1].reserve = true;
    s.accounts[1].opening = 999999;
    s.reserve = 2000;
    s.movements.push(
      movement({ amount: 3000, date: "2026-10-01", status: "previsto" }),
      movement({ amount: 20000, type: "income", status: "provavel" }),
    );
    expect(D.projection(s, now, false, now).folga).toBe(5000);
    expect(D.projection(s, now, true, now).closing).toBe(27000);
  });
  it("fatura uma saída e empréstimo não aumenta renda", () => {
    const s = state();
    const m = movement();
    s.movements.push(m, movement({ type: "loan", amount: 50000 }));
    s.cardDetails.push({
      id: "detail",
      payment: m.id,
      category: "A identificar",
      amount: 5000,
    });
    D.validate(s);
    expect(D.totals(s).income).toBe(0);
    expect(D.totals(s).gross).toBe(10000);
    s.cardDetails[0].amount = 11000;
    expect(() => D.validate(s)).toThrow();
  });
  it("ajuste negativo não é despesa e não altera abertura", () => {
    const s = state();
    s.movements.push(movement({ type: "adjustment-out", amount: 4000 }));
    expect(D.balance(s, "a", now)).toBe(6000);
    expect(D.totals(s).net).toBe(0);
    expect(s.accounts[0].opening).toBe(10000);
  });
  it("rejeita referência a conta fora do agregado", () => {
    const s = state();
    s.movements.push(movement({ account: "conta-de-B" }));
    expect(() => D.validate(s)).toThrow("Conta inválida");
  });
});
describe("Simulador analítico", () => {
  it.each(["snowball", "avalanche"] as const)(
    "%s: zero explícito, final parcial e orçamento reaplicado no mesmo mês",
    (method) => {
      const r = D.simulate(
        [
          debt({ id: "1", creditor: "A", balance: 2000, installment: 1000 }),
          debt({ id: "2", creditor: "B", balance: 4000, installment: 1000 }),
        ],
        1000,
        method,
      );
      expect(r.months).toBe(2);
      expect(r.interest).toBe(0);
      expect(r.rows.map((x) => x.paid)).toEqual([3000, 3000]);
    },
  );
  it("taxa ausente e atraso são excluídos, zero aceito", () => {
    const r = D.simulate(
      [
        debt({ rate: null }),
        debt({ id: "x", overdue: true }),
        debt({ id: "valid" }),
      ],
      0,
      "avalanche",
    );
    expect(r.excluded).toHaveLength(2);
    expect(r.months).toBe(4);
  });
  it("juros de 10%, pagamento final 1210 conhecido", () => {
    const r = D.simulate(
      [debt({ balance: 10000, installment: 10000, rate: "10" })],
      0,
      "avalanche",
    );
    expect(r.rows.map((r) => r.paid)).toEqual([10000, 1100]);
    expect(r.interest).toBe(1100);
  });
  it("amortização negativa não promete data", () => {
    const r = D.simulate(
      [debt({ rate: "10", installment: 500 })],
      0,
      "snowball",
    );
    expect(r.months).toBeNull();
    expect(r.warnings.join()).toContain("Amortização negativa");
  });
  it("limite 600 meses impede laço interminável", () => {
    const r = D.simulate(
      [debt({ balance: 1000000, installment: 1 })],
      0,
      "snowball",
    );
    expect(r.months).toBeNull();
    expect(r.rows).toHaveLength(600);
  });
});
describe("Datas e CSV", () => {
  it("dia 31 não deriva após fevereiro e aceita ano bissexto", () => {
    expect(D.monthDate("2026-01-31", 1)).toBe("2026-02-28");
    expect(D.monthDate("2026-01-31", 2)).toBe("2026-03-31");
    expect(D.monthDate("2024-01-31", 1)).toBe("2024-02-29");
    expect(() => D.date.parse("2026-02-30")).toThrow();
  });
  it("valores brasileiros sem float e precisão estrita", () => {
    expect(D.money("1.234,56")).toBe(123456);
    expect(D.money("0,10") + D.money("0,20")).toBe(30);
    expect(() => D.money("1,234")).toThrow();
  });
  it("prévia não altera estado, datas BR e ISO, lote atômico/idempotente/desfeito", () => {
    const s = state();
    const rows = parseCSV(
      'descricao;data;valor;tipo\n"Teste; mercado";10/10/2026;12,30;despesa\nOutro;2026-10-11;10,00;entrada',
    );
    const p = preview(
      rows,
      { description: 0, date: 1, amount: 2, type: 3 },
      s,
      "a",
    );
    expect(s.movements).toHaveLength(0);
    expect(p[0].movement?.amount).toBe(1230);
    const next = importBatch(
      s,
      "batch",
      "hash",
      "a",
      p.map((r) => r.movement!),
    );
    expect(
      importBatch(
        next,
        "batch",
        "hash",
        "a",
        p.map((r) => r.movement!),
      ).movements,
    ).toHaveLength(2);
    expect(() => importBatch(next, "new", "hash", "a", [])).toThrow();
    undoBatch(next, "batch");
    expect(next.movements).toHaveLength(0);
  });
  it("neutraliza fórmulas e respeita aspas", () => {
    expect(csv([["=cmd", "  @foo", 'Teste "x"']])).toContain("'=cmd");
    expect(
      parseCSV(
        csv([
          ["a", "b"],
          ['Teste "x"', "1,00"],
        ]),
      )[1][0],
    ).toBe('Teste "x"');
  });
  it("linha inválida e possível duplicata requerem revisão", () => {
    const s = state();
    s.movements.push(movement());
    const p = preview(
      parseCSV(
        "desc;data;valor;tipo\nExemplo;10/10/2026;100,00;despesa\nPix;2026-02-30;10,00;transferencia",
      ),
      { description: 0, date: 1, amount: 2, type: 3 },
      s,
      "a",
    );
    expect(p[0].duplicate).toBe(true);
    expect(p[1].error).not.toBe("");
  });
});
