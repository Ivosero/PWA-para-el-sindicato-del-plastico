import QRCode from "qrcode";
import type { Profile } from "./types";
import { whatsappNumber } from "./delegate-card-domain";
export type CardImage = { url: string; file: File; contactUrl: string };
function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error("No se pudo cargar el logo."));
    im.src = src;
  });
}
function lines(ctx: CanvasRenderingContext2D, text: string, max: number) {
  const out: string[] = [];
  let line = "";
  for (const word of text.trim().split(/\s+/)) {
    if (ctx.measureText(word).width > max) {
      if (line) {
        out.push(line);
        line = "";
      }
      for (const c of Array.from(word)) {
        if (ctx.measureText(line + c).width > max) {
          out.push(line);
          line = "";
        }
        line += c;
      }
      continue;
    }
    if (line && ctx.measureText(line + " " + word).width > max) {
      out.push(line);
      line = word;
    } else line += (line ? " " : "") + word;
  }
  if (line) out.push(line);
  return out.length ? out : ["Sin informar"];
}
export async function renderDelegateCard(
  person: Profile,
  organization: string,
  sample: boolean,
): Promise<CardImage> {
  const number = whatsappNumber(person.whatsapp || "");
  if (!number)
    throw new Error(
      "Completá un WhatsApp válido con código de país para generar el QR.",
    );
  await document.fonts.ready;
  const logo = await loadImage("/logo-uoyep.webp");
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  let ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Este navegador no permite generar la tarjeta.");
  const font = (size: number, weight = 500) =>
    `${weight} ${size}px "DM Sans Variable", sans-serif`;
  ctx.font = font(68, 750);
  const nameLines = lines(ctx, person.name, 920);
  ctx.font = font(38, 550);
  const buildingLines = lines(ctx, person.building || "Sin asignar", 920);
  const nameY = 330,
    nameBottom = nameY + (nameLines.length - 1) * 82,
    buildingY = nameBottom + 125,
    buildingBottom = buildingY + buildingLines.length * 51,
    horarioY = buildingBottom + 48,
    whatsappY = horarioY + 130,
    qrY = whatsappY + 128;
  canvas.height = Math.max(1450, qrY + 390);
  ctx = canvas.getContext("2d")!;
  const gradient = ctx.createLinearGradient(0, 0, 1080, canvas.height);
  gradient.addColorStop(0, "#1c5dce");
  gradient.addColorStop(0.52, "#4b489b");
  gradient.addColorStop(1, "#146b65");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1080, canvas.height);
  ctx.strokeStyle = "#c6dcff30";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(1150, 650, 460, 700, -0.4, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(1120, 800, 370, 720, -0.4, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.roundRect(76, 65, 110, 120, 17);
  ctx.fill();
  ctx.drawImage(logo, 88, 77, 86, 96);
  ctx.fillStyle = "#fff";
  ctx.font = font(54, 800);
  ctx.fillText(organization, 218, 120, 780);
  ctx.fillStyle = "#d0e3ff";
  ctx.font = font(18, 650);
  ctx.fillText("REPRESENTACIÓN GREMIAL", 220, 158);
  ctx.fillStyle = "#b5f2d2";
  ctx.font = font(24, 750);
  ctx.fillText("DELEGADO/A GREMIAL", 78, 245);
  ctx.fillStyle = "#fff";
  ctx.font = font(68, 750);
  nameLines.forEach((s, i) => ctx!.fillText(s, 76, nameY + i * 82));
  const label = (text: string, y: number) => {
    ctx!.fillStyle = "#c1d8f8";
    ctx!.font = font(23, 650);
    ctx!.fillText(text, 78, y);
  };
  label("EDIFICIO", buildingY - 43);
  ctx.fillStyle = "#fff";
  ctx.font = font(38, 550);
  buildingLines.forEach((s, i) => ctx!.fillText(s, 76, buildingY + i * 51));
  label("HORARIO", horarioY);
  ctx.fillStyle = "#fff";
  ctx.font = font(40, 600);
  ctx.fillText(
    `${person.start_time.slice(0, 5)} a ${person.end_time.slice(0, 5)} h`,
    76,
    horarioY + 55,
  );
  label("WHATSAPP DE CONTACTO", whatsappY);
  ctx.fillStyle = "#fff";
  ctx.font = font(42, 650);
  ctx.fillText("+" + number, 76, whatsappY + 60);
  const contactUrl = `https://wa.me/${number}`,
    qr = document.createElement("canvas");
  await QRCode.toCanvas(qr, contactUrl, {
    width: 280,
    margin: 4,
    errorCorrectionLevel: "M",
    color: { dark: "#102347", light: "#ffffff" },
  });
  ctx.drawImage(qr, 76, qrY, 280, 280);
  ctx.fillStyle = "#c9ffe5";
  ctx.font = font(30, 750);
  ctx.fillText("ESCANEÁ Y CONTACTAME", 400, qrY + 80);
  ctx.fillStyle = "#e0f3f2";
  ctx.font = font(26, 450);
  ctx.fillText("El QR abre mi WhatsApp.", 400, qrY + 125);
  ctx.fillText("Tu representación, más cerca.", 400, qrY + 168);
  ctx.strokeStyle = "#d5efff50";
  ctx.beginPath();
  ctx.moveTo(76, canvas.height - 91);
  ctx.lineTo(1004, canvas.height - 91);
  ctx.stroke();
  ctx.fillStyle = "#c5ebdf";
  ctx.font = font(19, 650);
  ctx.fillText(
    sample
      ? "MUESTRA · DATOS FICTICIOS · SIN VALIDEZ INSTITUCIONAL"
      : "CERCA DE TUS COMPAÑEROS",
    76,
    canvas.height - 46,
  );
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) =>
        b ? resolve(b) : reject(new Error("No se pudo generar la imagen.")),
      "image/png",
    ),
  );
  const safe =
    person.name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase() || "delegado";
  return {
    url: URL.createObjectURL(blob),
    file: new File([blob], `tarjeta-${safe}.png`, { type: "image/png" }),
    contactUrl,
  };
}
