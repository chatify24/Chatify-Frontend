import { Toaster } from "@/components/ui/toaster";
import { useState, useEffect } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Routes, Route, useLocation, useNavigate, BrowserRouter } from "react-router-dom";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { SocketProvider } from "@/lib/socket-context";
import { ThemeProvider } from "@/lib/theme-context";
import { ThemeToggle } from "@/components/ThemeToggle";
import { getVersion } from '@tauri-apps/api/app';
import { platform } from '@tauri-apps/plugin-os';
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

function AppContent({ splashDone, onSplashDone }: { splashDone: boolean; onSplashDone: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, isProfileComplete } = useAuth();

  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isDesktop, setIsDesktop] = useState(false);
  const [updateInfo, setUpdateInfo] = useState({
    available: false,
    newVersion: "",
    apkUrl: "",
  });

  useEffect(() => {
    const checkForAndroidUpdate = async () => {
      try {
        const currentPlatform = await platform();
        if (currentPlatform !== "android") return;

        const currentVersion = await getVersion();

        const res = await fetch("https://chatify-backend-mrlh.onrender.com/app-version");
        const data = await res.json();

        if (data.version !== currentVersion) {
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

  useEffect(() => {
    const checkPlatform = async () => {
      try {
        const currentPlatform = await platform();
        setIsDesktop(currentPlatform !== "android" && currentPlatform !== "ios");
      } catch (err) {
        console.error("Platform check failed:", err);
      }
    };

    if (isTauriApp) {
      checkPlatform();
    }
  }, []);

  // 🔥 App start hote hi notification permission maang lo (agar Tauri app hai)
  useEffect(() => {
    if (!isTauriApp) return;
    import('@tauri-apps/plugin-notification').then(async ({ isPermissionGranted, requestPermission }) => {
      try {
        const granted = await isPermissionGranted();
        if (!granted) await requestPermission();
      } catch (err) {
        console.error("Notification permission request failed:", err);
      }
    });
  }, []);

  // 🔥 Authenticated user ko public/auth pages se door bhej do
  // 🔥 Unauthenticated user ko protected pages se door bhej do (e.g. manual logout ke baad)
  useEffect(() => {
    if (isLoading) return;

    if (isAuthenticated && publicPaths.includes(location.pathname)) {
      navigate(isProfileComplete ? "/chat" : "/profile", { replace: true });
    } else if (!isAuthenticated && protectedPaths.includes(location.pathname)) {
      navigate("/auth", { replace: true });
    }
  }, [isAuthenticated, isLoading, isProfileComplete, location.pathname, navigate]);

  const showThemeToggle =
    location.pathname !== "/chat" &&
    location.pathname !== "/settings" &&
    !isOffline;

  // 🔥 Splash (update check) abhi khatam nahi hua → wahi dikhao
  if (!splashDone) {
    return <SplashScreen onDone={onSplashDone} />;
  }

  // 🔥 Fallback safety net: agar session check splash se zyada time le raha hai
  // (rare case), tabhi ye "Loading..." dikhega — normally isLoading splash ke
  // saath parallel mein hi complete ho chuka hota hai isliye ye ghatna kam hoga.
  if (isLoading) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-2 bg-background">
        <div className="h-8 w-8 border-4 border-muted border-t-primary rounded-full animate-spin"></div>
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <>
      <UpdateBanner
        updateInfo={updateInfo}
        onDismiss={() => setUpdateInfo((prev) => ({ ...prev, available: false }))}
      />

      {showThemeToggle && <ThemeToggle />}

      <Routes>
        <Route
          path="/"
          element={
            <NoInternet onVisibilityChange={setIsOffline}>
              {isTauriApp ? <Auth /> : <Welcome />}
            </NoInternet>
          }
        />
        <Route
          path="/auth"
          element={
            <NoInternet onVisibilityChange={setIsOffline}>
              <Auth />
            </NoInternet>
          }
        />
        <Route
          path="/profile"
          element={
            <NoInternet onVisibilityChange={setIsOffline}>
              <Profile />
            </NoInternet>
          }
        />
        <Route
          path="/chat"
          element={
            <NoInternet onVisibilityChange={setIsOffline}>
              <Chat />
            </NoInternet>
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
                  <AppContent splashDone={true} onSplashDone={() => {}} />
                </BrowserRouter>
              </ThemeProvider>
            </SocketProvider>
          </AuthProvider>
        </TooltipProvider>
      </QueryClientProvider>
    );
  }

  // 🔥 KEY CHANGE: AuthProvider ab SplashScreen ke SAATH mount hota hai,
  // splash ke baad nahi. Isse session-check (Supabase getSession) aur
  // update-check dono PARALLEL mein chalte hain. Jab tak "Checking for
  // updates..." dikh raha hota hai, session bhi load ho chuka hota hai —
  // isliye splash ke baad seedha sahi page (chat/auth) khulta hai,
  // beech mein alag se "Loading..." ya Auth ka flash nahi dikhta.
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <SocketProvider>
            <ThemeProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <AppContent splashDone={splashDone} onSplashDone={() => setSplashDone(true)} />
              </BrowserRouter>
            </ThemeProvider>
          </SocketProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;