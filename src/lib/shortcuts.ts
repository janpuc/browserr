/** Catalog of global keyboard shortcuts, used by the help overlay and hints. */
export interface ShortcutDef {
  id: string;
  label: string;
  /** Key tokens; "mod" → ⌘ on mac / Ctrl elsewhere. Multiple combos = alternatives. */
  combos: string[][];
  section: "General" | "Navigation" | "In a dialog";
}

export const SHORTCUTS: ShortcutDef[] = [
  { id: "search", label: "Search titles", combos: [["mod", "K"], ["/"]], section: "General" },
  { id: "help", label: "Keyboard shortcuts", combos: [["?"]], section: "General" },
  { id: "settings", label: "Open settings", combos: [["mod", ","]], section: "Navigation" },
  { id: "back", label: "Close / go back", combos: [["Esc"]], section: "Navigation" },
  { id: "refresh", label: "Refresh feed (or pull down at the top)", combos: [["mod", "R"]], section: "Navigation" },
  { id: "dismiss", label: "Close this dialog", combos: [["Esc"]], section: "In a dialog" },
];
