import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Routes, Route, useLocation,BrowserRouter  } from "react-router-dom";
import { AuthProvider } from "@/lib/auth-context";
import { ThemeProvider } from "@/lib/theme-context";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useEffect, useState } from "react";


import Auth from "./pages/Auth";
import Settings from "./pages/Settings";
import ForgotPassword from "./pages/ForgotPassword";
import Profile from "./pages/Profile";
import Chat from "./pages/Chat";
import NotFound from "./pages/NotFound";
import GoogleAuth from "./pages/GoogleAuth";
import Welcome from "./pages/Welcome";


const queryClient = new QueryClient();

function AppContent() {

  const location = useLocation();
  const isDesktopApp = () => {
  return (
    typeof window !== "undefined" &&
    ((window as any).NL_VERSION !== undefined)
  );
};

  

  // 🔥 install trigger


  return (
    <>
       
      {/* Toggle button except chat & settings */}
      {location.pathname !== "/chat" &&
        location.pathname !== "/settings" && <ThemeToggle />}

      
     

      <Routes>
<Route
  path="/"
  element={<Auth />}
/>

  <Route path="/auth" element={<Auth />} />
  <Route path="/profile" element={<Profile />} />
  <Route path="/chat" element={<Chat />} />
  <Route path="*" element={<NotFound />} />
  <Route path="/forgot-password" element={<ForgotPassword />} />
  <Route path="/settings" element={<Settings />} />
  <Route path="/google-auth" element={<GoogleAuth />} />
</Routes>
    </>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <ThemeProvider>

          <Toaster />
          <Sonner />

          <BrowserRouter>
  <AppContent />
</BrowserRouter>

        </ThemeProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;