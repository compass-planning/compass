/**
 * navigationStore.ts
 * Global navigation state.
 * Controls sidebar mode and active household/section.
 */
import { create } from 'zustand';

export type HouseholdSection =
  | 'overview'
  | 'retirement'
  | 'networth'
  | 'insurance'
  | 'tax'
  | 'estate'
  | 'documents'
  | 'meetings'
  | 'activity';

interface NavigationState {
  sidebarMode: 'global' | 'household';
  activeHousehold?: { id: number; name: string; province?: string };
  activeSection: HouseholdSection;
  enterHousehold: (household: { id: number; name: string; province?: string }) => void;
  exitHousehold: () => void;
  setSection: (section: HouseholdSection) => void;
}

export const useNavigationStore = create<NavigationState>(set => ({
  sidebarMode:     'global',
  activeHousehold: undefined,
  activeSection:   'overview',

  enterHousehold: household =>
    set({ sidebarMode: 'household', activeHousehold: household, activeSection: 'overview' }),

  exitHousehold: () =>
    set({ sidebarMode: 'global', activeHousehold: undefined }),

  setSection: section =>
    set({ activeSection: section }),
}));
