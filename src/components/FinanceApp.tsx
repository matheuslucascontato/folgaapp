"use client";
import { useEffect, useState, useRef, FormEvent } from "react";
import {
  Home,
  ArrowLeftRight,
  CalendarDays,
  Wallet,
  Eye,
  EyeOff,
  Plus,
  Settings,
  ArrowUpRight,
  ChevronRight,
  Leaf,
  Search,
  LogOut,
  X,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import * as D from "@/lib/domain";
import { demo } from "@/lib/demo";
import {
  csv,
  parseCSV,
  preview,
  hash,
  importBatch,
  undoBatch,
} from "@/lib/csv";
import { Field, Check, download } from "./Forms";
type Tab =
  | "Hoje"
  | "Movimentos"
  | "Planejar"
  | "Dívidas"
  | "Perfil"
  | "Auditoria"
  | "Importar";
type Modal =
  | "movement"
  | "account"
  | "rule"
  | "debt"
  | "contract"
  | "activity"
  | "task"
  | "reconcile"
  | "card"
  | null;
export default function FinanceApp({ demoMode }: { demoMode: boolean }) {
  const router = useRouter();
  const [s, setS] = useState<D.State | null>(null),
    [tab, setTab] = useState<Tab>("Hoje"),
    [hidden, setHidden] = useState(false),
    [modal, setModal] = useState<Modal>(null),
    [edit, setEdit] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all"),
    [end, setEnd] = useState(""),
    [extra, setExtra] = useState("0"),
    [selected, setSelected] = useState<string[]>([]),
    [file, setFile] = useState(""),
    [rows, setRows] = useState<string[][]>([]),
    [mapping, setMapping] = useState({
      description: 0,
      date: 1,
      amount: 2,
      type: 3,
    }),
    [account, setAccount] = useState(""),
    [repeat, setRepeat] = useState(false),
    [duplicates, setDuplicates] = useState(false);
  const modalRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!modal) return;
    const previous = document.activeElement as HTMLElement;
    const dialog = modalRef.current;
    dialog?.querySelector<HTMLElement>("input,select,button")?.focus();
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") setModal(null);
      if (e.key === "Tab" && dialog) {
        const els = Array.from(
          dialog.querySelectorAll<HTMLElement>(
            "button:not(:disabled),input,select,textarea,summary",
          ),
        ).filter((el) => el.getClientRects().length);
        const first = els[0],
          last = els[els.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", handle);
    return () => {
      document.removeEventListener("keydown", handle);
      previous?.focus();
    };
  }, [modal]);
  const revision = useRef(0),
    lock = useRef(false);
  const value = (n: number) => (hidden ? "••••••" : D.brl(n));
  useEffect(() => {
    if ("serviceWorker" in navigator)
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    async function load() {
      try {
        if (demoMode) {
          const raw = localStorage.getItem("folga-demo-v1");
          setS(
            D.generate(
              raw ? D.validate(D.stateSchema.parse(JSON.parse(raw))) : demo(),
            ),
          );
        } else {
          const r = await fetch("/api/data", { cache: "no-store" });
          const data = await r.json();
          if (!r.ok) throw Error(data.error);
          revision.current = data.revision;
          setS(D.generate(D.validate(D.stateSchema.parse(data.data))));
        }
      } catch (e) {
        setError((e as Error).message);
      }
    }
    void load();
  }, [demoMode]);
  async function save(next: D.State, closeModal = false) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      D.validate(next);
      if (demoMode) localStorage.setItem("folga-demo-v1", JSON.stringify(next));
      else {
        const r = await fetch("/api/data", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: next, revision: revision.current }),
        });
        const body = await r.json();
        if (!r.ok) throw Error(body.error);
        revision.current = body.revision;
      }
      setS(next);
      setNotice("Alterações salvas.");
      if (closeModal) setModal(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function change(fn: (next: D.State) => void, closeModal = false) {
    if (!s) return;
    const n = structuredClone(s);
    try {
      fn(n);
      void save(n, closeModal);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function open(m: Modal, id = "") {
    setEdit(id);
    setModal(m);
    setError("");
  }
  function confirmDelete(fn: (n: D.State) => void) {
    if (confirm("Excluir este registro? Os indicadores serão recalculados."))
      change(fn);
  }
  if (!s)
    return (
      <main className="auth panel">
        <h1>FOLGA</h1>
        <p role="status">{error || "Organizando seu espaço…"}</p>
        {error && (
          <button onClick={() => location.reload()}>Tentar novamente</button>
        )}
      </main>
    );
  const state = s;
  const accounts = s.accounts.filter((a) => !a.archived);
  const defaultAccount = accounts[0]?.id || "";
  const nextIncome = s.movements
    .filter(
      (m) =>
        m.type === "income" && m.status === "previsto" && m.date >= D.today(),
    )
    .map((m) => m.date)
    .concat(
      s.contracts.flatMap((c) =>
        c.receipts
          .filter((r) => r.status === "previsto" && r.date >= D.today())
          .map((r) => r.date),
      ),
    )
    .sort()[0];
  const horizon = end || nextIncome || D.monthEnd(D.today());
  const p = D.projection(s, horizon),
    prob = D.projection(s, horizon, true);
  const month = D.projection(s, D.monthEnd(D.today()));
  const available = s.accounts
    .filter((a) => !a.reserve)
    .reduce((n, a) => n + D.balance(s, a.id), 0);
  const obligations = s.occurrences
    .filter(
      (o) =>
        !o.paid &&
        !o.cancelled &&
        !s.rules.find((r) => r.id === o.rule)?.payroll,
    )
    .sort((a, b) => a.date.localeCompare(b.date));
  const existing = s.movements.find((m) => m.id === edit);
  const currentAccount = s.accounts.find((a) => a.id === edit);
  const debt = s.debts.find((d) => d.id === edit);
  const rule = s.rules.find((r) => r.id === edit);
  function formSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const str = (k: string) => String(f.get(k) || "");
    const amount = (k = "amount") => D.money(str(k));
    const bool = (k: string) => f.get(k) === "on";
    try {
      change((n) => {
        if (modal === "account") {
          const a = {
            id: edit || D.uid(),
            name: str("name"),
            opening: amount(),
            date: str("date"),
            reserve: bool("reserve"),
            archived: false,
          };
          if (edit) n.accounts = n.accounts.map((x) => (x.id === edit ? a : x));
          else n.accounts.push(a);
        }
        if (modal === "movement") {
          if (bool("netSalary")) n.profile.salaryNet = true;
          const type = str("type") as D.Movement["type"];
          if (str("status") === "provavel" && type !== "income")
            throw Error("Status provável é exclusivo de renda variável");
          if (
            type === "income" &&
            /sal[aá]rio/i.test(str("description")) &&
            !bool("netSalary")
          )
            throw Error(
              "Confirme se o salário já está líquido dos descontos em folha",
            );
          const m: D.Movement = {
            id: edit || D.uid(),
            description: str("description"),
            amount: amount(),
            account: str("account"),
            category: str("category"),
            date: str("date"),
            status: str("status") as D.Movement["status"],
            type,
            note: str("note"),
            ...(str("activity") ? { activity: str("activity") } : {}),
            ...(str("original") ? { original: str("original") } : {}),
            ...(str("competence") ? { competence: str("competence") } : {}),
            ...(existing?.batch ? { batch: existing.batch } : {}),
            ...(existing?.debt ? { debt: existing.debt } : {}),
            ...(existing?.receipt ? { receipt: existing.receipt } : {}),
            ...(existing?.occurrence
              ? { occurrence: existing.occurrence }
              : {}),
          };
          if (edit) {
            if (existing?.occurrence) {
              if (m.type !== "expense" || m.status !== "realizado")
                throw Error(
                  "Pagamento vinculado deve continuar despesa realizada. Para reabrir, desfaça no planejamento.",
                );
              n.occurrences.find((o) => o.id === existing.occurrence)!.amount =
                m.amount;
            }
            if (existing?.receipt) {
              if (m.type !== "income" || m.status !== "realizado")
                throw Error(
                  "Recebimento de contrato deve continuar entrada realizada. Exclua para reabrir.",
                );
              for (const c of n.contracts)
                for (const r of c.receipts)
                  if (r.paid === m.id) r.amount = m.amount;
            }
            if (existing?.debt && str("status") !== "realizado")
              throw Error(
                "Empréstimo recebido deve continuar realizado; revise o inventário antes de reverter",
              );
            if (existing?.type === "loan" && type !== "loan")
              throw Error(
                "Empréstimo deve continuar como empréstimo; edite as condições em Dívidas",
              );
            if (existing?.debt) {
              const linked = n.debts.find((d) => d.id === existing.debt)!;
              linked.balance += m.amount - existing.amount;
              if (linked.balance < 0)
                throw Error("Revise o saldo de quitação da dívida");
            }
            if (existing?.pair)
              throw Error("Exclua o par e cadastre a transferência corrigida.");
            if (
              type === "loan" &&
              !existing?.debt &&
              m.status === "realizado"
            ) {
              n.movements = n.movements.filter((x) => x.id !== edit);
              D.addLoan(n, m);
            } else
              n.movements = n.movements.map((x) => (x.id === edit ? m : x));
          } else if (type === "transfer-out") {
            if (str("destination") === m.account)
              throw Error("Escolha contas diferentes");
            const pair = D.uid();
            n.movements.push(
              { ...m, pair },
              {
                ...m,
                id: D.uid(),
                account: str("destination"),
                type: "transfer-in",
                pair,
              },
            );
          } else if (type === "loan") D.addLoan(n, m);
          else n.movements.push(m);
        }
        if (modal === "rule") {
          const r = {
            id: edit || D.uid(),
            description: str("description"),
            amount: amount(),
            account: str("account"),
            start: str("date"),
            ...(str("end") ? { end: str("end") } : {}),
            ...(str("count") ? { count: Number(str("count")) } : {}),
            subscription: bool("subscription"),
            payroll: bool("payroll"),
            category: str("category"),
            active: true,
          };
          if (edit) {
            n.rules = n.rules.map((x) => (x.id === edit ? r : x));
            n.occurrences = n.occurrences.filter(
              (o) => o.rule !== edit || o.paid || o.date < D.today(),
            );
          } else n.rules.push(r);
          D.generate(n);
        }
        if (modal === "debt") {
          const d: D.Debt = {
            id: edit || D.uid(),
            creditor: str("creditor"),
            kind: str("kind"),
            balance: amount("balance"),
            base: str("base"),
            installment: amount(),
            remaining: Number(str("remaining")),
            rate: str("rate") ? str("rate").replace(",", ".") : null,
            ...(str("cet") ? { cet: str("cet") } : {}),
            due: str("date"),
            overdue: bool("overdue"),
            payroll: bool("payroll"),
            note: str("note"),
          };
          if (edit) n.debts = n.debts.map((x) => (x.id === edit ? d : x));
          else n.debts.push(d);
        }
        if (modal === "contract") {
          const receipts = str("schedule")
            .split("\n")
            .filter(Boolean)
            .map((line) => {
              const [date, v, status] = line.split(";");
              return {
                date,
                amount: D.money(v),
                status: (status || "previsto") as "previsto",
                account: str("account"),
              };
            });
          const cid = D.uid();
          n.contracts.push({
            id: cid,
            description: str("description"),
            total: amount(),
            start: str("date"),
            end: str("end"),
            receipts,
          });
          receipts.forEach((r, i) => {
            if (String(r.status) === "realizado")
              D.receiveContract(n, cid, i, r.date);
          });
        }
        if (modal === "activity")
          n.activities.push({
            id: D.uid(),
            name: str("name"),
            platformNet: bool("net"),
            costsComplete: bool("complete"),
          });
        if (modal === "task") {
          const t = n.tasks.find((t) => t.id === edit);
          if (t) {
            if (amount() > 0 && !bool("monthly"))
              throw Error("Confirme que a redução é mensal e recorrente");
            t.title = str("title");
            t.due = str("due");
            t.confirmed = amount();
            t.effect = str("date");
            t.status = bool("done") ? "concluida" : "aberta";
          }
        }
        if (modal === "reconcile") {
          const desired = amount();
          const delta = desired - D.balance(n, str("account"));
          if (delta === 0) throw Error("Saldo já conciliado");
          n.movements.push({
            id: D.uid(),
            description: "Ajuste explícito de saldo",
            amount: Math.abs(delta),
            account: str("account"),
            category: "A identificar",
            date: D.today(),
            status: "realizado",
            type: delta > 0 ? "adjustment" : "adjustment-out",
            note: "Conciliação, não é renda ou despesa",
          });
        }
        if (modal === "card")
          n.cardDetails.push({
            id: D.uid(),
            payment: str("payment"),
            category: str("category"),
            amount: amount(),
          });
      }, true);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const accountOptions = accounts.map((a) => (
    <option key={a.id} value={a.id}>
      {a.name}
    </option>
  ));
  const categoryOptions = s.categories.map((c) => <option key={c}>{c}</option>);
  return (
    <>
      <div className="app-shell">
        <aside>
          <Link href="/" className="brand">
            <Image alt="" src="/icon.svg" width="34" height="34" />
            FOLGA<span>seu espaço financeiro</span>
          </Link>
          <nav>
            {(
              [
                { label: "Hoje", icon: Home },
                { label: "Movimentos", icon: ArrowLeftRight },
                { label: "Planejar", icon: CalendarDays },
                { label: "Dívidas", icon: Wallet },
              ] as const
            ).map(({ label, icon: Icon }) => (
              <button
                key={label}
                className={tab === label ? "active" : ""}
                onClick={() => setTab(label)}
              >
                <Icon size={20} />
                <span>{label}</span>
              </button>
            ))}
          </nav>
          <div className="aside-bottom">
            <Leaf size={28} />
            <p>
              Um passo de cada vez.
              <br />
              Com espaço para você.
            </p>
            <button className="text" onClick={() => setTab("Perfil")}>
              <Settings size={18} /> Configurações
            </button>
          </div>
        </aside>
        <div className="workspace">
          {demoMode && (
            <div className="demo-banner">
              Demonstração — dados fictícios{" "}
              <button
                onClick={() => {
                  if (confirm("Reiniciar todos os dados fictícios?"))
                    void save(demo());
                }}
              >
                Reiniciar
              </button>
            </div>
          )}
          <header>
            <div>
              <span className="eyebrow">SEU DINHEIRO, COM CLAREZA</span>
              <h1>{tab === "Hoje" ? "Vamos dar espaço ao seu dia." : tab}</h1>
              <p>
                {tab === "Hoje"
                  ? new Intl.DateTimeFormat("pt-BR", {
                      dateStyle: "full",
                      timeZone: "America/Sao_Paulo",
                    }).format(new Date())
                  : "Organize no seu ritmo. Cada informação faz diferença."}
              </p>
            </div>
            <div className="header-actions">
              <button
                className="icon"
                aria-label={hidden ? "Mostrar valores" : "Ocultar valores"}
                onClick={() => setHidden(!hidden)}
              >
                {hidden ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
              <button
                className="icon"
                aria-label="Perfil e configurações"
                onClick={() => setTab("Perfil")}
              >
                <Settings size={20} />
              </button>
              <button
                disabled={busy}
                onClick={() => open("movement")}
                className="add"
              >
                <Plus size={18} />
                Adicionar
              </button>
            </div>
          </header>
          {error && (
            <div className="error" role="alert">
              {error}
              <button className="text" onClick={() => setError("")}>
                Fechar
              </button>
            </div>
          )}
          {notice && (
            <div className="toast" role="status">
              {notice}
              <button aria-label="Fechar aviso" onClick={() => setNotice("")}>
                <X size={14} />
              </button>
            </div>
          )}
          {s.onboarding < 4 && (
            <section className="panel onboarding">
              <span className="eyebrow">
                PRIMEIROS PASSOS • {s.onboarding + 1} DE 4
              </span>
              <h2>
                {
                  [
                    "Onde seu dinheiro está?",
                    "Qual é sua próxima entrada?",
                    "O que já está comprometido?",
                    "Qual espaço você quer preservar?",
                  ][s.onboarding]
                }
              </h2>
              <p>
                {
                  [
                    "Cadastre uma conta e seu saldo com data para começar.",
                    "Informe o salário líquido e a data real de recebimento. Descontos em folha não saem duas vezes.",
                    "Contas recorrentes ajudam a prever os vencimentos.",
                    "A reserva adicional é separada das contas de reserva. Você pode ajustar no perfil.",
                  ][s.onboarding]
                }
              </p>
              <div className="actions">
                <button
                  onClick={() =>
                    s.onboarding === 3
                      ? setTab("Perfil")
                      : open(
                          (["account", "movement", "rule"] as Modal[])[
                            s.onboarding
                          ],
                        )
                  }
                >
                  Preencher
                </button>
                <button
                  className="secondary"
                  onClick={() =>
                    change((n) => {
                      n.onboarding++;
                    })
                  }
                >
                  Continuar / pular etapa
                </button>
              </div>
            </section>
          )}
          {tab === "Hoje" && (
            <>
              <div className="dashboard">
                <section className="breathing">
                  <div className="card-top">
                    <span>
                      <Leaf size={18} /> FOLGA ATÉ {D.human(horizon)}
                    </span>
                    <span className="pill light">Estimativa</span>
                  </div>
                  <h2 className={p.folga < 0 ? "shortfall" : ""}>
                    {p.folga < 0 ? `Faltam ${value(-p.folga)}` : value(p.folga)}
                  </h2>
                  <p>
                    {p.folga < 0
                      ? "para cobrir o período"
                      : "de espaço estimado depois dos compromissos e da reserva."}
                  </p>
                  <div className="horizon">
                    <label>
                      Até quando?
                      <input
                        aria-label="Horizonte da previsão"
                        type="date"
                        min={D.today()}
                        value={horizon}
                        onChange={(e) => setEnd(e.target.value)}
                      />
                    </label>
                    <span>
                      {nextIncome
                        ? "Sugestão: próxima entrada confirmada"
                        : "Sugestão: fim do mês"}
                    </span>
                  </div>
                  <details>
                    <summary>
                      Entenda este valor <ChevronRight size={16} />
                    </summary>
                    <p>
                      Começamos com {value(p.start)}. Usamos o menor saldo do
                      período, {value(p.min)}, e retiramos {value(s.reserve)} de
                      reserva adicional. Contas segregadas de reserva ficam
                      fora.
                    </p>
                    <p>
                      Na falta de horário, saídas vêm antes de entradas no mesmo
                      dia. Atrasados abertos são cobrados hoje. Estimativa, sem
                      garantia.
                    </p>
                    {p.steps.map((e, i) => (
                      <div className="calc-row" key={i}>
                        {D.human(e.date)} • {e.label}
                        <span>
                          {value(e.amount)} → {value(e.balance)}
                        </span>
                      </div>
                    ))}
                  </details>
                </section>
                <section className="panel balance">
                  <span className="eyebrow">O QUE VOCÊ TEM HOJE</span>
                  <h2>{value(available)}</h2>
                  <p>Saldo nas contas disponíveis</p>
                  <div className="divider" />
                  <div className="row">
                    <span>Fechamento previsto do mês</span>
                    <strong>{value(month.closing)}</strong>
                  </div>
                  <div className="row">
                    <span>Reserva segregada</span>
                    <strong>
                      {value(
                        s.accounts
                          .filter((a) => a.reserve)
                          .reduce((n, a) => n + D.balance(s, a.id), 0),
                      )}
                    </strong>
                  </div>
                  <button className="text" onClick={() => setTab("Perfil")}>
                    Ver minhas contas <ArrowUpRight size={16} />
                  </button>
                </section>
              </div>
              {p.missing.length > 0 && (
                <div className="notice">
                  <strong>Previsão incompleta</strong>
                  <p>{p.missing.join(" • ")}</p>
                </div>
              )}
              <div className="two-col">
                <section className="panel">
                  <div className="section-title">
                    <h2>Antes de respirar, os vencimentos</h2>
                    <button className="text" onClick={() => setTab("Planejar")}>
                      Ver todos
                    </button>
                  </div>
                  {obligations.length ? (
                    obligations.slice(0, 5).map((o) => (
                      <div className="list-row" key={o.id}>
                        <div className="date-badge">
                          {o.date.slice(8)}
                          <small>{o.date.slice(5, 7)}</small>
                        </div>
                        <div className="grow">
                          <strong>
                            {s.rules.find((r) => r.id === o.rule)?.description}
                          </strong>
                          <small>
                            {o.date < D.today()
                              ? "Em atraso • obrigação imediata"
                              : D.human(o.date)}
                          </small>
                        </div>
                        <strong>{value(o.amount)}</strong>
                      </div>
                    ))
                  ) : (
                    <p>
                      Nenhum vencimento cadastrado. Adicione compromissos para
                      melhorar a previsão.
                    </p>
                  )}
                </section>
                <section className="panel">
                  <h2>Se a renda provável entrar</h2>
                  <span className="scenario">{value(prob.folga)}</span>
                  <p>
                    Cenário separado. Essa renda não compõe sua folga principal.
                  </p>
                  <div className="divider" />
                  <h3>Próximas entradas</h3>
                  {s.movements
                    .filter(
                      (m) => m.type === "income" && m.status !== "realizado",
                    )
                    .map((m) => (
                      <div className="list-row" key={m.id}>
                        <div className="grow">
                          {m.description}
                          <small>
                            {D.human(m.date)} •{" "}
                            {m.status === "provavel"
                              ? "Provável"
                              : "Confirmada"}
                          </small>
                        </div>
                        <strong>{value(m.amount)}</strong>
                      </div>
                    ))}
                </section>
              </div>
              <section className="action-card">
                <div>
                  <span className="eyebrow">UM PRÓXIMO PASSO POSSÍVEL</span>
                  <h2>Olhe para o que já está comprometido.</h2>
                  <p>
                    Revise assinaturas, identifique lançamentos e transforme
                    dúvidas em ações.
                  </p>
                </div>
                <button
                  className="secondary"
                  onClick={() => setTab("Auditoria")}
                >
                  Revisar meu mês <ArrowUpRight size={18} />
                </button>
              </section>
            </>
          )}
          {tab === "Movimentos" && (
            <>
              <div className="toolbar">
                <label className="search">
                  <Search size={18} />
                  <input
                    placeholder="Buscar movimento"
                    aria-label="Buscar movimento"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
                <select
                  aria-label="Filtrar movimentos"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="all">Todos os tipos</option>
                  <option value="income">Entradas</option>
                  <option value="expense">Despesas</option>
                  <option value="previsto">Previstos</option>
                  <option value="transfer-out">Transferências</option>
                </select>
                <button
                  className="secondary"
                  onClick={() => setTab("Importar")}
                >
                  Importar CSV
                </button>
              </div>
              <div className="summary-strip">
                <span>
                  Receitas realizadas{" "}
                  <strong>{value(D.totals(s).income)}</strong>
                </span>
                <span>
                  Despesas brutas <strong>{value(D.totals(s).gross)}</strong>
                </span>
                <span>
                  Despesas líquidas de estornos{" "}
                  <strong>{value(D.totals(s).net)}</strong>
                </span>
              </div>
              <section className="panel">
                {s.movements
                  .filter(
                    (m) =>
                      m.description
                        .toLowerCase()
                        .includes(search.toLowerCase()) &&
                      (filter === "all" ||
                        m.type === filter ||
                        m.status === filter),
                  )
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map((m) => (
                    <div className="list-row wrap" key={m.id}>
                      <div
                        className={
                          "movement-icon " + (D.signed(m) > 0 ? "in" : "out")
                        }
                      >
                        <ArrowUpRight size={20} />
                      </div>
                      <div className="grow">
                        <strong>{m.description}</strong>
                        <small>
                          {D.human(m.date)} •{" "}
                          {s.accounts.find((a) => a.id === m.account)?.name} •{" "}
                          {m.category}
                        </small>
                        <small>
                          {m.status} {m.pair ? "• Transferência interna" : ""}
                          {m.type === "loan" ? "• Empréstimo, não renda" : ""}
                        </small>
                      </div>
                      <strong>{value(D.signed(m))}</strong>
                      <div className="row-actions">
                        {!m.pair && (
                          <button
                            className="text"
                            onClick={() => open("movement", m.id)}
                          >
                            Editar
                          </button>
                        )}
                        <button
                          className="text danger"
                          onClick={() =>
                            confirmDelete((n) => D.removeMovement(n, m.id))
                          }
                        >
                          Excluir
                        </button>
                      </div>
                    </div>
                  ))}
                {!s.movements.length && (
                  <p>
                    Seu primeiro lançamento pode ser simples: descrição, valor,
                    conta e data.
                  </p>
                )}
              </section>
              <section className="panel">
                <h2>Para onde foi o dinheiro neste mês?</h2>
                <p>
                  Despesas líquidas de estornos na data real de caixa.
                  Transferências e ajustes ficam fora. Detalhes de fatura não
                  geram despesas adicionais.
                </p>
                {D.expenseGroups(s).map((g) => (
                  <div className="row" key={g.category}>
                    <span>{g.category}</span>
                    <strong>{value(g.amount)}</strong>
                  </div>
                ))}
              </section>
              <button className="secondary" onClick={() => open("card")}>
                Detalhar pagamento de fatura
              </button>
              <p className="muted">
                Cartão simplificado: a fatura é a única saída. Detalhes por
                categoria são informativos, sem novas despesas. Limites e
                fechamento ficam para evolução posterior.
              </p>
              {s.cardDetails.map((d) => (
                <p key={d.id}>
                  {d.category}: {value(d.amount)} (informativo){" "}
                  <button
                    className="text"
                    onClick={() =>
                      confirmDelete((n) => {
                        n.cardDetails = n.cardDetails.filter(
                          (x) => x.id !== d.id,
                        );
                      })
                    }
                  >
                    Excluir detalhe
                  </button>
                </p>
              ))}
            </>
          )}
          {tab === "Planejar" && (
            <>
              <div className="toolbar">
                <button onClick={() => open("rule")}>
                  <Plus size={16} />
                  Compromisso mensal
                </button>
                <button className="secondary" onClick={() => open("contract")}>
                  Contrato / recebimentos
                </button>
                <button className="secondary" onClick={() => open("activity")}>
                  Atividade com custos
                </button>
                <button
                  className="text"
                  onClick={() =>
                    change((n) => {
                      D.generate(n);
                    })
                  }
                >
                  Atualizar 12 meses
                </button>
              </div>
              <section className="panel">
                <h2>Compromissos e parcelas</h2>
                {s.rules.map((r) => (
                  <div className="list-row wrap" key={r.id}>
                    <div className="grow">
                      <strong>{r.description}</strong>
                      <small>
                        {value(r.amount)} / mês{" "}
                        {r.subscription ? "• Assinatura" : ""}{" "}
                        {r.payroll ? "• Já descontado em folha" : ""}{" "}
                        {r.end ? `• Termina ${D.human(r.end)}` : ""}
                        {!r.active ? " • Encerrado" : ""}
                      </small>
                    </div>
                    <button className="text" onClick={() => open("rule", r.id)}>
                      Editar futuras
                    </button>
                    <button
                      className="text danger"
                      onClick={() => {
                        if (
                          confirm(
                            "Encerrar futuras ocorrências abertas? Pagas serão preservadas.",
                          )
                        )
                          change((n) => {
                            n.rules.find((x) => x.id === r.id)!.active = false;
                            n.occurrences.forEach((o) => {
                              if (
                                o.rule === r.id &&
                                !o.paid &&
                                o.date >= D.today()
                              )
                                o.cancelled = true;
                            });
                          });
                      }}
                    >
                      Encerrar
                    </button>
                  </div>
                ))}
                <p>
                  Quando terminam, parcelas liberam espaço. Isso reduz
                  compromissos; não cria renda nova.
                </p>
                <h3>
                  Liberação no próximo mês:{" "}
                  {value(D.released(s, D.monthDate(D.today(), 1)))}
                </h3>
              </section>
              <section className="panel">
                <h2>Lista de vencimentos</h2>
                {s.occurrences
                  .filter((o) => !o.cancelled)
                  .sort((a, b) => a.date.localeCompare(b.date))
                  .map((o) => {
                    const r = s.rules.find((r) => r.id === o.rule)!;
                    return (
                      <div className="list-row wrap" key={o.id}>
                        <div className="grow">
                          <strong>{r.description}</strong>
                          <small>
                            {D.human(o.date)}{" "}
                            {o.date < D.today() && !o.paid ? "• Em atraso" : ""}{" "}
                            {r.payroll ? "• Sem saída adicional" : ""}
                          </small>
                        </div>
                        <strong>{value(o.amount)}</strong>
                        {!r.payroll && (
                          <button
                            className={o.paid ? "secondary" : "primary"}
                            disabled={busy}
                            onClick={() =>
                              change((n) => {
                                if (o.paid) D.unpay(n, o.id);
                                else D.pay(n, o.id);
                              })
                            }
                          >
                            {o.paid ? "Desfazer pagamento" : "Marcar como pago"}
                          </button>
                        )}
                        <button
                          className="text"
                          onClick={() => {
                            const v = prompt(
                              "Novo valor desta ocorrência (R$)",
                              String(o.amount / 100).replace(".", ","),
                            );
                            if (v)
                              change((n) => {
                                if (o.paid)
                                  throw Error(
                                    "Desfaça o pagamento antes de editar",
                                  );
                                n.occurrences.find(
                                  (x) => x.id === o.id,
                                )!.amount = D.money(v);
                              });
                          }}
                        >
                          Editar esta
                        </button>
                      </div>
                    );
                  })}
              </section>
              <section className="panel">
                <h2>Contratos: competência ≠ recebimento</h2>
                {s.contracts.map((c) => (
                  <div key={c.id}>
                    <h3>
                      {c.description} • {value(c.total)}
                    </h3>
                    <p>
                      {D.human(c.start)} a {D.human(c.end)}. Média de
                      competência: {value(D.contractAverage(c))} / mês
                      (informativa). Só o cronograma abaixo entra na previsão.
                    </p>
                    {c.receipts.map((r, i) => (
                      <div className="row" key={i}>
                        {D.human(r.date)} • {r.status}
                        <strong>{value(r.amount)}</strong>
                        {r.status !== "realizado" && r.amount > 0 && (
                          <button
                            className="text"
                            onClick={() =>
                              change((n) => {
                                D.receiveContract(n, c.id, i);
                              })
                            }
                          >
                            Registrar recebimento hoje
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
                {!s.contracts.length && (
                  <p>
                    Cadastre valores totais e as datas reais de recebimento; a
                    média mensal não gera depósitos.
                  </p>
                )}
              </section>
              <section className="panel">
                <h2>Resultado das atividades</h2>
                {s.activities.map((a) => (
                  <div className="list-row" key={a.id}>
                    <div className="grow">
                      <strong>{a.name}</strong>
                      <small>
                        {a.platformNet
                          ? "Repasse já líquido de taxa. Sem dedução adicional."
                          : ""}
                      </small>
                      <small>
                        {a.costsComplete
                          ? "Após custos cadastrados"
                          : "Custos incompletos — não é lucro líquido"}
                      </small>
                    </div>
                    <strong>{value(D.activityResult(s, a.name))}</strong>
                    <button
                      className="text"
                      onClick={() => {
                        if (
                          confirm(
                            "Confirmar ou revisar que todos os custos desta atividade foram informados?",
                          )
                        )
                          change((n) => {
                            n.activities.find(
                              (x) => x.id === a.id,
                            )!.costsComplete = !a.costsComplete;
                          });
                      }}
                    >
                      {a.costsComplete
                        ? "Reabrir revisão de custos"
                        : "Confirmar custos completos"}
                    </button>
                  </div>
                ))}
              </section>
            </>
          )}
          {tab === "Dívidas" && (
            <>
              <div className="toolbar">
                <button onClick={() => open("debt")}>Adicionar dívida</button>
              </div>
              <section className="panel">
                <h2>Inventário, sem misturar os números</h2>
                {s.debts.map((d) => (
                  <div className="list-row wrap" key={d.id}>
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={selected.includes(d.id)}
                        onChange={(e) =>
                          setSelected(
                            e.target.checked
                              ? [...selected, d.id]
                              : selected.filter((id) => id !== d.id),
                          )
                        }
                      />
                      Simular
                    </label>
                    <div className="grow">
                      <strong>{d.creditor}</strong>
                      <small>
                        {d.kind} • Base {D.human(d.base)}{" "}
                        {d.overdue
                          ? "• Saldo em atraso: atualize antes de simular"
                          : ""}
                      </small>
                      <small>
                        Quitação: {value(d.balance)} • Soma nominal:{" "}
                        {value(d.installment * d.remaining)}
                      </small>
                      <small>
                        Juros mensais:{" "}
                        {d.rate === null ? "Desconhecidos" : d.rate + "%"} • CET
                        anual: {d.cet || "Não informado"}{" "}
                        {d.payroll ? "• Já descontado em folha" : ""}
                      </small>
                    </div>
                    <button className="text" onClick={() => open("debt", d.id)}>
                      Editar
                    </button>
                    <button
                      className="text danger"
                      onClick={() =>
                        confirmDelete((n) => {
                          n.debts = n.debts.filter((x) => x.id !== d.id);
                        })
                      }
                    >
                      Excluir
                    </button>
                  </div>
                ))}
              </section>
              <section className="panel">
                <h2>Uma comparação para pensar</h2>
                <p>
                  Simulação simplificada; condições reais dependem do contrato.
                  Selecione contratos com saldo atualizado e taxa conhecida.
                  Taxa ausente nunca é zero.
                </p>
                <label>
                  Extra mensal escolhido (R$)
                  <input
                    value={extra}
                    onChange={(e) => setExtra(e.target.value)}
                  />
                </label>
                <p>
                  Orçamento constante: parcelas selecionadas + extra. Juros
                  sobre saldo no início do mês, arredondados ao centavo; mínimos
                  primeiro, extra no alvo, sobras reaplicadas no mesmo mês.
                </p>
                {(() => {
                  let v = 0;
                  try {
                    v = D.money(extra);
                  } catch {
                    return <p className="error">Informe um extra válido</p>;
                  }
                  if (v < 0) return <p>Extra não pode ser negativo.</p>;
                  const ds = s.debts.filter((d) => selected.includes(d.id));
                  return (
                    <>
                      {(v > p.folga || p.missing.length > 0 || p.folga < 0) && (
                        <div className="notice">
                          O orçamento atual não comprova capacidade para esse
                          extra.
                        </div>
                      )}
                      <p>
                        Projeção parcial: excluídos{" "}
                        {s.debts
                          .filter(
                            (d) =>
                              !selected.includes(d.id) ||
                              d.rate === null ||
                              d.overdue,
                          )
                          .map((d) => d.creditor)
                          .join(", ") || "nenhum"}
                        .
                      </p>
                      <div className="two-col">
                        {(["snowball", "avalanche"] as const).map((method) => {
                          const r = D.simulate(ds, v, method);
                          return (
                            <div className="simulation" key={method}>
                              <h3>
                                {method === "snowball"
                                  ? "Bola de neve"
                                  : "Avalanche"}
                              </h3>
                              <p>
                                {r.months === null
                                  ? "Sem prazo de quitação demonstrado"
                                  : `${r.months} meses aproximadamente`}
                              </p>
                              <strong>
                                {value(r.interest)} de juros estimados
                              </strong>
                              <p>Orçamento mensal: {value(r.budget)}</p>
                              <small>
                                Alvos:{" "}
                                {r.order.join(" → ") || "Selecione dívidas"}
                              </small>
                              {r.warnings.map((w) => (
                                <p className="notice" key={w}>
                                  {w}
                                </p>
                              ))}
                              <details>
                                <summary>Tabela mensal</summary>
                                {r.rows.map((row) => (
                                  <div className="calc-row" key={row.month}>
                                    Mês {row.month}
                                    <span>
                                      Pago {value(row.paid)} • Juros{" "}
                                      {value(row.interest)} • Saldo{" "}
                                      {value(row.balance)}
                                    </span>
                                  </div>
                                ))}
                              </details>
                              <button
                                className="text"
                                onClick={() =>
                                  download(
                                    `folga-${method}.csv`,
                                    csv([
                                      [
                                        "mes",
                                        "pago_centavos",
                                        "juros_centavos",
                                        "saldo_centavos",
                                      ],
                                      ...r.rows.map((x) => [
                                        x.month,
                                        x.paid,
                                        x.interest,
                                        x.balance,
                                      ]),
                                    ]),
                                  )
                                }
                              >
                                Exportar tabela
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  );
                })()}
              </section>
            </>
          )}
          {tab === "Auditoria" && (
            <>
              <section className="panel">
                <h2>Revisões com motivo, sem julgamento</h2>
                <p>
                  Regras locais. Repetições são sugestões, não prova de cobrança
                  indevida.
                </p>
                {D.audit(s).map((a) => (
                  <article className="audit" key={a.id}>
                    <span className="pill">{a.certainty}</span>
                    <h3>{a.title}</h3>
                    <p>{a.why}</p>
                    {a.movements.map((id) => {
                      const m = s.movements.find((m) => m.id === id);
                      return (
                        <small key={id}>
                          {m?.description} • {m && D.human(m.date)} •{" "}
                          {m && value(m.amount)}
                          <br />
                        </small>
                      );
                    })}
                    <button
                      className="secondary"
                      disabled={s.tasks.some((t) => t.id === a.id)}
                      onClick={() =>
                        change((n) => {
                          n.tasks.push({
                            id: a.id,
                            title: a.title,
                            due: D.today(),
                            status: "aberta",
                            potential: a.potential,
                            confirmed: 0,
                          });
                        })
                      }
                    >
                      {s.tasks.some((t) => t.id === a.id)
                        ? "Tarefa criada"
                        : "Criar tarefa"}
                    </button>
                  </article>
                ))}
              </section>
              <section className="panel">
                <h2>Seu plano de ação</h2>
                {s.tasks.map((t) => (
                  <div className="list-row wrap" key={t.id}>
                    <div className="grow">
                      <strong>{t.title}</strong>
                      <small>
                        Prazo {D.human(t.due)} • {t.status}
                      </small>
                      <small>
                        Potencial {value(t.potential)} / mês • Confirmado{" "}
                        {value(t.confirmed)}{" "}
                        {t.effect ? `a partir de ${D.human(t.effect)}` : ""}
                      </small>
                    </div>
                    <button className="text" onClick={() => open("task", t.id)}>
                      Atualizar resultado
                    </button>
                  </div>
                ))}
                <p>
                  Economia só é confirmada com valor e data de efeito. Compras
                  pontuais e diferenças de juros não entram como economia
                  mensal.
                </p>
              </section>
            </>
          )}
          {tab === "Importar" && (
            <section className="panel">
              <h2>Importação CSV revisada</h2>
              {demoMode ? (
                <div className="notice">
                  A demonstração não aceita extratos reais. Use apenas o exemplo
                  fictício para explorar a prévia. Nenhum arquivo pode ser
                  enviado neste modo.
                  <button
                    className="secondary"
                    onClick={() => {
                      setFile(
                        "descricao;data;valor;tipo\nMercado fictício;" +
                          D.today() +
                          ";35,90;despesa",
                      );
                      setRows(
                        parseCSV(
                          "descricao;data;valor;tipo\nMercado fictício;" +
                            D.today() +
                            ";35,90;despesa",
                        ),
                      );
                      setAccount(defaultAccount);
                    }}
                  >
                    Abrir exemplo fictício
                  </button>
                </div>
              ) : (
                <label>
                  Arquivo CSV (até 1 MB)
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={async (e) => {
                      try {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        if (f.size > 1_000_000) throw Error("Limite de 1 MB");
                        const text = await f.text();
                        setFile(text);
                        setRows(parseCSV(text));
                        setAccount(defaultAccount);
                      } catch (e) {
                        setError((e as Error).message);
                      }
                    }}
                  />
                </label>
              )}
              <button
                className="text"
                onClick={() =>
                  download(
                    "modelo-ficticio.csv",
                    csv([
                      ["descricao", "data", "valor", "tipo"],
                      ["Mercado fictício", D.today(), "35,90", "despesa"],
                    ]),
                  )
                }
              >
                Baixar modelo fictício
              </button>
              {rows.length > 0 && (
                <>
                  <label>
                    Conta destino
                    <select
                      value={account}
                      onChange={(e) => setAccount(e.target.value)}
                    >
                      {accountOptions}
                    </select>
                  </label>
                  <div className="form-grid">
                    {Object.entries(mapping).map(([key, index]) => (
                      <label key={key}>
                        {
                          (
                            {
                              description: "Descrição",
                              date: "Data",
                              amount: "Valor",
                              type: "Tipo",
                            } as Record<string, string>
                          )[key]
                        }
                        <select
                          value={index}
                          onChange={(e) =>
                            setMapping({
                              ...mapping,
                              [key]: Number(e.target.value),
                            })
                          }
                        >
                          {rows[0].map((c, i) => (
                            <option key={i} value={i}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </label>
                    ))}
                  </div>
                  <p>
                    Datas dd/mm/aaaa ou ISO, valores brasileiros e tipos
                    entrada/despesa. Nenhum saldo é alterado antes da
                    confirmação. Transferências exigem revisão manual.
                  </p>
                  {preview(rows, mapping, s, account).map((r) => (
                    <div className="list-row" key={r.line}>
                      Linha {r.line}:{" "}
                      {r.error ||
                        `${r.movement?.description} • ${value(r.movement!.amount)}`}{" "}
                      {r.duplicate && <strong>Possível duplicata</strong>}
                    </div>
                  ))}
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={duplicates}
                      onChange={(e) => setDuplicates(e.target.checked)}
                    />
                    Revisei e quero incluir possíveis duplicatas
                  </label>
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={repeat}
                      onChange={(e) => setRepeat(e.target.checked)}
                    />
                    Se este arquivo já foi importado, repetir intencionalmente
                  </label>
                  <button
                    disabled={
                      busy ||
                      !account ||
                      preview(rows, mapping, s, account).some((r) => r.error) ||
                      (!duplicates &&
                        preview(rows, mapping, s, account).some(
                          (r) => r.duplicate,
                        ))
                    }
                    onClick={async () => {
                      try {
                        const h = await hash(file);
                        const items = preview(
                          rows,
                          mapping,
                          state,
                          account,
                        ).map((r) => r.movement!);
                        await save(
                          importBatch(
                            state,
                            D.uid(),
                            h,
                            account,
                            items,
                            repeat,
                          ),
                        );
                        setRows([]);
                      } catch (e) {
                        setError((e as Error).message);
                      }
                    }}
                  >
                    Confirmar lote {demoMode ? "fictício" : ""}
                  </button>
                </>
              )}
              <h3>Lotes importados</h3>
              {s.batches.map((b) => (
                <div className="list-row wrap" key={b.id}>
                  <span className="grow">
                    Lote {b.id.slice(0, 8)} •{" "}
                    {b.undone ? "Desfeito" : "Confirmado"}
                  </span>
                  <button
                    className="secondary"
                    disabled={b.undone}
                    onClick={() => {
                      if (confirm("Desfazer todos os movimentos deste lote?"))
                        change((n) => {
                          undoBatch(n, b.id);
                        });
                    }}
                  >
                    Desfazer lote
                  </button>
                </div>
              ))}
            </section>
          )}
          {tab === "Perfil" && (
            <>
              <section className="panel">
                <div className="section-title">
                  <h2>Minhas contas</h2>
                  <button className="secondary" onClick={() => open("account")}>
                    Adicionar conta
                  </button>
                </div>
                {s.accounts.map((a) => (
                  <div className="list-row wrap" key={a.id}>
                    <div className="grow">
                      <strong>{a.name}</strong>
                      <small>
                        {a.reserve ? "Reserva segregada" : "Conta disponível"}{" "}
                        {a.archived ? "• Arquivada" : ""} • Abertura{" "}
                        {D.human(a.date)}
                      </small>
                    </div>
                    <strong>{value(D.balance(s, a.id))}</strong>
                    <button
                      className="text"
                      onClick={() => open("account", a.id)}
                    >
                      Editar
                    </button>
                    <button
                      className="text"
                      onClick={() =>
                        change((n) => {
                          n.accounts.find((x) => x.id === a.id)!.archived =
                            !a.archived;
                        })
                      }
                    >
                      {a.archived ? "Reativar" : "Arquivar"}
                    </button>
                  </div>
                ))}
                <button className="text" onClick={() => open("reconcile")}>
                  Conciliar com ajuste explícito
                </button>
                <p>
                  Arquivar oculta a conta nos formulários e preserva seu saldo e
                  histórico.
                </p>
              </section>
              <section className="panel">
                <h2>Suas preferências</h2>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    try {
                      const f = new FormData(e.currentTarget);
                      const v = D.money(String(f.get("reserve")));
                      change((n) => {
                        n.reserve = v;
                      });
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  <Field
                    label="Reserva mínima adicional (R$) — fora das contas segregadas"
                    name="reserve"
                    value={String(s.reserve / 100).replace(".", ",")}
                    required
                  />
                  <button disabled={busy}>Salvar reserva</button>
                </form>
                <h3>Categorias e subcategorias</h3>
                <p>
                  Exemplos: Moradia e contas / Energia; Alimentação e dia a dia
                  / Mercado. A identificar é uma pendência, não uma finalidade
                  inferida.
                </p>
                <div className="tags">
                  {s.categories.map((c) => (
                    <span className="pill" key={c}>
                      {c}
                      {!D.groups.some((g) => g === c) && (
                        <button
                          className="text"
                          aria-label={`Renomear ${c}`}
                          onClick={() => {
                            const next = prompt(
                              "Nome da categoria ou subcategoria",
                              c,
                            )?.trim();
                            if (next && next !== c)
                              change((n) => {
                                if (n.categories.includes(next))
                                  throw Error("Categoria já existe");
                                n.categories = n.categories.map((x) =>
                                  x === c ? next : x,
                                );
                                n.movements.forEach((m) => {
                                  if (m.category === c) m.category = next;
                                });
                                n.rules.forEach((r) => {
                                  if (r.category === c) r.category = next;
                                });
                                n.cardDetails.forEach((d) => {
                                  if (d.category === c) d.category = next;
                                });
                              });
                          }}
                        >
                          Editar
                        </button>
                      )}
                    </span>
                  ))}
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    const c = String(f.get("category")).trim();
                    if (c && !s.categories.includes(c))
                      change((n) => {
                        n.categories.push(c);
                      });
                  }}
                >
                  <Field
                    label="Nova subcategoria (grupo / nome)"
                    name="category"
                    required
                  />
                  <button className="secondary">Adicionar categoria</button>
                </form>
              </section>
              <section className="panel">
                <h2>Seus dados, sob seu controle</h2>
                <p>
                  Sem rastreadores externos. O modo real não grava dados
                  financeiros no localStorage. A demonstração usa armazenamento
                  separado apenas para dados fictícios.
                </p>
                <div className="actions">
                  <button
                    className="secondary"
                    onClick={() =>
                      download(
                        "folga-backup-v1.json",
                        JSON.stringify(s, null, 2),
                        "application/json",
                      )
                    }
                  >
                    Backup JSON v1
                  </button>
                  <button
                    className="secondary"
                    onClick={() =>
                      download(
                        "folga-movimentos.csv",
                        csv([
                          [
                            "descricao",
                            "data",
                            "valor_centavos",
                            "tipo",
                            "status",
                            "conta",
                          ],
                          ...s.movements.map((m) => [
                            m.description,
                            m.date,
                            m.amount,
                            m.type,
                            m.status,
                            s.accounts.find((a) => a.id === m.account)?.name ||
                              "",
                          ]),
                        ]),
                      )
                    }
                  >
                    Exportar movimentos CSV
                  </button>
                  <button
                    className="secondary"
                    onClick={() => setTab("Auditoria")}
                  >
                    Auditoria e tarefas
                  </button>
                </div>
                <button
                  className="text danger"
                  onClick={() => {
                    if (
                      confirm(
                        "Apagar todos os dados financeiros? Esta ação não pode ser desfeita.",
                      )
                    )
                      void save(D.empty());
                  }}
                >
                  Excluir dados financeiros
                </button>
                {!demoMode && (
                  <>
                    <details>
                      <summary className="danger">
                        Excluir conta e dados
                      </summary>
                      <p>
                        Ação irreversível. Informe EXCLUIR e sua senha atual.
                      </p>
                      <form
                        onSubmit={async (e) => {
                          e.preventDefault();
                          if (
                            !confirm(
                              "Excluir definitivamente a conta e todos os dados?",
                            )
                          )
                            return;
                          const f = new FormData(e.currentTarget);
                          setBusy(true);
                          try {
                            const r = await fetch("/api/account", {
                              method: "DELETE",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                confirmation: f.get("confirmation"),
                                password: f.get("password"),
                              }),
                            });
                            const result = await r.json();
                            if (!r.ok) throw Error(result.error);
                            router.push("/");
                            router.refresh();
                          } catch (e) {
                            setError((e as Error).message);
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        <Field
                          name="confirmation"
                          label="Confirmação: digite EXCLUIR"
                          required
                        />
                        <Field
                          name="password"
                          type="password"
                          label="Senha atual para exclusão"
                          required
                        />
                        <button disabled={busy} className="danger secondary">
                          Excluir definitivamente
                        </button>
                      </form>
                    </details>
                    <button
                      className="text"
                      onClick={async () => {
                        await fetch("/api/auth", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ action: "logout" }),
                        });
                        router.push("/login");
                        router.refresh();
                      }}
                    >
                      <LogOut size={16} /> Sair
                    </button>
                  </>
                )}
              </section>
            </>
          )}
          <footer>
            FOLGA <span>Seu dinheiro com espaço para respirar.</span>
          </footer>
        </div>
      </div>
      {modal && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModal(null);
          }}
        >
          <section
            ref={modalRef}
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            <div className="section-title">
              <h2 id="modal-title">
                {
                  (
                    {
                      movement: edit
                        ? "Editar movimento"
                        : "Adicionar movimento",
                      account: "Conta e saldo de abertura",
                      rule: "Compromisso mensal",
                      debt: "Dívida",
                      contract: "Contrato e recebimentos",
                      activity: "Atividade com custos",
                      task: "Resultado da tarefa",
                      reconcile: "Conciliação explícita",
                      card: "Detalhes de fatura",
                    } as Record<string, string>
                  )[modal]
                }
              </h2>
              <button
                className="icon"
                aria-label="Fechar formulário"
                onClick={() => setModal(null)}
              >
                <X />
              </button>
            </div>
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <form onSubmit={formSubmit}>
              {modal === "movement" && (
                <>
                  <Field
                    label="Descrição"
                    name="description"
                    value={existing?.description}
                    required
                  />
                  <div className="form-grid">
                    <Field
                      label="Valor (R$)"
                      name="amount"
                      value={
                        existing
                          ? String(existing.amount / 100).replace(".", ",")
                          : undefined
                      }
                      required
                    />
                    <Field
                      label="Data de caixa"
                      name="date"
                      type="date"
                      value={existing?.date || D.today()}
                      required
                    />
                  </div>
                  <Field
                    label="Tipo financeiro"
                    name="type"
                    value={existing?.type || "expense"}
                  >
                    <option value="expense">Despesa</option>
                    <option value="income">Entrada de trabalho / renda</option>
                    <option value="transfer-out">
                      Transferência entre contas
                    </option>
                    <option value="refund">Reembolso / estorno</option>
                    {existing?.type.startsWith("adjustment") && (
                      <>
                        <option value="adjustment">Ajuste positivo</option>
                        <option value="adjustment-out">Ajuste negativo</option>
                      </>
                    )}
                    <option value="loan">
                      Entrada de empréstimo (não é renda)
                    </option>
                  </Field>
                  <Field
                    label="Conta"
                    name="account"
                    value={existing?.account || defaultAccount}
                    required
                  >
                    {accountOptions}
                  </Field>
                  <Field
                    label="Status"
                    name="status"
                    value={existing?.status || "realizado"}
                  >
                    <option value="realizado">Realizado</option>
                    <option value="previsto">Previsto confirmado</option>
                    <option value="provavel">
                      Renda provável (não entra na folga principal)
                    </option>
                  </Field>
                  <Field
                    label="Categoria"
                    name="category"
                    value={existing?.category || "A identificar"}
                  >
                    {categoryOptions}
                  </Field>
                  <details open={existing?.type === "refund"}>
                    <summary>Detalhes opcionais / transferência</summary>
                    <Field
                      label="Conta destino (apenas transferência)"
                      name="destination"
                    >
                      <option value="">Selecione</option>
                      {accountOptions}
                    </Field>
                    <Field
                      label="Despesa original (para estorno)"
                      name="original"
                      value={existing?.original}
                    >
                      <option value="">Não identificada</option>
                      {s.movements
                        .filter((m) => m.type === "expense")
                        .map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.description} • {D.brl(m.amount)}
                          </option>
                        ))}
                    </Field>
                    <Field
                      label="Atividade"
                      name="activity"
                      value={existing?.activity}
                    >
                      <option value="">Nenhuma</option>
                      {s.activities.map((a) => (
                        <option key={a.id}>{a.name}</option>
                      ))}
                    </Field>
                    <Field
                      label="Competência"
                      name="competence"
                      type="date"
                      value={existing?.competence}
                    />
                    <label>
                      Observação
                      <textarea name="note" defaultValue={existing?.note} />
                    </label>
                  </details>
                  <Check
                    name="netSalary"
                    label="Se for salário: confirmo que o valor já está líquido dos descontos em folha"
                  />
                  <p className="muted">
                    Salário: informe o valor líquido. Consignados já abatidos
                    não devem gerar nova despesa. Entrada de empréstimo aumenta
                    caixa e passivo, não renda de trabalho.
                  </p>
                </>
              )}
              {modal === "account" && (
                <>
                  <Field
                    label="Nome da conta"
                    name="name"
                    value={currentAccount?.name}
                    required
                  />
                  <Field
                    label="Saldo de abertura (R$)"
                    name="amount"
                    value={
                      currentAccount
                        ? String(currentAccount.opening / 100).replace(".", ",")
                        : "0"
                    }
                    required
                  />
                  <Field
                    label="Data do saldo"
                    name="date"
                    type="date"
                    value={currentAccount?.date || D.today()}
                    required
                  />
                  <Check
                    name="reserve"
                    label="Conta segregada de reserva — fora da folga disponível"
                    checked={currentAccount?.reserve}
                  />
                  <p>
                    Movimentos anteriores à abertura não alteram esse saldo.
                  </p>
                </>
              )}
              {modal === "rule" && (
                <>
                  <Field
                    label="Descrição"
                    name="description"
                    value={rule?.description}
                    required
                  />
                  <Field
                    label="Parcela mensal (R$)"
                    name="amount"
                    value={
                      rule
                        ? String(rule.amount / 100).replace(".", ",")
                        : undefined
                    }
                    required
                  />
                  <Field
                    label="Primeiro vencimento"
                    name="date"
                    type="date"
                    value={rule?.start || D.today()}
                    required
                  />
                  <Field
                    label="Último vencimento (opcional)"
                    name="end"
                    type="date"
                    value={rule?.end}
                  />
                  <Field
                    label="Número de parcelas (opcional)"
                    name="count"
                    type="number"
                    value={rule?.count}
                  />
                  <Field
                    label="Conta prevista"
                    name="account"
                    value={rule?.account || defaultAccount}
                    required
                  >
                    {accountOptions}
                  </Field>
                  <Field
                    label="Categoria"
                    name="category"
                    value={rule?.category || "Moradia e contas"}
                  >
                    {categoryOptions}
                  </Field>
                  <Check
                    name="subscription"
                    label="É uma assinatura cadastrada"
                    checked={rule?.subscription}
                  />
                  <Check
                    name="payroll"
                    label="Descontado em folha e já retirado da renda líquida"
                    checked={rule?.payroll}
                  />
                  <p>
                    Alterações preservam ocorrências pagas e passadas. Mensal,
                    até 12 meses adiante; dias 29–31 ajustam ao fim do mês.
                  </p>
                </>
              )}
              {modal === "debt" && (
                <>
                  <Field
                    label="Credor"
                    name="creditor"
                    value={debt?.creditor}
                    required
                  />
                  <Field
                    label="Modalidade"
                    name="kind"
                    value={debt?.kind || "Empréstimo pessoal"}
                    required
                  />
                  <Field
                    label="Saldo atual para quitação (R$)"
                    name="balance"
                    value={
                      debt
                        ? String(debt.balance / 100).replace(".", ",")
                        : undefined
                    }
                    required
                  />
                  <Field
                    label="Data-base do saldo"
                    name="base"
                    type="date"
                    value={debt?.base || D.today()}
                    required
                  />
                  <Field
                    label="Parcela (R$)"
                    name="amount"
                    value={
                      debt
                        ? String(debt.installment / 100).replace(".", ",")
                        : undefined
                    }
                    required
                  />
                  <Field
                    label="Parcelas restantes"
                    name="remaining"
                    type="number"
                    value={debt?.remaining || 1}
                    required
                  />
                  <Field
                    label="Juros mensais % — vazio se desconhecido"
                    name="rate"
                    value={debt?.rate || ""}
                  />
                  <Field
                    label="CET anual % (não é taxa de amortização)"
                    name="cet"
                    value={debt?.cet}
                  />
                  <Field
                    label="Próximo vencimento"
                    name="date"
                    type="date"
                    value={debt?.due || D.today()}
                    required
                  />
                  <Check
                    name="overdue"
                    label="Em atraso — saldo precisa ser atualizado antes da simulação"
                    checked={debt?.overdue}
                  />
                  <Check
                    name="payroll"
                    label="Descontado em folha e já retirado da renda líquida"
                    checked={debt?.payroll}
                  />
                  <Field
                    label="Observações (sem dados sensíveis de terceiros)"
                    name="note"
                    value={debt?.note}
                  />
                  <p>
                    O inventário não cria parcelas no caixa automaticamente.
                    Cadastre um compromisso para controlar vencimentos sem
                    duplicar descontos em folha.
                  </p>
                </>
              )}
              {modal === "contract" && (
                <>
                  <Field
                    label="Descrição do contrato"
                    name="description"
                    required
                  />
                  <Field label="Valor total (R$)" name="amount" required />
                  <Field
                    label="Início da competência"
                    name="date"
                    type="date"
                    value={D.today()}
                    required
                  />
                  <Field
                    label="Fim da competência"
                    name="end"
                    type="date"
                    value={D.monthDate(D.today(), 2)}
                    required
                  />
                  <Field
                    label="Conta de recebimento"
                    name="account"
                    value={defaultAccount}
                  >
                    {accountOptions}
                  </Field>
                  <label>
                    Cronograma: data ISO;valor;status
                    <textarea
                      name="schedule"
                      required
                      placeholder="2026-11-05;2600,00;previsto"
                    />
                  </label>
                  <p>
                    Uma linha por recebimento. Status: previsto, provavel ou
                    realizado. Realizados criam um único movimento na data
                    informada. A média de competência não gera depósitos.
                  </p>
                </>
              )}
              {modal === "activity" && (
                <>
                  <Field label="Nome da atividade" name="name" required />
                  <Check
                    name="net"
                    label="Repasse já líquido da taxa da plataforma"
                  />
                  <Check
                    name="complete"
                    label="Todos os custos necessários foram informados"
                  />
                  <p>
                    Vincule entradas e despesas à atividade nos detalhes do
                    movimento. Não descontamos taxas automaticamente.
                  </p>
                </>
              )}
              {modal === "task" && (
                <>
                  <Field
                    name="title"
                    label="Ação concreta (ex.: pedir proposta ou acompanhar cancelamento)"
                    value={s.tasks.find((t) => t.id === edit)!.title}
                    required
                  />
                  <Field
                    label="Prazo da tarefa"
                    name="due"
                    type="date"
                    value={s.tasks.find((t) => t.id === edit)!.due}
                    required
                  />
                  <Check
                    name="monthly"
                    label="Confirmo redução mensal recorrente, sem compras pontuais ou diferenças nominais de juros"
                  />
                  <Field
                    label="Economia mensal confirmada (R$) — zero se ainda não confirmada"
                    name="amount"
                    value={String(
                      s.tasks.find((t) => t.id === edit)!.confirmed / 100,
                    ).replace(".", ",")}
                    required
                  />
                  <Field
                    label="Data de efeito"
                    name="date"
                    type="date"
                    value={D.today()}
                    required
                  />
                  <Check
                    name="done"
                    label="Tarefa concluída"
                    checked={
                      s.tasks.find((t) => t.id === edit)?.status === "concluida"
                    }
                  />
                </>
              )}
              {modal === "reconcile" && (
                <>
                  <Field label="Conta" name="account" value={defaultAccount}>
                    {accountOptions}
                  </Field>
                  <Field
                    label="Saldo real observado (R$)"
                    name="amount"
                    required
                  />
                  <p>
                    A diferença será um ajuste explícito, sem compor receitas ou
                    despesas.
                  </p>
                </>
              )}
              {modal === "card" && (
                <>
                  <Field
                    label="Pagamento realizado da fatura"
                    name="payment"
                    required
                  >
                    {s.movements
                      .filter(
                        (m) => m.type === "expense" && m.status === "realizado",
                      )
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.description} • {D.brl(m.amount)}
                        </option>
                      ))}
                  </Field>
                  <Field label="Categoria informativa" name="category">
                    {categoryOptions}
                  </Field>
                  <Field label="Valor detalhado (R$)" name="amount" required />
                  <p>
                    Não gera saída adicional. Não misture fatura com compras
                    individuais já lançadas como despesas.
                  </p>
                </>
              )}
              <button
                disabled={
                  busy ||
                  (["movement", "rule", "contract", "reconcile"].includes(
                    modal,
                  ) &&
                    !accounts.length)
                }
              >
                {busy ? "Salvando…" : "Salvar"}
              </button>
              {!accounts.length && modal !== "account" && (
                <p>Cadastre uma conta em Configurações antes de continuar.</p>
              )}
            </form>
          </section>
        </div>
      )}
    </>
  );
}
