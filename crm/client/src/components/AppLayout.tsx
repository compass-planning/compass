import { GlobalSearch } from "@/components/GlobalSearch";
import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, Users, PieChart, Settings, Search, UserCog, LogOut, Mail, CalendarDays, Mic, TrendingUp, Building2, CheckSquare, PanelLeftClose, PanelLeftOpen, LineChart, Sun } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { CompassLogo } from "@/components/CompassLogo";
import { useCurrentStaff } from "@/hooks/use-users";
import { useCompanySettings } from "@/hooks/use-company";
import { NotificationBell } from "@/components/NotificationBell";
import { MorningDigest } from "@/components/MorningDigest";
import { NotificationPoller } from "@/components/NotificationPoller";
import { useWindowManager } from "@/contexts/WindowManagerContext";
import { LanguageToggle } from "@/components/ui/LanguageToggle";
import { useT } from "@/hooks/useT";
import React from "react";
import type { UserRole, Company } from "@shared/schema";

type ModuleKey = keyof Pick<Company,
  "moduleEmail" | "moduleCalendar" | "moduleInsurance" | "moduleMutualFund" |
  "moduleSegFund" | "moduleMeetingRecorder" | "moduleAnalytics" | "modulePipeline" |
  "moduleFinancialPlanning"
>;

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles?: UserRole[];
  moduleKey?: ModuleKey;
}

