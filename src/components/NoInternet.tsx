import { useEffect, useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";

interface NoInternetProps {
  children: React.ReactNode;
  onReconnect?: () => void;
  onVisibilityChange?: (isOffline: boolean) => void;
}

const HEALTH_CHECK_TIMEOUT = 10000;
const SLOW_THRESHOLD_MS = 2500;

const NoInternet = ({ children, onReconnect, onVisibilityChange }: NoInternetProps) => {
  const [visible, setVisible] = useState(!navigator.onLine);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryFailed, setRetryFailed] = useState(false);
  const [isPoorConnection, setIsPoorConnection] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const visibleRef = useRef(visible);
  visibleRef.current = visible;

  const checkConnection = useCallback(async () => {
    const start = performance.now();

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT);

      const res = await fetch(
        `https://chatify-backend-mrlh.onrender.com/health?_=${Date.now()}`,
        { method: "GET", cache: "no-store", signal: controller.signal }
      );
      clearTimeout(timeout);

      if (!res.ok) throw new Error("Not ok");

      const elapsed = performance.now() - start;

      setVisible(false);
      setIsRetrying(false);
      setRetryFailed(false);
      setIsPoorConnection(elapsed > SLOW_THRESHOLD_MS);
      onVisibilityChange?.(false);
    } catch {
      // 🔥 Backend fail hua (cold-start/down) — agar browser abhi bhi
      // "online" bol raha hai, to ye internet ka issue nahi hai.
      // Full "No Internet" screen mat dikhao, sirf poor-connection banner.
      if (navigator.onLine) {
        setVisible(false);
        setIsPoorConnection(true);
        onVisibilityChange?.(false);
      } else {
        setVisible(true);
        setIsPoorConnection(false);
        onVisibilityChange?.(true);
      }
    }
  }, [onVisibilityChange]);

  useEffect(() => {
    // Initial check on mount
    checkConnection();

    // 🔥 Polling hata di — ye galti se "No Internet" trigger karti thi
    // jab backend cold-start ho raha hota tha (Render free tier).

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        checkConnection();
      }
    };

    // 🔥 Real browser network events hi primary source of truth
    const handleOnline = () => {
      checkConnection();
      window.dispatchEvent(new Event("app-reconnected"));
    };

    const handleOffline = () => {
      setVisible(true);
      setRetryFailed(false);
      setIsPoorConnection(false);
      onVisibilityChange?.(true);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", handleVisibility);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [checkConnection, onVisibilityChange]);

  const handleRetry = useCallback(() => {
    if (isRetrying) return;
    setIsRetrying(true);
    setRetryFailed(false);

    timeoutRef.current = setTimeout(async () => {
      const start = performance.now();

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT);

        const res = await fetch(
          `https://chatify-backend-mrlh.onrender.com/health?_=${Date.now()}`,
          { method: "GET", cache: "no-store", signal: controller.signal }
        );
        clearTimeout(timeout);

        if (!res.ok) throw new Error("Not ok");

        const elapsed = performance.now() - start;

        setVisible(false);
        setIsRetrying(false);
        setRetryFailed(false);
        setIsPoorConnection(elapsed > SLOW_THRESHOLD_MS);
        onVisibilityChange?.(false);
      } catch {
        setIsRetrying(false);
        setRetryFailed(true);
      }
    }, 800);
  }, [isRetrying, onVisibilityChange]);

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

      {!visible && isPoorConnection && (
        <div
          className="noinet-shake"
          style={{
            position: "fixed",
            top: 12,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 9998,
            backgroundColor: "rgba(239, 68, 68, 0.12)",
            border: "1px solid #ef4444",
            color: "#ef4444",
            padding: "6px 14px",
            borderRadius: 999,
            fontSize: 13,
            fontWeight: 600,
            fontFamily: "'Segoe UI', system-ui, sans-serif",
          }}
        >
          Network connection is poor
        </div>
      )}

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

        @keyframes noinet-shake {
          0%, 100% { transform: translateX(-50%) translateY(0); }
          20% { transform: translateX(-50%) translateX(-3px); }
          40% { transform: translateX(-50%) translateX(3px); }
          60% { transform: translateX(-50%) translateX(-2px); }
          80% { transform: translateX(-50%) translateX(2px); }
        }

        .noinet-shake {
          animation: noinet-shake 0.4s ease-in-out;
        }
      `}</style>
    </>
  );
};

export default NoInternet;