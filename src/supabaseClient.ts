import { createClient } from "@supabase/supabase-js";
import { Store } from "@tauri-apps/plugin-store";

const supabaseUrl = "https://lbfplybfspcnnitrzmoj.supabase.co";
const supabaseKey = "sb_publishable_eQPg98Sid1Q2rD2lki6eMg__StzT6EE";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

let tauriStorePromise: Promise<Store> | null = null;
const getTauriStore = () => {
  if (!tauriStorePromise) {
    tauriStorePromise = Store.load("auth-session.json");
  }
  return tauriStorePromise;
};

const tauriStorageAdapter = {
  getItem: async (key: string) => {
    const store = await getTauriStore();
    const value = await store.get<string>(key);
    return value ?? null;
  },
  setItem: async (key: string, value: string) => {
    const store = await getTauriStore();
    await store.set(key, value);
    await store.save();
  },
  removeItem: async (key: string) => {
    const store = await getTauriStore();
    await store.delete(key);
    await store.save();
  },
};

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: isTauri
      ? tauriStorageAdapter
      : typeof window !== "undefined"
      ? window.localStorage
      : undefined,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});