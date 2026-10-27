import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.goto("/demo");
  await expect(page.getByText("Demonstração — dados fictícios")).toBeVisible();
});
test("adicionar, editar, persistir, pagar e não transbordar", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.getByRole("button", { name: "Adicionar", exact: true }).click();
  await page.getByLabel("Descrição", { exact: true }).fill("Café fictício");
  await page.getByLabel("Valor (R$)", { exact: true }).fill("10,00");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await page.getByRole("button", { name: "Movimentos", exact: true }).click();
  await expect(page.getByText("Café fictício", { exact: true })).toBeVisible();
  await page
    .locator(".list-row")
    .filter({ hasText: "Café fictício" })
    .getByRole("button", { name: "Editar", exact: true })
    .click();
  await page.getByLabel("Valor (R$)", { exact: true }).fill("20,00");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(
    page.locator(".list-row").filter({ hasText: "Café fictício" }),
  ).toContainText("20,00");
  await page.reload();
  await page.getByRole("button", { name: "Movimentos", exact: true }).click();
  await expect(page.getByText("Café fictício", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Hoje", exact: true }).click();
  await expect(page.locator(".balance")).toContainText("1.820,50");
  await page.getByRole("button", { name: "Planejar", exact: true }).click();
  await page
    .getByRole("button", { name: "Marcar como pago", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("button", { name: "Desfazer pagamento", exact: true }),
  ).toHaveCount(1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
  await page.getByRole("button", { name: "Hoje", exact: true }).click();
  await page.screenshot({
    path: `test-results/${testInfo.project.name}-hoje.png`,
    fullPage: true,
  });
});
test("onboarding retomável e importação fictícia revisada", async ({
  page,
}) => {
  await page.getByLabel("Perfil e configurações").click();
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Excluir dados financeiros", exact: true })
    .click();
  await expect(page.getByText("Onde seu dinheiro está?")).toBeVisible();
  await page.getByRole("button", { name: "Preencher", exact: true }).click();
  await page.getByLabel("Nome da conta").fill("Conta fictícia");
  await page
    .getByLabel("Saldo de abertura (R$)", { exact: true })
    .fill("100,00");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await page.getByRole("button", { name: "Continuar / pular etapa" }).click();
  await page.reload();
  await expect(page.getByText("Qual é sua próxima entrada?")).toBeVisible();
  await page.getByRole("button", { name: "Movimentos", exact: true }).click();
  await page.getByRole("button", { name: "Importar CSV", exact: true }).click();
  await expect(page.locator("input[type=file]")).toHaveCount(0);
  await page.getByRole("button", { name: "Abrir exemplo fictício" }).click();
  await expect(page.getByText("Linha 2:")).toBeVisible();
  await page.getByRole("button", { name: "Confirmar lote fictício" }).click();
  await page.getByRole("button", { name: "Movimentos", exact: true }).click();
  await expect(
    page.getByText("Mercado fictício", { exact: true }),
  ).toBeVisible();
});
test("login sem configuração explica pendência e não substitui por demo", async ({
  page,
}) => {
  await page.goto("/login");
  await expect(
    page.getByText("Modo real ainda não configurado.", { exact: false }),
  ).toBeVisible();
});
test("planejamento, atividade, contrato, dívidas, auditoria e privacidade funcionam", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Planejar", exact: true }).click();
  await page
    .getByRole("button", { name: "Atividade com custos", exact: true })
    .click();
  await page.getByLabel("Nome da atividade").fill("Motorista fictício");
  await page.getByLabel("Repasse já líquido da taxa da plataforma").check();
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(
    page.getByText("Custos incompletos — não é lucro líquido"),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Contrato / recebimentos", exact: true })
    .click();
  await page
    .getByLabel("Descrição do contrato")
    .fill("Contrato fictício de teste");
  await page.getByLabel("Valor total (R$)", { exact: true }).fill("3600,00");
  await page
    .locator("textarea[name=schedule]")
    .fill("2026-11-05;2600,00;previsto\n2026-12-05;1000,00;previsto");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(
    page.getByText("Contrato fictício de teste", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Dívidas", exact: true }).click();
  await page.getByLabel("Simular", { exact: true }).first().check();
  await page.getByLabel("Extra mensal escolhido (R$)").fill("100,00");
  await expect(
    page.getByRole("heading", { name: "Bola de neve", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Avalanche", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Hoje", exact: true }).click();
  await page.getByLabel("Ocultar valores").click();
  await expect(page.locator(".balance h2")).toHaveText("••••••");
  await page
    .getByRole("button", { name: "Revisar meu mês", exact: false })
    .click();
  await page
    .getByRole("button", { name: "Criar tarefa", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("button", { name: "Tarefa criada", exact: true }),
  ).toHaveCount(1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
