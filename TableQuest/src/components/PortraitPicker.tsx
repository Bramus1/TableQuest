import { useState } from "react";
export function PortraitPicker({
  value = "",
  onBusy,
}: {
  value?: string;
  onBusy: (busy: boolean) => void;
}) {
  const [photo, setPhoto] = useState(value);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="field">
      <input type="hidden" name="portrait_url" value={photo} />
      <label>
        Foto del personaggio
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={busy}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setError("");
            setBusy(true);
            onBusy(true);
            try {
              if (
                !["image/jpeg", "image/png", "image/webp"].includes(
                  file.type,
                ) ||
                file.size > 10 * 1024 * 1024
              )
                throw new Error(
                  "Scegli una foto JPG, PNG o WebP fino a 10 MB.",
                );
              const bitmap = await createImageBitmap(file);
              const canvas = document.createElement("canvas");
              const size = 384;
              canvas.width = size;
              canvas.height = size;
              const ctx = canvas.getContext("2d");
              if (!ctx) throw new Error("Impossibile elaborare la foto.");
              const crop = Math.min(bitmap.width, bitmap.height);
              ctx.fillStyle = "#172019";
              ctx.fillRect(0, 0, size, size);
              ctx.drawImage(
                bitmap,
                (bitmap.width - crop) / 2,
                (bitmap.height - crop) / 2,
                crop,
                crop,
                0,
                0,
                size,
                size,
              );
              bitmap.close();
              const result = canvas.toDataURL("image/jpeg", 0.8);
              if (result.length > 180000)
                throw new Error(
                  "Foto troppo complessa. Scegli un’immagine più piccola.",
                );
              setPhoto(result);
            } catch (err) {
              setError((err as Error).message);
            } finally {
              setBusy(false);
              onBusy(false);
              e.target.value = "";
            }
          }}
        />
      </label>
      {photo && (
        <>
          <img
            className="portrait"
            src={photo}
            alt="Anteprima foto del personaggio"
            referrerPolicy="no-referrer"
          />
          <button
            type="button"
            className="button secondary"
            onClick={() => setPhoto("")}
          >
            Rimuovi foto
          </button>
        </>
      )}
      <small className="muted">
        Ritaglio quadrato. La foto viene salvata insieme al profilo.
      </small>
      {busy && <p role="status">Preparazione foto…</p>}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
