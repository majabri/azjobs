/**
 * Legacy /auth route — redirects to the canonical /auth/login page.
 * Kept for backward compatibility (bookmarks, external links, email
 * redirect URIs that still reference /auth).
 */
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function AuthPage() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate("/auth/login", { replace: true });
  }, [navigate]);

  return null;
}
