import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useHostUser } from "@/hooks/use-host";
import {
  LayoutDashboard,
  Building2,
  PieChart,
  Receipt,
  Headphones,
  Settings,
  LogOut,
  Shield,
  Users,
  Mail,
  CalendarDays,
} from "lucide-react";

const allNavItems = [
  {
    label: "Dashboard",
    path: "/host",
    icon: LayoutDashboard,
    roles: [] as string[],
  },
  { label: "Inbox", path: "/host/inbox", icon: Mail, roles: [] as string[] },
  {
    label: "Calendar",
    path: "/host/calendar",
    icon: CalendarDays,
    roles: [] as string[],
  },
  {
    label: "Business Clients",
    path: "/host/clients",
    icon: Building2,
    roles: ["admin", "sales", "manager"],
  },
  {
    label: "Analytics",
    path: "/host/analytics",
    icon: PieChart,
    roles: ["admin", "manager", "development"],
  },
  {
    label: "Accounting",
    path: "/host/accounting",
    icon: Receipt,
    roles: ["admin", "accounting"],
  },
  {
    label: "Service",
    path: "/host/service",
    icon: Headphones,
    roles: ["admin", "service"],
  },
  { label: "Users", path: "/host/users", icon: Users, roles: ["admin"] },
  {
    label: "Settings",
    path: "/host/settings",
    icon: Settings,
    roles: ["admin"],
  },
];

export function HostLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { data: hostUser } = useHostUser();
  const userRoles = (hostUser?.roles as string[]) ?? [];

  const visibleNav = allNavItems.filter(
    (item) =>
      item.roles.length === 0 || item.roles.some((r) => userRoles.includes(r)),
  );

  return (
    <div className="flex h-screen bg-background" data-testid="host-layout">
      <aside className="w-64 border-r border-border bg-white flex flex-col">
        <div className="p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-display font-bold text-primary">
                Compass CRM
              </h1>
              <p className="text-xs text-muted-foreground font-medium">
                Corporate Portal
              </p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1" data-testid="host-nav">
          {visibleNav.map((item) => {
            const isActive =
              location === item.path ||
              (item.path !== "/host" && location.startsWith(item.path));
            return (
              <Link key={item.path} href={item.path}>
                <div
                  data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
              {user?.firstName?.[0] ?? "H"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {userRoles.join(", ")}
              </p>
            </div>
          </div>
          <button
            onClick={() => logout()}
            data-testid="button-logout"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground w-full px-2 py-2 rounded-lg hover:bg-muted transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="p-8 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
