import { useLocation, useNavigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { NavLink } from "@/components/NavLink";
import UserMenu from "@/components/UserMenu";
import NotificationCenter from "@/components/NotificationCenter";
import {
  LayoutDashboard, Users, Bot, Shield, Settings, Target, ArrowLeft, UserCircle,
  ScrollText, Layers, Terminal, ClipboardList, LifeBuoy, MessageSquare,
} from "lucide-react";

const adminNav = [
  { title: "Command Center", url: "/admin", icon: LayoutDashboard },
  { title: "Users", url: "/admin/users", icon: Users },
  { title: "The Crew Status", url: "/admin/agents", icon: Bot },
  { title: "Agent Runs", url: "/admin/agent-runs", icon: Bot },
  { title: "Event Log", url: "/admin/logs", icon: ScrollText },
  { title: "Queue", url: "/admin/queue", icon: Layers },
  { title: "Console", url: "/admin/console", icon: Terminal },
  { title: "Audit Log", url: "/admin/audit", icon: ClipboardList },
  { title: "System Monitor", url: "/admin/system", icon: Shield },
  { title: "Support Inbox", url: "/admin/tickets", icon: LifeBuoy },
  { title: "Customer Surveys", url: "/admin/surveys", icon: MessageSquare },
  { title: "Settings", url: "/admin/settings", icon: Settings },
  { title: "My Profile", url: "/admin/profile", icon: UserCircle },
];

function AdminSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const isActive = (path: string) =>
    path === "/admin" ? location.pathname === path : location.pathname.startsWith(path);

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <div className={`flex items-center gap-2 px-4 py-5 ${collapsed ? "justify-center" : ""}`}>
          <div className="w-8 h-8 bg-destructive/80 rounded-lg flex items-center justify-center flex-shrink-0">
            <Shield className="w-4 h-4 text-white" />
          </div>
          {!collapsed && (
            <span className="font-display text-lg font-bold text-sidebar-foreground">Admin</span>
          )}
        </div>

        <SidebarGroup>
          <SidebarGroupLabel>Command Center</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {adminNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
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
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        {!collapsed && (
          <div className="flex items-center gap-2 px-4 py-2">
            <Target className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-[10px] text-sidebar-foreground/40">FitCheck Admin</span>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
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
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
