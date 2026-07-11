import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://lbfplybfspcnnitrzmoj.supabase.co";
const supabaseKey = "sb_publishable_eQPg98Sid1Q2rD2lki6eMg__StzT6EE";

const isTauriApp =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

// 🔥 Tauri app (Android/Desktop) -> localStorage (persist across restarts)
// Web browser -> sessionStorage (multi-tab, alag account per tab)
const authStorage = {
  getItem: (key: string) => {
    if (typeof window === "undefined") return null;
    return isTauriApp
      ? localStorage.getItem(key)
      : sessionStorage.getItem(key);
  },
  setItem: (key: string, value: string) => {
    if (typeof window === "undefined") return;
    if (isTauriApp) {
      localStorage.setItem(key, value);
    } else {
      sessionStorage.setItem(key, value);
    }
  },
  removeItem: (key: string) => {
    if (typeof window === "undefined") return;
    if (isTauriApp) {
      localStorage.removeItem(key);
    } else {
      sessionStorage.removeItem(key);
    }
  },
};

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: authStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});