/**
 * Account Settings page — password, MFA (TOTP), Google linking, delete account.
 */

import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Shield, Smartphone, Mail, MessageSquare, Key, Trash2, Loader2, Link2, Unlink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthReady } from "@/hooks/useAuthReady";
import { enrollTOTP, verifyTOTP, unenrollFactor, listFactors, linkWithProvider } from "@/services/user/auth";
import { normalizeError } from "@/lib/normalizeError";
import { toast } from "sonner";

export default function AccountSettings() {
  const navigate = useNavigate();
  const { user } = useAuthReady();

  // Password
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwLoading, setPwLoading] = useState(false);

  // MFA
  const [mfaFactors, setMfaFactors] = useState<any[]>([]);
  const [totpUri, setTotpUri] = useState<string | null>(null);
  const [totpSecret, setTotpSecret] = useState<string | null>(null);
  const [totpFactorId, setTotpFactorId] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [mfaLoading, setMfaLoading] = useState(false);

  // Delete
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [linkLoading, setLinkLoading] = useState<string | null>(null);

  useEffect(() => {
    loadFactors();
  }, []);

  async function loadFactors() {
    const result = await listFactors();
    if (result.factors) setMfaFactors(result.factors);
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) { toast.error("Password must be at least 8 characters."); return; }
    if (newPassword !== confirmPassword) { toast.error("Passwords do not match."); return; }

    setPwLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success("Password updated successfully.");
      setNewPassword(""); setConfirmPassword("");
    } catch (e) {
      toast.error(normalizeError(e));
    } finally { setPwLoading(false); }
  };

  const handleEnrollTOTP = async () => {
    setMfaLoading(true);
    try {
      const result = await enrollTOTP();
      if (result.error) { toast.error(result.error); return; }
      setTotpUri(result.qrUri || null);
      setTotpSecret(result.secret || null);
      setTotpFactorId(result.factorId || null);
    } catch (e) {
      toast.error(normalizeError(e));
    } finally { setMfaLoading(false); }
  };

  const handleVerifyTOTP = async () => {
    if (!totpFactorId || !verifyCode) return;
    setMfaLoading(true);
    try {
      const result = await verifyTOTP(totpFactorId, verifyCode);
      if (result.error) { toast.error(result.error); return; }
      toast.success("Authenticator app enabled!");
      setTotpUri(null); setTotpSecret(null); setTotpFactorId(null); setVerifyCode("");
      await loadFactors();
    } catch (e) {
      toast.error(normalizeError(e));
    } finally { setMfaLoading(false); }
  };

  const handleUnenroll = async (factorId: string) => {
    setMfaLoading(true);
    try {
      const result = await unenrollFactor(factorId);
      if (result.error) { toast.error(result.error); return; }
      toast.success("MFA factor removed.");
      await loadFactors();
    } catch (e) {
      toast.error(normalizeError(e));
    } finally { setMfaLoading(false); }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== "DELETE") return;
    setDeleteLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-own-account`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        }
      );
      if (!resp.ok) throw new Error("Failed to delete account");
      await supabase.auth.signOut();
      navigate("/");
    } catch (e) {
      toast.error(normalizeError(e));
    } finally { setDeleteLoading(false); }
  };

  const activeTotpFactors = mfaFactors.filter(f => f.factor_type === "totp" && f.status === "verified");

  const providers: string[] = useMemo(() => user?.app_metadata?.providers || [], [user]);
  const hasGoogle = providers.includes("google");
  const hasApple = providers.includes("apple");
  const identityCount = user?.identities?.length ?? 0;
  const canUnlink = identityCount > 1;

  const handleLinkProvider = async (provider: "google" | "apple") => {
    setLinkLoading(provider);
    try {
      const result = await linkWithProvider(provider);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`${provider === "google" ? "Google" : "Apple"} account linked!`);
      }
    } catch (e) {
      toast.error(normalizeError(e));
    } finally {
      setLinkLoading(null);
    }
  };

  const handleUnlinkProvider = async (provider: "google" | "apple") => {
    if (!canUnlink) {
      toast.error("Cannot unlink your only sign-in method. Add another provider or set a password first.");
      return;
    }
    const identity = user?.identities?.find(i => i.provider === provider);
    if (!identity) { toast.error("Identity not found."); return; }

    setLinkLoading(provider);
    try {
      const { error } = await supabase.auth.unlinkIdentity(identity);
      if (error) {
        toast.error(normalizeError(error));
      } else {
        toast.success(`${provider === "google" ? "Google" : "Apple"} account unlinked.`);
        // Refresh session to update user metadata
        await supabase.auth.refreshSession();
      }
    } catch (e) {
      toast.error(normalizeError(e));
    } finally {
      setLinkLoading(null);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Account Settings</h1>

      {/* Profile Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Account Info</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Email</span>
            <span className="text-sm font-medium">{user?.email || "—"}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Auth providers</span>
            <div className="flex gap-1">
              {user?.app_metadata?.providers?.map((p: string) => (
                <Badge key={p} variant="secondary" className="text-xs">{p}</Badge>
              )) || <Badge variant="secondary" className="text-xs">email</Badge>}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Connected Accounts */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2"><Link2 className="w-4 h-4" /> Connected Accounts</CardTitle>
          <CardDescription>Link social accounts for faster sign-in</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Google */}
          <div className="flex items-center justify-between p-3 rounded-lg border border-border">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              <div>
                <p className="text-sm font-medium">Google</p>
                <p className="text-xs text-muted-foreground">{hasGoogle ? "Connected" : "Not connected"}</p>
              </div>
            </div>
            {hasGoogle ? (
              <div className="flex items-center gap-2">
                <Badge className="bg-primary/10 text-primary border-0">Linked</Badge>
                <Button size="sm" variant="outline" disabled={!canUnlink || linkLoading === "google"} onClick={() => handleUnlinkProvider("google")}
                  title={!canUnlink ? "Cannot unlink your only sign-in method" : "Unlink Google"}>
                  {linkLoading === "google" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlink className="w-4 h-4" />}
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="outline" disabled={linkLoading === "google"} onClick={() => handleLinkProvider("google")}>
                {linkLoading === "google" ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                Link
              </Button>
            )}
          </div>

          {/* Apple */}
          <div className="flex items-center justify-between p-3 rounded-lg border border-border">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
              </svg>
              <div>
                <p className="text-sm font-medium">Apple</p>
                <p className="text-xs text-muted-foreground">{hasApple ? "Connected" : "Not connected"}</p>
              </div>
            </div>
            {hasApple ? (
              <div className="flex items-center gap-2">
                <Badge className="bg-primary/10 text-primary border-0">Linked</Badge>
                <Button size="sm" variant="outline" disabled={!canUnlink || linkLoading === "apple"} onClick={() => handleUnlinkProvider("apple")}
                  title={!canUnlink ? "Cannot unlink your only sign-in method" : "Unlink Apple"}>
                  {linkLoading === "apple" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlink className="w-4 h-4" />}
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="outline" disabled={linkLoading === "apple"} onClick={() => handleLinkProvider("apple")}>
                {linkLoading === "apple" ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                Link
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2"><Key className="w-4 h-4" /> Change Password</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="newPassword">New Password</Label>
              <Input id="newPassword" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} minLength={8} placeholder="At least 8 characters" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="confirmNewPassword">Confirm New Password</Label>
              <Input id="confirmNewPassword" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Repeat password" />
            </div>
            <Button type="submit" disabled={pwLoading || !newPassword || !confirmPassword} size="sm">
              {pwLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Update Password
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* MFA */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2"><Shield className="w-4 h-4" /> Multi-Factor Authentication</CardTitle>
          <CardDescription>Add an extra layer of security to your account</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* TOTP — fully supported */}
          <div className="flex items-center justify-between p-3 rounded-lg border border-border">
            <div className="flex items-center gap-3">
              <Smartphone className="w-5 h-5 text-primary" />
              <div>
                <p className="text-sm font-medium">Authenticator App</p>
                <p className="text-xs text-muted-foreground">Google Authenticator, Microsoft Authenticator, Authy</p>
              </div>
            </div>
            {activeTotpFactors.length > 0 ? (
              <div className="flex items-center gap-2">
                <Badge className="bg-primary/10 text-primary border-0">Active</Badge>
                <Button variant="outline" size="sm" onClick={() => handleUnenroll(activeTotpFactors[0].id)} disabled={mfaLoading}>Remove</Button>
              </div>
            ) : (
              <Button size="sm" onClick={handleEnrollTOTP} disabled={mfaLoading}>
                {mfaLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                Enable
              </Button>
            )}
          </div>

          {/* TOTP enrollment flow */}
          {totpUri && (
            <div className="p-4 rounded-lg border border-border bg-muted/30 space-y-3">
              <p className="text-sm font-medium">Scan this QR code with your authenticator app:</p>
              <div className="flex justify-center">
                <img src={totpUri} alt="TOTP QR Code" className="w-48 h-48" />
              </div>
              {totpSecret && (
                <p className="text-xs text-muted-foreground text-center">
                  Manual entry: <code className="bg-muted px-1 rounded text-xs">{totpSecret}</code>
                </p>
              )}
              <div className="flex gap-2">
                <Input placeholder="Enter 6-digit code" value={verifyCode} onChange={e => setVerifyCode(e.target.value)} maxLength={6} />
                <Button size="sm" onClick={handleVerifyTOTP} disabled={mfaLoading || verifyCode.length !== 6}>Verify</Button>
              </div>
            </div>
          )}

          <Separator />

          {/* Email MFA — grayed out */}
          <div className="flex items-center justify-between p-3 rounded-lg border border-border opacity-50">
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Email Verification</p>
                <p className="text-xs text-muted-foreground">Receive codes via email</p>
              </div>
            </div>
            <Badge variant="outline" className="text-xs">Coming soon</Badge>
          </div>

          {/* SMS MFA — grayed out */}
          <div className="flex items-center justify-between p-3 rounded-lg border border-border opacity-50">
            <div className="flex items-center gap-3">
              <MessageSquare className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">SMS Verification</p>
                <p className="text-xs text-muted-foreground">Receive codes via text message</p>
              </div>
            </div>
            <Badge variant="outline" className="text-xs">Coming soon</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Delete Account */}
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-lg text-destructive flex items-center gap-2"><Trash2 className="w-4 h-4" /> Delete Account</CardTitle>
          <CardDescription>Permanently delete your account and all associated data. This action cannot be undone.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="deleteConfirm" className="text-sm">Type <strong>DELETE</strong> to confirm</Label>
            <Input id="deleteConfirm" value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} placeholder="DELETE" />
          </div>
          <Button variant="destructive" disabled={deleteConfirm !== "DELETE" || deleteLoading} onClick={handleDeleteAccount}>
            {deleteLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
            Permanently Delete Account
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
/**
 * Account Settings page â appearance, password, MFA (TOTP), Google linking, delete account.
 */

import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
    Shield,
    Smartphone,
    Mail,
    MessageSquare,
    Key,
    Trash2,
    Loader2,
    Link2,
    Unlink,
    Palette,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthReady } from "@/hooks/useAuthReady";
import {
    enrollTOTP,
    verifyTOTP,
    unenrollFactor,
    listFactors,
    linkWithProvider,
} from "@/services/user/auth";
import { normalizeError } from "@/lib/normalizeError";
import { toast } from "sonner";
import ThemeSelector from "@/components/ThemeSelector";

export default function AccountSettings() {
    const navigate = useNavigate();
  const { user } = useAuthReady();

  // Password
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwLoading, setPwLoading] = useState(false);

  // MFA
  const [mfaFactors, setMfaFactors] = useState<any[]>([]);
  const [totpUri, setTotpUri] = useState<string | null>(null);
  const [totpSecret, setTotpSecret] = useState<string | null>(null);
  const [totpFactorId, setTotpFactorId] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [mfaLoading, setMfaLoading] = useState(false);

  // Delete
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [linkLoading, setLinkLoading] = useState<string | null>(null);

  useEffect(() => {
        loadFactors();
}, []);

  async function loadFactors() {
        const result = await listFactors();
    if (result.factors) setMfaFactors(result.factors);
}

  const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
    if (newPassword.length < 8) {
            toast.error("Password must be at least 8 characters.");
            return;
      }
          if (newPassword !== confirmPassword) {
                  toast.error("Passwords do not match.");
            return;
      }
          setPwLoading(true);
          try {
                  const { error } = await supabase.auth.updateUser({
                            password: newPassword,
      });
            if (error) throw error;
            toast.success("Password updated successfully.");
            setNewPassword("");
            setConfirmPassword("");
      } catch (e) {
              toast.error(normalizeError(e));
      } finally {
              setPwLoading(false);
      }
      };
      
        const handleEnrollTOTP = async () => {
              setMfaLoading(true);
          try {
                  const result = await enrollTOTP();
            if (result.error) {
                      toast.error(result.error);
              return;
      }
            setTotpUri(result.qrUri || null);
            setTotpSecret(result.secret || null);
            setTotpFactorId(result.factorId || null);
      } catch (e) {
              toast.error(normalizeError(e));
      } finally {
              setMfaLoading(false);
      }
      };
      
        const handleVerifyTOTP = async () => {
              if (!totpFactorId || !verifyCode) return;
          setMfaLoading(true);
          try {
                  const result = await verifyTOTP(totpFactorId, verifyCode);
            if (result.error) {
                      toast.error(result.error);
              return;
      }
            toast.success("Authenticator app enabled!");
            setTotpUri(null);
            setTotpSecret(null);
            setTotpFactorId(null);
            setVerifyCode("");
            await loadFactors();
      } catch (e) {
              toast.error(normalizeError(e));
      } finally {
              setMfaLoading(false);
      }
      };
      
        const handleUnenroll = async (factorId: string) => {
              setMfaLoading(true);
          try {
                  const result = await unenrollFactor(factorId);
            if (result.error) {
                      toast.error(result.error);
              return;
      }
            toast.success("MFA factor removed.");
            await loadFactors();
      } catch (e) {
              toast.error(normalizeError(e));
      } finally {
              setMfaLoading(false);
      }
      };
      
        const handleDeleteAccount = async () => {
              if (deleteConfirm !== "DELETE") return;
          setDeleteLoading(true);
          try {
                  const {
                            data: { session },
                  } = await supabase.auth.getSession();
            if (!session) throw new Error("Not authenticated");
            const resp = await fetch(
              `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-own-account`,
      {
                  method: "POST",
                headers: {
                              "Content-Type": "application/json",
                  Authorization: `Bearer ${session.access_token}`,
      },
      }
            );
            if (!resp.ok) throw new Error("Failed to delete account");
            await supabase.auth.signOut();
            navigate("/");
      } catch (e) {
              toast.error(normalizeError(e));
      } finally {
              setDeleteLoading(false);
      }
      };
      
        const activeTotpFactors = mfaFactors.filter(
          (f) => f.factor_type === "totp" && f.status === "verified"
        );
      
        const providers: string[] = useMemo(
          () => user?.app_metadata?.providers || [],
          [user]
        );
        const hasGoogle = providers.includes("google");
        const hasApple = providers.includes("apple");
        const identityCount = user?.identities?.length ?? 0;
        const canUnlink = identityCount > 1;
      
        const handleLinkProvider = async (provider: "google" | "apple") => {
              setLinkLoading(provider);
          try {
                  const result = await linkWithProvider(provider);
            if (result.error) {
                      toast.error(result.error);
      } else {
                toast.success(
                            `${provider === "google" ? "Google" : "Apple"} account linked!`
                          );
      }
      } catch (e) {
              toast.error(normalizeError(e));
      } finally {
              setLinkLoading(null);
      }
      };
      
        const handleUnlinkProvider = async (provider: "google" | "apple") => {
              if (!canUnlink) {
                      toast.error(
                                "Cannot unlink your only sign-in method. Add another provider or set a password first."
                              );
            return;
      }
          const identity = user?.identities?.find((i) => i.provider === provider);
          if (!identity) {
                  toast.error("Identity not found.");
            return;
      }
          setLinkLoading(provider);
          try {
                  const { error } = await supabase.auth.unlinkIdentity(identity);
            if (error) {
                      toast.error(normalizeError(error));
      } else {
                toast.success(
                            `${provider === "google" ? "Google" : "Apple"} account unlinked.`
                          );
              await supabase.auth.refreshSession();
      }
      } catch (e) {
              toast.error(normalizeError(e));
      } finally {
              setLinkLoading(null);
      }
      };
      
        return (
          <div className="max-w-2xl mx-auto py-8 px-4 space-y-6">
                <h1 className="text-2xl font-bold text-foreground">Account Settings</h1>
          
            {/* âââ Appearance âââââââââââââââââââââââââââââââââââââââââââââââââââ */}
                <Card>
                        <CardHeader>
                                  <CardTitle className="text-lg flex items-center gap-2">
                                              <Palette className="w-4 h-4" /> Appearance
                                  </CardTitle>
                                  <CardDescription>
                                              Customize how iCareerOS looks on your device
                                  </CardDescription>
                        </CardHeader>
                        <CardContent>
                                  <ThemeSelector />
                        </CardContent>
                </Card>
          
            {/* âââ Account Info ââââââââââââââââââââââââââââââââââââââââââââââââââ */}
                <Card>
                        <CardHeader>
                                  <CardTitle className="text-lg">Account Info</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                                  <div className="flex justify-between items-center">
                                              <span className="text-sm text-muted-foreground">Email</span>
                                              <span className="text-sm font-medium">{user?.email || "â"}</span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                              <span className="text-sm text-muted-foreground">
                                                            Auth providers
                                              </span>
                                              <div className="flex gap-1">
                                                {user?.app_metadata?.providers?.map((p: string) => (
        <Badge key={p} variant="secondary" className="text-xs">
          {p}
        </Badge>
      )) || (
        <Badge variant="secondary" className="text-xs">
                          email
        </Badge>
                                                            )}
                                              </div>
                                  </div>
                        </CardContent>
                </Card>
          
            {/* âââ Connected Accounts ââââââââââââââââââââââââââââââââââââââââââââ */}
                <Card>
                        <CardHeader>
                                  <CardTitle className="text-lg flex items-center gap-2">
                                              <Link2 className="w-4 h-4" /> Connected Accounts
                                  </CardTitle>
                                  <CardDescription>
                                              Link social accounts for faster sign-in
                                  </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {/* Google */}
                                  <div className="flex items-center justify-between p-3 rounded-lg border border-border">
                                              <div className="flex items-center gap-3">
                                                            <svg
                                                                              className="w-5 h-5"
                                                                              viewBox="0 0 24 24"
                                                                              aria-hidden="true"
                                                                            >
                                                                            <path
                                                                                                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                                                                                                fill="#4285F4"
                                                                                              />
                                                                            <path
                                                                                                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                                                                                fill="#34A853"
                                                                                              />
                                                                            <path
                                                                                                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                                                                                fill="#FBBC05"
                                                                                              />
                                                                            <path
                                                                                                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                                                                                fill="#EA4335"
                                                                                              />
                                                            </svg>
                                                            <div>
                                                                            <p className="text-sm font-medium">Google</p>
                                                                            <p className="text-xs text-muted-foreground">
                                                                              {hasGoogle ? "Connected" : "Not connected"}
                                                                              </p>
                                                            </div>
                                              </div>
                                    {hasGoogle ? (
      <div className="flex items-center gap-2">
                      <Badge className="bg-primary/10 text-primary border-0">
                                        Linked
                      </Badge>
                      <Button
                                          size="sm"
                                          variant="outline"
                                          disabled={!canUnlink || linkLoading === "google"}
                                          onClick={() => handleUnlinkProvider("google")}
                                          title={
                                                                !canUnlink
                                                                  ? "Cannot unlink your only sign-in method"
                                                                  : "Unlink Google"
                                          }
                                        >
                        {linkLoading === "google" ? (
                                                              <Loader2 className="w-4 h-4 animate-spin" />
                                                            ) : (
                                                              <Unlink className="w-4 h-4" />
                                                            )}
                      </Button>
      </div>
    ) : (
      <Button
                        size="sm"
                        variant="outline"
                        disabled={linkLoading === "google"}
                        onClick={() => handleLinkProvider("google")}
                      >
        {linkLoading === "google" ? (
                                          <Loader2 className="w-4 h-4 animate-spin mr-1" />
                                        ) : null}
                      Link
      </Button>
                                              )}
                                  </div>
                        
                          {/* Apple */}
                                  <div className="flex items-center justify-between p-3 rounded-lg border border-border">
                                              <div className="flex items-center gap-3">
                                                            <svg
                                                                              className="w-5 h-5"
                                                                              viewBox="0 0 24 24"
                                                                              fill="currentColor"
                                                                              aria-hidden="true"
                                                                            >
                                                                            <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                                                            </svg>
                                                            <div>
                                                                            <p className="text-sm font-medium">Apple</p>
                                                                            <p className="text-xs text-muted-foreground">
                                                                              {hasApple ? "Connected" : "Not connected"}
                                                                              </p>
                                                            </div>
                                              </div>
                                    {hasApple ? (
      <div className="flex items-center gap-2">
                      <Badge className="bg-primary/10 text-primary border-0">
                                        Linked
                      </Badge>
                      <Button
                                          size="sm"
                                          variant="outline"
                                          disabled={!canUnlink || linkLoading === "apple"}
                                          onClick={() => handleUnlinkProvider("apple")}
                                          title={
                                                                !canUnlink
                                                                  ? "Cannot unlink your only sign-in method"
                                                                  : "Unlink Apple"
                                          }
                                        >
                        {linkLoading === "apple" ? (
                                                              <Loader2 className="w-4 h-4 animate-spin" />
                                                            ) : (
                                                              <Unlink className="w-4 h-4" />
                                                            )}
                      </Button>
      </div>
    ) : (
      <Button
                        size="sm"
                        variant="outline"
                        disabled={linkLoading === "apple"}
                        onClick={() => handleLinkProvider("apple")}
                      >
        {linkLoading === "apple" ? (
                                          <Loader2 className="w-4 h-4 animate-spin mr-1" />
                                        ) : null}
                      Link
      </Button>
                                              )}
                                  </div>
                        </CardContent>
                </Card>
          
            {/* âââ Change Password ââââââââââââââââââââââââââââââââââââââââââââââ */}
                <Card>
                        <CardHeader>
                                  <CardTitle className="text-lg flex items-center gap-2">
                                              <Key className="w-4 h-4" /> Change Password
                                  </CardTitle>
                        </CardHeader>
                        <CardContent>
                                  <form onSubmit={handleChangePassword} className="space-y-3">
                                              <div className="space-y-1">
                                                            <Label htmlFor="newPassword">New Password</Label>
                                                            <Input
                                                                              id="newPassword"
                                                                              type="password"
                                                                              value={newPassword}
                                                                              onChange={(e) => setNewPassword(e.target.value)}
                                                                              minLength={8}
                                                                              placeholder="At least 8 characters"
                                                                            />
                                              </div>
                                              <div className="space-y-1">
                                                            <Label htmlFor="confirmNewPassword">Confirm New Password</Label>
                                                            <Input
                                                                              id="confirmNewPassword"
                                                                              type="password"
                                                                              value={confirmPassword}
                                                                              onChange={(e) => setConfirmPassword(e.target.value)}
                                                                              placeholder="Repeat password"
                                                                            />
                                              </div>
                                              <Button
                                                              type="submit"
                                                              disabled={pwLoading || !newPassword || !confirmPassword}
                                                              size="sm"
                                                            >
                                                {pwLoading ? (
                                                                              <Loader2 className="w-4 h-4 animate-spin mr-1" />
                                                                            ) : null}
                                                            Update Password
                                              </Button>
                                  </form>
                        </CardContent>
                </Card>
          
            {/* âââ MFA âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ */}
                <Card>
                        <CardHeader>
                                  <CardTitle className="text-lg flex items-center gap-2">
                                              <Shield className="w-4 h-4" /> Multi-Factor Authentication
                                  </CardTitle>
                                  <CardDescription>
                                              Add an extra layer of security to your account
                                  </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {/* TOTP */}
                                  <div className="flex items-center justify-between p-3 rounded-lg border border-border">
                                              <div className="flex items-center gap-3">
                                                            <Smartphone className="w-5 h-5 text-primary" />
                                                            <div>
                                                                            <p className="text-sm font-medium">Authenticator App</p>
                                                                            <p className="text-xs text-muted-foreground">
                                                                                              Google Authenticator, Microsoft Authenticator, Authy
                                                                              </p>
                                                            </div>
                                              </div>
                                    {activeTotpFactors.length > 0 ? (
      <div className="flex items-center gap-2">
                      <Badge className="bg-primary/10 text-primary border-0">
                                        Active
                      </Badge>
                      <Button
                                          variant="outline"
                           </div>{user?.app_metadata?.providers?.map((p: string) => (
  <Badge key={p} variant="secondary" className="text-xs">{p}</Badge>
)) || <Badge variant="secondary" className="text-xs">email</Badge>}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Connected Accounts */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2"><Link2 className="w-4 h-4" /> Connected Accounts</CardTitle>
          <CardDescription>Link social accounts for faster sign-in</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Google */}
          <div className="flex items-center justify-between p-3 rounded-lg border border-border">
            <div className="flex items-center gap-3">
<svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
</svg>
<div>
  <p className="text-sm font-medium">Google</p>
  <p className="text-xs text-muted-foreground">{hasGoogle ? "Connected" : "Not connected"}</p>
</div>
            </div>
            {hasGoogle ? (
<div className="flex items-center gap-2">
  <Badge className="bg-primary/10 text-primary border-0">Linked</Badge>
  <Button size="sm" variant="outline" disabled={!canUnlink || linkLoading === "google"} onClick={() => handleUnlinkProvider("google")}
    title={!canUnlink ? "Cannot unlink your only sign-in method" : "Unlink Google"}>
    {linkLoading === "google" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlink className="w-4 h-4" />}
  </Button>
</div>
            ) : (
<Button size="sm" variant="outline" disabled={linkLoading === "google"} onClick={() => handleLinkProvider("google")}>
  {linkLoading === "google" ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
  Link
</Button>
            )}
          </div>

          {/* Apple */}
          <div className="flex items-center justify-between p-3 rounded-lg border border-border">
            <div className="flex items-center gap-3">
<svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
  <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
</svg>
<div>
  <p className="text-sm font-medium">Apple</p>
  <p className="text-xs text-muted-foreground">{hasApple ? "Connected" : "Not connected"}</p>
</div>
            </div>
            {hasApple ? (
<div className="flex items-center gap-2">
  <Badge className="bg-primary/10 text-primary border-0">Linked</Badge>
  <Button size="sm" variant="outline" disabled={!canUnlink || linkLoading === "apple"} onClick={() => handleUnlinkProvider("apple")}
    title={!canUnlink ? "Cannot unlink your only sign-in method" : "Unlink Apple"}>
    {linkLoading === "apple" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlink className="w-4 h-4" />}
  </Button>
</div>
            ) : (
<Button size="sm" variant="outline" disabled={linkLoading === "apple"} onClick={() => handleLinkProvider("apple")}>
  {linkLoading === "apple" ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
  Link
</Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2"><Key className="w-4 h-4" /> Change Password</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-3">
            <div className="space-y-1">
<Label htmlFor="newPassword">New Password</Label>
<Input id="newPassword" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} minLength={8} placeholder="At least 8 characters" />
            </div>
            <div className="space-y-1">
<Label htmlFor="confirmNewPassword">Confirm New Password</Label>
<Input id="confirmNewPassword" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Repeat password" />
            </div>
            <Button type="submit" disabled={pwLoading || !newPassword || !confirmPassword} size="sm">
{pwLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
Update Password
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* MFA */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2"><Shield className="w-4 h-4" /> Multi-Factor Authentication</CardTitle>
          <CardDescription>Add an extra layer of security to your account</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* TOTP â fully supported */}
          <div className="flex items-center justify-between p-3 rounded-lg border border-border">
            <div className="flex items-center gap-3">
<Smartphone className="w-5 h-5 text-primary" />
<div>
  <p className="text-sm font-medium">Authenticator App</p>
  <p className="text-xs text-muted-foreground">Google Authenticator, Microsoft Authenticator, Authy</p>
</div>
            </div>
            {activeTotpFactors.length > 0 ? (
<div className="flex items-center gap-2">
  <Badge className="bg-primary/10 text-primary border-0">Active</Badge>
  <Button variant="outline" size="sm" onClick={() => handleUnenroll(activeTotpFactors[0].id)} disabled={mfaLoading}>Remove</Button>
</div>
            ) : (
<Button size="sm" onClick={handleEnrollTOTP} disabled={mfaLoading}>
  {mfaLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
  Enable
</Button>
            )}
          </div>

          {/* TOTP enrollment flow */}
          {totpUri && (
            <div className="p-4 rounded-lg border border-border bg-muted/30 space-y-3">
<p className="text-sm font-medium">Scan this QR code with your authenticator app:</p>
<div className="flex justify-center">
  <img src={totpUri} alt="TOTP QR Code" className="w-48 h-48" />
</div>
{totpSecret && (
  <p className="text-xs text-muted-foreground text-center">
    Manual entry: <code className="bg-muted px-1 rounded text-xs">{totpSecret}</code>
  </p>
)}
<div className="flex gap-2">
  <Input placeholder="Enter 6-digit code" value={verifyCode} onChange={e => setVerifyCode(e.target.value)} maxLength={6} />
  <Button size="sm" onClick={handleVerifyTOTP} disabled={mfaLoading || verifyCode.length !== 6}>Verify</Button>
</div>
            </div>
          )}

          <Separator />

          {/* Email MFA â grayed out */}
          <div className="flex items-center justify-between p-3 rounded-lg border border-border opacity-50">
            <div className="flex items-center gap-3">
<Mail className="w-5 h-5 text-muted-foreground" />
<div>
  <p className="text-sm font-medium text-muted-foreground">Email Verification</p>
  <p className="text-xs text-muted-foreground">Receive codes via email</p>
</div>
            </div>
            <Badge variant="outline" className="text-xs">Coming soon</Badge>
          </div>

          {/* SMS MFA â grayed out */}
          <div className="flex items-center justify-between p-3 rounded-lg border border-border opacity-50">
            <div className="flex items-center gap-3">
<MessageSquare className="w-5 h-5 text-muted-foreground" />
<div>
  <p className="text-sm font-medium text-muted-foreground">SMS Verification</p>
  <p className="text-xs text-muted-foreground">Receive codes via text message</p>
</div>
            </div>
            <Badge variant="outline" className="text-xs">Coming soon</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Delete Account */}
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-lg text-destructive flex items-center gap-2"><Trash2 className="w-4 h-4" /> Delete Account</CardTitle>
          <CardDescription>Permanently delete your account and all associated data. This action cannot be undone.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="deleteConfirm" className="text-sm">Type <strong>DELETE</strong> to confirm</Label>
            <Input id="deleteConfirm" value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} placeholder="DELETE" />
          </div>
          <Button variant="destructive" disabled={deleteConfirm !== "DELETE" || deleteLoading} onClick={handleDeleteAccount}>
            {deleteLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
            Permanently Delete Account
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
