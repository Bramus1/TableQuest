import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { User, RealtimeChannel } from "@supabase/supabase-js";
import { db } from "./client";
import type { Tables } from "../types";
type Context = {
  user: User;
  campaignId: string;
  setCampaignId: (id: string) => void;
  online: boolean;
  busy: boolean;
  live: string;
  run: (action: string, data?: object) => Promise<{ token?: string }>;
  notice: string;
  error: string;
  setError: (s: string) => void;
};
export const AppContext = createContext<Context>(null!);
export const useApp = () => useContext(AppContext);
const safeCache = new Set([
  "characters",
  "character_resources",
  "records",
  "sessions",
  "campaigns",
]);
export function useRows<K extends keyof Tables>(table: K, campaign = true) {
  const { user, campaignId, online, setError } = useApp();
  const key = `tq:${user.id}:${campaign ? campaignId : "all"}:${table}`;
  const result = useQuery<Tables[K][]>({
    queryKey: [user.id, campaign ? campaignId : "all", table],
    enabled: !campaign || !!campaignId,
    queryFn: async () => {
      if (!online) {
        try {
          return JSON.parse(localStorage.getItem(key) || "[]") as Tables[K][];
        } catch {
          return [];
        }
      }
      let query = db!.from(table).select("*");
      if (campaign) query = query.eq("campaign_id" as never, campaignId);
      const { data, error } = await query;
      if (error) throw error;
      const rows = data as unknown as Tables[K][];
      if (safeCache.has(table)) {
        const cache =
          table === "records"
            ? (rows as Tables["records"][]).filter(
                (r) => r.visibility === "shared" || r.author_id === user.id,
              )
            : table === "characters"
              ? (rows as Tables["characters"][]).filter(
                  (r) => r.user_id === user.id,
                )
              : rows;
        try {
          localStorage.setItem(key, JSON.stringify(cache));
        } catch {
          /* Cache optional; never prevents an online save. */
        }
      }
      return rows;
    },
    networkMode: "always",
    staleTime: 10000,
    retry: 1,
  });
  useEffect(() => {
    if (result.error)
      setError(`Caricamento non riuscito: ${result.error.message}`);
  }, [result.error, setError]);
  return result;
}
export function clearCache() {
  for (const key of Object.keys(localStorage))
    if (key.startsWith("tq:")) localStorage.removeItem(key);
}
export function DataProvider({
  user,
  children,
}: {
  user: User;
  children: ReactNode;
}) {
  const qc = useQueryClient();
  const [campaignId, choose] = useState(
    () => localStorage.getItem(`tq:${user.id}:selected`) || "",
  );
  const [online, setOnline] = useState(navigator.onLine);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const requests = useRef(new Map<string, string>());
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [live, setLive] = useState("Connessione…");
  useEffect(() => {
    const update = () => {
      setOnline(navigator.onLine);
    };
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, [qc]);
  useEffect(() => {
    void qc.invalidateQueries();
  }, [online, qc]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 3500);
    return () => clearTimeout(t);
  }, [notice]);
  useEffect(() => {
    if (!campaignId || !online) return;
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(
        () => void qc.invalidateQueries({ queryKey: [user.id] }),
        120,
      );
    };
    let channel: RealtimeChannel | undefined;
    let disposed = false;
    const connect = async () => {
      const {
        data: { session },
        error,
      } = await db!.auth.getSession();
      if (disposed) return;
      if (error || !session)
        throw new Error("Sessione scaduta. Accedi di nuovo.");
      // Ensure the JWT has reached Realtime before joining RLS-filtered streams.
      await db!.realtime.setAuth(session.access_token);
      if (disposed) return;
      channel = db!.channel(`campaign:${campaignId}`);
      for (const table of [
        "campaign_members",
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
        "availability",
        "monsters",
        "currency",
      ])
        channel = channel.on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table,
            filter: `campaign_id=eq.${campaignId}`,
          },
          refresh,
        );
      channel.subscribe((status) => {
        if (disposed) return;
        setLive(status === "SUBSCRIBED" ? "In tempo reale" : "Riconnessione…");
        if (status === "SUBSCRIBED") refresh();
      });
    };
    void connect().catch(() => {
      if (!disposed) setLive("Riconnessione…");
    });
    const poll = setInterval(refresh, 30000);
    return () => {
      disposed = true;
      clearTimeout(timer);
      clearInterval(poll);
      if (channel) void db!.removeChannel(channel);
    };
  }, [campaignId, online, qc, user.id]);
  const setCampaignId = (id: string) => {
    choose(id);
    localStorage.setItem(`tq:${user.id}:selected`, id);
    setError("");
  };
  async function run(action: string, data: object = {}) {
    if (!online) throw new Error("Sei offline. Riconnettiti per salvare.");
    if (lock.current) throw new Error("Attendi il salvataggio in corso.");
    lock.current = true;
    setBusy(true);
    setError("");
    const signature = campaignId + action + JSON.stringify(data);
    try {
      const request = requests.current.get(signature) || crypto.randomUUID();
      requests.current.set(signature, request);
      const { data: result, error: e } = await db!.rpc("command", {
        p_campaign: campaignId,
        p_action: action,
        p_data: data,
        p_request: request,
      });
      if (e) {
        if (e.code) requests.current.delete(signature);
        throw e;
      }
      requests.current.delete(signature);
      await qc.invalidateQueries({ queryKey: [user.id, campaignId] });
      setNotice("Salvato al tavolo");
      return result || {};
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : (e as { message?: string }).message || "Salvataggio non riuscito";
      setError(msg);
      void qc.invalidateQueries({ queryKey: [user.id, campaignId] });
      throw new Error(msg);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <AppContext.Provider
      value={{
        user,
        campaignId,
        setCampaignId,
        online,
        busy,
        live,
        run,
        notice,
        error,
        setError,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
