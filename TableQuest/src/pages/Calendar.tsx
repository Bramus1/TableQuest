import { useState } from "react";
import { useApp, useRows } from "../lib/data";
import {
  Action,
  Button,
  Empty,
  Field,
  Form,
  Heading,
  Loading,
  Select,
} from "../components/ui";
const labels = { yes: "Disponibile", maybe: "Forse", no: "Non disponibile" };
const dateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export default function CalendarPage() {
  const { user, campaignId, run } = useApp();
  const q = useRows("availability");
  const members = useRows("campaign_members");
  const profiles = useRows("profiles", false);
  const [month, setMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const [day, setDay] = useState(() => dateKey(new Date()));
  if (!campaignId) return <Empty title="Scegli prima una campagna" />;
  if (q.isLoading || members.isLoading || profiles.isLoading)
    return <Loading />;
  if (q.error || members.error || profiles.error)
    return (
      <p role="alert">
        Impossibile caricare il calendario. Riprova quando la connessione è
        disponibile.
      </p>
    );
  const rows = q.data || [];
  const mine = rows.find((r) => r.day === day && r.user_id === user.id);
  const total = members.data?.length || 0;
  const offset = (month.getDay() + 6) % 7;
  const count = new Date(
    month.getFullYear(),
    month.getMonth() + 1,
    0,
  ).getDate();
  function move(delta: number) {
    const d = new Date(month.getFullYear(), month.getMonth() + delta, 1);
    setMonth(d);
    setDay(dateKey(d));
  }
  return (
    <>
      <Heading
        eyebrow="TROVIAMO IL PROSSIMO APPUNTAMENTO"
        title="Calendario della compagnia"
      />
      <p className="muted">
        Scegli un giorno e indica quando puoi giocare. Orari della campagna:
        Italia (Europe/Rome). Nessuna risposta significa disponibilità non
        ancora indicata.
      </p>
      <section className="panel">
        <div className="section-heading">
          <Button secondary onClick={() => move(-1)}>
            ← Mese precedente
          </Button>
          <h2>
            {month.toLocaleDateString("it-IT", {
              month: "long",
              year: "numeric",
            })}
          </h2>
          <Button secondary onClick={() => move(1)}>
            Mese successivo →
          </Button>
        </div>
        <div className="availability-grid">
          {["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"].map((s) => (
            <span className="muted small" key={s}>
              {s}
            </span>
          ))}
          {Array.from({ length: offset }, (_, i) => (
            <span key={`blank-${i}`} />
          ))}
          {Array.from({ length: count }, (_, i) => {
            const key = dateKey(
              new Date(month.getFullYear(), month.getMonth(), i + 1),
            );
            const yes = rows.filter(
              (r) => r.day === key && r.status === "yes",
            ).length;
            const responses = rows.filter((r) => r.day === key).length;
            return (
              <button
                key={key}
                className={`availability-day ${responses ? "has-availability" : ""} ${day === key ? "selected" : ""}`}
                aria-pressed={day === key}
                aria-label={`${key}, ${yes} disponibili su ${total}, ${responses} risposte`}
                onClick={() => setDay(key)}
              >
                <strong>{i + 1}</strong>
                <small>{responses ? `${yes}/${total} ·` : "–"}</small>
              </button>
            );
          })}
        </div>
        <p className="muted small">
          I giorni evidenziati hanno almeno una risposta. Il conteggio indica i
          membri disponibili; confronta gli orari qui sotto prima di scegliere
          la sessione.
        </p>
      </section>
      <div className="record-grid">
        {rows.some((r) => r.day === day) && (
          <section className="panel">
            <h2>
              {new Date(`${day}T12:00:00`).toLocaleDateString("it-IT", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </h2>
            {(members.data || []).map((m) => {
              const r = rows.find(
                (a) => a.day === day && a.user_id === m.user_id,
              );
              return (
                <article className="session-record" key={m.id}>
                  <h3>
                    {profiles.data?.find((p) => p.id === m.user_id)
                      ?.display_name || "Membro"}
                    {m.user_id === user.id ? " · tu" : ""}
                  </h3>
                  <p>
                    {r ? labels[r.status] : "Non ha ancora risposto"}
                    {r && r.status !== "no"
                      ? ` · ${r.starts_at.slice(0, 5)}–${r.ends_at.slice(0, 5)}`
                      : ""}
                  </p>
                  {r?.note && <p className="preserve muted">{r.note}</p>}
                </article>
              );
            })}
          </section>
        )}
        <section className="panel">
          <h2>La tua disponibilità</h2>
          <Form
            key={`${campaignId}:${day}:${mine?.status}:${mine?.starts_at}:${mine?.ends_at}:${mine?.note}`}
            onSave={async (d) => {
              if (String(d.ends_at) <= String(d.starts_at))
                throw new Error(
                  "L’orario finale deve essere successivo a quello iniziale, nello stesso giorno.",
                );
              if (String(d.note).length > 300)
                throw new Error(
                  "La nota può contenere al massimo 300 caratteri.",
                );
              await run("availability_save", { ...d, day });
            }}
          >
            <Select
              label="Ci sarai?"
              name="status"
              value={mine?.status || "yes"}
            >
              {Object.entries(labels).map(([k, v]) => (
                <option value={k} key={k}>
                  {v}
                </option>
              ))}
            </Select>
            <Field
              label="Dalle (ora italiana)"
              name="starts_at"
              type="time"
              value={mine?.starts_at.slice(0, 5) || "19:00"}
              required
            />
            <Field
              label="Alle (stesso giorno)"
              name="ends_at"
              type="time"
              value={mine?.ends_at.slice(0, 5) || "23:00"}
              required
            />
            <Field
              label="Nota per il gruppo (max 300 caratteri)"
              name="note"
              value={mine?.note || ""}
            />
          </Form>
          {mine && (
            <Action
              action="availability_delete"
              data={{ day }}
              confirm="Rimuovere la tua risposta per questo giorno?"
            >
              Rimuovi la mia risposta
            </Action>
          )}
        </section>
      </div>
    </>
  );
}
