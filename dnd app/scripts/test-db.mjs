import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
// Real PostgreSQL in WASM: the migration and policies run unchanged.
const db = new PGlite({ extensions: { pgcrypto } });
await db.exec(
  `create schema auth; create schema extensions; create role anon; create role authenticated; create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}'); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema public,auth,extensions to anon,authenticated; grant execute on function auth.uid() to anon,authenticated; create publication supabase_realtime;`,
);
await db.exec(
  await readFile(
    new URL(
      "../supabase/migrations/20261027071056_tablequest_initial.sql",
      import.meta.url,
    ),
    "utf8",
  ),
);
await db.exec(
  await readFile(
    new URL(
      "../supabase/migrations/20261027071417_restrict_profile_trigger.sql",
      import.meta.url,
    ),
    "utf8",
  ),
);
const ids = {
  dm: randomUUID(),
  alice: randomUUID(),
  bob: randomUUID(),
  outsider: randomUUID(),
};
for (const id of Object.values(ids))
  await db.query("insert into auth.users(id) values($1)", [id]);
async function as(user) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    ids[user] || "",
  ]);
  await db.exec(`set role ${user ? "authenticated" : "anon"}`);
}
async function scalar(sql, args = []) {
  return Object.values((await db.query(sql, args)).rows[0] || {})[0];
}
const cmd = (campaign, action, data = {}, request = randomUUID()) =>
  scalar("select public.command($1,$2,$3,$4)", [
    campaign,
    action,
    JSON.stringify(data),
    request,
  ]);
let count = 0;
async function test(name, fn) {
  await fn();
  count++;
  console.log(`PASS ${name}`);
}
const denied = async (fn, pattern) => {
  await assert.rejects(fn, pattern);
};
await as("dm");
await test("profile trigger cannot be invoked by clients", async () =>
  assert.equal(
    await scalar(
      "select has_function_privilege('authenticated','public.handle_new_user()','execute')",
    ),
    false,
  ));
await scalar("select save_profile($1,$2)", ["Dungeon Master", "shield"]);
const campaign = await scalar("select create_campaign($1,$2)", [
  "La compagnia",
  "Test",
]);
await test("creator becomes DM", async () =>
  assert.equal(
    await scalar("select role from campaign_members where campaign_id=$1", [
      campaign,
    ]),
    "dm",
  ));
const { token } = await cmd(campaign, "invite");
await as("alice");
await test("invalid invitation rejected", () =>
  denied(() => scalar("select join_campaign($1)", ["wrong"]), /Invito/));
await test("secure invite joins player", async () => {
  assert.equal(await scalar("select join_campaign($1)", [token]), campaign);
  assert.equal(
    await scalar("select role from campaign_members where user_id=$1", [
      ids.alice,
    ]),
    "player",
  );
});
await as("bob");
await scalar("select join_campaign($1)", [token]);
await as("outsider");
const other = await scalar("select create_campaign($1,$2)", ["Other", ""]);
await test("unrelated campaign invisible", async () =>
  assert.equal(
    await scalar("select count(*)::int from campaigns where id=$1", [campaign]),
    0,
  ));
await test("non-member cannot invoke campaign actions", () =>
  denied(
    () => cmd(campaign, "session_start", { title: "Hack" }),
    /Accesso negato/,
  ));
await as("alice");
await test("cannot grant self DM role directly", () =>
  denied(
    () =>
      db.query("update campaign_members set role='dm' where user_id=$1", [
        ids.alice,
      ]),
    /permission denied/,
  ));
await test("player cannot start session", () =>
  denied(
    () => cmd(campaign, "session_start", { title: "Hack" }),
    /Dungeon Master/,
  ));
const base = {
  name: "Kaelen",
  species: "Elfo",
  classes: "Druido 4 / Barbaro 1",
  level: 5,
  max_hp: 45,
  armor_class: 16,
  initiative_modifier: 2,
  movement_speed: 9,
  notes: "Private sheet",
};
await cmd(campaign, "character_save", base);
const ch = await scalar("select id from characters");
await test("HP and temporary HP persist", async () => {
  await cmd(campaign, "character_state", {
    id: ch,
    version: 0,
    current_hp: 38,
    temporary_hp: 5,
  });
  assert.equal(
    await scalar("select current_hp from characters where id=$1", [ch]),
    38,
  );
  assert.equal(
    await scalar("select temporary_hp from characters where id=$1", [ch]),
    5,
  );
});
await test("negative HP rejected", () =>
  denied(
    () =>
      cmd(campaign, "character_state", { id: ch, version: 1, current_hp: -1 }),
    /check constraint/,
  ));
await test("stale HP write rejected", () =>
  denied(
    () =>
      cmd(campaign, "character_state", { id: ch, version: 0, current_hp: 1 }),
    /aggiornati/,
  ));
