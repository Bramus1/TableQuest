import Monsters from "./Monsters";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { BookOpen, EyeOff, MapPin, PenLine, Plus, Trash2 } from "lucide-react";
import { useApp, useRows } from "../lib/data";
import {
  Action,
  Area,
  Button,
  Empty,
  Field,
  Form,
  Heading,
  Loading,
  Modal,
  Select,
} from "../components/ui";
import { it } from "../lib/i18n";
import type { RecordKind, RecordRow } from "../types";
export default function CampaignPage() {
  const { user, campaignId, run } = useApp();
  const { data: campaigns = [] } = useRows("campaigns", false);
  const q = useRows("records");
  const { data: sessions = [] } = useRows("sessions");
  const [params, setParams] = useSearchParams();
  const requested = params.get("kind");
  const kind: RecordKind =
    requested && requested in it.kind ? (requested as RecordKind) : "journal";
  const [edit, setEdit] = useState<RecordRow | null | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [summary, setSummary] = useState("");
  const dm = campaigns.find((c) => c.id === campaignId)?.owner_id === user.id;
  const rows = (q.data || [])
    .filter(
      (r) =>
        r.kind === kind &&
        `${r.title} ${r.content}`.toLowerCase().includes(search.toLowerCase()),
    )
    .sort(
      (a, b) =>
        (!["npc", "location", "note"].includes(kind)
          ? a.status.localeCompare(b.status)
          : 0) || b.created_at.localeCompare(a.created_at),
    );
  if (!campaignId) return <Empty title="Scegli prima una campagna" />;
  return (
    <>
      <Heading
        eyebrow="OGNI DETTAGLIO È UN PEZZO DI STORIA"
        title="Il diario della compagnia"
      >
        {requested !== "monsters" &&
          (dm || kind === "journal" || kind === "note") && (
            <Button onClick={() => setEdit(null)}>
              <Plus size={18} /> Aggiungi
            </Button>
          )}
      </Heading>
      <div className="tabs wrap">
        {(Object.keys(it.kind) as RecordKind[]).map((k) => (
          <button
            key={k}
            onClick={() => setParams({ kind: k })}
            className={requested !== "monsters" && kind === k ? "selected" : ""}
          >
            {it.kind[k]}
          </button>
        ))}
        {dm && (
          <button
            className={requested === "monsters" ? "selected" : ""}
            onClick={() => setParams({ kind: "monsters" })}
          >
            Aggiungi Mostri
          </button>
        )}
      </div>
      {requested === "monsters" ? (
        dm ? (
          <Monsters />
        ) : (
          <Empty title="Solo il Dungeon Master" />
        )
      ) : (
        <>
          <label className="search">
            <span className="sr-only">Cerca nel diario</span>
            <input
              placeholder="Cerca una storia, un nome, un dettaglio…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          {q.isLoading ? (
            <Loading />
          ) : q.error ? (
            <p role="alert" className="error">
              {q.error.message}
            </p>
          ) : rows.length ? (
            <div className="record-grid">
              {rows.map((r) => (
                <article className="panel record" key={r.id}>
                  <div className="section-heading">
                    <span className="badge">
                      {kind === "quest"
                        ? it.status[r.status]
                        : new Date(r.created_at).toLocaleDateString("it-IT")}
                    </span>
                    {r.visibility !== "shared" && (
                      <span className="muted small">
                        <EyeOff size={14} /> {it.visibility[r.visibility]}
                      </span>
                    )}
                  </div>
                  <h2>{r.title}</h2>
                  {r.location && (
                    <p className="gold small">
                      <MapPin size={14} /> {r.location}
                    </p>
                  )}
                  <p className="preserve">{r.content}</p>
                  {(r.author_id === user.id ||
                    (dm && r.visibility !== "personal")) && (
                    <div className="button-row">
                      <Button secondary onClick={() => setEdit(r)}>
                        <PenLine size={15} /> Modifica
                      </Button>
                      <Action
                        action="record_delete"
                        data={{ id: r.id }}
                        confirm="Eliminare questa voce dal diario?"
                      >
                        <Trash2 size={15} />
                        <span className="sr-only">Elimina voce</span>
                      </Action>
                    </div>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <section className="panel">
              <Empty
                title={
                  search ? "Nessuna corrispondenza" : "Una pagina da scrivere"
                }
              >
                {kind === "note"
                  ? "Le note personali sono visibili solo a te."
                  : "Le informazioni rivelate alla compagnia appariranno qui."}
              </Empty>
            </section>
          )}
          {kind === "journal" && sessions.length > 0 && (
            <section className="panel">
              <div className="section-heading">
                <h2>Le vostre sessioni</h2>
                <BookOpen size={21} />
              </div>
              {[...sessions]
                .sort((a, b) => b.session_number - a.session_number)
                .map((s) => (
                  <article className="session-record" key={s.id}>
                    <div className="section-heading">
                      <h3>
                        #{s.session_number} · {s.title}
                      </h3>
                      <span className="badge">
                        {s.status === "active" ? "IN CORSO" : "CONCLUSA"}
                      </span>
                    </div>
                    <small className="muted">
                      {new Date(s.started_at).toLocaleDateString("it-IT")}
                    </small>
                    <p className="preserve">
                      {s.summary || "Nessun riepilogo ufficiale."}
                    </p>
                    {dm && (
                      <Button secondary onClick={() => setSummary(s.id)}>
                        Modifica riepilogo ufficiale
                      </Button>
                    )}
                  </article>
                ))}
            </section>
          )}
          {summary && (
            <Modal title="Riepilogo ufficiale" onClose={() => setSummary("")}>
              <Form
                onSave={async (d) => {
                  await run("session_summary", { id: summary, ...d });
                  setSummary("");
                }}
              >
                <Area
                  label="Riepilogo, scoperte e note"
                  name="summary"
                  value={sessions.find((s) => s.id === summary)?.summary}
                />
              </Form>
            </Modal>
          )}
        </>
      )}
      {edit !== undefined && (
        <Modal
          title={edit ? "Modifica voce" : `Nuova voce · ${it.kind[kind]}`}
          onClose={() => setEdit(undefined)}
        >
          <Form
            onSave={async (d) => {
              await run("record_save", {
                ...d,
                id: edit?.id,
                version: edit?.version,
                kind,
              });
              setEdit(undefined);
            }}
          >
            <Field label="Titolo" name="title" value={edit?.title} required />
            <Area
              label="Storia, descrizione e note"
              name="content"
              value={edit?.content}
            />
            <Field
              label="Luogo / riferimenti a NPC e missioni"
              name="location"
              value={edit?.location}
            />
            <Select
              label="Visibilità"
              name="visibility"
              value={
                edit?.visibility || (kind === "note" ? "personal" : "shared")
              }
            >
              <option value="shared">Condiviso con la compagnia</option>
              <option value="personal">Personale · solo tu</option>
              {dm && <option value="dm">Nascosto · solo DM</option>}
            </Select>
            {!["npc", "location", "note"].includes(kind) && (
              <Select
                label="Stato"
                name="status"
                value={edit?.status || "active"}
              >
                {Object.entries(it.status).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            )}
          </Form>
        </Modal>
      )}
    </>
  );
}
