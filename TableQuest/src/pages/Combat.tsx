import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Plus,
  Swords,
  Shield,
  EyeOff,
  Trash2,
} from "lucide-react";
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
import { ordered } from "../lib/rules";
import type { Combatant } from "../types";
export default function CombatPage() {
  const { user, campaignId, run } = useApp();
  const { data: campaigns = [] } = useRows("campaigns", false);
  const eq = useRows("encounters");
  const { data: combatants = [] } = useRows("combatants");
  const { data: characters = [] } = useRows("characters");
  const { data: secrets = [] } = useRows("combatant_secrets");
  const { data: monsters = [] } = useRows("monsters");
  const { data: resources = [] } = useRows("character_resources");
  const [modal, setModal] = useState("");
  const [selected, setSelected] = useState<Combatant | null>(null);
  const [vibrate, setVibrate] = useState(false);
  const lastTurn = useRef("");
  const dm = campaigns.find((c) => c.id === campaignId)?.owner_id === user.id;
  const encounter = eq.data?.find((e) => e.status !== "completed");
  const ch = characters.find((c) => c.user_id === user.id);
  const rows = ordered(
    combatants.filter((b) => b.encounter_id === encounter?.id),
    encounter?.status === "preparing",
  );
  const active =
    encounter?.status === "active" ? rows[encounter.current_turn] : undefined;
  const mine = !!ch && active?.character_id === ch.id;
  const secret = secrets.find((s) => s.id === selected?.id);
  useEffect(() => {
    if (active?.id && lastTurn.current !== active.id) {
      if (mine && vibrate) navigator.vibrate?.([150, 100, 150]);
      lastTurn.current = active.id;
    }
  }, [active?.id, mine, vibrate]);
  if (!campaignId) return <Empty title="Scegli prima una campagna" />;
  if (eq.isLoading) return <Loading />;
  if (eq.error)
    return (
      <p className="error" role="alert">
        {eq.error.message}
      </p>
    );
  if (!encounter)
    return (
      <>
        <Heading title="Un respiro prima della battaglia." />
        <section className="panel">
          <Empty title="Nessuno scontro in corso">
            {dm ? (
              <>
                <p>Avvia una sessione, poi prepara l’iniziativa.</p>
                <Link className="button" to="/dm">
                  Apri lo schermo del DM
                </Link>
              </>
            ) : (
              <p>
                Quando il DM avvia uno scontro, l’ordine di iniziativa apparirà
                qui.
              </p>
            )}
          </Empty>
        </section>
      </>
    );
  return (
    <>
      <Heading
        eyebrow={
          encounter.status === "preparing"
            ? "PREPARAZIONE · TIRATE I VOSTRI DADI"
            : "AL TAVOLO · COMBATTIMENTO"
        }
        title={encounter.name}
      >
        {dm && (
          <Button onClick={() => setModal("add")}>
            <Plus size={18} /> Partecipante
          </Button>
        )}
      </Heading>
      {encounter.status === "active" ? (
        <section className={`turn-banner ${mine ? "your-turn" : ""}`}>
          <span className="round">
            ROUND<strong>{encounter.current_round}</strong>
          </span>
          <div>
            <span className="eyebrow">
              {mine ? "È IL TUO TURNO" : "TOCCA A"}
            </span>
            <h2>{active?.name || "—"}</h2>
            <p>Guarda il tavolo. L’avventura è lì.</p>
          </div>
          {dm && (
            <div className="button-row">
              <Action
                action="turn"
                data={{
                  id: encounter.id,
                  version: encounter.version,
                  direction: -1,
                }}
                disabled={
                  encounter.current_round === 1 && encounter.current_turn === 0
                }
              >
                <ArrowLeft size={18} />
                <span className="sr-only">Turno precedente</span>
              </Action>
              <Action
                action="turn"
                secondary={false}
                data={{
                  id: encounter.id,
                  version: encounter.version,
                  direction: 1,
                }}
              >
                Prossimo turno <ArrowRight size={18} />
              </Action>
            </div>
          )}
        </section>
      ) : (
        <div className="reminder">
          <Swords size={20} /> Inserite il risultato del dado fisico. I valori
          più alti agiscono prima; il DM decide le parità.
        </div>
      )}
      <div className="combat-grid">
        <section className="panel">
          <div className="section-heading">
            <h2>Ordine di iniziativa</h2>
            <span className="badge">{rows.length} PARTECIPANTI</span>
          </div>
          {rows.length ? (
            <ol className="initiative-list">
              {rows.map((b, i) => (
                <li key={b.id} className={active?.id === b.id ? "active" : ""}>
                  <span className="initiative-number">{b.initiative}</span>
                  <span className="combatant-icon">
                    {b.character_id ? (
                      <Shield size={22} />
                    ) : (
                      <Swords size={22} />
                    )}
                  </span>
                  <div className="combatant-name">
                    <strong>{b.name}</strong>
                    <small>
                      {b.public_hp ||
                        (b.character_id
                          ? "Personaggio"
                          : "Statistiche riservate al DM")}
                      {b.public_conditions ? ` · ${b.public_conditions}` : ""}
                    </small>
                    {active?.id === b.id && (
                      <span className="turn-label">
                        {mine ? "IL TUO TURNO" : "TURNO ATTUALE"}
                      </span>
                    )}
                  </div>
                  <div className="combatant-actions">
                    {encounter.status === "preparing" &&
                      (dm || b.character_id === ch?.id) && (
                        <button
                          className="text-button"
                          onClick={() => {
                            setSelected(b);
                            setModal("initiative");
                          }}
                        >
                          Iniziativa
                        </button>
                      )}
                    {dm && encounter.status === "preparing" && (
                      <button
                        className="icon-button"
                        aria-label={`Ordine per ${b.name}`}
                        onClick={() => {
                          setSelected(b);
                          setModal("order");
                        }}
                      >
                        ↕
                      </button>
                    )}
                    {dm && !b.character_id && (
                      <button
                        className="icon-button"
                        aria-label={`Statistiche private ${b.name}`}
                        onClick={() => {
                          setSelected(b);
                          setModal("secret");
                        }}
                      >
                        <EyeOff size={17} />
                      </button>
                    )}
                    {dm && (
                      <Action
                        action="combatant_remove"
                        data={{ id: b.id }}
                        confirm={`Rimuovere ${b.name} dallo scontro?`}
                      >
                        <Trash2 size={15} />
                        <span className="sr-only">Rimuovi</span>
                      </Action>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <Empty title="Il campo è pronto">
              Aggiungi i personaggi e gli avversari.
            </Empty>
          )}
          {dm && (
            <div className="button-row">
              {encounter.status === "preparing" && (
                <Action
                  action="encounter_start"
                  secondary={false}
                  disabled={!rows.length}
                  data={{ id: encounter.id, version: encounter.version }}
                >
                  Inizia combattimento <Swords size={17} />
                </Action>
              )}
              <Action
                action="encounter_end"
                data={{ id: encounter.id }}
                confirm="Terminare questo scontro? Lo stato dei personaggi resta invariato."
              >
                Termina scontro
              </Action>
            </div>
          )}
        </section>
        <aside className="panel">
          <span className="eyebrow">IL TUO ANGOLO DI TAVOLO</span>
          {ch ? (
            <>
              <h2>{ch.name}</h2>
              <div className="hp-big compact">
                <strong>{ch.current_hp}</strong>
                <span>/ {ch.max_hp} HP</span>
              </div>
              <p className="muted">
                {ch.temporary_hp} HP temporanei · AC {ch.armor_class}
              </p>
              <div className="condition-row">
                {ch.conditions.map((c) => (
                  <div className="reminder" key={c.name}>
                    <b>{c.name}</b> {c.duration} {c.notes}
                  </div>
                ))}
              </div>
              {ch.concentration && (
                <p className="reminder">
                  Concentrazione: {ch.concentration}. Ricorda l’eventuale tiro
                  dopo i danni.
                </p>
              )}
              {resources
                .filter((r) => r.character_id === ch.id)
                .map((r) => (
                  <p className="resource" key={r.id}>
                    <span>{r.name}</span>
                    <b>
                      {r.remaining_uses} / {r.maximum_uses}
                    </b>
                  </p>
                ))}
              <Link to="/character" className="button secondary">
                Gestisci HP e risorse
              </Link>
            </>
          ) : (
            <p className="muted">
              I dadi e la scheda cartacea restano al centro del gioco.
            </p>
          )}
          <label className="check">
            <input
              type="checkbox"
              checked={vibrate}
              onChange={(e) => setVibrate(e.target.checked)}
            />{" "}
            Vibra al mio turno, se supportato
          </label>
          <p className="muted small">
            A inizio e fine turno verifica le durate degli effetti. Nessuna
            condizione viene rimossa automaticamente.
          </p>
        </aside>
      </div>
      {modal && (
        <Modal
          title={
            {
              add: "Aggiungi partecipante",
              initiative: "Risultato di Initiative",
              order: "Risolvi parità",
              secret: "Dietro lo schermo del DM",
            }[modal] || ""
          }
          onClose={() => setModal("")}
        >
          {modal === "add" ? (
            <>
              <Form
                submit="Aggiungi personaggio"
                onSave={async (d) => {
                  if (!d.character_id) throw new Error("Scegli un personaggio");
                  await run("combatant_add", { id: encounter.id, ...d });
                  setModal("");
                }}
              >
                <Select label="Personaggio" name="character_id">
                  <option value="">Scegli…</option>
                  {characters
                    .filter((c) => !rows.some((b) => b.character_id === c.id))
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </Select>
                <Field
                  label="Initiative"
                  name="initiative"
                  type="number"
                  value={0}
                  required
                />
              </Form>
              <hr />
              {dm && (
                <>
                  <Form
                    submit="Aggiungi mostro salvato"
                    onSave={async (d) => {
                      if (!d.monster_id)
                        throw new Error("Scegli un mostro dalla campagna");
                      await run("monster_add", { ...d, id: encounter.id });
                      setModal("");
                    }}
                  >
                    <Select label="Mostro dalla campagna" name="monster_id">
                      <option value="">Scegli…</option>
                      {monsters.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} · {m.max_hp} HP · AC {m.armor_class}
                        </option>
                      ))}
                    </Select>
                    <Field
                      label="Initiative del mostro"
                      name="initiative"
                      type="number"
                      value={0}
                      required
                    />
                  </Form>
                  <Link to="/campaign?kind=monsters">
                    Prepara mostri nella campagna
                  </Link>
                  <hr />
                </>
              )}
              <Form
                submit="Aggiungi nemico / NPC"
                onSave={async (d) => {
                  await run("combatant_add", { id: encounter.id, ...d });
                  setModal("");
                }}
              >
                <Field
                  label="Nome visibile ai giocatori"
                  name="name"
                  value="Creatura sconosciuta"
                  required
                />
                <Field label="Nome reale (privato)" name="real_name" required />
                <div className="form-grid">
                  <Field
                    label="HP massimi (privati)"
                    name="max_hp"
                    type="number"
                    min={1}
                    value={10}
                    required
                  />
                  <Field
                    label="AC (privata)"
                    name="armor_class"
                    type="number"
                    min={0}
                    value={10}
                    required
                  />
                  <Field
                    label="Initiative"
                    name="initiative"
                    type="number"
                    value={0}
                    required
                  />
                </div>
              </Form>
            </>
          ) : modal === "initiative" ? (
            <Form
              onSave={async (d) => {
                await run("initiative", { id: selected!.id, ...d });
                setModal("");
              }}
            >
              <Field
                label={`Initiative · ${selected?.name}`}
                name="initiative"
                type="number"
                value={selected?.initiative}
                required
              />
            </Form>
          ) : modal === "order" ? (
            <Form
              onSave={async (d) => {
                await run("combatant_order", {
                  id: encounter.id,
                  version: encounter.version,
                  combatant_id: selected!.id,
                  ...d,
                });
                setModal("");
              }}
            >
              <p className="muted">
                Tra valori di Initiative uguali, il numero più basso agisce
                prima.
              </p>
              <Field
                label="Priorità per parità"
                name="order"
                type="number"
                value={selected?.turn_order}
                required
              />
            </Form>
          ) : (
            secret && (
              <Form
                onSave={async (d) => {
                  await run("enemy_update", { id: selected!.id, ...d });
                  setModal("");
                }}
              >
                <p className="badge">
                  {secret.real_name} · AC {secret.armor_class} · SOLO DM
                </p>
                <Field
                  label="HP attuali (privati)"
                  name="current_hp"
                  type="number"
                  min={0}
                  max={secret.max_hp}
                  value={secret.current_hp}
                  required
                />
                <Field
                  label="Condizioni private"
                  name="conditions"
                  value={secret.conditions}
                />
                <Area
                  label="Note private / durata effetti"
                  name="notes"
                  value={secret.notes}
                />
                <hr />
                <Field
                  label="Nome rivelato ai giocatori"
                  name="name"
                  value={selected?.name}
                  required
                />
                <Field
                  label="HP da rivelare (vuoto = nascosti)"
                  name="public_hp"
                  value={selected?.public_hp}
                  placeholder="Ferito, quasi sconfitto oppure 8 / 20"
                />
                <Field
                  label="Condizioni rivelate"
                  name="public_conditions"
                  value={selected?.public_conditions}
                />
                <p className="muted small">
                  Solo i tre campi qui sopra sono condivisi con i giocatori. Gli
                  indicatori di salute sono descrizioni manuali.
                </p>
              </Form>
            )
          )}
        </Modal>
      )}
    </>
  );
}
