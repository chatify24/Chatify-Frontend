import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://lbfplybfspcnnitrzmoj.supabase.co";
const supabaseKey = "sb_publishable_eQPg98Sid1Q2rD2lki6eMg__StzT6EE";

// 🔥 SESSIONSTORAGE - Har tab ka apna alag session
// Tab 1 -> Account A, Tab 2 -> Account B, Tab 3 -> Account C
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: {
      getItem: (key: string) => {
        if (typeof window === "undefined") return null;
        return sessionStorage.getItem(key);
      },
      setItem: (key: string, value: string) => {
        if (typeof window === "undefined") return;
        sessionStorage.setItem(key, value);
      },
      removeItem: (key: string) => {
        if (typeof window === "undefined") return;
        sessionStorage.removeItem(key);
      },
    },
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});
