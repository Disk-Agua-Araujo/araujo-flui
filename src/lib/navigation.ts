import { useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";

/**
 * Navigate to a section on the homepage from any page.
 * If already on "/", scrolls directly. Otherwise navigates to "/#sectionId".
 */
export function useNavigateToSection() {
  const navigate = useNavigate();
  const location = useLocation();

  return useCallback(
    (sectionId: string) => {
      if (location.pathname === "/") {
        const el = document.getElementById(sectionId);
        if (el) {
          el.scrollIntoView({ behavior: "smooth" });
        } else {
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      } else {
        navigate(`/#${sectionId}`);
      }
    },
    [navigate, location.pathname]
  );
}

/**
 * Hook to scroll to hash on mount (used in Index page).
 */
export function useScrollToHash() {
  const scrollOnMount = useCallback(() => {
    const hash = window.location.hash.slice(1);
    if (hash) {
      setTimeout(() => {
        document.getElementById(hash)?.scrollIntoView({ behavior: "smooth" });
      }, 150);
    }
  }, []);
  return scrollOnMount;
}
