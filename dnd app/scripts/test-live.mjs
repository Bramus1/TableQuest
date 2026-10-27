import { createClient } from "@supabase/supabase-js";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
const env = process.env;
for (const key of [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
  "TQ_DM_EMAIL",
  "TQ_DM_PASSWORD",
  "TQ_PLAYER_EMAIL",
  "TQ_PLAYER_PASSWORD",
  "TQ_OBSERVER_EMAIL",
  "TQ_OBSERVER_PASSWORD",
])
  if (!env[key])
    throw new Error(
      `Set ${key} before running the hosted integration check. See README.`,
    );
const clients = ["DM", "PLAYER", "OBSERVER"].map(() =>
  createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  }),
);
const [dm, player, observer] = clients;
const identities = [];
const channels = [];
async function rpc(client, name, args) {
  const { data, error } = await client.rpc(name, args);
  if (error) throw error;
  return data;
}
let campaign;
const command = (client, action, data = {}) =>
  rpc(client, "command", {
    p_campaign: campaign,
    p_action: action,
    p_data: data,
    p_request: randomUUID(),
  });
async function rows(client, table) {
  const { data, error } = await client
    .from(table)
    .select("*")
    .eq("campaign_id", campaign);
  if (error) throw error;
  return data;
}
async function subscribe(client, table, callback) {
  const {
    data: { session },
  } = await client.auth.getSession();
  await client.realtime.setAuth(session.access_token);
  const channel = client.channel(`verification-${randomUUID()}`).on(
    "postgres_changes",
    {
      schema: "public",
      table,
      event: "*",
      filter: `campaign_id=eq.${campaign}`,
    },
    (payload) => {
      console.log("Realtime change:", table, payload.eventType);
      callback(payload);
    },
  );
  channel.on("system", {}, (payload) =>
    console.log("Realtime system:", payload.status, payload.message),
  );
  channels.push([client, channel]);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Realtime subscribe timeout")),
      20000,
    );
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        clearTimeout(timer);
        resolve();
      }
      if (status === "CHANNEL_ERROR") {
        clearTimeout(timer);
        reject(new Error("Realtime subscription failed"));
      }
    });
  });
}
try {
  for (const [i, role] of ["DM", "PLAYER", "OBSERVER"].entries()) {
    const { data, error } = await clients[i].auth.signInWithPassword({
      email: env[`TQ_${role}_EMAIL`],
      password: env[`TQ_${role}_PASSWORD`],
    });
    if (error) throw error;
    identities.push(data.user.id);
  }
  assert.equal(new Set(identities).size, 3, "Use three distinct accounts");
  console.log("PASS real Supabase login for three accounts");
  campaign = await rpc(dm, "create_campaign", {
    p_name: `TableQuest verification ${new Date().toISOString()}`,
    p_description: "Disposable hosted integration test",
  });
  console.log("Created verification campaign:", campaign);
  const { token } = await command(dm, "invite");
  await rpc(player, "join_campaign", { p_token: token });
  await rpc(observer, "join_campaign", { p_token: token });
  console.log("PASS create campaign and invitations");
  await command(dm, "session_start", { title: "Verification session" });
  await command(dm, "encounter_create", { name: "Verification encounter" });
  const encounter = (await rows(dm, "encounters"))[0];
  await command(dm, "combatant_add", {
    id: encounter.id,
    name: "Unknown creature",
    real_name: "Private creature",
    max_hp: 10,
    armor_class: 12,
    initiative: 18,
  });
  const prepared = (await rows(dm, "encounters"))[0];
  await command(dm, "encounter_start", {
    id: encounter.id,
    version: prepared.version,
  });
  assert.equal((await rows(player, "combatant_secrets")).length, 0);
  console.log("PASS hidden enemy RLS");
  let receivedResolve;
  const received = new Promise((resolve) => {
    receivedResolve = resolve;
  });
  await subscribe(player, "encounters", (payload) => {
    if (payload.new?.current_round === 2) receivedResolve();
  });
  const current = (await rows(dm, "encounters"))[0];
  await command(dm, "turn", {
    id: encounter.id,
    version: current.version,
    direction: 1,
  });
  let timer;
  try {
    await Promise.race([
      received,
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("Turn did not arrive over Realtime")),
          15000,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
  console.log("PASS real multiplayer turn synchronization");
  let privateResolve;
  const privateReceived = new Promise((resolve) => {
    privateResolve = resolve;
  });
  await subscribe(player, "private_messages", (payload) => {
    if (payload.new?.content === "Only the player sees this") privateResolve();
  });
  await command(dm, "message_send", {
    recipients: [identities[1]],
    content: "Only the player sees this",
  });
  try {
    await Promise.race([
      privateReceived,
      new Promise((_, reject) => {
        timer = setTimeout(
          () =>
            reject(new Error("Private message did not arrive over Realtime")),
          15000,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
  assert.equal((await rows(player, "private_messages")).length, 1);
  assert.equal((await rows(observer, "private_messages")).length, 0);
  console.log("PASS private message realtime delivery and recipient isolation");
  const forbidden = await player.rpc("command", {
    p_campaign: campaign,
    p_action: "session_end",
    p_data: {},
    p_request: randomUUID(),
  });
  assert.ok(forbidden.error);
  console.log("PASS player cannot perform DM operation");
  await command(dm, "session_end");
  console.log("PASS session completion");
  console.log(
    "Hosted verification passed. Inspect/remove the verification campaign in Supabase:",
    campaign,
  );
} finally {
  for (const [client, channel] of channels) await client.removeChannel(channel);
  for (const client of clients) await client.auth.signOut();
}
