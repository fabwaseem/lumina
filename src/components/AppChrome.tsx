import {
  Sun,
  Moon,
  Grid3X3,
  List,
  LayoutGrid,
  Menu,
  X,
  Sparkles,
  PanelLeftClose,
  PanelLeft,
  Settings2,
  Minus,
  Square,
} from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { useGallery } from "@/context/GalleryContext";
import { useSettings } from "@/context/SettingsContext";
import { DownloadIndicator } from "./DownloadManager";
import type { ViewMode } from "@/types";

interface AppChromeProps {
  onToggleSidebar: () => void;
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  onToggleCollapse: () => void;
}

const dragStyle = { WebkitAppRegion: "drag" } as React.CSSProperties;
const noDragStyle = { WebkitAppRegion: "no-drag" } as React.CSSProperties;

export function AppChrome({
  onToggleSidebar,
  sidebarOpen,
  sidebarCollapsed,
  onToggleCollapse,
}: AppChromeProps) {
  const { isDark, toggle } = useTheme();
  const { viewMode, setViewMode } = useGallery();
  const { openSettings } = useSettings();

  const viewModes: { mode: ViewMode; icon: typeof Grid3X3; label: string }[] = [
    { mode: "masonry", icon: LayoutGrid, label: "Masonry" },
    { mode: "grid", icon: Grid3X3, label: "Grid" },
    { mode: "list", icon: List, label: "List" },
  ];

  return (
    <header
      className="sticky top-0 z-40 h-10 flex items-center border-b border-surface-200 dark:border-surface-800 bg-surface-100/95 dark:bg-surface-900/95 backdrop-blur-xl shrink-0 overflow-hidden"
      style={dragStyle}
    >
      <div className="flex items-center gap-1 min-w-0 flex-1 pl-2 pr-1">
        <button
          onClick={onToggleSidebar}
          className="lg:hidden p-1.5 rounded-md text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700"
          style={noDragStyle}
          aria-label="Toggle sidebar"
        >
          {sidebarOpen ? <X size={16} /> : <Menu size={16} />}
        </button>
        <button
          onClick={onToggleCollapse}
          className="hidden lg:flex p-1.5 rounded-md text-surface-500 dark:text-surface-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-500/10"
          style={noDragStyle}
          aria-label={sidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
        >
          {sidebarCollapsed ? (
            <PanelLeft size={16} />
          ) : (
            <PanelLeftClose size={16} />
          )}
        </button>
        <div className="flex items-center gap-2 min-w-0 ml-0.5">
          <div className="shrink-0 w-6 h-6 rounded-md bg-linear-to-br from-primary-400 to-primary-600 flex items-center justify-center ring-1 ring-white/20 dark:ring-surface-900/50">
            <Sparkles size={12} className="text-white" />
          </div>
          <span className="text-sm font-semibold text-surface-800 dark:text-surface-100 truncate max-w-30 sm:max-w-35">
            Lumina
          </span>
        </div>
      </div>

      <div
        className="flex items-center gap-1 pr-0 flex-1 justify-end"
        style={noDragStyle}
      >
        <div className="hidden sm:flex items-center rounded-md bg-surface-200/80 dark:bg-surface-700/80 p-0.5 border border-surface-200 dark:border-surface-600">
          {viewModes.map(({ mode, icon: Icon, label }) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`p-1 rounded transition-colors ${
                viewMode === mode
                  ? "bg-white dark:bg-surface-600 text-primary-600 dark:text-primary-400 shadow-sm"
                  : "text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-200"
              }`}
              title={label}
              aria-label={label}
            >
              <Icon size={14} />
            </button>
          ))}
        </div>

        <DownloadIndicator />

        <button
          onClick={toggle}
          className="p-1.5 rounded-md text-surface-500 dark:text-surface-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-500/10"
          aria-label="Toggle theme"
        >
          {isDark ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        <button
          onClick={() => openSettings("app")}
          className="p-1.5 rounded-md text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 hover:bg-surface-200/50 dark:hover:bg-surface-700/50"
          aria-label="Settings"
        >
          <Settings2 size={16} />
        </button>
      </div>

      <div className="flex items-center shrink-0" style={noDragStyle}>
        <button
          type="button"
          onClick={() => window.api.windowMinimize()}
          className="h-10 w-10 flex items-center justify-center text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700"
          aria-label="Minimize"
        >
          <Minus size={14} strokeWidth={2.5} />
        </button>
        <button
          type="button"
          onClick={() => window.api.windowMaximize()}
          className="h-10 w-10 flex items-center justify-center text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700"
          aria-label="Maximize"
        >
          <Square size={12} strokeWidth={2.5} />
        </button>
        <button
          type="button"
          onClick={() => window.api.windowClose()}
          className="h-10 w-10 flex items-center justify-center text-surface-600 dark:text-surface-400 hover:bg-red-500 hover:text-white"
          aria-label="Close"
        >
          <X size={14} strokeWidth={2.5} />
        </button>
      </div>
    </header>
  );
}
