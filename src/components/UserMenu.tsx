import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { LogOut, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { User as SupaUser } from "@supabase/supabase-js";

export default function UserMenu() {
  const [user, setUser] = useState<SupaUser | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setUser(session?.user ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => setUser(session?.user ?? null));
    return () => subscription.unsubscribe();
  }, []);

  if (!user) return null;

  const avatar = user.user_metadata?.avatar_url;
  const name = user.user_metadata?.full_name || user.email?.split("@")[0] || "User";

  return (
    <div className="flex items-center gap-2">
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
        onClick={async () => { await supabase.auth.signOut(); }}
      >
        <LogOut className="w-4 h-4" />
      </Button>
    </div>
  );
}
