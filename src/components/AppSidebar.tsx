import { Target } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { useAdminRole } from "@/hooks/useAdminRole";
import { jobSeekerNav } from "@/shell/navigation";

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { isAdmin } = useAdminRole();
  const isActive = (path: string) => location.pathname === path;

  // Filter nav: adminOnly items only shown to admins
  const navItems = jobSeekerNav.filter(item => !item.adminOnly || isAdmin);

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        {/* Logo */}
        <div className={`flex items-center gap-2 px-4 py-5 ${collapsed ? "justify-center" : ""}`}>
          <div className="w-8 h-8 gradient-teal rounded-lg flex items-center justify-center shadow-teal flex-shrink-0">
            <Target className="w-4 h-4 text-white" />
          </div>
          {!collapsed && (
            <span className="font-display text-lg font-bold text-sidebar-foreground">FitCheck</span>
          )}
        </div>

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
        {!collapsed && (
          <div className="px-4 py-3 text-[10px] text-sidebar-foreground/40">
            FitCheck AI Career OS
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
