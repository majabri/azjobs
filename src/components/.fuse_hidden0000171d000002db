import { Button } from "@/components/ui/button";
import { LogOut, User } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuthReady } from "@/hooks/useAuthReady";
import { useAdminRole } from "@/hooks/useAdminRole";
import { useProfile } from "@/hooks/useProfile";
import LanguageSwitcher from "@/components/LanguageSwitcher";

export default function UserMenu() {
  const { user } = useAuthReady();
  const { isAdmin } = useAdminRole();
  const { displayName, profile } = useProfile();
  const navigate = useNavigate();
  const location = useLocation();

  if (!user) return null;

  // Prefer profile avatar, then OAuth avatar from user metadata
  const avatar = profile?.avatar_url || user.user_metadata?.avatar_url;

  // Admins always show "Admin"; everyone else gets their editable display name
  const name = isAdmin ? "Admin" : displayName();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    // If logging out from admin area, redirect to main page
    if (location.pathname.startsWith("/admin")) {
      window.location.href = "/";
    } else {
      navigate("/", { replace: true });
    }
  };

  return (
    <div className="flex items-center gap-2">
      <LanguageSwitcher />
      {avatar ? (
        <img src={avatar} alt={name} className="w-7 h-7 rounded-full border border-border" />
      ) : (
        <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center">
          <User className="w-3.5 h-3.5 text-muted-foreground" />
        </div>
      )}
      <span className="text-sm text-muted-foreground font-medium hidden sm:inline max-w-[120px] truncate">
        {name}
      </span>
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground hover:text-destructive"
        onClick={handleLogout}
      >
        <LogOut className="w-4 h-4" />
      </Button>
    </div>
  );
}
