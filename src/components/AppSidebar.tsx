import { ChevronDown, Shield } from "lucide-react";
import { Logo } from "@/assets/Logo";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAdminRole } from "@/hooks/useAdminRole";
import {
  jobSeekerNav, hiringManagerNav, modes, detectMode, getNavItems,
} from "@/shell/navigation";

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { isAdmin } = useAdminRole();
  const isActive = (path: string) => location.pathname === path;

  const currentMode = detectMode(location.pathname);
  const navItems = getNavItems(currentMode);
  const modeInfo = modes.find((m) => m.value === currentMode)!;

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        {/* Logo */}
        <div className={`flex items-center gap-2 px-4 py-5 ${collapsed ? "justify-center" : ""}`}>
          <Logo size={28} />
          {!collapsed && (
              <span style={{ fontSize: '15px', fontWeight: 500, color: 'var(--text-primary)', letterSpacing: '-0.2px' }}>
                                iCareer<span style={{ color: 'var(--brand)' }}>OS</span>
                                              </span>
                                                        )}
        </div>

        {/* Mode switcher */}
        {!collapsed && (
          <div className="px-3 mb-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-full flex items-center gap-2 rounded-lg border border-border bg-sidebar-accent/30 px-3 py-2 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors">
                  <modeInfo.icon className="h-4 w-4 text-primary" />
                  <span className="flex-1 text-left">{modeInfo.label}</span>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                {modes.map((m) => (
                  <DropdownMenuItem
                    key={m.value}
                    onClick={() => navigate(m.value === "hiring" ? "/hiring-manager" : "/dashboard")}
                    className={currentMode === m.value ? "bg-accent/50" : ""}
                  >
                    <m.icon className="mr-2 h-4 w-4" />
                    {m.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink to={item.url} end className="hover:bg-sidebar-accent/50" activeClassName="bg-sidebar-accent text-sidebar-primary font-medium">
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        {!collapsed && isAdmin && (
          <div className="px-3 pb-2">
            <button
              onClick={() => navigate("/admin")}
              className="w-full flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
            >
              <Shield className="h-4 w-4" />
              <span>Admin Panel</span>
            </button>
          </div>
        )}
        {collapsed && isAdmin && (
          <div className="px-2 pb-2">
            <button
              onClick={() => navigate("/admin")}
              className="w-full flex items-center justify-center rounded-lg border border-destructive/30 bg-destructive/5 p-2 text-destructive hover:bg-destructive/10 transition-colors"
              title="Admin Panel"
            >
              <Shield className="h-4 w-4" />
            </button>
          </div>
        )}
        {!collapsed && (
          <div className="px-4 py-3 text-[10px] text-sidebar-foreground/40">
            iCareerOS — Intelligent Career Operating System
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
