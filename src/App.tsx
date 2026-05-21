import { Toaster } from "@/components/ui/toaster";
import { useState } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Routes, Route, useLocation, BrowserRouter } from "react-router-dom";
import { AuthProvider } from "@/lib/auth-context";
import { SocketProvider } from "@/lib/socket-context";
import { ThemeProvider } from "@/lib/theme-context";
import { ThemeToggle } from "@/components/ThemeToggle";

import NoInternet from "@/components/NoInternet";
import SplashScreen from "./pages/SplashScreen";
import Auth from "./pages/Auth";
import ForgotPassword from "./pages/ForgotPassword";
import Profile from "./pages/Profile";
import Chat from "./pages/Chat";
import NotFound from "./pages/NotFound";
import GoogleAuth from "./pages/GoogleAuth";
import Welcome from "./pages/Welcome";

const queryClient = new QueryClient();

// Detect Tauri
const isTauriApp =
  typeof window !== "undefined" &&
  "__TAURI_INTERNALS__" in window;

function AppContent() {
  const location = useLocation();
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  const showThemeToggle =
    location.pathname !== "/chat" &&
    location.pathname !== "/settings" &&
    !isOffline;

  return (
    <>
      {showThemeToggle && <ThemeToggle />}

      <Routes>
        {/* WEBSITE => Welcome */}
        {/* TAURI => Auth */}
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
  // WEBSITE => No Splash
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
                  <AppContent />
                </BrowserRouter>
              </ThemeProvider>
            </SocketProvider>
          </AuthProvider>
        </TooltipProvider>
      </QueryClientProvider>
    );
  }

  // TAURI APP => Splash First
  const [splashDone, setSplashDone] = useState(false);
  const [splashKey, setSplashKey] = useState(0);

  if (!splashDone) {
    return (
      <ThemeProvider>
        <SplashScreen key={splashKey} onDone={() => setSplashDone(true)} />
      </ThemeProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <SocketProvider>
            <ThemeProvider>
              <Toaster />
              <Sonner />

              <BrowserRouter>
                <AppContent />
              </BrowserRouter>
            </ThemeProvider>
          </SocketProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;