await test("conditions add and remove", async () => {
  await cmd(campaign, "character_state", {
    id: ch,
    version: 1,
    conditions: [{ name: "Prone", notes: "", duration: "Fine turno" }],
  });
  assert.equal(
    (await scalar("select conditions from characters where id=$1", [ch]))
      .length,
    1,
  );
  await cmd(campaign, "character_state", {
    id: ch,
    version: 2,
    conditions: [],
  });
});
await cmd(campaign, "resource_add", {
  id: ch,
  name: "Rage",
  maximum_uses: 2,
  recovery_type: "long",
});
let resource = await scalar("select id from character_resources");
await test("resource uses and configured rest recovery", async () => {
  await cmd(campaign, "resource_use", {
    id: resource,
    version: 0,
    remaining_uses: 1,
  });
  await cmd(campaign, "rest", { id: ch, type: "short" });
  assert.equal(
    await scalar("select remaining_uses from character_resources"),
    1,
  );
  await cmd(campaign, "rest", { id: ch, type: "long" });
  assert.equal(
    await scalar("select remaining_uses from character_resources"),
    2,
  );
});
await as("bob");
await cmd(campaign, "character_save", { ...base, name: "Tharok" });
const bobCh = await scalar("select id from characters");
await test("private character hidden from another player", async () =>
  assert.equal(
    await scalar("select count(*)::int from characters where id=$1", [ch]),
    0,
  ));
await test("cannot mutate another character", () =>
  denied(
    () =>
      cmd(campaign, "character_state", { id: ch, version: 3, current_hp: 1 }),
    /Accesso negato/,
  ));
await test("cannot mutate another character resources", () =>
  denied(
    () =>
      cmd(campaign, "resource_use", {
        id: resource,
        version: 2,
        remaining_uses: 0,
      }),
    /Accesso negato/,
  ));
await as("dm");
await cmd(campaign, "session_start", { title: "Il tempio" });
await cmd(campaign, "encounter_create", { name: "Imboscata" });
let enc = await scalar("select id from encounters");
await cmd(campaign, "combatant_add", {
  id: enc,
  character_id: ch,
  initiative: 21,
});
await cmd(campaign, "combatant_add", {
  id: enc,
  character_id: bobCh,
  initiative: 16,
});
await cmd(campaign, "combatant_add", {
  id: enc,
  name: "Creatura",
  real_name: "Goblin",
  max_hp: 10,
  armor_class: 13,
  initiative: 18,
});
await test("enemy statistics stored in separate private table", async () =>
  assert.equal(await scalar("select count(*)::int from combatant_secrets"), 1));
await as("alice");
await test("players cannot read enemy secrets", async () =>
  assert.equal(await scalar("select count(*)::int from combatant_secrets"), 0));
const myCombatant = await scalar(
  "select id from combatants where character_id=$1",
  [ch],
);
const bobCombatant = await scalar(
  "select id from combatants where character_id=$1",
  [bobCh],
);
await test("player enters own physical dice result", async () => {
  await cmd(campaign, "initiative", { id: myCombatant, initiative: 22 });
  assert.equal(
    await scalar("select initiative from combatants where id=$1", [
      myCombatant,
    ]),
    22,
  );
});
await test("player cannot enter another player initiative", () =>
  denied(
    () => cmd(campaign, "initiative", { id: bobCombatant, initiative: 99 }),
    /Accesso negato/,
  ));
await as("dm");
await cmd(campaign, "encounter_start", { id: enc, version: 4 });
await test("initiative is sorted", async () =>
  assert.deepEqual(
    (
      await db.query("select initiative from combatants order by turn_order")
    ).rows.map((r) => r.initiative),
    [22, 18, 16],
  ));
await test("turn advances once, retries are idempotent", async () => {
  const request = randomUUID();
  await cmd(campaign, "turn", { id: enc, version: 5, direction: 1 }, request);
  await cmd(campaign, "turn", { id: enc, version: 5, direction: 1 }, request);
  assert.equal(await scalar("select current_turn from encounters"), 1);
});
await test("duplicate advance with different request is rejected", () =>
  denied(
    () => cmd(campaign, "turn", { id: enc, version: 5, direction: 1 }),
    /già aggiornato/,
  ));
await test("round increments and previous turn works", async () => {
  await cmd(campaign, "turn", { id: enc, version: 6, direction: 1 });
  await cmd(campaign, "turn", { id: enc, version: 7, direction: 1 });
  assert.equal(await scalar("select current_round from encounters"), 2);
  assert.equal(await scalar("select current_turn from encounters"), 0);
  await cmd(campaign, "turn", { id: enc, version: 8, direction: -1 });
  assert.equal(await scalar("select current_round from encounters"), 1);
  assert.equal(await scalar("select current_turn from encounters"), 2);
});
await as("alice");
await test("player cannot advance encounter", () =>
  denied(
    () => cmd(campaign, "turn", { id: enc, version: 9, direction: 1 }),
    /Dungeon Master/,
  ));
