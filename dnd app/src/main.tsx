import React, { Suspense, lazy, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  NavLink,
  Link,
} from "react-router-dom";
import {
  QueryClient,
  QueryClientProvider,
  useQueryClient,
} from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import {
  House,
  Swords,
  BookOpen,
  Backpack,
  UserRound,
  Shield,
  LogOut,
  Bell,
  WifiOff,
  Settings,
  ArrowRight,
  Flame,
  Leaf,
  Moon,
  Sparkles,
  Menu,
  X,
} from "lucide-react";
import { db, configured } from "./lib/client";
import { DataProvider, useApp, useRows, clearCache } from "./lib/data";
import { Button, Field, Form, Loading, Modal, Select } from "./components/ui";
import { Home, CampaignPicker } from "./pages/Home";
import "./style.css";
const CharacterPage = lazy(() => import("./pages/Character"));
const CombatPage = lazy(() => import("./pages/Combat"));
const CampaignPage = lazy(() => import("./pages/Campaign"));
const InventoryPage = lazy(() => import("./pages/Inventory"));
const DmPage = lazy(() => import("./pages/Dm"));
const MessagesPage = lazy(() => import("./pages/Messages"));
const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: true } },
});
export function Brand() {
  return (
    <Link to="/" className="brand">
      <img src="/icon.svg" alt="" />
      <span>
        Table<span className="gold">Quest</span>
        <small>IL COMPAGNO DI OGNI AVVENTURA</small>
      </span>
    </Link>
  );
}
function Setup() {
  return (
    <div className="welcome">
      <Brand />
      <div className="welcome-grid">
        <section>
          <div className="eyebrow">MENO SCHERMO. PIÙ AVVENTURA.</div>
          <h1>
            Le grandi storie
            <br />
            iniziano <em>al tavolo.</em>
          </h1>
          <p>
            La scheda è di carta. I dadi sono veri.
            <br />
            Il resto della tua avventura, tutto qui.
          </p>
          <div className="feature-row">
            <span>
              <Swords /> Combattimenti condivisi
            </span>
            <span>
              <BookOpen /> Ricordi di campagna
            </span>
            <span>
              <Shield /> Segreti al sicuro
            </span>
          </div>
        </section>
        <section className="panel setup">
          <span className="badge">IL TUO TAVOLO TI ASPETTA</span>
          <h2>Prepariamo TableQuest</h2>
          <p>
            Per iniziare, collega il database della tua compagnia. Nessuna
            campagna è stata ancora creata.
          </p>
          <ol>
            <li>Crea un progetto Supabase dedicato.</li>
            <li>
              Esegui la migrazione nella cartella{" "}
              <code>supabase/migrations</code>.
            </li>
            <li>
              Copia <code>.env.example</code> in <code>.env</code> e inserisci
              URL e chiave pubblica.
            </li>
            <li>
              Riavvia l’app con <code>pnpm dev</code>.
            </li>
          </ol>
          <p className="muted small">
            La guida completa si trova nel README del progetto.
          </p>
          <a
            className="button"
            href="https://supabase.com/dashboard"
            target="_blank"
            rel="noreferrer"
          >
            Apri Supabase <ArrowRight size={18} />
          </a>
        </section>
      </div>
      <footer>
        Fatto per gli amici intorno a un tavolo.{" "}
        <span>TABLEQUEST · D&D 2024</span>
      </footer>
    </div>
  );
}
function Auth() {
  const [signup, setSignup] = useState(false);
  const [message, setMessage] = useState("");
  return (
    <div className="welcome">
      <Brand />
      <div className="welcome-grid">
        <section>
          <div className="eyebrow">LA PROSSIMA AVVENTURA TI ASPETTA</div>
          <h1>
            Un tavolo.
            <br />
            Mille <em>storie.</em>
          </h1>
          <p>
            Ritrova la compagnia, segui il combattimento e custodisci ogni
            scoperta. Senza perdere il filo dell’avventura.
          </p>
          <div className="feature-row">
            <span>
              <Swords /> Dadi veri
            </span>
            <span>
              <BookOpen /> Memorie condivise
            </span>
            <span>
              <Shield /> Il tuo gruppo
            </span>
          </div>
        </section>
        <section className="panel">
          <span className="badge">BENVENUTO AL TAVOLO</span>
          <h2>{signup ? "Crea il tuo account" : "Bentornato, avventuriero"}</h2>
          <Form
            submit={signup ? "Crea account" : "Entra nella compagnia"}
            onSave={async (d) => {
              setMessage("");
              if (signup) {
                const { error } = await db!.auth.signUp({
                  email: d.email,
                  password: d.password,
                  options: {
                    data: { display_name: d.name },
                    emailRedirectTo: window.location.origin,
                  },
                });
                if (error) throw error;
                setMessage(
                  "Controlla la tua email per confermare l’account, poi accedi.",
                );
              } else {
                const { error } = await db!.auth.signInWithPassword({
                  email: d.email,
                  password: d.password,
                });
                if (error) throw error;
              }
            }}
          >
            {signup && <Field label="Come ti chiami?" name="name" required />}
            <Field label="Email" name="email" type="email" required />
            <label className="field">
              Password
              <input
                type="password"
                name="password"
                minLength={8}
                required
                autoComplete={signup ? "new-password" : "current-password"}
              />
            </label>
          </Form>
          {message && (
            <p role="status" className="success">
              {message}
            </p>
          )}
          <button
            className="text-button"
            onClick={() => {
              setSignup(!signup);
              setMessage("");
            }}
          >
            {signup
              ? "Hai già un account? Accedi"
              : "La tua prima avventura? Registrati"}
          </button>
        </section>
      </div>
      <footer>Le tue storie. La tua compagnia. Il tuo TableQuest.</footer>
    </div>
  );
}
const nav = [
  ["/", "Home", House],
  ["/combat", "Combattimento", Swords],
  ["/campaign", "Campagna", BookOpen],
  ["/inventory", "Inventario", Backpack],
  ["/character", "Personaggio", UserRound],
] as const;
function Shell() {
  const {
    user,
    campaignId,
    setCampaignId,
    online,
    live,
    notice,
    error,
    setError,
  } = useApp();
  const qc = useQueryClient();
  const campaigns = useRows("campaigns", false);
  const profiles = useRows("profiles", false);
  const messages = useRows("private_messages");
  const [settings, setSettings] = useState(false);
  const [picker, setPicker] = useState(false);
  const [mobile, setMobile] = useState(false);
  const campaign = campaigns.data?.find((c) => c.id === campaignId);
  const dm = campaign?.owner_id === user.id;
  const me = profiles.data?.find((p) => p.id === user.id);
  const unread =
    messages.data?.filter((m) => m.recipient_id === user.id && !m.is_read)
      .length || 0;
  useEffect(() => {
    if (
      campaigns.isSuccess &&
      online &&
      campaignId &&
      !campaigns.data.some((c) => c.id === campaignId)
    ) {
      clearCache();
      qc.removeQueries({ queryKey: [user.id, campaignId] });
      setCampaignId("");
    }
  }, [
    campaigns.data,
    campaigns.isSuccess,
    campaignId,
    online,
    qc,
    user.id,
    setCampaignId,
  ]);
  const Avatar =
    {
      shield: Shield,
      sword: Swords,
      sparkles: Sparkles,
      moon: Moon,
      flame: Flame,
      leaf: Leaf,
    }[me?.avatar || "shield"] || Shield;
  return (
    <div className="app">
      <aside className={`sidebar ${mobile ? "show" : ""}`}>
        <button
          className="icon-button sidebar-close"
          aria-label="Chiudi menu"
          onClick={() => setMobile(false)}
        >
          <X size={20} />
        </button>
        <Brand />
        <div className="sidebar-label">LA TUA COMPAGNIA</div>
        <button
          className="campaign-switch"
          onClick={() => {
            setPicker(true);
            setMobile(false);
          }}
        >
          <span className="campaign-monogram">
            {campaign?.name.slice(0, 1) || "+"}
          </span>
          <span>
            {campaign?.name || "Scegli una campagna"}
            <small>{dm ? "Dungeon Master" : "Avventuriero"}</small>
          </span>
          <span>⌄</span>
        </button>
        <div className="sidebar-label">AL TAVOLO</div>
        <nav>
          {nav.map(([to, label, Icon]) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              onClick={() => setMobile(false)}
            >
              <Icon size={21} />
              {label}
            </NavLink>
          ))}
        </nav>
        {dm && (
          <NavLink
            className="dm-link"
            to="/dm"
            onClick={() => setMobile(false)}
          >
            <Shield size={20} /> Schermo del DM <span>↗</span>
          </NavLink>
        )}
        <div className="sidebar-bottom">
          <p>
            Lascia spazio
            <br />
            <em>all’immaginazione.</em>
          </p>
          <div className="account">
            <span className="avatar">
              <Avatar size={22} />
            </span>
            <span>
              {me?.display_name ||
                user.user_metadata.display_name ||
                "Avventuriero"}
              <small>{dm ? "Dungeon Master" : "Al tavolo con gli amici"}</small>
            </span>
            <button
              className="icon-button"
              aria-label="Impostazioni account"
              onClick={() => setSettings(true)}
            >
              <Settings size={18} />
            </button>
          </div>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            aria-label="Menu"
            onClick={() => setMobile(!mobile)}
          >
            <Menu />
          </button>
          <span className="breadcrumb">
            LA COMPAGNIA <span>/</span>{" "}
            {campaign?.name || "Una nuova avventura"}
          </span>
          <div className="top-actions">
            <span className={`connection ${!online ? "offline" : ""}`}>
              <i />
              {online ? live : "Offline · sola lettura"}
            </span>
            <Link
              className="icon-button bell"
              to="/messages"
              aria-label={`Messaggi, ${unread} non letti`}
            >
              <Bell size={21} />
              {unread > 0 && <b>{unread}</b>}
            </Link>
            <button
              className="avatar"
              aria-label="Profilo"
              onClick={() => setSettings(true)}
            >
              <Avatar size={20} />
            </button>
          </div>
        </header>
        {!online && (
          <div className="offline-banner">
            <WifiOff size={17} /> Sei offline. Puoi leggere le informazioni già
            caricate; le modifiche richiedono una connessione.
          </div>
        )}
        <main className="content">
          {error && (
            <div role="alert" className="error dismiss">
              {error}
              <button aria-label="Chiudi errore" onClick={() => setError("")}>
                ×
              </button>
            </div>
          )}
          {campaigns.error && (
            <p role="alert" className="error">
              Impossibile caricare le campagne: {campaigns.error.message}
            </p>
          )}
          <Suspense fallback={<Loading />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/combat" element={<CombatPage />} />
              <Route path="/campaign" element={<CampaignPage />} />
              <Route path="/inventory" element={<InventoryPage />} />
              <Route path="/character" element={<CharacterPage />} />
              <Route
                path="/dm"
                element={
                  campaigns.isPending ? (
                    <Loading />
                  ) : dm ? (
                    <DmPage />
                  ) : (
                    <Navigate to="/" replace />
                  )
                }
              />
              <Route path="/messages" element={<MessagesPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
          <div className="page-footer">
            <span>TABLEQUEST</span> I momenti migliori accadono lontano dallo
            schermo.
          </div>
        </main>
      </div>
      <nav className="bottom-nav">
        {nav.map(([to, label, Icon]) => (
          <NavLink key={to} to={to} end={to === "/"}>
            <Icon size={21} />
            <span>{label === "Combattimento" ? "Combat" : label}</span>
          </NavLink>
        ))}
      </nav>
      {notice && (
        <div className="toast" role="status">
          ✓ {notice}
        </div>
      )}
      {picker && (
        <Modal title="Le tue campagne" onClose={() => setPicker(false)}>
          <CampaignPicker onSelect={() => setPicker(false)} />
        </Modal>
      )}
      {settings && (
        <Modal title="Il tuo profilo" onClose={() => setSettings(false)}>
          <Form
            onSave={async (d) => {
              const { error } = await db!.rpc("save_profile", {
                p_name: d.name,
                p_avatar: d.avatar,
              });
              if (error) throw error;
              await qc.invalidateQueries({
                queryKey: [user.id, "all", "profiles"],
              });
              setSettings(false);
            }}
          >
            <Field
              label="Nome visualizzato"
              name="name"
              value={me?.display_name || user.user_metadata.display_name || ""}
              required
            />
            <Select
              label="Emblema"
              name="avatar"
              value={me?.avatar || "shield"}
            >
              <option value="shield">Scudo</option>
              <option value="sword">Spada</option>
              <option value="sparkles">Magia</option>
              <option value="moon">Luna</option>
              <option value="flame">Fiamma</option>
              <option value="leaf">Foglia</option>
            </Select>
          </Form>
          <Button
            secondary
            onClick={() =>
              void (async () => {
                const { error } = await db!.auth.signOut();
                if (error) {
                  setError(error.message);
                  return;
                }
                clearCache();
                qc.clear();
              })()
            }
          >
            <LogOut size={18} /> Esci dall’account
          </Button>
        </Modal>
      )}
    </div>
  );
}
function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(configured);
  useEffect(() => {
    if (!db) return;
    db.auth.getSession().then(({ data }) => {
      setUser(data.session?.user || null);
      setLoading(false);
    });
    const {
      data: { subscription },
    } = db.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);
  if (!configured) return <Setup />;
  if (loading) return <Loading />;
  if (!user) return <Auth />;
  return (
    <DataProvider key={user.id} user={user}>
      <Shell />
    </DataProvider>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