export function AppLayout({ children, sidebarOverride, noPadding, workspaceMode }: { children: React.ReactNode; sidebarOverride?: React.ReactNode; noPadding?: boolean; workspaceMode?: boolean }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { data: currentStaff } = useCurrentStaff();
  const { data: companyConfig } = useCompanySettings();
  const { openWindow: _openWindow } = useWindowManager();
  const { t, isFr } = useT();

  const navItems: NavItem[] = [
    { href: "/", label: t("nav.dashboard"), icon: LayoutDashboard },
    { href: "/briefing", label: isFr ? "Briefing quotidien" : "Daily Briefing", icon: Sun },
    { href: "/pipeline", label: t("nav.pipeline"), icon: TrendingUp, moduleKey: "modulePipeline" },
    { href: "/tasks", label: t("nav.tasks"), icon: CheckSquare },
    { href: "/clients", label: t("nav.clients"), icon: Users },
    { href: "/financial-planning", label: t("nav.financialPlanning"), icon: LineChart, roles: ["general_manager", "sales_manager", "advisor"], moduleKey: "moduleFinancialPlanning" },
    { href: "/users", label: t("nav.team"), icon: UserCog, roles: ["general_manager", "office_admin", "sales_manager", "advisor_admin"] },
    { href: "/analytics", label: t("nav.analytics"), icon: PieChart, roles: ["general_manager", "sales_manager"], moduleKey: "moduleAnalytics" },
    { href: "/email", label: t("nav.email"), icon: Mail, moduleKey: "moduleEmail" },
    { href: "/calendar", label: t("nav.calendar"), icon: CalendarDays, moduleKey: "moduleCalendar" },
    { href: "/meeting-recorder", label: t("nav.meetings"), icon: Mic, moduleKey: "moduleMeetingRecorder" },
    { href: "/settings", label: t("nav.settings"), icon: Settings },
    { href: "/company-settings", label: t("nav.companySettings"), icon: Building2, roles: ["general_manager"] },
  ];

  const [searchOpen, setSearchOpen] = useState(false);

  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem("sidebar-collapsed") === "true"; }
    catch { return false; }
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(prev => !prev);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    try { localStorage.setItem("sidebar-collapsed", String(collapsed)); }
    catch { /* noop */ }
  }, [collapsed]);

  const userRole = currentStaff?.role as UserRole | undefined;

  const filteredNavItems = navItems.filter(item => {
    if (item.roles) {
      if (!userRole) return true;
      if (!item.roles.includes(userRole)) return false;
    }
    if (item.moduleKey && companyConfig) {
      if (companyConfig[item.moduleKey] === false) return false;
    }
    return true;
  });

  const initials = user
    ? `${(user.firstName || "")[0] || ""}${(user.lastName || "")[0] || ""}`.toUpperCase() || "?"
    : "?";
  const displayName = user
    ? [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || "User"
    : "User";

  return (
    <div style={{ display: "flex", height: "100vh", backgroundColor: "#f1f5f9", color: "#0f172a", fontFamily: "Inter, DM Sans, sans-serif" }}>
      {/* ── Global navigation sidebar ─────────────────────────────────── */}
      <aside
        className={`${workspaceMode ? "w-[60px]" : collapsed ? "w-[72px]" : "w-64"} flex flex-col z-10 relative transition-all duration-300 text-primary-foreground`}
        style={{ background: "linear-gradient(160deg, #2d1b69 0%, #1e1044 100%)", boxShadow: "0 4px 24px rgba(15,23,42,0.18)" }}
      >
        <div className={`${(workspaceMode || collapsed) ? "p-4 justify-center" : "p-5"} flex items-center space-x-3`}>
          {(!collapsed && !workspaceMode) ? (
            <CompassLogo variant="sidebar" product="crm" light />
          ) : (
            <CompassLogo variant="icon" product="crm" size={32} />
          )}
        </div>

        {(sidebarOverride && !workspaceMode) ? (
          <div className="flex-1 overflow-y-auto text-primary-foreground">
            {sidebarOverride}
          </div>
        ) : (
          <>
            {!collapsed && !workspaceMode && (
              <div className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-primary-foreground/50">
                {t("nav.mainMenu")}
              </div>
            )}
            <nav className={`flex-1 ${collapsed ? "px-2" : "px-4"} space-y-1 mt-2 overflow-y-auto`}>
              {filteredNavItems.map((item) => {
                const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    className={`
                      flex items-center ${(workspaceMode || collapsed) ? "justify-center px-2" : "space-x-3 px-4"} py-3 rounded-xl transition-all duration-200
                      ${isActive ? "bg-white/10 text-white shadow-sm font-medium" : "text-primary-foreground/70 hover:bg-white/5 hover:text-white"}
                    `}
                    data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    <item.icon className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-secondary" : ""}`} />
                    {!collapsed && !workspaceMode && <span className="text-xs">{item.label}</span>}
                  </Link>
                );
              })}
            </nav>
          </>
        )}

        {!workspaceMode && <div className={collapsed ? "p-2" : "p-6"}>
          <button
            onClick={() => setCollapsed(!collapsed)}
            data-testid="button-toggle-sidebar"
            className={`flex items-center ${collapsed ? "justify-center w-full" : "justify-center w-full"} p-2 rounded-xl text-primary-foreground/50 hover:text-white hover:bg-white/10 transition-colors mb-3`}
            title={collapsed ? t("action.expand") : t("action.collapse")}
          >
            {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
          {collapsed ? (
            <div className="flex flex-col items-center gap-2">
              {user?.profileImageUrl ? (
                <img src={user.profileImageUrl} alt={displayName} className="w-9 h-9 rounded-full object-cover shadow-lg" />
              ) : (
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg" style={{ background: "linear-gradient(135deg, #a78bfa, #7c3aed)" }}>
                  {initials}
                </div>
              )}
              <button
                onClick={() => logout()}
                data-testid="button-logout"
                title="Sign Out"
                className="p-2 rounded-xl text-primary-foreground/70 hover:text-white hover:bg-white/10 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
              <div className="flex items-center space-x-3">
                {user?.profileImageUrl ? (
                  <img src={user.profileImageUrl} alt={displayName} className="w-10 h-10 rounded-full object-cover shadow-lg" />
                ) : (
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shadow-lg" style={{ background: "linear-gradient(135deg, #a78bfa, #7c3aed)" }}>
                    {initials}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" data-testid="text-sidebar-user">{displayName}</p>
                  <p className="text-xs text-primary-foreground/60 truncate">{user?.email || ""}</p>
                </div>
              </div>
              <button
                onClick={() => logout()}
                data-testid="button-logout"
                className="mt-3 flex items-center justify-center space-x-2 w-full px-3 py-2 rounded-xl text-xs font-medium text-primary-foreground/70 hover:text-white hover:bg-white/10 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>{t("action.signOut")}</span>
              </button>
            </div>
          )}
        </div>}
      </aside>

      {/* ── Workspace sidebar (shown when workspaceMode + sidebarOverride) ── */}
      {workspaceMode && sidebarOverride && (
        <div style={{ width: "260px", flexShrink: 0, backgroundColor: "#ffffff", borderRight: "1px solid #e2e8f0", overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {sidebarOverride}
        </div>
      )}

      <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative", backgroundColor: "#f1f5f9" }}>
        <header style={{ height: "56px", backgroundColor: "#ffffff", borderBottom: "1px solid rgb(226 232 240)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 2rem", zIndex: 10, flexShrink: 0 }}>
          <div className="relative w-96">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder={isFr ? "Rechercher clients, polices ou plans..." : "Search clients, policies, or plans..."}
              readOnly
              onClick={() => setSearchOpen(true)}
              className="w-full pl-10 pr-4 py-2.5 bg-background/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200 cursor-pointer"
            />
            <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 text-xs text-muted-foreground bg-muted rounded border border-border">
              <span>⌘K</span>
            </kbd>
          </div>
          <div className="flex items-center gap-3">
            <LanguageToggle />
            <NotificationBell />
          </div>
        </header>

        <div style={{ flex: 1, overflow: "auto", position: "relative", backgroundColor: "#f1f5f9", padding: noPadding ? 0 : "2rem" }}>
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-secondary/5 rounded-full blur-[100px] pointer-events-none -z-10" />
          <div className="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full blur-[100px] pointer-events-none -z-10" style={{ background: "radial-gradient(circle, rgba(124,58,237,0.04) 0%, rgba(167,139,250,0.04) 100%)" }} />
          
          <div style={noPadding ? { height: "100%" } : { maxWidth: "80rem", margin: "0 auto", position: "relative", zIndex: 10 }}>
            {children}
          </div>
        </div>
      </main>
      <MorningDigest />
      <NotificationPoller />
      <GlobalSearch isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