await as("dm");
await cmd(campaign, "message_send", {
  recipients: [ids.alice],
  content: "Un simbolo nascosto",
});
const msg = await scalar("select id from private_messages");
await cmd(campaign, "record_save", {
  kind: "quest",
  title: "Secret quest",
  content: "Secret",
  visibility: "dm",
  status: "active",
});
await cmd(campaign, "record_save", {
  kind: "npc",
  title: "Hidden NPC",
  content: "Secret",
  visibility: "dm",
  status: "active",
});
await as("bob");
await test("other player cannot read private message", async () =>
  assert.equal(await scalar("select count(*)::int from private_messages"), 0));
await test("hidden DM information inaccessible", async () =>
  assert.equal(await scalar("select count(*)::int from records"), 0));
await test("player cannot send messages as DM", () =>
  denied(
    () =>
      cmd(campaign, "message_send", {
        recipients: [ids.alice],
        content: "Forged",
      }),
    /Dungeon Master/,
  ));
await as("alice");
await test("recipient reads and marks message", async () => {
  assert.equal(
    await scalar("select content from private_messages"),
    "Un simbolo nascosto",
  );
  await cmd(campaign, "message_read", { id: msg });
  assert.equal(await scalar("select is_read from private_messages"), true);
});
await cmd(campaign, "record_save", {
  kind: "journal",
  title: "Scoperta",
  content: "Abbiamo trovato il tempio",
  visibility: "shared",
  status: "active",
});
await cmd(campaign, "record_save", {
  kind: "note",
  title: "My secret",
  content: "Secret",
  visibility: "personal",
  status: "active",
});
await as("bob");
await test("shared journal visible but personal note private", async () =>
  assert.deepEqual(
    (await db.query("select title from records")).rows.map((r) => r.title),
    ["Scoperta"],
  ));
await cmd(campaign, "item_add", {
  name: "Pozione",
  description: "",
  quantity: 4,
  item_type: "Pozione",
});
const item = await scalar("select id from inventory_items");
await test("negative inventory rejected", () =>
  denied(
    () =>
      cmd(campaign, "item_quantity", { id: item, version: 0, quantity: -1 }),
    /check constraint/,
  ));
await test("inventory transfer is atomic and idempotent", async () => {
  const request = randomUUID();
  await cmd(
    campaign,
    "item_transfer",
    { id: item, version: 0, quantity: 2, character_id: bobCh },
    request,
  );
  await cmd(
    campaign,
    "item_transfer",
    { id: item, version: 0, quantity: 2, character_id: bobCh },
    request,
  );
  assert.equal(
    await scalar("select sum(quantity)::int from inventory_items"),
    4,
  );
  assert.equal(
    await scalar("select quantity from inventory_items where id=$1", [item]),
    2,
  );
});
await test("overdraw transfer rejected", () =>
  denied(
    () =>
      cmd(campaign, "item_transfer", {
        id: item,
        version: 1,
        quantity: 3,
        character_id: bobCh,
      }),
    /non valido/,
  ));
await test("currency rejects negative balance", () =>
  denied(
    () => cmd(campaign, "currency", { denomination: "GP", delta: -1 }),
    /check constraint/,
  ));
await test("currency and audit history persist", async () => {
  await cmd(campaign, "currency", { denomination: "GP", delta: 850 });
  assert.equal(
    await scalar("select amount from currency where denomination='GP'"),
    850,
  );
  assert.ok(
    (await scalar("select count(*)::int from inventory_transactions")) >= 3,
  );
});
await as("dm");
await test("session end preserves character and inventory state", async () => {
  await cmd(campaign, "session_end");
  assert.equal(await scalar("select status from encounters"), "completed");
  assert.equal(await scalar("select status from sessions"), "completed");
  assert.equal(
    await scalar("select current_hp from characters where id=$1", [ch]),
    38,
  );
  assert.equal(
    await scalar("select sum(quantity)::int from inventory_items"),
    4,
  );
});
await cmd(campaign, "revoke_invite");
await as("outsider");
await test("revoked invitation rejected", () =>
  denied(() => scalar("select join_campaign($1)", [token]), /Invito/));
await as("dm");
await cmd(campaign, "remove_member", { id: ids.bob });
await as("bob");
await test("removed member loses all campaign reads", async () => {
  assert.equal(await scalar("select count(*)::int from campaigns"), 0);
  assert.equal(await scalar("select count(*)::int from inventory_items"), 0);
  assert.equal(await scalar("select count(*)::int from records"), 0);
});
await as("");
await test("unauthenticated campaign access rejected", () =>
  denied(() => db.query("select * from campaigns"), /permission denied/));
await test("unauthenticated RPC rejected", () =>
  denied(
    () => scalar("select create_campaign($1,$2)", ["hack", ""]),
    /permission denied/,
  ));
console.log(`\n${count} database integration and security tests passed.`);
await db.close();
