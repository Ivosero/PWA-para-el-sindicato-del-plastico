import { test, expect } from "@playwright/test";
import { PNG } from "pngjs";
import jsQR from "jsqr";
import { readFileSync } from "node:fs";
import { whatsappNumber, delegateShareText } from "../src/delegate-card-domain";
test("teléfonos internacionales sin adivinar país ni aceptar enlaces arbitrarios", () => {
  expect(whatsappNumber("+54 9 (11) 5550-0101")).toBe("5491155500101");
  for (const invalid of [
    "1155500101",
    "javascript:alert(1)",
    "https://wa.me/123",
    "+0012345678",
    "+123",
    "",
  ])
    expect(whatsappNumber(invalid)).toBeNull();
});
test("PNG descargable con QR decodificable y datos actualizados del perfil", async ({
  page,
}) => {
  await page.goto("/?view=tarjetas");
  await expect(
    page.getByRole("img", { name: /Tarjeta de Lucía/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Editar mis datos" }).click();
  await page.getByLabel("WhatsApp con código de país").fill("1155500101");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByRole("status")).toContainText("código de país");
  await page
    .getByLabel("WhatsApp con código de país")
    .fill("+54 9 11 5550 9999");
  await page.getByLabel("Edificio asignado").fill("Edificio & Representación");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.locator(".delegate-card-image")).toHaveAttribute(
    "alt",
    /Edificio & Representación.*5491155509999/,
  );
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Descargar tarjeta PNG" }).click();
  const download = await pending;
  expect(download.suggestedFilename()).toMatch(
    /^tarjeta-lucia-fernandez\.png$/,
  );
  const file = await download.path();
  expect(file).toBeTruthy();
  const png = PNG.sync.read(readFileSync(file!));
  expect(png.width).toBe(1080);
  expect(png.height).toBeGreaterThanOrEqual(1450);
  const qr = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  expect(qr?.data).toBe("https://wa.me/5491155509999");
  await download.saveAs("evidence/tarjeta-delegado-qr.png");
  await page.reload();
  await expect(page.locator(".delegate-card-image")).toHaveAttribute(
    "alt",
    /5491155509999/,
  );
  await page.screenshot({
    path: "evidence/tarjeta-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Editar mis datos" }).click();
  await page.getByLabel("WhatsApp con código de país").fill("");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(
    page.getByRole("button", { name: "Compartir tarjeta por WhatsApp" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("link", { name: "Contactar por WhatsApp" }),
  ).toHaveCount(0);
});
test("compartir entrega un archivo PNG al menú nativo y cancelar no descarga", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: () => true,
    });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (data: ShareData) => {
        (window as Window & { sharedCard?: unknown }).sharedCard = {
          count: data.files?.length,
          type: data.files?.[0]?.type,
          size: data.files?.[0]?.size,
          text: data.text,
        };
      },
    });
  });
  await page.goto("/?view=tarjetas");
  await page
    .getByRole("button", { name: "Compartir tarjeta por WhatsApp" })
    .click();
  const shared = await page.evaluate(
    () =>
      (
        window as Window & {
          sharedCard?: {
            count: number;
            type: string;
            size: number;
            text: string;
          };
        }
      ).sharedCard,
  );
  expect(shared?.count).toBe(1);
  expect(shared?.type).toBe("image/png");
  expect(shared?.size).toBeGreaterThan(10000);
  expect(shared?.text).toContain("Lucía Fernández");
  expect(shared?.text).toContain("https://wa.me/5491155500101");
  await page.evaluate(() =>
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async () => {
        throw new DOMException("Cancelado", "AbortError");
      },
    }),
  );
  let downloads = 0;
  page.on("download", () => downloads++);
  await page
    .getByRole("button", { name: "Compartir tarjeta por WhatsApp" })
    .click();
  await expect(
    page.getByRole("button", { name: "Compartir tarjeta por WhatsApp" }),
  ).toBeEnabled();
  expect(downloads).toBe(0);
  await expect(page.getByRole("alert")).toHaveCount(0);
});
test("sin compartir archivos se descarga la imagen para adjuntar a WhatsApp", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: () => false,
    }),
  );
  await page.goto("/?view=tarjetas");
  const pending = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Compartir tarjeta por WhatsApp" })
    .click();
  expect((await pending).suggestedFilename()).toMatch(/\.png$/);
  await expect(page.getByRole("status")).toContainText("adjuntá la imagen");
  await expect(
    page.getByRole("link", { name: "Abrir WhatsApp para adjuntar la tarjeta" }),
  ).toHaveAttribute("href", /^https:\/\/wa.me\/\?text=/);
});
test("tarjetas por rol y sin desbordes en cinco tamaños", async ({ page }) => {
  for (const width of [360, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/?view=tarjetas");
    await expect(page.locator(".delegate-card-image")).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
    await expect(page.getByLabel("Elegir delegado/a")).toHaveCount(0);
  }
  for (const role of ["secretario", "admin"]) {
    await page
      .getByRole("combobox", { name: "Cambiar perfil de muestra" })
      .selectOption(role);
    await page
      .getByRole("button", { name: "Tarjetas de delegados", exact: true })
      .click();
    await page.getByLabel("Elegir delegado/a").selectOption("d2");
    await expect(page.locator(".delegate-card-image")).toHaveAttribute(
      "alt",
      /Diego Romero/,
    );
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "evidence/tarjeta-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
});
