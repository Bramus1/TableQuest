import { test, expect, type BrowserContext } from "@playwright/test";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";

// Browser tests use actual migration/RLS with a test-only HTTP/Auth transport.
// They do NOT assert real Supabase Auth, WebSocket delivery, or hosted connectivity.
let db: PGlite;
let sequence: Promise<unknown> = Promise.resolve();
const accounts = new Map<
  string,
  { id: string; email: string; password: string; name: string }
>();
async function attach(context: BrowserContext) {
  await context.route("http://127.0.0.1:54321/**", async (route) => {
    const previous = sequence;
    let release!: () => void;
    sequence = new Promise((r) => (release = r));
    await previous;
    try {
      const request = route.request();
      const url = new URL(request.url());
      const path = url.pathname;
      const body = request.postDataJSON() || {};
      const bearer = request.headers().authorization?.replace("Bearer ", "");
      let account = [...accounts.values()].find((a) => a.id === bearer);
      let result: unknown;
      const user = (a: NonNullable<typeof account>) => ({
        id: a.id,
        email: a.email,
        aud: "authenticated",
        role: "authenticated",
        created_at: new Date().toISOString(),
        app_metadata: { provider: "email" },
        user_metadata: { display_name: a.name },
      });
      if (path.endsWith("/signup")) {
        const a = {
          id: randomUUID(),
          email: body.email,
          password: body.password,
          name: body.data?.display_name || "Avventuriero",
        };
        accounts.set(a.email, a);
        await db.exec("reset role");
        await db.query(
          "insert into auth.users(id,raw_user_meta_data) values($1,$2)",
          [a.id, JSON.stringify({ display_name: a.name })],
        );
        result = { user: user(a), session: null };
      } else if (path.endsWith("/token")) {
        account = accounts.get(body.email);
        if (!account || account.password !== body.password)
          throw new Error("Credenziali non valide");
        result = {
          access_token: account.id,
          refresh_token: account.id,
          expires_in: 3600,
          token_type: "bearer",
          user: user(account),
        };
      } else if (path.endsWith("/logout")) result = {};
      else if (path.endsWith("/user")) {
        if (!account) throw new Error("Unauthorized");
        result = user(account);
      } else {
        if (!account) throw new Error("Unauthorized");
        await db.exec("reset role");
        await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
          account.id,
        ]);
        await db.exec("set role authenticated");
        if (path.includes("/rpc/")) {
          const name = path.split("/").pop()!;
          const functions: Record<string, string[]> = {
            create_campaign: ["p_name", "p_description"],
            join_campaign: ["p_token"],
            save_profile: ["p_name", "p_avatar"],
            command: ["p_campaign", "p_action", "p_data", "p_request"],
          };
          const args = functions[name];
          if (!args) throw new Error("Unknown RPC");
          const values = args.map((k) =>
            typeof body[k] === "object" ? JSON.stringify(body[k]) : body[k],
          );
          const response = await db.query(
            `select public.${name}(${args.map((_, i) => `$${i + 1}`).join(",")}) as result`,
            values,
          );
          result = response.rows[0]?.result ?? null;
        } else {
          const table = path.split("/").pop()!;
          const tables = [
            "profiles",
            "campaigns",
            "campaign_members",
            "campaign_invites",
            "characters",
            "character_resources",
            "sessions",
            "encounters",
            "combatants",
            "combatant_secrets",
            "records",
            "private_messages",
            "inventory_items",
            "inventory_transactions",
            "currency",
          ];
          if (!tables.includes(table)) throw new Error("Unknown table");
          const campaign = url.searchParams
            .get("campaign_id")
            ?.replace("eq.", "");
          result = (
            await db.query(
              `select * from public.${table}${campaign ? " where campaign_id=$1" : ""}`,
              campaign ? [campaign] : [],
            )
          ).rows;
        }
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(result),
      });
    } catch (error) {
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({
          message: (error as Error).message,
          error_description: (error as Error).message,
        }),
      });
    } finally {
      release();
    }
  });
}
test.beforeEach(async ({ context }) => {
  accounts.clear();
  db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(
    `create schema auth;create schema extensions;create role anon;create role authenticated;create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth,extensions to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;create publication supabase_realtime;`,
  );
  await db.exec(
    await readFile(
      "supabase/migrations/20261027071056_tablequest_initial.sql",
      "utf8",
    ),
  );
  await db.exec(
    await readFile(
      "supabase/migrations/20261027071417_restrict_profile_trigger.sql",
      "utf8",
    ),
  );
  await attach(context);
});
test.afterEach(async () => {
  await sequence;
  await db.close();
});

