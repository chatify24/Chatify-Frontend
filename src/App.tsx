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
import Welcome from "./pages/Welcome";

const queryClient = new QueryClient();

const isTauriApp =
  typeof window !== "undefined" &&
  "__TAURI_INTERNALS__" in window;

// ✅ Hover-to-reveal Close Button (only in Tauri)
function TauriCloseButton() {
  const [hovered, setHovered] = useState(false);

  const handleClose = async () => {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().close();
    } catch (e) {
      console.error("Failed to close window:", e);
    }
  };

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "fixed",
        top: 0,
        left: "50%",
        transform: "translateX(-50%)",
        width: "120px",
        height: "40px",       // ✅ thoda bada hover zone
        zIndex: 99999,        // ✅ sabse upar
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        pointerEvents: "auto", // ✅ explicitly enable
      }}
    >
      <button
        onClick={handleClose}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "6px 18px",
          background: "#ef4444",
          color: "white",
          border: "none",
          borderRadius: "0 0 12px 12px",
          cursor: "pointer",
          fontSize: "13px",
          fontWeight: 600,
          boxShadow: "0 4px 12px rgba(239,68,68,0.5)",
          transform: hovered ? "translateY(0)" : "translateY(-100%)",
          transition: "transform 0.2s ease",
          pointerEvents: "auto", // ✅ yeh key fix hai
          zIndex: 99999,
        }}
      >
        ✕ Close
      </button>
    </div>
  );
}

function AppContent() {
  const location = useLocation();
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  const showThemeToggle =
    location.pathname !== "/chat" &&
    location.pathname !== "/settings" &&
    !isOffline;

  return (
    <>
      {/* ✅ Close button sirf Tauri mein dikhega */}
      {isTauriApp && <TauriCloseButton />}

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