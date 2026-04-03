/**
 * Legacy /auth route — redirects to the canonical /auth/login page.
 * Kept for backward compatibility (bookmarks, external links, email
 * redirect URIs that still reference /auth).
 */
import { Navigate } from "react-router-dom";

export default function AuthPage() {
  return <Navigate to="/auth/login" replace />;
}