test("invitation joining, private messages, and offline read-only character", async ({
  page,
  browser,
}) => {
  for (const [email, name] of [
    ["dm@example.test", "Narratore"],
    ["player@example.test", "Luca"],
  ]) {
    const account = {
      id: randomUUID(),
      email,
      password: "tablequest-test",
      name,
    };
    accounts.set(email, account);
    await db.exec("reset role");
    await db.query(
      "insert into auth.users(id,raw_user_meta_data) values($1,$2)",
      [account.id, JSON.stringify({ display_name: name })],
    );
  }
  await page.goto("/");
  await page.getByLabel("Email", { exact: true }).fill("dm@example.test");
  await page.getByLabel("Password", { exact: true }).fill("tablequest-test");
  await page.getByRole("button", { name: "Entra nella compagnia" }).click();
  await page.getByLabel("Nome della campagna").fill("Le rovine");
  await page.getByRole("button", { name: "Crea la tua campagna" }).click();
  await expect(
    page.getByRole("heading", { name: "Le rovine", exact: true }),
  ).toBeVisible();
  await page.goto("/dm");
  await page.getByRole("button", { name: "Genera invito" }).click();
  await expect(page.locator(".invite-code code")).toBeVisible();
  const token = await page.locator(".invite-code code").innerText();
  const context = await browser.newContext({
    baseURL: "http://127.0.0.1:5174",
  });
  await attach(context);
  const player = await context.newPage();
  try {
    await player.goto("/");
    await player
      .getByLabel("Email", { exact: true })
      .fill("player@example.test");
    await player
      .getByLabel("Password", { exact: true })
      .fill("tablequest-test");
    await player.getByRole("button", { name: "Entra nella compagnia" }).click();
    await player.getByRole("button", { name: "Unisciti con codice" }).click();
    await player
      .getByLabel("Codice d’invito del Dungeon Master")
      .fill("INVALID");
    await player
      .getByRole("button", { name: "Unisciti alla compagnia" })
      .click();
    await expect(player.getByRole("alert")).toContainText("Invito non valido");
    await player.getByLabel("Codice d’invito del Dungeon Master").fill(token);
    await player
      .getByRole("button", { name: "Unisciti alla compagnia" })
      .click();
    await expect(
      player.getByRole("heading", { name: "Le rovine", exact: true }),
    ).toBeVisible();
    await page.goto("/messages");
    await page.getByRole("button", { name: "Nuovo messaggio" }).click();
    await page.getByLabel("Luca", { exact: true }).check();
    await page
      .getByLabel("Il messaggio", { exact: true })
      .fill("Una runa nascosta dietro la porta.");
    await page.getByRole("button", { name: "Invia messaggio privato" }).click();
    await expect(
      page.getByText("Una runa nascosta dietro la porta.", { exact: true }),
    ).toBeVisible();
    await player.goto("/messages");
    await expect(
      player.getByText("Una runa nascosta dietro la porta.", { exact: true }),
    ).toBeVisible();
    await player.getByRole("button", { name: "Segna come letto" }).click();
    await expect(player.getByText("✓ Letto", { exact: true })).toBeVisible();
    await player.goto("/character");
    await player.getByLabel("Nome del personaggio").fill("Tharok");
    await player.getByRole("button", { name: "Salva", exact: true }).click();
    await expect(
      player.getByRole("heading", { name: "Tharok", exact: true }),
    ).toBeVisible();
    await context.setOffline(true);
    await expect(player.locator(".offline-banner")).toBeVisible();
    await expect(
      player.getByRole("heading", { name: "Tharok", exact: true }),
    ).toBeVisible();
    await expect(
      player.getByRole("button", { name: "HP", exact: true }).first(),
    ).toBeDisabled();
    await player.getByRole("button", { name: "Modifica profilo" }).click();
    await expect(
      player
        .getByRole("dialog")
        .getByRole("button", { name: "Salva", exact: true }),
    ).toBeDisabled();
  } finally {
    await context.setOffline(false);
    await context.close();
  }
});
test("registration, login, campaign, character, combat, journal, inventory and logout", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Bentornato, avventuriero" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "La tua prima avventura? Registrati" })
    .click();
  await page.getByLabel("Come ti chiami?").fill("Giulia");
  await page.getByLabel("Email", { exact: true }).fill("giulia@example.test");
  await page.getByLabel("Password", { exact: true }).fill("tablequest-test");
  await page.getByRole("button", { name: "Crea account", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(
    "Controlla la tua email",
  );
  await page
    .getByRole("button", { name: "Hai già un account? Accedi" })
    .click();
  await page.getByRole("button", { name: "Entra nella compagnia" }).click();
  await expect(
    page.getByRole("heading", { name: "Ogni avventura ha un inizio." }),
  ).toBeVisible();
  await page.getByLabel("Nome della campagna").fill("Il regno dimenticato");
  await page
    .getByLabel("Una breve introduzione")
    .fill("Una compagnia tra antiche rovine.");
  await page.getByRole("button", { name: "Crea la tua campagna" }).click();
  await expect(
    page.getByRole("heading", { name: "Il regno dimenticato", exact: true }),
  ).toBeVisible();
  await page.goto("/character");
  await page.getByLabel("Nome del personaggio").fill("Kaelen");
  await page.getByLabel("Classi, livelli").fill("Druido 4 / Barbaro 1");
  await page.getByLabel("Livello totale").fill("5");
  await page.getByLabel("HP massimi").fill("45");
  await page.getByRole("button", { name: "Salva", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Kaelen", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Imposta HP e HP temporanei" })
    .click();
  await page.getByLabel("HP attuali").fill("38");
  await page.getByLabel("HP temporanei", { exact: true }).fill("5");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Salva", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".hp-big strong")).toHaveText("38");
  await page.getByRole("button", { name: "Aggiungi risorsa" }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Nome", { exact: true })
    .fill("Wild Shape");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Salva", exact: true })
    .click();
  await expect(page.getByText("Wild Shape", { exact: true })).toBeVisible();
  await page.goto("/dm");
  await page.getByRole("button", { name: "Avvia sessione" }).click();
  await page
    .getByLabel("Titolo", { exact: true })
    .fill("Il tempio dimenticato");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Avvia sessione" })
    .click();
  await page.getByRole("button", { name: "Prepara uno scontro" }).click();
  await page.getByLabel("Titolo", { exact: true }).fill("Imboscata");
  await page.getByRole("button", { name: "Crea scontro" }).click();
  await page.goto("/combat");
  await page.getByRole("button", { name: "Partecipante", exact: true }).click();
  await page
    .getByLabel("Personaggio", { exact: true })
    .selectOption({ label: "Kaelen" });
  await page
    .getByRole("dialog")
    .getByLabel("Initiative", { exact: true })
    .first()
    .fill("21");
  await page
    .getByRole("button", { name: "Aggiungi personaggio", exact: true })
    .click();
  await page.getByRole("button", { name: "Inizia combattimento" }).click();
  await expect(page.getByText("È IL TUO TURNO")).toBeVisible();
  await page.getByRole("button", { name: "Prossimo turno" }).click();
  await expect(page.locator(".round strong")).toHaveText("2");
  await page.goto("/campaign");
  await page.getByRole("button", { name: "Aggiungi", exact: true }).click();
  await page
    .getByLabel("Titolo", { exact: true })
    .fill("Il simbolo sulla porta");
  await page
    .getByLabel("Storia, descrizione e note")
    .fill("Una runa antica conduce al tempio.");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Salva", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Il simbolo sulla porta" }),
  ).toBeVisible();
  await page.goto("/inventory");
  await page.getByRole("button", { name: "Aggiungi oggetto" }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Nome", { exact: true })
    .fill("Pozione di guarigione");
  await page.getByLabel("Quantità", { exact: true }).fill("4");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Salva", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Pozione di guarigione" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Trasferisci Pozione di guarigione" })
    .click();
  await page.getByLabel("Nuovo proprietario").selectOption({ label: "Kaelen" });
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Salva", exact: true })
    .click();
  await page.getByRole("button", { name: "Il mio zaino", exact: true }).click();
  await expect(page.locator(".item-controls strong")).toHaveText("1");
  await page.goto("/");
  await page.screenshot({
    path: `test-results/home-${testInfo.project.name}.png`,
    fullPage: true,
  });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
  await page
    .getByRole("button", {
      name: testInfo.project.name === "mobile" ? "Menu" : "Profilo",
      exact: true,
    })
    .click();
  if (testInfo.project.name === "mobile")
    await page.getByRole("button", { name: "Impostazioni account" }).click();
  await page.getByRole("button", { name: "Esci dall’account" }).click();
  await expect(
    page.getByRole("heading", { name: "Bentornato, avventuriero" }),
  ).toBeVisible();
  await page.goto("/combat");
  await expect(
    page.getByRole("heading", { name: "Bentornato, avventuriero" }),
  ).toBeVisible();
});
