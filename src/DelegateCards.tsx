import { useEffect, useState } from "react";
import { Download, MessageCircle, Share2 } from "lucide-react";
import type { Profile } from "./types";
import { delegateShareText, whatsappNumber } from "./delegate-card-domain";
import { renderDelegateCard, type CardImage } from "./delegate-card-image";
import "./delegate-card.css";
export default function DelegateCards({
  actor,
  profiles,
  organization,
  sample,
  onEdit,
}: {
  actor: Profile;
  profiles: Profile[];
  organization: string;
  sample: boolean;
  onEdit: () => void;
}) {
  const delegates = profiles.filter((p) => p.active && p.role === "delegado");
  const [selected, setSelected] = useState(
    actor.role === "delegado" ? actor.id : delegates[0]?.id || "",
  );
  const person =
    actor.role === "delegado"
      ? actor
      : delegates.find((p) => p.id === selected) || delegates[0];
  return (
    <section className="delegate-cards">
      <p className="muted">
        Una tarjeta en imagen, con tus datos y un QR para contactarte por
        WhatsApp.
      </p>
      {actor.role !== "delegado" && (
        <label className="delegate-picker">
          Elegir delegado/a
          <select
            value={person?.id || ""}
            onChange={(e) => setSelected(e.target.value)}
          >
            {delegates.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.building || "Sin asignar"}
              </option>
            ))}
          </select>
        </label>
      )}
      {person ? (
        <Card
          key={JSON.stringify([person, organization, sample])}
          person={person}
          organization={organization}
          sample={sample}
          onEdit={person.id === actor.id ? onEdit : undefined}
        />
      ) : (
        <section className="surface">
          <h2>No hay delegados activos para mostrar.</h2>
        </section>
      )}
    </section>
  );
}
function Card({
  person,
  organization,
  sample,
  onEdit,
}: {
  person: Profile;
  organization: string;
  sample: boolean;
  onEdit?: () => void;
}) {
  const [image, setImage] = useState<CardImage | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [fallback, setFallback] = useState(false),
    [sharing, setSharing] = useState(false);
  const number = whatsappNumber(person.whatsapp || ""),
    text = delegateShareText(person, organization, sample);
  useEffect(() => {
    let cancelled = false,
      url = "";
    if (number)
      void renderDelegateCard(person, organization, sample)
        .then((result) => {
          url = result.url;
          if (cancelled) URL.revokeObjectURL(url);
          else setImage(result);
        })
        .catch((e) => {
          if (!cancelled)
            setError(
              e instanceof Error ? e.message : "No se pudo generar la tarjeta.",
            );
        });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [person, organization, sample, number]);
  function download() {
    if (!image) return;
    const a = document.createElement("a");
    a.href = image.url;
    a.download = image.file.name;
    a.click();
  }
  async function share() {
    if (!image) return;
    setError("");
    setNotice("");
    try {
      if (navigator.share && navigator.canShare?.({ files: [image.file] })) {
        setSharing(true);
        await navigator.share({
          files: [image.file],
          title: `Tarjeta de ${person.name}`,
          text,
        });
        setNotice("Tarjeta entregada al menú de compartir.");
      } else {
        download();
        setFallback(true);
        setNotice(
          "Tarjeta PNG descargada. Abrí WhatsApp y adjuntá la imagen en el chat que elijas.",
        );
      }
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      setFallback(true);
      setError(
        "El navegador no pudo compartir la imagen. Podés descargarla y adjuntarla en WhatsApp.",
      );
    } finally {
      setSharing(false);
    }
  }
  return (
    <div className="delegate-card-layout">
      <div className="delegate-image-preview">
        {number ? (
          image ? (
            <img
              className="delegate-card-image"
              src={image.url}
              alt={`Tarjeta de ${person.name}. Edificio ${person.building || "Sin asignar"}. Horario ${person.start_time.slice(0, 5)} a ${person.end_time.slice(0, 5)} h. WhatsApp +${number}. QR de contacto.`}
            />
          ) : (
            <div className="surface" role="status">
              Preparando tarjeta y código QR…
            </div>
          )
        ) : (
          <article className="delegate-contact-card">
            <div className="delegate-card-brand">
              <img src="/logo-uoyep.webp" alt="UOYEP" />
              <strong>{organization}</strong>
            </div>
            <div className="delegate-card-role">DELEGADO/A GREMIAL</div>
            <h2>{person.name}</h2>
            <p>{person.building || "Edificio sin asignar"}</p>
            <p>
              {person.start_time.slice(0, 5)} a {person.end_time.slice(0, 5)} h
            </p>
            <p className="card-missing">
              Falta WhatsApp con código de país para generar el QR y la imagen
              compartible.
            </p>
          </article>
        )}
      </div>
      <section className="delegate-share-panel">
        <span className="eyebrow">UNA TARJETA PARA ESTAR MÁS CERCA</span>
        <h2>Tus datos. Tu contacto. Tu QR.</h2>
        <p className="muted">
          Se comparte la tarjeta como imagen PNG con nombre, edificio, horario,
          WhatsApp y un código QR que abre el chat de contacto.
        </p>
        <button
          className="whatsapp-share"
          onClick={() => void share()}
          disabled={!image || sharing}
        >
          <Share2 size={18} />
          Compartir tarjeta por WhatsApp
        </button>
        <p className="delegate-share-explainer">
          En celulares compatibles, se abre el menú de compartir: elegí
          WhatsApp. Si el navegador no permite compartir archivos, descargamos
          la tarjeta para que la adjuntes.
        </p>
        <button className="secondary" onClick={download} disabled={!image}>
          <Download size={18} />
          Descargar tarjeta PNG
        </button>
        {number && (
          <a
            className="button secondary"
            href={`https://wa.me/${number}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <MessageCircle size={18} />
            Contactar por WhatsApp
          </a>
        )}
        {fallback && (
          <a
            className="button"
            href={"https://wa.me/?text=" + encodeURIComponent(text)}
            target="_blank"
            rel="noopener noreferrer"
          >
            Abrir WhatsApp para adjuntar la tarjeta
          </a>
        )}
        {onEdit && (
          <button className="text-button" onClick={onEdit}>
            Editar mis datos
          </button>
        )}
        {!number && (
          <p className="card-missing">
            Completá WhatsApp con código de país. Para un celular argentino: +54
            9, código de área y número, sin 0 ni 15.
          </p>
        )}
        {error && (
          <p className="measure-error" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="measure-notice" role="status">
            {notice}
          </p>
        )}
        <p className="delegate-share-note">
          La imagen se genera en este dispositivo. No publica el perfil privado.{" "}
          {sample
            ? "Datos ficticios: el número de muestra no es un canal oficial."
            : "La imagen conserva los datos del momento de descarga; regenerala si cambian."}
        </p>
      </section>
    </div>
  );
}
