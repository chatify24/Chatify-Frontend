import { Toaster } from "@/components/ui/toaster";
import { useState, useEffect } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Routes,
  Route,
  useLocation,
  useNavigate,
  BrowserRouter,
   Navigate,
} from "react-router-dom";

import { AuthProvider, useAuth } from "@/lib/auth-context";
import { SocketProvider } from "@/lib/socket-context";
import { ThemeProvider } from "@/lib/theme-context";
import { ThemeToggle } from "@/components/ThemeToggle";

import { getVersion } from "@tauri-apps/api/app";
import { platform } from "@tauri-apps/plugin-os";

import UpdateBanner from "@/components/UpdateBanner";
import NoInternet from "@/components/NoInternet";

import SplashScreen from "./pages/SplashScreen";
import Auth from "./pages/Auth";
import ForgotPassword from "./pages/ForgotPassword";
import Profile from "./pages/Profile";
import Chat from "./pages/Chat";
import NotFound from "./pages/NotFound";
import Welcome from "./pages/Welcome";

const queryClient = new QueryClient();

const isTauriApp =
  typeof window !== "undefined" &&
  "__TAURI_INTERNALS__" in window;

const publicPaths = ["/", "/auth", "/forgot-password"];
const protectedPaths = ["/chat", "/profile"];

/*
 * Version comparison function
 *
 * Example:
 * isNewerVersion("1.3.0", "1.2.0") -> true
 * isNewerVersion("1.2.0", "1.3.0") -> false
 * isNewerVersion("1.2.0", "1.2.0") -> false
 *
 * latest = backend version
 * current = installed app version
 */
function isNewerVersion(latest: string, current: string): boolean {
  const l = latest.split(".").map(Number);
  const c = current.split(".").map(Number);

  for (let i = 0; i < Math.max(l.length, c.length); i++) {
    const a = l[i] || 0;
    const b = c[i] || 0;

    if (a > b) return true;
    if (a < b) return false;
  }

  return false;
}

