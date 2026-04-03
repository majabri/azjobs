import { Target } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarFooter, SidebarHeader, useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAdminRole } from "@/hooks/useAdminRole";
import {
  modes, detectMode, getNavItems,
} from "@/shell/navigation";

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { isAdmin } = useAdminRole();

  // Use exact match OR startsWith with "/" boundary so /dashboard matches
  // /dashboard/sub-page but NOT /dashboard-settings (different prefix)
  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + "/");

  // Filter nav: adminOnly items only shown to admins
  const navItems = jobSeekerNav.filter(item => !item.adminOnly || isAdmin);

  return (
    <TooltipProvider delayDuration={300}>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          {/* Logo */}
          <div className={`flex items-center gap-2 px-4 py-3 ${collapsed ? "justify-center" : ""}`}>
            <div className="w-8 h-8 gradient-teal rounded-lg flex items-center justify-center shadow-teal flex-shrink-0">
              <Target className="w-4 h-4 text-white" />
            </div>
            {!collapsed && (
              <span className="font-display text-lg font-bold text-sidebar-foreground">FitCheck</span>
            )}
          </div>

          {/* Mode switcher — full when expanded, icon-only when collapsed */}
          <div className="px-3 mb-1">
            {!collapsed ? (
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
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button className="w-full flex items-center justify-center rounded-lg border border-border bg-sidebar-accent/30 p-2 text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors">
                        <modeInfo.icon className="h-4 w-4 text-primary" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right">{modeInfo.label}</TooltipContent>
                  </Tooltip>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="right" align="start" className="w-48">
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
            )}
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Navigation</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                      <NavLink to={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          {isAdmin && (
            <div className={collapsed ? "px-2 pb-2" : "px-3 pb-2"}>
              {collapsed ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => navigate("/admin")}
                      className="w-full flex items-center justify-center rounded-lg border border-destructive/30 bg-destructive/5 p-2 text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <Shield className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">Admin Panel</TooltipContent>
                </Tooltip>
              ) : (
                <button
                  onClick={() => navigate("/admin")}
                  className="w-full flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <Shield className="h-4 w-4" />
                  <span>Admin Panel</span>
                </button>
              )}
            </div>
          )}
          {!collapsed && (
            <div className="px-4 py-3 text-[10px] text-sidebar-foreground/40">
              FitCheck AI Career OS
            </div>
          )}
        </SidebarFooter>
      </Sidebar>
    </TooltipProvider>
  );
}

