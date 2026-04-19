import { useEffect } from "react";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { generateUID } from "@/utils/uid";

export default function GoogleAuth() {

  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {

    const handleUser = async () => {

      const params = new URLSearchParams(window.location.search);
      const mode = params.get("mode");

      // 🔥 run both together
      const delay = new Promise(res => setTimeout(res, 2500));

      const authProcess = (async () => {

        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          return { action: "redirect_home" };
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle();

        const profileHasName = !!profile?.name?.trim();

        // LOGIN
        if (mode === "login") {
          if (!profile) {
            await supabase.auth.signOut();
            return { action: "not_found" };
          }

          return profileHasName
            ? { action: "login_success_chat" }
            : { action: "login_success_profile" };
        }

        // SIGNUP
        if (mode === "signup") {
          if (profile) {
            if (profileHasName) {
              await supabase.auth.signOut();
              return { action: "already_exists" };
            }
            return { action: "signup_success_profile" };
          }

          const uid = generateUID(user.email);

          await supabase.from("profiles").insert([
            {
              id: user.id,
              email: user.email,
              uid,
              name: user.user_metadata?.full_name || "",
              avatar: user.user_metadata?.avatar_url || "",
            },
          ]);

          return user.user_metadata?.full_name
            ? { action: "signup_success_chat" }
            : { action: "signup_success_profile" };
        }

      })();

      // ⏳ wait for BOTH
      const [result] = await Promise.all([authProcess, delay]);

      // 🔥 now decide
      if (result.action === "redirect_home") {
        navigate("/");
        return;
      }

      if (result.action === "not_found") {
        toast({
          title: "Account not found",
          description: "Please sign up first",
          variant: "destructive"
        });
        navigate("/");
        return;
      }

      if (result.action === "already_exists") {
        toast({
          title: "Account already exists",
          description: "Please sign in",
          variant: "destructive"
        });
        navigate("/");
        return;
      }

      if (result.action === "login_success_chat") {
        toast({ title: "Welcome back" });
        navigate("/chat");
        return;
      }

      if (result.action === "login_success_profile") {
        toast({ title: "Welcome back" });
        navigate("/profile");
        return;
      }

      if (result.action === "signup_success_chat") {
        toast({ title: "Account created" });
        navigate("/chat");
        return;
      }

      if (result.action === "signup_success_profile") {
        toast({ title: "Account created" });
        navigate("/profile");
        return;
      }

    };

    handleUser();

  }, []);

  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="flex items-center gap-3">
        <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
       <p className="text-2xl font-semibold text-muted-foreground tracking-wide">
        Processing...
      </p>
      </div>
    </div>
  );
}