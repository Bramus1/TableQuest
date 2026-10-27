import { useState } from "react";
import {
  Heart,
  Shield,
  Footprints,
  Zap,
  Minus,
  Plus,
  PenLine,
  Moon,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useApp, useRows } from "../lib/data";
import {
  Action,
  AddButton,
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
import { conditions, hpPercent, referenceUrl } from "../lib/rules";
import { it } from "../lib/i18n";
import type { Character } from "../types";
function CharacterForm({
  character,
  onClose,
}: {
  character?: Character;
  onClose: () => void;
}) {
  const { run } = useApp();
  return (
    <Form
      onSave={async (d) => {
        await run("character_save", { ...d, version: character?.version });
        onClose();
      }}
    >
      <Field
        label="Nome del personaggio"
        name="name"
        value={character?.name}
        required
      />
      <div className="form-grid">
        <Field label="Specie" name="species" value={character?.species} />
        <Field
          label="Livello totale"
          name="level"
          type="number"
          min={1}
          max={20}
          value={character?.level || 1}
          required
        />
      </div>
      <Field
        label="Classi, livelli e sottoclassi"
        name="classes"
        value={character?.classes}
        placeholder="Druido 4 (Luna) / Barbaro 1"
      />
      <p className="muted small">
        Riporta i livelli dalla scheda cartacea. Nessun calcolo automatico delle
        classi.
      </p>
      <div className="form-grid">
        <Field
          label="HP massimi"
          name="max_hp"
          type="number"
          min={1}
          value={character?.max_hp || 10}
          required
        />
        <Field
          label="Armor Class"
          name="armor_class"
          type="number"
          min={0}
          value={character?.armor_class || 10}
          required
        />
        <Field
          label="Modificatore Initiative"
          name="initiative_modifier"
          type="number"
          value={character?.initiative_modifier || 0}
          required
        />
        <Field
          label="Velocità (metri)"
          name="movement_speed"
          type="number"
          min={0}
          value={character?.movement_speed ?? 9}
          required
        />
      </div>
      <Field
        label="URL ritratto (HTTPS, facoltativo)"
        name="portrait_url"
        type="url"
        value={character?.portrait_url}
      />
      <Area
        label="Note personali sulla scheda"
        name="notes"
        value={character?.notes}
      />
    </Form>
  );
}
export default function CharacterPage() {
  const { user, campaignId, run } = useApp();
  const query = useRows("characters");
  const { data: resources = [] } = useRows("character_resources");
  const [modal, setModal] = useState("");
  const [amount, setAmount] = useState(1);
  const ch = query.data?.find((c) => c.user_id === user.id);
  if (!campaignId) return <Empty title="Scegli prima una campagna" />;
  if (query.isLoading) return <Loading />;
  if (query.error)
    return (
      <p role="alert" className="error">
        {query.error.message}
      </p>
    );
  if (!ch)
    return (
      <>
        <Heading title="La tua scheda, più leggera." />
        <section className="panel narrow">
          <p className="muted">
            La scheda cartacea resta il riferimento. Qui bastano nome, HP e le
            risorse utili al tavolo.
          </p>
          <CharacterForm onClose={() => {}} />
        </section>
      </>
    );
  const state = { id: ch.id, version: ch.version };
  const ownResources = resources.filter((r) => r.character_id === ch.id);
  return (
    <>
      <Heading eyebrow="LA CARTA RACCONTA. TABLEQUEST RICORDA." title={ch.name}>
        <Button secondary onClick={() => setModal("edit")}>
          <PenLine size={16} /> Modifica profilo
        </Button>
      </Heading>
      <div className="character-page-grid">
        <section className="panel hp-panel">
          <div className="character-identity">
            {ch.portrait_url.startsWith("https://") ? (
              <img
                className="portrait"
                src={ch.portrait_url}
                alt={`Ritratto di ${ch.name}`}
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="portrait">
                <Shield size={32} />
              </span>
            )}
            <div>
              <h2>{ch.classes || "Avventuriero"}</h2>
              <p className="muted">
                {ch.species} · Livello {ch.level}
              </p>
            </div>
          </div>
          <div className="hp-big">
            <Heart size={26} />
            <strong>{ch.current_hp}</strong>
            <span>/ {ch.max_hp} HP</span>
          </div>
          <div className="hp-track">
            <span
              style={{ width: `${hpPercent(ch.current_hp, ch.max_hp)}%` }}
            />
          </div>
          <div className="hp-controls">
            <Action
              action="character_state"
              data={{
                ...state,
                current_hp: Math.max(0, ch.current_hp - amount),
              }}
              disabled={ch.current_hp === 0}
            >
              <Minus size={18} /> HP
            </Action>
            <label className="sr-only" htmlFor="hp-amount">
              Quantità HP
            </label>
            <input
              id="hp-amount"
              type="number"
              min={1}
              max={9999}
              value={amount}
              onChange={(e) =>
                setAmount(
                  Math.max(1, Math.min(9999, Number(e.target.value) || 1)),
                )
              }
            />
            <Action
              action="character_state"
              data={{
                ...state,
                current_hp: Math.min(ch.max_hp, ch.current_hp + amount),
              }}
              disabled={ch.current_hp === ch.max_hp}
            >
              <Plus size={18} /> HP
            </Action>
          </div>
          <Button secondary onClick={() => setModal("hp")}>
            Imposta HP e HP temporanei
          </Button>
          <p className="muted small">
            HP temporanei: <strong>{ch.temporary_hp}</strong>. Gestiscili
            separatamente; non si sommano automaticamente.
          </p>
          {ch.concentration && (
            <p className="reminder">
              <Sparkles size={17} /> Concentrazione: {ch.concentration}. Se
              subisci danni, verifica sulla scheda se serve un tiro.
            </p>
          )}
          <div className="stat-grid">
            <div>
              <Shield />
              <strong>{ch.armor_class}</strong>
              <span>Armor Class</span>
            </div>
            <div>
              <Zap />
              <strong>
                {ch.initiative_modifier >= 0 ? "+" : ""}
                {ch.initiative_modifier}
              </strong>
              <span>Initiative</span>
            </div>
            <div>
              <Footprints />
              <strong>{ch.movement_speed} m</strong>
              <span>Velocità</span>
            </div>
          </div>
        </section>
        <section className="panel">
          <div className="section-heading">
            <h2>Risorse & spell slots</h2>
            <button
              className="icon-button"
              aria-label="Aggiungi risorsa"
              onClick={() => setModal("resource")}
            >
              <Plus />
            </button>
          </div>
          <p className="muted small">
            Configura usi e recupero dalla tua scheda, inclusi gli slot per
            livello.
          </p>
          {ownResources.length ? (
            ownResources.map((r) => (
              <div className="resource" key={r.id}>
                <div>
                  <strong>{r.name}</strong>
                  <small>{it.recovery[r.recovery_type]}</small>
                </div>
                <Action
                  action="resource_use"
                  data={{
                    id: r.id,
                    version: r.version,
                    remaining_uses: r.remaining_uses - 1,
                  }}
                  disabled={r.remaining_uses === 0}
                >
                  <span className="sr-only">Usa {r.name}</span>
                  <Minus size={16} />
                </Action>
                <b>
                  {r.remaining_uses}
                  <small> / {r.maximum_uses}</small>
                </b>
                <Action
                  action="resource_use"
                  data={{
                    id: r.id,
                    version: r.version,
                    remaining_uses: r.remaining_uses + 1,
                  }}
                  disabled={r.remaining_uses === r.maximum_uses}
                >
                  <span className="sr-only">Ripristina {r.name}</span>
                  <Plus size={16} />
                </Action>
                <Action
                  action="resource_delete"
                  data={{ id: r.id }}
                  confirm={`Eliminare ${r.name}?`}
                >
                  <span className="sr-only">Elimina {r.name}</span>
                  <Trash2 size={14} />
                </Action>
              </div>
            ))
          ) : (
            <Empty title="Solo le risorse che ti servono">
              Rage, Wild Shape, slot… decidi tu.
            </Empty>
          )}
          <div className="button-row">
            <Action
              action="rest"
              data={{ id: ch.id, type: "short" }}
              confirm="Ripristinare solo le risorse configurate per il riposo breve?"
            >
              <Moon size={16} /> Riposo breve
            </Action>
            <Action
              action="rest"
              data={{ id: ch.id, type: "long" }}
              confirm="Ripristinare le risorse configurate per riposo breve o lungo? Gli HP restano invariati."
            >
              <Moon size={16} /> Riposo lungo
            </Action>
          </div>
        </section>
        <section className="panel">
          <div className="section-heading">
            <h2>Condizioni</h2>
            <button
              className="icon-button"
              aria-label="Aggiungi condizione"
              onClick={() => setModal("condition")}
            >
              <Plus />
            </button>
          </div>
          {ch.conditions.length ? (
            ch.conditions.map((c, i) => (
              <div className="condition" key={i}>
                <div>
                  <strong>{c.name}</strong>
                  <p>{c.notes}</p>
                  <small className="gold">
                    {c.duration || "Rimozione manuale"}
                  </small>
                </div>
                <Action
                  action="character_state"
                  data={{
                    ...state,
                    conditions: ch.conditions.filter((_, j) => i !== j),
                  }}
                >
                  <span className="sr-only">Rimuovi {c.name}</span>×
                </Action>
              </div>
            ))
          ) : (
            <Empty title="Nessuna condizione attiva" />
          )}
          <p className="muted small">
            Durate e scadenze sono promemoria manuali: verifica a inizio e fine
            turno.
          </p>
          <a
            className="text-link"
            href={referenceUrl}
            target="_blank"
            rel="noreferrer"
          >
            Consulta le regole ufficiali 2024 ↗
          </a>
        </section>
        <section className="panel">
          <div className="section-heading">
            <h2>Concentrazione</h2>
            <Sparkles className="gold" size={20} />
          </div>
          <Form
            key={ch.concentration}
            submit={
              ch.concentration ? "Aggiorna effetto" : "Inizia concentrazione"
            }
            onSave={(d) =>
              run("character_state", { ...state, concentration: d.effect })
            }
          >
            <Field
              label="Effetto, round iniziale e durata"
              name="effect"
              value={ch.concentration}
              placeholder="Es. Benedizione · round 2 · 10 round"
              required
            />
          </Form>
          {ch.concentration && (
            <Action
              action="character_state"
              data={{ ...state, concentration: "" }}
            >
              Termina concentrazione
            </Action>
          )}
          <p className="muted small">
            Il tiro e il suo risultato restano nelle tue mani.
          </p>
          {ch.notes && (
            <>
              <h3>Le tue note</h3>
              <p className="preserve">{ch.notes}</p>
            </>
          )}
        </section>
      </div>
      {modal && (
        <Modal
          title={
            {
              edit: "Modifica personaggio",
              hp: "Punti ferita",
              resource: "Nuova risorsa",
              condition: "Aggiungi condizione",
            }[modal] || ""
          }
          onClose={() => setModal("")}
        >
          {modal === "edit" ? (
            <CharacterForm character={ch} onClose={() => setModal("")} />
          ) : modal === "hp" ? (
            <Form
              onSave={async (d) => {
                await run("character_state", { ...state, ...d });
                setModal("");
              }}
            >
              <Field
                label="HP attuali"
                name="current_hp"
                type="number"
                min={0}
                max={ch.max_hp}
                value={ch.current_hp}
                required
              />
              <Field
                label="HP temporanei"
                name="temporary_hp"
                type="number"
                min={0}
                value={ch.temporary_hp}
                required
              />
            </Form>
          ) : modal === "resource" ? (
            <Form
              onSave={async (d) => {
                await run("resource_add", { id: ch.id, ...d });
                setModal("");
              }}
            >
              <Field
                label="Nome"
                name="name"
                placeholder="Spell Slots · Livello 1"
                required
              />
              <Field
                label="Usi massimi"
                name="maximum_uses"
                type="number"
                min={0}
                value={2}
                required
              />
              <Select label="Recupero" name="recovery_type" value="manual">
                <option value="manual">Solo manuale</option>
                <option value="short">Riposo breve (e lungo)</option>
                <option value="long">Riposo lungo</option>
              </Select>
            </Form>
          ) : (
            <Form
              onSave={async (d) => {
                if (ch.conditions.some((c) => c.name === d.name))
                  throw new Error(
                    "Condizione già presente: rimuovila per cambiarla.",
                  );
                await run("character_state", {
                  ...state,
                  conditions: [
                    ...ch.conditions,
                    { name: d.name, notes: d.notes, duration: d.duration },
                  ],
                });
                setModal("");
              }}
            >
              <Select label="Condizione" name="name" value={conditions[0]}>
                {conditions.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
              <Field
                label="Durata e scadenza (promemoria manuale)"
                name="duration"
                placeholder="2 round, fine del mio turno / manuale"
              />
              <Area label="Note / livello di Exhaustion" name="notes" />
            </Form>
          )}
        </Modal>
      )}
    </>
  );
}
