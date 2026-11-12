import { test, expect } from "@playwright/test";
import {
  summarize,
  validateReport,
  type Measure,
} from "../src/measures-domain";
test("porcentaje ponderado, partes faltantes y ceros explícitos", () => {
  const measure: Measure = {
    id: "m",
    title: "Prueba",
    date: "2026-11-18",
    description: "",
    closed: false,
    buildings: [
      { name: "A", reporter_ids: [] },
      { name: "B", reporter_ids: [] },
      { name: "C", reporter_ids: [] },
    ],
  };
  const base = {
    measure_id: "m",
    user_id: "d1",
    updated_at: "2026-11-11T10:00:00Z",
  };
  const stats = summarize(measure, [
    { ...base, id: "a", building: "A", total: 100, adherents: 90 },
    { ...base, id: "b", building: "B", total: 10, adherents: 0 },
  ]);
  expect(stats.rate).toBeCloseTo(81.81818);
  expect(stats.pending).toBe(1);
  expect(stats.received).toBe(2);
  expect(stats.notAdhering).toBe(20);
  expect(summarize(measure, []).rate).toBeNull();
  for (const [total, adherents] of [
    [0, 0],
    [100, 101],
    [10, -1],
    [10, 1.2],
    [1.5, 1],
  ])
    expect(() => validateReport(total, adherents)).toThrow();
  expect(() => validateReport(100, 0)).not.toThrow();
});
test("delegado carga y corrige; Secretaría analiza, exporta y cierra", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Medidas gremiales", exact: true })
    .click();
  await expect(page.getByRole("button", { name: "Nueva medida" })).toHaveCount(
    0,
  );
  await expect(page.getByLabel("Edificio para informar")).toHaveValue(
    "Sede Central",
  );
  await page
    .getByLabel("Total de personas alcanzadas", { exact: true })
    .fill("100");
  await page.getByLabel("Personas que adhieren", { exact: true }).fill("101");
  await page.getByRole("button", { name: "Enviar parte", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("entre cero y el total");
  await page.getByLabel("Personas que adhieren", { exact: true }).fill("70");
  await page.getByRole("button", { name: "Enviar parte", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Parte actualizado");
  await page.reload();
  await expect(
    page.getByLabel("Personas que adhieren", { exact: true }),
  ).toHaveValue("70");
  await page.getByLabel("Personas que adhieren", { exact: true }).fill("60");
  await page
    .getByRole("button", { name: "Actualizar parte", exact: true })
    .click();
  await expect(page.locator(".own-report")).toContainText("60 de 100");
  await page
    .getByRole("combobox", { name: "Cambiar perfil de muestra" })
    .selectOption("secretario");
  await page
    .getByRole("button", { name: "Medidas gremiales", exact: true })
    .click();
  await expect(page.locator(".adhesion-stats")).toContainText("112");
  await expect(page.locator(".adhesion-stats")).toContainText("62,2%");
  await expect(page.locator(".adhesion-stats")).toContainText("2 / 3");
  await expect(
    page.locator("tr").filter({ hasText: "Planta Sur" }),
  ).toContainText("Sin parte");
  await expect(
    page.getByRole("button", { name: "Enviar parte", exact: true }),
  ).toHaveCount(0);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Descargar CSV" }).click();
  expect((await download).suggestedFilename()).toMatch(
    /informe-adhesion-.*\.csv/,
  );
  await page.screenshot({
    path: "evidence/medidas-informe.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".sidebar")).toBeHidden();
  await expect(page.locator(".measure-report")).toBeVisible();
  await page.pdf({
    path: "evidence/informe-adhesion-muestra.pdf",
    format: "A4",
    printBackground: true,
  });
  await page.emulateMedia({ media: "screen" });
  await page
    .getByRole("button", { name: "Cerrar carga de la medida", exact: true })
    .click();
  await page.getByRole("button", { name: "Confirmar cierre" }).click();
  await expect(page.getByText("Carga cerrada", { exact: true })).toBeVisible();
  await page
    .getByRole("combobox", { name: "Cambiar perfil de muestra" })
    .selectOption("delegado");
  await page
    .getByRole("button", { name: "Medidas gremiales", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Actualizar parte", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("La medida está cerrada.", { exact: false }),
  ).toBeVisible();
});
test("Administración crea una medida con alcance y asignaciones fijas", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("combobox", { name: "Cambiar perfil de muestra" })
    .selectOption("admin");
  await page
    .getByRole("button", { name: "Medidas gremiales", exact: true })
    .click();
  await page.getByRole("button", { name: "Nueva medida" }).click();
  await page.getByLabel("Nombre de la medida").fill("Asamblea por edificio");
  await page.getByLabel("Fecha de la medida").fill("2026-12-02");
  await page.getByRole("button", { name: "Crear medida", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.locator(".measure-heading")).toContainText(
    "Asamblea por edificio",
  );
  await expect(page.locator(".adhesion-stats")).toContainText("Sin datos");
  await expect(page.locator(".adhesion-stats")).toContainText("0 / 3");
  await page
    .getByRole("combobox", { name: "Cambiar perfil de muestra" })
    .selectOption("delegado");
  await page
    .getByRole("button", { name: "Medidas gremiales", exact: true })
    .click();
  await expect(page.getByLabel("Edificio para informar")).toHaveValue(
    "Sede Central",
  );
});
test("medidas y gráficos adaptables para ambos roles de gestión y delegado", async ({
  page,
}) => {
  for (const width of [360, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const role of ["delegado", "secretario", "admin"]) {
      await page.goto("/");
      await expect(
        page.getByRole("heading", { name: "Hola, Lucía." }),
      ).toBeVisible();
      if (role !== "delegado")
        await page
          .getByRole("combobox", { name: "Cambiar perfil de muestra" })
          .selectOption(role);
      if (width <= 680)
        await page.getByRole("button", { name: /Abrir men/ }).click();
      await page
        .getByRole("button", { name: "Medidas gremiales", exact: true })
        .click();
      await expect(page.locator(".measure-heading")).toBeVisible();
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        )
        .toBe(true);
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "evidence/medidas-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
});
