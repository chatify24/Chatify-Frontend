import React, { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { generateUID } from "@/utils/uid";

export interface UserProfile {
  name: string;
  email: string;
  avatar: string;
  uid?: string;
}

type AuthResult = { success: true; profileComplete: boolean } | string;

interface AuthContextType {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isProfileComplete: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<AuthResult>;
  signup: (email: string, password: string) => Promise<AuthResult>;
  logout: () => void;
  updateProfile: (profile: Partial<UserProfile>) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

// 🔁 AUTO LOGIN + ONLINE SET
  useEffect(() => {
    const getSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          console.log("[auth] getSession error (possibly offline):", error.message);
          return;
        }

        if (data.session?.user) {
          const userId = data.session.user.id;

          const { data: profile } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", userId)
            .single();

          await supabase
            .from("profiles")
            .update({ last_seen: new Date().toISOString() })
            .eq("id", userId);

          setUser({
            name: profile?.name || "",
            email: data.session.user.email!,
            avatar: profile?.avatar || "",
            uid: profile?.uid || "",
          });

          setIsAuthenticated(true);
          setupFcmToken(userId);
        } else {
          setUser(null);
          setIsAuthenticated(false);
        }
      } finally {
        setIsLoading(false);
      }
    };

    getSession();

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("[auth] state changed:", event);

      if (event === "SIGNED_OUT" || !session) {
        setUser(null);
        setIsAuthenticated(false);
      }

      if (event === "SIGNED_IN" && session?.user) {
        // Optional
      }
    });

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        getSession();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    const handleReconnect = () => {
      console.log("[auth] network reconnected, re-verifying session");
      getSession();
    };
    window.addEventListener("app-reconnected", handleReconnect);

    return () => {
      listener.subscription.unsubscribe();
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("app-reconnected", handleReconnect);
    };
  }, []);
  

  useEffect(() => {
    const interval = setInterval(async () => {
      const { data } = await supabase.auth.getUser();
      const userId = data.user?.id;

      if (userId) {
        await supabase
          .from("profiles")
          .update({ last_seen: new Date().toISOString() })
          .eq("id", userId);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, []);
  const setupFcmToken = async (userId: string) => {
  if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) return;
  try {
    const { checkPermissions, requestPermissions, register, getToken } = await import("tauri-plugin-fcm");
    let permission = await checkPermissions();
    if (permission === "prompt" || permission === "prompt-with-rationale") {
      permission = await requestPermissions();
    }
    if (permission === "granted") {
      await register();
      const { token } = await getToken();
      if (token) {
        await supabase.from("profiles").update({ fcm_token: token }).eq("id", userId);
        console.log("[fcm] token saved successfully");
      }
    }
  } catch (err) {
    console.error("FCM setup failed:", err);
  }
};

  // 🔐 SIGNUP
  const signup = async (email: string, password: string): Promise<AuthResult> => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      if (error.message.toLowerCase().includes("already")) {
        return "Account already exists";
      }
      return error.message;
    }

    const user = data.user;

    if (!user) {
      return "Signup failed (no user)";
    }

    const uid = generateUID(user.email);

    const { error: insertError } = await supabase.from("profiles").insert([
      {
        id: user.id,
        email: user.email,
        uid,
        name: "",
        avatar: "",
        last_seen: new Date().toISOString(),
      },
    ]);

    if (insertError) {
      console.log("PROFILE ERROR:", insertError);
      return insertError.message;
    }

    return { success: true, profileComplete: false };
  };

// 🔐 LOGIN
  const login = async (email: string, password: string): Promise<AuthResult> => {

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      const { data: profileCheck } = await supabase
        .from("profiles")
        .select("email")
        .eq("email", email)
        .single();

      if (!profileCheck) {
        return "Account not found";
      }

      return "Incorrect password";
    }

    if (!data.user) {
      return "Login failed";
    }

    const userId = data.user.id;

    let { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    let generatedUid = "";

    if (!profile) {
      generatedUid = generateUID(data.user.email || "");
      const { data: newProfile } = await supabase
        .from("profiles")
        .upsert([
          {
            id: userId,
            email: data.user.email,
            uid: generatedUid,
            name: "",
            avatar: "",
          },
        ])
        .select()
        .single();

      profile = newProfile;
    }

    if (profile && !profile.uid) {
      generatedUid = generateUID(data.user.email || "");
      await supabase
        .from("profiles")
        .update({ uid: generatedUid })
        .eq("id", userId);
      profile.uid = generatedUid;
    }

    await supabase
      .from("profiles")
      .update({ last_seen: new Date().toISOString() })
      .eq("id", userId);

    setUser({
      name: profile?.name || "",
      email: data.user.email!,
      avatar: profile?.avatar || "",
      uid: profile?.uid || generatedUid || "",
    });

    setIsAuthenticated(true);
    setupFcmToken(userId);

    
    if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
      import("tauri-plugin-fcm").then(async ({ checkPermissions, requestPermissions, register, getToken }) => {
        try {
          let permission = await checkPermissions();
          if (permission === "prompt" || permission === "prompt-with-rationale") {
            permission = await requestPermissions();
          }
          if (permission === "granted") {
            await register();
            const { token } = await getToken();
            if (token) {
              await supabase.from("profiles").update({ fcm_token: token }).eq("id", userId);
              console.log("[fcm] token saved successfully");
            }
          }
        } catch (err) {
          console.error("FCM setup failed:", err);
        }
      });
    }

    return { success: true, profileComplete: !!profile?.name };
  };

  // 🚪 LOGOUT
  const logout = async () => {
    const { data } = await supabase.auth.getUser();

    if (data.user) {
      await supabase
        .from("profiles")
        .update({ last_seen: new Date().toISOString() })
        .eq("id", data.user.id);
    }

    // 🔥 scope: 'local' explicitly specify karo
    await supabase.auth.signOut({ scope: "local" });

    // 🔥 Extra safety - manually bhi purana token hata do
    if (typeof window !== "undefined") {
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith("sb-") || key.includes("supabase")) {
          localStorage.removeItem(key);
        }
      });
      Object.keys(sessionStorage).forEach((key) => {
        if (key.startsWith("sb-") || key.includes("supabase")) {
          sessionStorage.removeItem(key);
        }
      });
    }

    setUser(null);
    setIsAuthenticated(false);
  };

  // 🧾 PROFILE UPDATE (LOCAL + OPTIONAL DB SAVE)
  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!user) return;

    const { data } = await supabase.auth.getUser();
    const userId = data.user?.id;

    if (userId) {
      await supabase.from("profiles").upsert([
        {
          id: userId,
          email: user.email,
          name: updates.name,
          avatar: updates.avatar,
        },
      ]);
    }

    setUser({ ...user, ...updates });
  };

  const isProfileComplete = !!user?.name;

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isProfileComplete,
        isLoading,
        login,
        signup,
        logout,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};