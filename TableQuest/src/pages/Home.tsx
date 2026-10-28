import { useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Swords,
  BookOpen,
  Backpack,
  Shield,
  Heart,
  Users,
  Sparkles,
} from "lucide-react";
import { useApp, useRows } from "../lib/data";
import { db } from "../lib/client";
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
} from "../components/ui";
import { hpPercent } from "../lib/rules";
export function CampaignPicker({
  onSelect = () => {},
}: {
  onSelect?: () => void;
}) {
  const { user, setCampaignId, online } = useApp();
  const { data = [] } = useRows("campaigns", false);
  const qc = useQueryClient();
  const [tab, setTab] = useState("create");
  async function done(id: string) {
    await qc.invalidateQueries({ queryKey: [user.id, "all", "campaigns"] });
    setCampaignId(id);
    onSelect();
  }
  return (
    <div>
      {data.length > 0 && (
        <div className="campaign-list">
          {data.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                setCampaignId(c.id);
                onSelect();
              }}
            >
              <span className="campaign-monogram">{c.name[0]}</span>
              <span>
                {c.name}
                <small>
                  {c.owner_id === user.id ? "Dungeon Master" : "Giocatore"}
                </small>
              </span>
              <ArrowRight size={18} />
            </button>
          ))}
        </div>
      )}
      <div className="tabs">
        <button
          className={tab === "create" ? "selected" : ""}
          onClick={() => setTab("create")}
        >
          Crea campagna
        </button>
        <button
          className={tab === "join" ? "selected" : ""}
          onClick={() => setTab("join")}
        >
          Unisciti con codice
        </button>
      </div>
      {!online ? (
        <p className="muted">
          Riconnettiti per creare o unirti a una campagna.
        </p>
      ) : tab === "create" ? (
        <Form
          key="create"
          submit="Crea la tua campagna"
          onSave={async (d) => {
            const { data, error } = await db!.rpc("create_campaign", {
              p_name: d.name,
              p_description: d.description,
            });
            if (error) throw error;
            await done(data);
          }}
        >
          <Field
            label="Nome della campagna"
            name="name"
            placeholder="Il regno dimenticato"
            required
          />
          <Area
            label="Una breve introduzione (facoltativa)"
            name="description"
          />
        </Form>
      ) : (
        <Form
          key="join"
          submit="Unisciti alla compagnia"
          onSave={async (d) => {
            const { data, error } = await db!.rpc("join_campaign", {
              p_token: d.token,
            });
            if (error) throw error;
            await done(data);
          }}
        >
          <Field
            label="Codice d’invito del Dungeon Master"
            name="token"
            required
          />
          <p className="muted small">
            L’invito è valido per 7 giorni, salvo revoca del DM.
          </p>
        </Form>
      )}
    </div>
  );
}
export function Home() {
  const { user, campaignId } = useApp();
  const campaigns = useRows("campaigns", false);
  const { data: characters = [] } = useRows("characters");
  const { data: sessions = [] } = useRows("sessions");
  const { data: records = [] } = useRows("records");
  const { data: members = [] } = useRows("campaign_members");
  const { data: encounters = [] } = useRows("encounters");
  const [focus, setFocus] = useState(false);
  const campaign = campaigns.data?.find((c) => c.id === campaignId);
  const character = characters.find((c) => c.user_id === user.id);
  const session = sessions.find((s) => s.status === "active");
  const encounter = encounters.find((e) => e.status !== "completed");
  const dm = campaign?.owner_id === user.id;
  if (campaigns.isLoading) return <Loading />;
  if (!campaign)
    return (
      <>
        <Heading
          eyebrow="BENVENUTO IN TABLEQUEST"
          title="Ogni avventura ha un inizio."
        />
        <div className="onboarding">
          <div className="hero empty-hero">
            <div className="hero-content">
              <span className="badge">IL PROSSIMO CAPITOLO È VOSTRO</span>
              <h2>
                Raduna la tua
                <br />
                <em>compagnia.</em>
              </h2>
              <p>
                Un posto per le storie, i segreti e le imprese che
                condividerete. Porta i dadi, al resto pensiamo insieme.
              </p>
            </div>
            <div className="hero-sigil">◇</div>
          </div>
          <section className="panel">
            <CampaignPicker />
          </section>
        </div>
      </>
    );
  return (
    <>
      <Heading
        eyebrow="È BELLO RITROVARSI AL TAVOLO"
        title={
          dm
            ? "Bentornato, Dungeon Master."
            : `Bentornato${character ? `, ${character.name}` : ""}.`
        }
      >
        {session && (
          <Button secondary onClick={() => setFocus(!focus)}>
            <Sparkles size={17} />
            {focus ? "Vista completa" : "Modalità sessione"}
          </Button>
        )}
      </Heading>
      <section className={`hero ${focus ? "focused-hero" : ""}`}>
        <div className="hero-content">
          <span className="badge">
            {session ? (
              <>
                <i className="live-dot" /> SESSIONE IN CORSO
              </>
            ) : (
              "LA VOSTRA STORIA CONTINUA"
            )}
          </span>
          <h2>{campaign.name}</h2>
          <p>
            {session
              ? `Sessione ${session.session_number} · ${session.title}`
              : campaign.description ||
                "Un nuovo capitolo aspetta solo di essere scritto."}
          </p>
          <div className="hero-actions">
            {session ? (
              <Link
                className="button"
                to={encounter ? "/combat" : dm ? "/dm" : "/character"}
              >
                {encounter ? "Entra nel combattimento" : "Al tavolo"}
                <ArrowRight size={18} />
              </Link>
            ) : (
              <Link className="button" to={dm ? "/dm" : "/campaign"}>
                {dm ? "Prepara la sessione" : "Apri il diario"}
                <ArrowRight size={18} />
              </Link>
            )}
            <span>
              <Users size={16} /> {members.length} al tavolo
            </span>
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="sun" />
          <div className="mountain far" />
          <div className="mountain near" />
          <div className="tower" />
          <div className="road" />
        </div>
      </section>
      <div className="dashboard-grid">
        <section className="panel character-card">
          <div className="section-heading">
            <span className="eyebrow">IL TUO PERSONAGGIO</span>
            <Link to="/character" className="text-link">
              Scheda <ArrowRight size={15} />
            </Link>
          </div>
          {character ? (
            <>
              <div className="character-identity">
                <span className="portrait">
                  <Shield size={34} />
                </span>
                <div>
                  <h2>{character.name}</h2>
                  <p className="muted">
                    {character.classes || character.species || "Avventuriero"} ·
                    Liv. {character.level}
                  </p>
                </div>
              </div>
              <div className="hp-header">
                <span>
                  <Heart size={17} /> Punti ferita
                </span>
                <strong>
                  {character.current_hp} <small>/ {character.max_hp}</small>
                </strong>
              </div>
              <div className="hp-track">
                <span
                  style={{
                    width: `${hpPercent(character.current_hp, character.max_hp)}%`,
                  }}
                />
              </div>
              <div className="character-stats">
                <span>
                  <Shield size={18} />
                  <b>{character.armor_class}</b> AC
                </span>
                <span>
                  <b>{character.temporary_hp}</b> HP temporanei
                </span>
              </div>
              <div className="condition-row">
                {character.conditions.length ? (
                  character.conditions.map((c) => (
                    <span className="badge" key={c.name}>
                      {c.name}
                    </span>
                  ))
                ) : (
                  <span className="muted small">
                    ✧ Nessuna condizione attiva
                  </span>
                )}
              </div>
            </>
          ) : (
            <Empty title="La carta resta la tua scheda">
              <p>Aggiungi solo ciò che ti serve al tavolo.</p>
              <Link className="button secondary" to="/character">
                Crea un profilo leggero
              </Link>
            </Empty>
          )}
        </section>
        <section className="panel">
          <div className="section-heading">
            <span className="eyebrow">PRONTI ALL’AVVENTURA</span>
            <span className="muted small">Accesso rapido</span>
          </div>
          <div className="quick-links">
            {[
              [
                Swords,
                "/combat",
                "Combattimento",
                encounter
                  ? `Round ${encounter.current_round} · ${encounter.name}`
                  : "L’iniziativa, sotto controllo",
              ],
              [
                BookOpen,
                "/campaign",
                "Diario di campagna",
                "Nessuna scoperta dimenticata",
              ],
              [
                Backpack,
                "/inventory",
                "Inventario del gruppo",
                "Il bottino, tutto in ordine",
              ],
            ].map(([Icon, to, title, sub]) => {
              const I = Icon as typeof Swords;
              return (
                <Link key={String(to)} to={String(to)}>
                  <span className="quick-icon">
                    <I size={22} />
                  </span>
                  <span>
                    <strong>{String(title)}</strong>
                    <small>{String(sub)}</small>
                  </span>
                  <ArrowRight size={18} />
                </Link>
              );
            })}
          </div>
        </section>
      </div>
      {!focus && (
        <section className="panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">IL FILO DELLA STORIA</span>
              <h2>Ultime dal diario</h2>
            </div>
            <Link to="/campaign" className="text-link">
              Tutto il diario <ArrowRight size={16} />
            </Link>
          </div>
          {records.filter((r) => ["journal", "announcement"].includes(r.kind))
            .length ? (
            <div className="journal-preview">
              {records
                .filter((r) => ["journal", "announcement"].includes(r.kind))
                .sort((a, b) => b.created_at.localeCompare(a.created_at))
                .slice(0, 3)
                .map((r) => (
                  <article key={r.id}>
                    <span className="muted small">
                      {new Date(r.created_at).toLocaleDateString("it-IT", {
                        day: "numeric",
                        month: "long",
                      })}
                    </span>
                    <h3>{r.title}</h3>
                    <p>{r.content.slice(0, 180)}</p>
                  </article>
                ))}
            </div>
          ) : (
            <Empty title="La prima pagina è ancora bianca">
              Scrivete insieme le scoperte della vostra prossima sessione.
            </Empty>
          )}
        </section>
      )}
      {focus && (
        <div className="focus-shortcuts">
          <Link to="/messages" className="button secondary">
            Messaggi privati
          </Link>
          <Link to="/character" className="button secondary">
            HP e risorse
          </Link>
          <Link to="/campaign?kind=note" className="button secondary">
            Note personali
          </Link>
        </div>
      )}
    </>
  );
}