function AppContent({
  splashDone,
  onSplashDone,
}: {
  splashDone: boolean;
  onSplashDone: () => void;
}) {
  const location = useLocation();
  const navigate = useNavigate();

  const {
    isAuthenticated,
    isLoading,
    isProfileComplete,
  } = useAuth();

  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isDesktop, setIsDesktop] = useState(false);

  const [updateInfo, setUpdateInfo] = useState({
    available: false,
    newVersion: "",
    apkUrl: "",
  });

  /*
   * 🔥 Android Update Check
   *
   * Backend version ko installed app version se compare karta hai.
   * Banner sirf tab show hoga jab backend version actually newer ho.
   */
  useEffect(() => {
    const checkForAndroidUpdate = async () => {
      try {
        const currentPlatform = await platform();

        // Sirf Android ke liye update check
        if (currentPlatform !== "android") return;

        // Installed app ka current version
        const currentVersion = await getVersion();

        // Backend se latest version fetch
        const res = await fetch(
          "https://chatify-backend-mrlh.onrender.com/app-version"
        );

        if (!res.ok) {
          throw new Error(
            `Version API failed with status ${res.status}`
          );
        }

        const data = await res.json();

        /*
         * 🔥 IMPORTANT CHANGE
         *
         * Pehle:
         * if (data.version !== currentVersion)
         *
         * Ab:
         * if (isNewerVersion(data.version, currentVersion))
         *
         * Isse old backend version hone par galti se
         * update banner nahi dikhega.
         */
        if (isNewerVersion(data.version, currentVersion)) {
          setUpdateInfo({
            available: true,
            newVersion: data.version,
            apkUrl: data.apk_url,
          });
        }
      } catch (err) {
        console.error("Update check failed:", err);
      }
    };

    checkForAndroidUpdate();
  }, []);

  /*
   * Platform check
   */
  useEffect(() => {
    const checkPlatform = async () => {
      try {
        const currentPlatform = await platform();

        setIsDesktop(
          currentPlatform !== "android" &&
            currentPlatform !== "ios"
        );
      } catch (err) {
        console.error("Platform check failed:", err);
      }
    };

    if (isTauriApp) {
      checkPlatform();
    }
  }, []);

  /*
   * 🔥 App start hote hi notification permission maang lo
   * (agar Tauri app hai)
   */
  useEffect(() => {
    if (!isTauriApp) return;

    import("@tauri-apps/plugin-notification").then(
      async ({
        isPermissionGranted,
        requestPermission,
      }) => {
        try {
          const granted = await isPermissionGranted();

          if (!granted) {
            await requestPermission();
          }
        } catch (err) {
          console.error(
            "Notification permission request failed:",
            err
          );
        }
      }
    );
  }, []);

 


  const showThemeToggle =
    location.pathname !== "/chat" &&
    location.pathname !== "/settings" &&
    !isOffline;

  /*
   * 🔥 Splash abhi khatam nahi hua
   */
  if (!splashDone) {
    return <SplashScreen onDone={onSplashDone} />;
  }

  /*
   * 🔥 Fallback safety net:
   * Agar session check splash se zyada time le raha hai
   */
  if (isLoading) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-2 bg-background">
        <div className="h-8 w-8 border-4 border-muted border-t-primary rounded-full animate-spin"></div>

        <p className="text-sm text-muted-foreground">
          Loading...
        </p>
      </div>
    );
  }

  return (
    <>
      <UpdateBanner
        updateInfo={updateInfo}
        onDismiss={() =>
          setUpdateInfo((prev) => ({
            ...prev,
            available: false,
          }))
        }
      />

      {showThemeToggle && <ThemeToggle />}

     <Routes>
  <Route
    path="/"
    element={
      isAuthenticated ? (
        <Navigate to={isProfileComplete ? "/chat" : "/profile"} replace />
      ) : (
        <NoInternet onVisibilityChange={setIsOffline}>
          {isTauriApp ? <Auth /> : <Welcome />}
        </NoInternet>
      )
    }
  />

  <Route
    path="/auth"
    element={
      isAuthenticated ? (
        <Navigate to={isProfileComplete ? "/chat" : "/profile"} replace />
      ) : (
        <NoInternet onVisibilityChange={setIsOffline}>
          <Auth />
        </NoInternet>
      )
    }
  />

  <Route
    path="/profile"
    element={
      !isAuthenticated ? (
        <Navigate to="/auth" replace />
      ) : (
        <NoInternet onVisibilityChange={setIsOffline}>
          <Profile />
        </NoInternet>
      )
    }
  />

  <Route
    path="/chat"
    element={
      !isAuthenticated ? (
        <Navigate to="/auth" replace />
      ) : (
        <NoInternet onVisibilityChange={setIsOffline}>
          <Chat />
        </NoInternet>
      )
    }
  />

  <Route
    path="/forgot-password"
    element={
      <NoInternet onVisibilityChange={setIsOffline}>
        <ForgotPassword />
      </NoInternet>
    }
  />

  <Route path="*" element={<NotFound />} />
</Routes>
    </>
  );
}

const App = () => {
  const [splashDone, setSplashDone] = useState(false);

  /*
   * Web app ke liye splash nahi chahiye.
   */
  if (!isTauriApp) {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AuthProvider>
            <SocketProvider>
              <ThemeProvider>
                <Toaster />
                <Sonner />

                <BrowserRouter>
                  <AppContent
                    splashDone={true}
                    onSplashDone={() => {}}
                  />
                </BrowserRouter>
              </ThemeProvider>
            </SocketProvider>
          </AuthProvider>
        </TooltipProvider>
      </QueryClientProvider>
    );
  }

  /*
   * 🔥 KEY CHANGE:
   *
   * AuthProvider SplashScreen ke saath mount hota hai.
   *
   * Isse:
   * - Session check
   * - Update check
   *
   * parallel mein chalte hain.
   *
   * Jab tak "Checking for updates..." dikh raha hota hai,
   * session bhi load ho raha hota hai.
   *
   * Splash ke baad seedha correct page:
   * Chat / Auth / Profile
   * open hota hai.
   *
   * Beech mein unnecessary "Loading..." ya Auth flash
   * normally nahi dikhta.
   */
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <SocketProvider>
            <ThemeProvider>
              <Toaster />
              <Sonner />

              <BrowserRouter>
                <AppContent
                  splashDone={splashDone}
                  onSplashDone={() => setSplashDone(true)}
                />
              </BrowserRouter>
            </ThemeProvider>
          </SocketProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;