/**
 * Regression tests for auth navigation paths.
 *
 * Ensures:
 *   (a) /auth redirects to /auth/login (backward-compat redirect)
 *   (b) The landing-page "Sign In" button navigates to /auth/login
 *   (c) The route constants module exports the correct values
 *
 * These tests guard against accidental drift where the navigation target
 * diverges from the canonical /auth/login route, which previously caused
 * React error #306 in production.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { AUTH_LOGIN, AUTH_ROOT } from "@/lib/routes";

// ─── Route constants ──────────────────────────────────────────────────────────

describe("route constants", () => {
  it("AUTH_LOGIN is /auth/login", () => {
    expect(AUTH_LOGIN).toBe("/auth/login");
  });

  it("AUTH_ROOT is /auth", () => {
    expect(AUTH_ROOT).toBe("/auth");
  });
});

// ─── /auth redirect ───────────────────────────────────────────────────────────

/** Thin wrapper that renders the current pathname for assertions. */
function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

describe("/auth redirect", () => {
  it("redirects /auth to /auth/login", async () => {
    // Dynamically import Auth to avoid top-level module resolution issues
    const { default: AuthPage } = await import("@/pages/Auth");

    render(
      <MemoryRouter initialEntries={["/auth"]}>
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/auth/login" element={<LocationDisplay />} />
        </Routes>
      </MemoryRouter>
    );

    // After the <Navigate replace> renders, we should be at /auth/login
    expect(screen.getByTestId("location").textContent).toBe("/auth/login");
  });
});

// ─── Landing page "Sign In" button ───────────────────────────────────────────

// Minimal mocks so Index.tsx can render in jsdom without real Supabase/assets
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
      signOut: vi.fn(),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], count: 0, error: null }),
    }),
  },
}));

vi.mock("@/hooks/useAuthReady", () => ({
  useAuthReady: () => ({ user: null, isReady: true, isAuthenticated: false }),
}));

// analyzeJobFit is async AI logic — stub it so tests don't need real APIs
vi.mock("@/lib/analysisEngine", () => ({
  analyzeJobFit: vi.fn(),
}));

// hero-bg.jpg is handled by Vite's asset pipeline at build time; stub it here
// so jsdom doesn't throw on static import resolution.
vi.mock("@/assets/hero-bg.jpg", () => ({ default: "" }));

describe("landing page Sign In button", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("navigates to AUTH_LOGIN when Sign In is clicked", async () => {
    const { default: Index } = await import("@/pages/Index");

    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path={AUTH_LOGIN} element={<LocationDisplay />} />
        </Routes>
      </MemoryRouter>
    );

    // Find the header "Sign In" button (not authenticated path)
    const signInButtons = screen.getAllByRole("button", { name: /sign in/i });
    // Click the first one (header navigation button)
    fireEvent.click(signInButtons[0]);

    expect(screen.getByTestId("location").textContent).toBe(AUTH_LOGIN);
  });
});
