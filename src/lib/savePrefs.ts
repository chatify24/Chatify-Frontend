import { supabase } from "@/supabaseClient";
export const savePrefs = async (userEmail: string, field: string, value: any) => {
  const { error } = await supabase
    .from("user_preferences")
    .upsert(
      {
        user_id: userEmail,
        [field]: value
      },
      { onConflict: "user_id" } // 🔥 important
    );

  if (error) {
    console.error("savePrefs error:", error);
  }
};