# TableQuest

An Italian, mobile-first companion for an in-person D&D 2024 group. Paper sheets and physical dice remain the primary tools. React + TypeScript + Vite + Tailwind CSS, React Router, TanStack Query, Supabase Auth/Postgres/Realtime, and an installable PWA.

## Stato della configurazione

Il backend è già collegato al progetto **TableQuest**, organizzazione **Bramus1**, regione **Parigi (`eu-west-3`)**, riferimento `mvwxtjmcrzjvmnejwdwt`. [Apri il progetto Supabase](https://supabase.com/dashboard/project/mvwxtjmcrzjvmnejwdwt). Il progetto BandHub non è stato modificato. Il preventivo alla creazione era di **$0/mese**.

Le migrazioni sono già applicate e il file locale `.env` contiene URL e chiave pubblica. **In questa copia del progetto non sovrascrivere `.env` con `.env.example`.** Avvia direttamente `pnpm dev`. Il frontend è pubblicato su [TableQuest](https://tablequest-seven.vercel.app). La pubblicazione corrente contiene la build statica verificata; non è collegata a un repository Git per aggiornamenti automatici.

Per usare la registrazione da `http://127.0.0.1:5173`, imposta tale indirizzo in Supabase **Authentication → URL Configuration → Site URL** e fra gli URL di reindirizzamento consentiti. Per la pubblicazione imposta Site URL e redirect su `https://tablequest-seven.vercel.app`. Il connettore disponibile non espone la modifica di queste impostazioni. Per le email di conferma agli amici configura un provider SMTP in Authentication; l’invio effettivo delle email non è stato verificato.

## Run locally

Requires Node.js 22.12+ and pnpm 10.26+ (tested with pnpm 11.25). For a fresh checkout without an existing `.env`, run from this directory:

```sh
pnpm install --frozen-lockfile
cp .env.example .env
pnpm dev
```

In PowerShell, replace the copy command with `Copy-Item .env.example .env`.

Open http://127.0.0.1:5173. Without environment variables the application shows a truthful setup screen; there is no demo mode, simulated multiplayer, or seeded production data.

This workstation has pnpm bundled outside PATH. Its equivalent command is:

```powershell
& 'C:\Users\GTaurone\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd' dev
```

## Connect a dedicated Supabase project

TableQuest is already configured in this workspace; use these steps only for a separate installation. BandHub must remain untouched.

1. Create a new project for TableQuest in the Supabase dashboard. Choose the region and plan you want; retain the database password privately.
2. Open **SQL Editor** and execute all SQL files in `supabase/migrations/` in filename order, once, against the new database. They create tables, indexes, policies, RPCs, the profile trigger, Realtime publication entries, and restrict the trigger's API permissions. Do not apply the initial migration twice or to an unrelated application's database.
3. In the project's **Connect / API** settings, obtain the project URL and publishable key (or legacy anon key). Put them in `.env`:

   ```dotenv
   VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   VITE_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
   ```

4. In **Authentication**, enable email/password sign-in. Keep email confirmation enabled for production. Configure SMTP for reliable email delivery to your friends; Supabase's default email provider may restrict recipients or rate-limit delivery.
5. Set Auth **Site URL** to the final frontend URL and allow redirects to that URL and `http://127.0.0.1:5173` during development. Sign-up uses the current origin as its confirmation redirect.
6. Restart Vite whenever `.env` changes. Create an account, confirm its email, and sign in. Create a campaign, open **Schermo del DM**, generate an invitation, and share the code with your friends. Each person uses their own account.

Only the public/anon key belongs in the frontend. **Never put a service-role key or database password in a `VITE_` variable.** No Storage bucket is required. Portraits can be uploaded and resized locally; existing HTTPS portraits remain supported.

Alternative migration workflow with an installed Supabase CLI:

```sh
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

## Deploy to Vercel

1. Import this repository as a Vite project; use Node 22+, `pnpm install --frozen-lockfile`, build command `pnpm build`, and output directory `dist`.
2. Add the two public environment variables above to the desired Vercel environment.
3. Deploy, then update Supabase Auth Site URL and redirect allowlist to the exact HTTPS domain.
4. Run the hosted acceptance check below with distinct DM, player, and observer accounts, then verify on two real phones before the first game.

`vercel.json` provides SPA route fallback and basic response headers. The service worker caches the app shell and split screen bundles, not Supabase API responses. HTTPS is required for installation outside localhost.

On Android use the browser's install/Add to Home Screen menu. On iOS use Safari → Share → Add to Home Screen. Open the installed app online once and visit the desired screens before relying on offline reading. App updates take effect after existing app tabs are closed and reopened, avoiding forced reloads during play.

## Implemented workflows

- Registration, email/password login, logout, display name, and six selectable profile emblems.
- Multiple campaigns, DM ownership, player membership, cryptographically random invitation codes, expiry/revocation, member removal. Removing a member also revokes outstanding invitations.
- Lightweight private character profiles: classes/subclasses and levels as manual text, total level, HP, temporary HP, AC, initiative modifier, speed in feet, uploaded portrait, notes, conditions, and concentration.
- Custom resources including spell slots per level; explicit manual/short/long rest recovery. Long rest restores maximum HP; short rest and session end leave HP unchanged.
- Sessions with official DM summaries, persistent completion dates, and a focused Home view.
- Encounters, character/enemy/NPC participation, physical-dice initiative input, tie priorities, round/turn advancement and rewind, adding/removing combatants, and end encounter. Active encounters retain their order; late arrivals append to the end.
- Enemy HP/AC/notes in a separate DM-only table. DM chooses a public name, HP description/exact textual disclosure, and revealed conditions.
- Private DM messages with multiple recipients, unread badge, history, and recipient-only read acknowledgement. Public announcements live in the campaign journal.
- Shared journal, quests with status, NPCs, locations, and private player notes. Visibility is enforced by RLS.
- Shared/personal inventory, quantity changes, partial transfers, five currencies, and transaction history. Party items can be managed by members; personal items by their owner or DM. Only the DM sees all private character profiles, so assigning to another player's character is a DM workflow.
- Realtime subscriptions, cleanup, reconnect invalidation, plus a 30-second reconciliation refresh for missed/deletion events.
- PWA assets, install icons, responsive desktop/mobile screens, keyboard-accessible dialogs, offline indicator, and read-only local caches.

## Architecture and security

```text
src/
  main.tsx           Auth boundary, app shell, protected DM route
  components/ui.tsx  Forms, dialog, actions, shared feedback
  lib/client.ts     Typed Supabase client
  lib/data.tsx      Query hooks, realtime lifecycle, mutation serialization/cache
  lib/i18n.ts       Shared Italian vocabulary
  lib/rules.ts      Manual-tracking helpers and authorized reference link
  pages/            Home, Character, Combat, Campaign, Inventory, DM, Messages
  types.ts          Database and application row contracts
supabase/migrations/ Full schema, grants, RLS and transactional RPCs
scripts/            Database and hosted-integration verification
tests/              Browser workflow against real SQL via test-only transport
```

Application roles have SELECT access only. Writes use a small set of security-definer functions with fixed search paths, authenticated user checks, ownership checks, and database constraints. Client-supplied roles, campaign IDs, recipient IDs, and character IDs never confer authority by themselves.

`command` locks the campaign for each mutation. Combat, character, resource, journal edit, and inventory updates use version checks where appropriate. A request UUID receipt makes retries idempotent; an ambiguous client network failure retains its request UUID for the same action. All inventory transfer steps and audit records commit together. Multiple-recipient sends are atomic. Campaign creation and joins are transactional but do not use command receipts; after an ambiguous network failure, inspect your campaign list before retrying creation.

RLS protects private messages, hidden records, private character sheets, and enemy secrets. Realtime uses the same SELECT permissions. The DM can view player sheets/resources but cannot view another user's personal notes. `records` unifies journal/quest/NPC/location content to keep the MVP small; references between those records are currently manual text. Conditions and class descriptions deliberately remain manually configured rather than implementing a rules engine.

The hosted security advisor reports the seven intentionally callable SECURITY DEFINER authorization/mutation functions; these perform the explicit permission checks above. The profile trigger is not callable by clients. See [Supabase's function-permission advisory](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable). Supabase's optional leaked-password protection is disabled by default on this project; see [password protection settings](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

Offline snapshots are stored in localStorage under user/campaign keys: campaign metadata, the user's character, resources, sessions and previously loaded shared/own records. Messages and enemy secrets are not persisted offline. Logout clears application snapshots and query memory. Previously downloaded data cannot be remotely revoked on a disconnected device; on reconnection the server rechecks membership and refreshes/clears the cached state. Do not use a shared browser account for confidential campaign material. Edits are disabled offline; unsaved form text remains in the open form until the user closes it. There is no offline mutation queue.

## Verify

```sh
pnpm build
pnpm test
pnpm test:db
pnpm exec playwright install chromium
pnpm test:e2e
```

On Windows with Edge already installed, no browser download is needed:

```powershell
$env:PLAYWRIGHT_EDGE='1'
pnpm test:e2e
```

- Unit tests cover initiative sorting, explicit tie priority, turn wrap/rewind, and HP display bounds.
- `test:db` loads the **actual migration** into PostgreSQL/WASM (PGlite with pgcrypto), switches real PostgreSQL roles/auth identities, and checks authorization plus gameplay transactions. It does not substitute frontend filtering for RLS tests.
- Browser tests exercise registration/login UI, campaign and character creation, HP/resources, sessions/combat, journals, inventory transfers, responsive overflow, and logout. Their HTTP/Auth transport is a test fixture backed by the actual migrated database. They do **not** prove hosted Supabase Auth delivery or real WebSocket synchronization.

For a real hosted test, create/confirm three separate test accounts. Supply `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `TQ_DM_EMAIL`, `TQ_DM_PASSWORD`, `TQ_PLAYER_EMAIL`, `TQ_PLAYER_PASSWORD`, `TQ_OBSERVER_EMAIL`, and `TQ_OBSERVER_PASSWORD` in your shell, then run:

```sh
node --env-file=.env scripts/test-live.mjs
```

This creates a clearly named verification campaign, exercises real login, invitations, RLS, and Realtime with separate clients, and signs the clients out. It leaves its test campaign for inspection; remove it through the Supabase dashboard afterwards. It requires no service-role key. Do not use a production campaign for tests.

## Deliberate MVP limits

- No automated condition expiry or rules engine. Conditions/effects have manual notes and duration reminders; concentration stores a manual effect/start-round/duration description. Verify expiration at the table.
- Multiclass details and record associations use free text; no automatic level calculations or spell preparation.
- No general file attachments, campaign image editor, automatic inventory item merging, member role reassignment, or account/password recovery UI yet.
- Queries load a campaign's visible rows; suited to small private groups. Large histories will need pagination, retention, and more selective invalidation.
- Some Italian screen copy is still colocated with components; shared vocabulary is centralized for a future full English locale.
- Actual iOS/Android installation and email delivery still need device/provider checks. Real Supabase login, Realtime turn delivery, private-message delivery and recipient isolation have been verified with three temporary test accounts on the hosted TableQuest project.

## Rules and attribution

TableQuest reproduces no commercial rulebook passages and includes no licensed rules corpus. Condition names are labels; resource and class mechanics are user configured. The reference link points to the official [D&D 2024 Basic Rules](https://www.dndbeyond.com/sources/dnd/br-2024). D&D and Dungeons & Dragons belong to Wizards of the Coast; this is an unofficial private companion. Before adding SRD text, record the exact version and include the required Creative Commons attribution.

## Roadmap (not unfinished controls)

Full spellbook, advanced optional character sheets, verified 2024 Wild Shape management, consent-based AI summaries, campaign statistics, interactive campaign map, browser push notifications, and session scheduling.

## Calendario della compagnia

Apri Calendario dopo aver scelto la campagna. Ogni membro può indicare per ciascun giorno Disponibile, Forse o Non disponibile, una fascia oraria nello stesso giorno e una nota di massimo 300 caratteri. Gli orari sono riferiti a Europe/Rome. Tutti i membri vedono le risposte; ognuno modifica o rimuove soltanto la propria. I conteggi non implicano sovrapposizione degli orari e non creano automaticamente una sessione. Le modifiche sono sincronizzate via Realtime e disabilitate offline. La migrazione `20261027120000_campaign_calendar.sql` aggiunge la tabella protetta da RLS e mantiene compatibili le operazioni esistenti.

## Tastiera e dettatura

I campi testuali e le note offrono il pulsante Detta nei browser compatibili con SpeechRecognition. La lingua è italiano; le frasi definitive vengono aggiunte al testo esistente e possono essere corrette prima del salvataggio. Ferma dettatura interrompe l’ascolto. Nessun invio automatico, nessun file audio conservato da TableQuest. Il browser può elaborare l’audio attraverso un servizio remoto e richiede il permesso microfono; il supporto varia per browser e dispositivo. In caso di mancato supporto resta la tastiera, incluso il microfono della tastiera di sistema. La dettatura diretta richiede rete. Uscita dal modulo, salvataggio, cambio di campo vocale e pagina nascosta interrompono l’ascolto. Email, password, numeri, date e orari non espongono il pulsante.

## Profili, bestiario e riposi

La scheda usa feet (ft); la migrazione `20261028090000_monsters_portraits_rest.sql` converte i valori precedenti usando la convenzione del gioco 1,5 m = 5 ft. Il riposo lungo ripristina gli HP massimi e le risorse configurate; il breve non modifica gli HP. HP temporanei e condizioni restano gestiti manualmente.

Modifica profilo consente di caricare JPG/PNG/WebP fino a 10 MB, ritagliati al centro e ridotti a 384×384 JPEG. Il ritratto viene salvato come piccola immagine nella scheda protetta dai permessi già esistenti, senza bucket pubblico. Campagna → Aggiungi Mostri è un bestiario privato del DM: nome pubblico, nome reale, HP, AC e note. Aggiungi partecipante → Mostro dalla campagna crea copie indipendenti nello scontro; eliminare un modello non elimina le copie già in gioco.

Personaggi, Luoghi e Note personali non hanno controlli di stato. Nel calendario, i giorni con almeno una risposta sono evidenziati e il riepilogo del giorno appare soltanto se esiste una risposta; il modulo per inserire la propria disponibilità resta sempre accessibile.
