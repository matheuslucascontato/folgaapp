import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
test.skip(
  !process.env.TEST_SUPABASE_ADMIN,
  "Execute npm run test:real com Supabase local. A demo não comprova autenticação.",
);
test("cadastro/login real, persistência, importação e encerramento de sessão", async ({
  page,
}, testInfo) => {
  const admin = createClient(
    process.env.TEST_SUPABASE_URL!,
    process.env.TEST_SUPABASE_ADMIN!,
    { auth: { persistSession: false } },
  );
  const email = `folga-e2e-${crypto.randomUUID()}@example.test`,
    password = crypto.randomUUID() + "aA1!";
  let id: string | undefined;
  try {
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (created.error) throw created.error;
    id = created.data.user!.id;
    await page.goto("/app");
    await expect(page).toHaveURL(/login/);
    await page.getByLabel("E-mail", { exact: true }).fill(email);
    await page
      .getByLabel("Senha (mínimo 8 caracteres)", { exact: true })
      .fill(password);
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(page).toHaveURL(/\/app$/);
    await expect(page.getByText("Onde seu dinheiro está?")).toBeVisible();
    await expect(page.getByText("Demonstração — dados fictícios")).toHaveCount(
      0,
    );
    await page.getByRole("button", { name: "Preencher", exact: true }).click();
    await page.getByLabel("Nome da conta").fill("Conta de teste fictícia");
    await page
      .getByLabel("Saldo de abertura (R$)", { exact: true })
      .fill("100,00");
    await page.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.getByRole("button", { name: "Continuar / pular etapa" }).click();
    await page.getByRole("button", { name: "Adicionar", exact: true }).click();
    await page.getByLabel("Descrição", { exact: true }).fill("Renda fictícia");
    await page.getByLabel("Valor (R$)", { exact: true }).fill("1000,00");
    await page.getByLabel("Tipo financeiro").selectOption("income");
    await page.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(page.locator(".balance")).toContainText("1.100,00");
    await page.reload();
    await expect(page.locator(".balance")).toContainText("1.100,00");
    await page.getByRole("button", { name: "Movimentos", exact: true }).click();
    await page
      .getByRole("button", { name: "Importar CSV", exact: true })
      .click();
    await page.locator("input[type=file]").setInputFiles({
      name: "ficticio.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(
        "descricao;data;valor;tipo\nDespesa fictícia;2026-10-10;10,00;despesa",
      ),
    });
    await expect(page.getByText("Linha 2:")).toBeVisible();
    await page
      .getByRole("button", { name: "Confirmar lote", exact: true })
      .click();
    await expect(
      page.getByText("Lote ", { exact: false }).first(),
    ).toBeVisible();
    await page.getByRole("button", { name: "Movimentos", exact: true }).click();
    await expect(
      page.getByText("Despesa fictícia", { exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () =>
          Object.keys(localStorage).filter((k) => !k.startsWith("folga-demo"))
            .length,
      ),
    ).toBe(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/${testInfo.project.name}-real.png`,
      fullPage: true,
    });
    await page.getByLabel("Perfil e configurações").click();
    await page.getByRole("button", { name: "Sair", exact: true }).click();
    await expect(page).toHaveURL(/login/);
    await page.goto("/app");
    await expect(page).toHaveURL(/login/);
    await page.getByLabel("E-mail", { exact: true }).fill(email);
    await page
      .getByLabel("Senha (mínimo 8 caracteres)", { exact: true })
      .fill(password);
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(page).toHaveURL(/\/app$/);
    await page.getByLabel("Perfil e configurações").click();
    await page.getByText("Excluir conta e dados", { exact: true }).click();
    await page.getByLabel("Confirmação: digite EXCLUIR").fill("EXCLUIR");
    await page.getByLabel("Senha atual para exclusão").fill(password);
    page.once("dialog", (dialog) => dialog.accept());
    await page
      .getByRole("button", { name: "Excluir definitivamente", exact: true })
      .click();
    await expect(page).toHaveURL(process.env.TEST_BASE_URL + "/");
    expect(
      (await admin.from("financial_data").select().eq("user_id", id!)).data,
    ).toEqual([]);
  } finally {
    if (id) await admin.auth.admin.deleteUser(id);
  }
});
test("cadastro por e-mail/senha e solicitação de recuperação (entrega SMTP não simulada)", async ({
  page,
}) => {
  const admin = createClient(
    process.env.TEST_SUPABASE_URL!,
    process.env.TEST_SUPABASE_ADMIN!,
    { auth: { persistSession: false } },
  );
  const email = `folga-signup-${crypto.randomUUID()}@example.test`,
    password = crypto.randomUUID() + "aA1!";
  try {
    await page.goto("/login");
    await page
      .getByRole("button", { name: "Criar conta", exact: true })
      .click();
    await page.getByLabel("E-mail", { exact: true }).fill(email);
    await page
      .getByLabel("Senha (mínimo 8 caracteres)", { exact: true })
      .fill(password);
    await page
      .getByRole("button", { name: "Criar conta", exact: true })
      .first()
      .click();
    await expect(
      page.getByText("Confira seu e-mail para confirmar o cadastro."),
    ).toBeVisible();
    const recovery = await page.request.post("/api/auth", {
      headers: { Origin: process.env.TEST_BASE_URL! },
      data: { action: "recover", email },
    });
    expect(recovery.status()).toBe(200);
  } finally {
    const { data } = await admin.auth.admin.listUsers();
    const user = data.users.find((u) => u.email === email);
    if (user) await admin.auth.admin.deleteUser(user.id);
  }
});
