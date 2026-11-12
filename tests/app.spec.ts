import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Hola, Lucía." }),
  ).toBeVisible();
});
test("padrón: búsqueda sin acentos, ficha completa, filtro y persistencia de perfil", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Padrón de afiliados", exact: true })
    .click();
  await page.getByRole("textbox", { name: "Buscar afiliado" }).fill("martinez");
  await expect(
    page.getByRole("button", { name: "AM Ana Martínez" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Ver ficha de Ana Martínez" }).click();
  await expect(page.getByRole("dialog")).toContainText("Gerencia");
  await expect(page.getByRole("dialog")).toContainText("42001");
  await page.getByRole("button", { name: "Cerrar", exact: true }).click();
  await page.getByRole("button", { name: "Mi perfil", exact: true }).click();
  await page.getByRole("button", { name: "Editar mi información" }).click();
  await page.getByLabel("Edificio asignado").fill("Edificio de prueba");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Mi perfil", exact: true }).click();
  await expect(page.locator("dd").first()).toHaveText("Edificio de prueba");
});
test("convocatorias: rechazar exige motivo y Secretaría ve la respuesta", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Ver convocatoria", exact: true })
    .click();
  await page
    .getByRole("button", { name: "No asistiré", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Enviar justificación" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page
    .getByLabel("Motivo de la inasistencia")
    .fill("Debo realizar un trámite personal previamente acordado.");
  await page.getByRole("button", { name: "Enviar justificación" }).click();
  await expect(page.getByText("Inasistencia justificada")).toBeVisible();
  await page
    .getByRole("combobox", { name: "Cambiar perfil de muestra" })
    .selectOption("secretario");
  await expect(
    page.getByRole("heading", { name: "Hola, Martín." }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Agenda gremial/ }).click();
  await page
    .getByRole("button", { name: /confirmados · Ver respuestas/ })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "Debo realizar un trámite personal",
  );
});
test("vacaciones: validar solapamiento y reflejar cobertura privada", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Mis vacaciones", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Informar vacaciones", exact: true })
    .click();
  await page.getByLabel("Desde").fill("2027-02-01");
  await page.getByLabel("Hasta").fill("2027-02-10");
  await page.getByRole("button", { name: "Informar período" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page
    .getByRole("button", { name: "Informar vacaciones", exact: true })
    .click();
  await page.getByLabel("Desde").fill("2027-02-05");
  await page.getByLabel("Hasta").fill("2027-02-12");
  await page.getByRole("button", { name: "Informar período" }).click();
  await expect(page.getByRole("status")).toContainText("superpone");
  await page.getByRole("button", { name: "Cerrar", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Cobertura por edificio" }),
  ).toHaveCount(0);
  await page
    .getByRole("combobox", { name: "Cambiar perfil de muestra" })
    .selectOption("secretario");
  await page
    .getByRole("button", { name: "Cobertura por edificio", exact: true })
    .click();
  await page.getByLabel("Consultar fecha").fill("2027-02-05");
  await expect(
    page.locator(".coverage-person").filter({ hasText: "Lucía Fernández" }),
  ).toContainText("Vacaciones");
});
test("Secretaría publica eventos y genera avisos para el delegado", async ({
  page,
}) => {
  await page
    .getByRole("combobox", { name: "Cambiar perfil de muestra" })
    .selectOption("secretario");
  await page.getByRole("button", { name: /Agenda gremial/ }).click();
  await page.getByRole("button", { name: "Nueva convocatoria" }).click();
  await page
    .getByLabel("Título", { exact: true })
    .fill("Asamblea de verificación");
  await page.getByLabel("Fecha y hora (Argentina)").fill("2027-10-20T14:00");
  await page.getByLabel("Lugar", { exact: true }).fill("Sede Central");
  await page
    .getByLabel("Descripción", { exact: true })
    .fill("Convocatoria de prueba para verificar las alertas.");
  await page.getByRole("button", { name: "Guardar y notificar" }).click();
  await expect(
    page.getByRole("heading", { name: "Asamblea de verificación" }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Cambiar perfil de muestra" })
    .selectOption("delegado");
  await page.getByRole("button", { name: /Notificaciones, / }).click();
  await expect(
    page.locator(".notice-row").filter({ hasText: "Asamblea de verificación" }),
  ).toBeVisible();
});
test("administración modifica padrón y beneficios", async ({ page }) => {
  await page
    .getByRole("combobox", { name: "Cambiar perfil de muestra" })
    .selectOption("admin");
  await page
    .getByRole("button", { name: "Padrón de afiliados", exact: true })
    .click();
  await page.getByRole("button", { name: "Nuevo afiliado" }).click();
  for (const [label, value] of [
    ["Nombre", "Prueba"],
    ["Apellido", "Integración"],
    ["Número de legajo", "99999"],
    ["Edificio", "Sede Central"],
    ["Área", "Sistemas"],
    ["Cargo", "Analista"],
    ["Gerencia", "Tecnología"],
    ["Hora de ingreso", "08:00"],
    ["Hora de salida", "15:00"],
    ["Teléfono de contacto", "11 5550 9999"],
  ])
    await page.getByLabel(label, { exact: true }).fill(value);
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await page.getByRole("textbox", { name: "Buscar afiliado" }).fill("99999");
  await expect(page.locator("tbody")).toContainText("Prueba Integración");
  await page
    .getByRole("button", { name: "Beneficios e información", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Editar", exact: true })
    .first()
    .click();
  await page.getByLabel("Título", { exact: true }).fill("Turismo actualizado");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(
    page.getByRole("heading", { name: "Turismo actualizado" }),
  ).toBeVisible();
});
test("móvil: navegación, sin desbordamiento y PWA instalada técnicamente", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("heading", { name: "Hola, Lucía." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Abrir menú" }).click();
  await page
    .getByRole("button", { name: "Padrón de afiliados", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Buscar afiliado" }),
  ).toBeVisible();
  const manifest = await (
    await page.request.get("/manifest.webmanifest")
  ).json();
  expect(manifest.display).toBe("standalone");
  expect((await page.request.get("/icon-192.png")).status()).toBe(200);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  expect(errors).toEqual([]);
});
test("la muestra abre sin conexión después de su primera visita", async ({
  page,
  context,
}) => {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Hola, Lucía." }),
  ).toBeVisible();
  await expect(page.getByText("Sin conexión.", { exact: false })).toBeVisible();
  await context.setOffline(false);
});
