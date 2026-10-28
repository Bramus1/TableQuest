import { createClient } from "@supabase/supabase-js";
import type { Database } from "../types";
const url = import.meta.env.VITE_SUPABASE_URL,
  key = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const configured = !!url && !!key && !url.includes("YOUR_PROJECT");
export const db = configured ? createClient<Database>(url, key) : null;
