import { useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

const LAST_ACTIVITY_KEY = "admin_last_activity";
const TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2 hours
const CHECK_INTERVAL_MS = 60 * 1000; // 60 seconds

export function useSessionTimeout() {
  const { isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const updateActivity = useCallback(() => {
    sessionStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
  }, []);

  useEffect(() => {
    if (!isAdmin) return;

    // Initialize
    updateActivity();

    const events = ["click", "keydown", "scroll", "mousemove", "touchstart"];
    events.forEach((e) => window.addEventListener(e, updateActivity, { passive: true }));

    const interval = setInterval(() => {
      const last = Number(sessionStorage.getItem(LAST_ACTIVITY_KEY) || 0);
      if (Date.now() - last > TIMEOUT_MS) {
        signOut();
        sessionStorage.removeItem(LAST_ACTIVITY_KEY);
        toast({ title: "Sessão expirada por inatividade.", description: "Faça login novamente para continuar." });
        navigate("/admin/login", { replace: true });
      }
    }, CHECK_INTERVAL_MS);

    return () => {
      events.forEach((e) => window.removeEventListener(e, updateActivity));
      clearInterval(interval);
    };
  }, [isAdmin, signOut, navigate, toast, updateActivity]);
}
