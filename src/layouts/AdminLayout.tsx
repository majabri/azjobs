import { useLocation, useNavigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { NavLink } from "@/components/NavLink";
import UserMenu from "@/components/UserMenu";
import NotificationCenter from "@/components/NotificationCenter";
import {
  LayoutDashboard,
  Users,
  Bot,
  Shield,
  Settings,
  Target,
  ArrowLeft,
  UserCircle,
  ScrollText,
  Layers,
  Terminal,
  ClipboardList,
  LifeBuoy,
  MessageSquare,
  LogOut,
  Globe,
  Activity,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { logger } from '@/lib/logger';

interface AdminNavItem {
  title: string;
  url: string;
  icon: typeof LayoutDashboard;
}

interface AdminNavGroup {
  label: string;
  items: AdminNavItem[];
}

const adminNavGroups: AdminNavGroup[] = [
  {
    label: "Overview",
    items: [
      {
        title: "Command Center",
        url: "/admin",
        icon: LayoutDashboard,
      },
    ],
  },
  {
    label: "User Management",
    items: [
      {
        title: "Users",
        url: "/admin/users",
        icon: Users,
      },
      {
        title: "Support Inbox",
        url: "/admin/tickets",
        icon: LifeBuoy,
      },
      {
        title: "Customer Surveys",
        url: "/admin/surveys",
        icon: MessageSquare,
      },
    ],
  },
  {
    label: "AI & Automation",
    items: [
      {
        title: "The Crew Status",
        url: "/admin/agents",
        icon: Bot,
      },
      {
        title: "Agent Runs",
        url: "/admin/agent-runs",
        icon: Bot,
      },
      {
        title: "Queue",
        url: "/admin/queue",
        icon: Layers,
      },
    ],
  },
  {
    label: "System & Monitoring",
    items: [
      {
        title: "System Monitor",
        url: "/admin/system",
        icon: Shield,
      },
      {
        title: "Console",
        url: "/admin/console",
        icon: Terminal,
      },
      {
        title: "Event Log",
        url: "/admin/logs",
        icon: ScrollText,
      },
      {
        title: "Audit Log",
        url: "/admin/audit",
        icon: ClipboardList,
      },
      {
        title: "Pipeline Events",
        url: "/admin/events",
        icon: Activity,
      },
      {
        title: "Platform Settings",
        url: "/admin/platform-settings",
        icon: Globe,
      },
    ],
  },
  {
    label: "Account",
    items: [
      {
        title: "Settings",
        url: "/admin/settings",
        icon: Settings,
      },
      {
        title: "My Profile",
        url: "/admin/profile",
        icon: UserCircle,
      },
    ],
  },
];

function AdminSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path: string) =>
    path === "/admin"
      ? location.pathname === path
      : location.pathname.startsWith(path);

  // ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ FIX 3.1.5: Sign Out handler ÃÂ¢ÃÂÃÂ clears session & redirects to /auth/login ÃÂ¢ÃÂÃÂÃÂ¢ÃÂÃÂ
  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      logger.error("Sign out error:", e);
    }
    navigate("/auth/login", { replace: true });
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <div
          className={`flex items-center gap-2 px-4 py-5 ${
            collapsed ? "justify-center" : ""
          }`}
        >
          <div className="w-8 h-8 bg-destructive/80 rounded-lg flex items-center justify-center flex-shrink-0">
            <Shield className="w-4 h-4 text-white" />
          </div>
          {!collapsed && (
            <span className="font-display text-lg font-bold text-sidebar-foreground">
              Admin
            </span>
          )}
        </div>

        {adminNavGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.url)}
                    >
                      <NavLink
                        to={item.url}
                        end={item.url === "/admin"}
                        className="hover:bg-sidebar-accent/50"
                        activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                      >
                        <item.icon className="mr-2 h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <button
                    onClick={() => navigate("/dashboard")}
                    className="w-full hover:bg-sidebar-accent/50 flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-muted-foreground"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    {!collapsed && <span>Back to App</span>}
                  </button>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {/* FIX 3.1.5: Sign Out button in the sidebar */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <button
                    onClick={handleSignOut}
                    className="w-full hover:bg-destructive/10 flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-destructive/70 hover:text-destructive"
                  >
                    <LogOut className="h-4 w-4" />
                    {!collapsed && <span>Sign Out</span>}
                  </button>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        {!collapsed && (
          <div className="flex items-center gap-2 px-4 py-2">
            <Target className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-[10px] text-sidebar-foreground/40">
              iCareerOS Admin
            </span>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AdminSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-40 px-4">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="text-muted-foreground" />
              <span className="text-xs font-medium text-destructive bg-destructive/10 border border-destructive/20 px-2 py-0.5 rounded-full">
                Admin Mode
              </span>
            </div>
            <div className="flex items-center gap-2">
              <NotificationCenter />
              <UserMenu />
            </div>
          </header>
          <main className="flex-1 overflow-auto">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
