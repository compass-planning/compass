/**
 * WorkspaceCommandBar.tsx — Light theme
 * Top command bar matching light institutional shell.
 */
import { useState } from "react";
import { Search, Command, Briefcase } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useCurrentStaff } from "@/hooks/use-users";
import { NotificationBell } from "@/components/NotificationBell";

interface Props {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function WorkspaceCommandBar({ collapsed }: Props) {
  const { user } = useAuth();
  const { data: currentStaff } = useCurrentStaff();
  const [focused, setFocused] = useState(false);

  const displayName = currentStaff
    ? [currentStaff.firstName, currentStaff.lastName].filter(Boolean).join(" ")
    : user?.email ?? "Advisor";

  return (
    <header className="h-14 border-b border-slate-200/80 bg-white px-5 flex items-center justify-between flex-shrink-0 z-20">
      {/* Left */}
      <div className="flex items-center gap-5">
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <div className="w-7 h-7 rounded-lg bg-slate-900 flex items-center justify-center">
            <Briefcase className="w-4 h-4 text-white" />
          </div>
          {!collapsed && (
            <span className="text-sm font-semibold text-slate-900 tracking-[-0.01em]">Compass CRM</span>
          )}
        </div>

        {/* Search */}
        <div className={`hidden md:flex items-center gap-2 rounded-xl border transition-all duration-200 ${
          focused ? "border-violet-300 bg-white shadow-sm w-[380px]" : "border-slate-200 bg-slate-50 w-[300px]"
        } px-3 h-9`}>
          <Search className="h-4 w-4 text-slate-400 flex-shrink-0" />
          <input
            placeholder="Search households, plans, policies..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400 text-slate-900"
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
          />
          <div className="flex items-center gap-0.5 rounded-lg bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-400 flex-shrink-0">
            <Command className="h-3 w-3" />K
          </div>
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-2">
        {/* Notification bell — restyled for light */}
        <div className="[&>button]:h-9 [&>button]:w-9 [&>button]:rounded-xl [&>button]:border [&>button]:border-slate-200 [&>button]:bg-white [&>button]:text-slate-600 [&>button]:hover:bg-slate-50">
          <NotificationBell />
        </div>

        {/* Advisor chip */}
        <div className="hidden lg:flex items-center gap-2 h-9 px-3 rounded-xl border border-slate-200 bg-white">
          <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-violet-600 to-violet-400 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">
            {displayName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
          </div>
          <span className="text-xs text-slate-700 font-medium max-w-[120px] truncate">{displayName}</span>
        </div>
      </div>
    </header>
  );
}
