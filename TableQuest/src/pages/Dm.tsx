import { useState } from "react";
import { Link } from "react-router-dom";
import { Play, Plus, Shield, Copy, Send, Users, Swords } from "lucide-react";
import { useApp, useRows } from "../lib/data";
import {
  Action,
  Button,
  Empty,
  Field,
  Form,
  Heading,
  Modal,
} from "../components/ui";
export default function DmPage() {
  const { user, run, busy, online } = useApp();
  const { data: sessions = [] } = useRows("sessions");
  const { data: encounters = [] } = useRows("encounters");
  const { data: members = [] } = useRows("campaign_members");
  const { data: profiles = [] } = useRows("profiles", false);
  const { data: characters = [] } = useRows("characters");
  const { data: invites = [] } = useRows("campaign_invites");
  const [modal, setModal] = useState("");
  const [token, setToken] = useState("");
  const [copied, setCopied] = useState(false);
  const session = sessions.find((s) => s.status === "active");
  const encounter = encounters.find((e) => e.status !== "completed");
  return (
    <>
      <Heading eyebrow="DIETRO LO SCHERMO" title="Il tavolo è nelle tue mani.">
        <span className="badge">
          <Shield size={15} /> DUNGEON MASTER
        </span>
      </Heading>
      <div className="dashboard-grid">
        <section className="panel">
          <div className="section-heading">
            <h2>La sessione</h2>
            <Play className="gold" size={21} />
          </div>
          {session ? (
            <>
              <span className="badge">
                <i className="live-dot" /> SESSIONE {session.session_number} IN
                CORSO
              </span>
              <h2>{session.title}</h2>
              <p className="muted">
                Iniziata {new Date(session.started_at).toLocaleString("it-IT")}
              </p>
              <div className="button-row">
                {encounter ? (
                  <Link to="/combat" className="button">
                    <Swords size={18} /> {encounter.name}
                  </Link>
                ) : (
                  <Button onClick={() => setModal("encounter")}>
                    <Plus size={18} /> Prepara uno scontro
                  </Button>
                )}
                <Action
                  action="session_end"
                  confirm="Concludere la sessione e l’eventuale scontro? HP, risorse, note e inventario saranno conservati."
                >
                  Concludi sessione
                </Action>
              </div>
            </>
          ) : (
            <Empty title="Un nuovo capitolo">
              <p>Raduna la compagnia e dai inizio alla storia.</p>
              <Button onClick={() => setModal("session")}>
                <Play size={17} /> Avvia sessione
              </Button>
            </Empty>
          )}
        </section>
        <section className="panel">
          <div className="section-heading">
            <h2>Invita la compagnia</h2>
            <Users className="gold" size={21} />
          </div>
          <p className="muted">
            Genera un codice valido per 7 giorni. Condividilo soltanto con i
            tuoi giocatori.
          </p>
          <Button
            disabled={busy || !online}
            onClick={() =>
              void run("invite")
                .then((r) => {
                  setToken(r.token || "");
                  setCopied(false);
                })
                .catch(() => {})
            }
          >
            <Plus size={17} /> Genera invito
          </Button>
          {token && (
            <div className="invite-code">
              <code>{token}</code>
              <Button
                secondary
                onClick={() =>
                  void navigator.clipboard
                    .writeText(token)
                    .then(() => setCopied(true))
                    .catch(() => setCopied(false))
                }
              >
                <Copy size={16} />
                {copied ? "Copiato" : "Copia"}
              </Button>
            </div>
          )}
          <div className="invite-list">
            {invites
              .filter(
                (i) => !i.revoked_at && new Date(i.expires_at) > new Date(),
              )
              .map((i) => (
                <div className="resource" key={i.id}>
                  <span className="small">
                    Scade il{" "}
                    {new Date(i.expires_at).toLocaleDateString("it-IT")}
                  </span>
                  <Action action="revoke_invite" data={{ id: i.id }}>
                    Revoca
                  </Action>
                </div>
              ))}
          </div>
        </section>
        <section className="panel">
          <h2>I tuoi giocatori</h2>
          {members.map((m) => {
            const c = characters.find((c) => c.user_id === m.user_id);
            return (
              <div className="member" key={m.id}>
                <span className="avatar">
                  <Shield size={20} />
                </span>
                <div>
                  <strong>
                    {profiles.find((p) => p.id === m.user_id)?.display_name ||
                      "Avventuriero"}
                  </strong>
                  <small>
                    {c
                      ? `${c.name} · ${c.current_hp}/${c.max_hp} HP · AC ${c.armor_class}`
                      : m.role === "dm"
                        ? "Dungeon Master"
                        : "In attesa del personaggio"}
                  </small>
                </div>
                {m.user_id !== user.id && (
                  <Action
                    action="remove_member"
                    data={{ id: m.user_id }}
                    confirm="Rimuovere questo giocatore? Verranno revocati anche gli inviti attivi. I suoi dati resteranno conservati."
                  >
                    Rimuovi
                  </Action>
                )}
              </div>
            );
          })}
        </section>
        <section className="panel">
          <span className="eyebrow">GLI STRUMENTI DEL NARRATORE</span>
          <div className="quick-links">
            <Link to="/messages">
              <span className="quick-icon">
                <Send size={22} />
              </span>
              <span>
                <strong>Sussurra un segreto</strong>
                <small>Messaggi privati ai tuoi giocatori</small>
              </span>
            </Link>
            <Link to="/campaign?kind=announcement">
              <span className="quick-icon">
                <Users size={22} />
              </span>
              <span>
                <strong>Parla alla compagnia</strong>
                <small>Annunci condivisi e persistenti</small>
              </span>
            </Link>
            <Link to="/campaign?kind=npc">
              <span className="quick-icon">
                <Shield size={22} />
              </span>
              <span>
                <strong>Prepara il prossimo incontro</strong>
                <small>NPC, luoghi e informazioni da rivelare</small>
              </span>
            </Link>
          </div>
        </section>
      </div>
      {modal && (
        <Modal
          title={
            modal === "session" ? "Una nuova sessione" : "Prepara uno scontro"
          }
          onClose={() => setModal("")}
        >
          <Form
            submit={modal === "session" ? "Avvia sessione" : "Crea scontro"}
            onSave={async (d) => {
              await run(
                modal === "session" ? "session_start" : "encounter_create",
                d,
              );
              setModal("");
            }}
          >
            <Field
              label="Titolo"
              name={modal === "session" ? "title" : "name"}
              placeholder={
                modal === "session" ? "Il tempio dimenticato" : "Tra le rovine"
              }
              required
            />
          </Form>
        </Modal>
      )}
    </>
  );
}
