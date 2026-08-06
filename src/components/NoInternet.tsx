import { useEffect, useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";

interface NoInternetProps {
  children: React.ReactNode;
  onReconnect?: () => void;
  onVisibilityChange?: (isOffline: boolean) => void;
}

const NoInternet = ({ children, onReconnect, onVisibilityChange }: NoInternetProps) => {
  const [visible, setVisible] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryFailed, setRetryFailed] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const checkConnection = async () => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        const res = await fetch(
          `https://chatify-backend-mrlh.onrender.com/health?_=${Date.now()}`,
          { method: "GET", cache: "no-store", signal: controller.signal }
        );
        clearTimeout(timeout);

        if (!res.ok) throw new Error("Not ok");

        setVisible(false);
        setIsRetrying(false);
        setRetryFailed(false);
        onVisibilityChange?.(false);
      } catch {
        setVisible(true);
        onVisibilityChange?.(true);
      }
    };

    checkConnection();

    // Poll every 4 seconds — Android WebView doesn't fire online/offline reliably
    const pollInterval = setInterval(checkConnection, 4000);

    // Recheck immediately when app comes back to foreground (Android resume)
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        checkConnection();
      }
    };

    const handleOnline = () => {
      checkConnection();
    };

    const handleOffline = () => {
      setVisible(true);
      setRetryFailed(false);
      onVisibilityChange?.(true);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearInterval(pollInterval);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", handleVisibility);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleRetry = useCallback(() => {
    if (isRetrying) return;
    setIsRetrying(true);
    setRetryFailed(false);

    timeoutRef.current = setTimeout(async () => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        const res = await fetch(
          `https://chatify-backend-mrlh.onrender.com/health?_=${Date.now()}`,
          { method: "GET", cache: "no-store", signal: controller.signal }
        );
        clearTimeout(timeout);

        if (!res.ok) throw new Error("Not ok");

        setVisible(false);
        setIsRetrying(false);
        setRetryFailed(false);
        onVisibilityChange?.(false);
      } catch {
        setIsRetrying(false);
        setRetryFailed(true);
      }
    }, 800);
  }, [isRetrying]);

  return (
    <>
      <div
        style={{
          visibility: visible ? "hidden" : "visible",
          pointerEvents: visible ? "none" : "auto",
          height: "100%",
        }}
      >
        {children}
      </div>

      {visible && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "var(--background, #f5f5f0)",
            fontFamily: "'Segoe UI', system-ui, sans-serif",
          }}
        >
          <div className="flex flex-col items-center gap-3 mb-6" />

          <div
            className="rounded-2xl border bg-card p-8 shadow-sm flex flex-col gap-4"
            style={{ width: "min(90vw, 480px)" }}
          >
            <div style={{ marginBottom: 4 }}>
              <p
                style={{
                  margin: "0 0 6px",
                  fontSize: 18,
                  fontWeight: 700,
                  color: "var(--foreground, #1a1a1a)",
                }}
              >
                No Internet Access
              </p>

              <p
                style={{
                  margin: 0,
                  fontSize: 14,
                  color: retryFailed ? "#ef4444" : "var(--muted-foreground, #888)",
                  lineHeight: 1.5,
                  transition: "color 0.3s ease",
                }}
              >
                {retryFailed
                  ? "Failed to connect. Please check your network connection."
                  : "Please check your connection and try again."}
              </p>
            </div>

            <div style={isRetrying ? { cursor: "not-allowed" } : {}}>
              <Button
                onClick={handleRetry}
                style={isRetrying ? { opacity: 0.4, pointerEvents: "none" } : {}}
                className="h-12 w-full rounded-xl text-base font-semibold flex items-center justify-center hover:opacity-90 cursor-pointer"
              >
                {isRetrying ? "Retry" : "Retry"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes noinet-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
};

export default NoInternet;