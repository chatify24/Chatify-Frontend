import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "../supabaseClient";

export default function GoogleAuth() {

  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {

    const handleGoogleUser = async () => {

      const { data: { user }, error } = await supabase.auth.getUser();

      if (error || !user) {
        navigate("/");
        return;
      }

      const userId = user.id; // 🔥 IMPORTANT
      const email = user.email;

      // 🔎 Check by ID (NOT email)
      const { data: profile, error: fetchError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (fetchError) {
        console.log(fetchError);
      }

      let profileHasName = !!profile?.name?.trim();

      // 🆕 NOT EXISTS → INSERT
      if (!profile) {
        const resultName = user.user_metadata?.full_name || "";

        const { error: insertError } = await supabase
          .from("profiles")
          .insert([
            {
              id: userId,
              email: email,
              name: resultName,
              avatar: user.user_metadata?.avatar_url || "",
            },
          ]);

        if (insertError) {
          console.log(insertError);
          toast({
            title: "Signup failed",
            variant: "destructive",
          });
          navigate("/");
          return;
        }

        toast({
          title: "Account created",
          description: "Welcome!",
        });

        profileHasName = !!resultName.trim();
      } else {
        toast({
          title: "Welcome back",
          description: "Login successful",
        });
      }

      localStorage.setItem(
        "current_user",
        JSON.stringify({
          id: userId,
          email,
        })
      );

      navigate(profileHasName ? "/chat" : "/profile");

    };

    handleGoogleUser();

  }, []);

  return null;
}