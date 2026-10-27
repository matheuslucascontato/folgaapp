import { empty, today, monthDate, generate, State } from "./domain";
export function demo(): State {
  const s = empty();
  const t = today();
  s.onboarding = 4;
  s.reserve = 20000;
  s.accounts = [
    {
      id: "bank",
      name: "Conta do dia a dia",
      opening: 184050,
      date: t,
      reserve: false,
      archived: false,
    },
    {
      id: "reserve",
      name: "Reserva separada",
      opening: 120000,
      date: t,
      reserve: true,
      archived: false,
    },
  ];
  s.movements = [
    {
      id: "salary",
      description: "Salário líquido • fictício",
      amount: 280000,
      account: "bank",
      category: "A identificar",
      date: monthDate(t, 1).slice(0, 8) + "05",
      status: "previsto",
      type: "income",
      note: "Líquido dos descontos em folha",
    },
    {
      id: "variable",
      description: "Serviço extra • provável",
      amount: 45000,
      account: "bank",
      category: "Transporte e trabalho",
      date: monthDate(t, 1).slice(0, 8) + "10",
      status: "provavel",
      type: "income",
      note: "",
    },
  ];
  s.rules = [
    {
      id: "rent",
      description: "Moradia • fictícia",
      amount: 85000,
      account: "bank",
      start: t,
      end: monthDate(t, 11),
      subscription: false,
      payroll: false,
      category: "Moradia e contas",
      active: true,
    },
    {
      id: "stream",
      description: "Streaming • fictício",
      amount: 2990,
      account: "bank",
      start: t,
      subscription: true,
      payroll: false,
      category: "Lazer e pessoais",
      active: true,
    },
  ];
  s.debts = [
    {
      id: "debt",
      creditor: "Credor exemplo",
      kind: "Empréstimo pessoal",
      balance: 240000,
      base: t,
      installment: 30000,
      remaining: 10,
      rate: "2",
      due: t,
      overdue: false,
      payroll: false,
      note: "Dados inteiramente fictícios",
    },
  ];
  return generate(s);
}
