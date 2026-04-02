/**
 * Tests for auth service error normalisation behaviour.
 * Verifies that login(), loginWithGoogle(), etc. always return a plain string
 * in the `error` field — never a raw object that could crash React rendering.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoist mock functions so vi.mock factories can reference them ────────────
const {
  mockSignInWithPassword,
  mockGetUser,
  mockRefreshSession,
  mockSignOut,
  mockSignInWithOAuth,
} = vi.hoisted(() => ({
  mockSignInWithPassword: vi.fn(),
  mockGetUser: vi.fn(),
  mockRefreshSession: vi.fn(),
  mockSignOut: vi.fn(),
  mockSignInWithOAuth: vi.fn(),
}));

// ─── Mock Supabase client ───────────────────────────────────────────────────
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      signInWithPassword: mockSignInWithPassword,
      getUser: mockGetUser,
      refreshSession: mockRefreshSession,
      signOut: mockSignOut,
    },
  },
}));

// ─── Mock Lovable integration ────────────────────────────────────────────────
vi.mock("@/integrations/lovable/index", () => ({
  lovable: {
    auth: {
      signInWithOAuth: mockSignInWithOAuth,
    },
  },
}));

// ─── Import after mocks are registered ──────────────────────────────────────
import { login, loginWithGoogle, getCurrentUser, refreshToken } from "@/services/user/auth";

// ────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

describe("login()", () => {
  it("returns user + session on success", async () => {
    const fakeUser = { id: "u1" };
    const fakeSession = { access_token: "tok" };
    mockSignInWithPassword.mockResolvedValueOnce({
      data: { user: fakeUser, session: fakeSession },
      error: null,
    });

    const result = await login("a@b.com", "pass");
    expect(result.user).toBe(fakeUser);
    expect(result.session).toBe(fakeSession);
    expect(result.error).toBeUndefined();
  });

  it("returns a string error when Supabase returns an Error object", async () => {
    mockSignInWithPassword.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: new Error("Invalid credentials"),
    });

    const result = await login("a@b.com", "wrong");
    expect(typeof result.error).toBe("string");
    expect(result.error).toBe("Invalid credentials");
  });

  it("returns a string error when Supabase returns a plain-object error", async () => {
    mockSignInWithPassword.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: { message: "network failure", code: 503 },
    });

    const result = await login("a@b.com", "pass");
    expect(typeof result.error).toBe("string");
    expect(result.error).toBe("network failure");
  });

  it("returns a string error when signInWithPassword throws", async () => {
    mockSignInWithPassword.mockRejectedValueOnce({ code: 500, reason: "server error" });

    const result = await login("a@b.com", "pass");
    expect(typeof result.error).toBe("string");
    expect(result.error!.length).toBeGreaterThan(0);
  });
});

describe("loginWithGoogle()", () => {
  it("returns empty object on success (redirect handled by SDK)", async () => {
    mockSignInWithOAuth.mockResolvedValueOnce({ redirected: true });

    const result = await loginWithGoogle();
    expect(result.error).toBeUndefined();
  });

  it("returns a string error when OAuth returns an error object", async () => {
    mockSignInWithOAuth.mockResolvedValueOnce({ error: new Error("popup closed") });

    const result = await loginWithGoogle();
    expect(typeof result.error).toBe("string");
    expect(result.error).toBe("popup closed");
  });

  it("returns a string error when OAuth returns a plain-object error", async () => {
    mockSignInWithOAuth.mockResolvedValueOnce({ error: { message: "oauth_error", status: 400 } });

    const result = await loginWithGoogle();
    expect(typeof result.error).toBe("string");
    expect(result.error).toBe("oauth_error");
  });

  it("returns a string error when signInWithOAuth throws", async () => {
    mockSignInWithOAuth.mockRejectedValueOnce(new Error("SDK init failed"));

    const result = await loginWithGoogle();
    expect(typeof result.error).toBe("string");
    expect(result.error).toBe("SDK init failed");
  });

  it("returns a string error even when a non-Error object is thrown", async () => {
    mockSignInWithOAuth.mockRejectedValueOnce({ type: "AuthError", msg: "blocked" });

    const result = await loginWithGoogle();
    expect(typeof result.error).toBe("string");
    expect(result.error!.length).toBeGreaterThan(0);
  });
});

describe("getCurrentUser()", () => {
  it("returns user on success", async () => {
    const fakeUser = { id: "u1" };
    mockGetUser.mockResolvedValueOnce({ data: { user: fakeUser } });

    const user = await getCurrentUser();
    expect(user).toBe(fakeUser);
  });

  it("returns null when getUser throws", async () => {
    mockGetUser.mockRejectedValueOnce(new Error("network error"));

    const user = await getCurrentUser();
    expect(user).toBeNull();
  });
});

describe("refreshToken()", () => {
  it("returns updated session on success", async () => {
    const fakeUser = { id: "u1" };
    const fakeSession = { access_token: "new-tok" };
    mockRefreshSession.mockResolvedValueOnce({
      data: { user: fakeUser, session: fakeSession },
      error: null,
    });

    const result = await refreshToken();
    expect(result.user).toBe(fakeUser);
    expect(result.session).toBe(fakeSession);
    expect(result.error).toBeUndefined();
  });

  it("returns a string error when refresh fails", async () => {
    mockRefreshSession.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: new Error("token expired"),
    });

    const result = await refreshToken();
    expect(typeof result.error).toBe("string");
    expect(result.error).toBe("token expired");
  });
});
