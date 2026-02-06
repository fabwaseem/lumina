import {
  ChevronDown,
  Filter,
  RotateCcw,
  Heart,
  MessageCircle,
  Clock,
  Calendar,
  Shield,
  Eye,
  AlertTriangle,
  Flame,
  Layers,
  User,
  Hash,
  Box,
  FileStack,
  Check,
  Settings2,
  Search,
  WifiOff,
  type LucideIcon,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { defaultFilters, useGallery } from "../context/GalleryContext";
import { useComfyUI } from "@/context/ComfyUIContext";
import { useSettings } from "@/context/SettingsContext";
import { Models as baseModelOptions } from "../data/civitai";
import type { ModelType, NsfwLevel, PeriodOption, SortOption } from "../types";

interface FilterSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const sortOptions: { value: SortOption; icon: LucideIcon; label: string }[] = [
  { value: "Most Reactions", icon: Heart, label: "Reactions" },
  { value: "Most Comments", icon: MessageCircle, label: "Comments" },
  { value: "Newest", icon: Clock, label: "Newest" },
];

const periodOptions: {
  value: PeriodOption;
  label: string;
  short: string;
}[] = [
  { value: "Day", label: "Today", short: "1d" },
  { value: "Week", label: "This Week", short: "1w" },
  { value: "Month", label: "This Month", short: "1m" },
  { value: "Year", label: "This Year", short: "1y" },
  { value: "AllTime", label: "All Time", short: "All" },
];

const modelTypes: ModelType[] = [
  "Checkpoint",
  "LORA",
  "LoCon",
  "TextualInversion",
  "Hypernetwork",
  "Controlnet",
  "VAE",
  "Upscaler",
  "Poses",
  "Wildcards",
  "Other",
];

const nsfwLevels: {
  value: NsfwLevel;
  icon: LucideIcon;
  label: string;
}[] = [
  { value: "None", icon: Shield, label: "Safe" },
  { value: "Soft", icon: Eye, label: "Soft" },
  { value: "Mature", icon: AlertTriangle, label: "Mature" },
  { value: "X", icon: Flame, label: "Explicit" },
];

interface CollapsibleSectionProps {
  title: string;
  icon: LucideIcon;
  defaultOpen?: boolean;
  active?: boolean;
  children: React.ReactNode;
}

function CollapsibleSection({
  title,
  icon: Icon,
  defaultOpen = true,
  active = false,
  children,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="rounded-lg bg-surface-50/80 dark:bg-surface-800/50 border border-surface-200/60 dark:border-surface-700/60 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full py-2.5 px-3 text-sm font-medium text-surface-700 dark:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-700/50 transition-colors"
      >
        <span className="flex items-center gap-2 min-w-0">
          <Icon
            size={15}
            className="shrink-0 text-surface-500 dark:text-surface-400"
          />
          <span className="truncate">{title}</span>
          {active && (
            <span
              className="shrink-0 w-1.5 h-1.5 rounded-full bg-primary-500 dark:bg-primary-400"
              aria-hidden
            />
          )}
        </span>
        <ChevronDown
          size={14}
          className={`shrink-0 text-surface-400 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>
      <div
        className={`overflow-hidden transition-all duration-200 ${
          isOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="p-1 border-t border-surface-200/60 dark:border-surface-700/60">
          {children}
        </div>
      </div>
    </div>
  );
}

export function FilterSidebar({ isOpen, onClose }: FilterSidebarProps) {
  const { filters, setFilters } = useGallery();
  const { openSettings } = useSettings();
  const { connected, queue_running, queue_pending } = useComfyUI();
  const [searchValue, setSearchValue] = useState(filters.query);
  const debouncedSearch = useDebounce(searchValue, 500);

  useEffect(() => {
    setSearchValue(filters.query);
  }, [filters.query]);

  useEffect(() => {
    if (debouncedSearch !== filters.query) {
      setFilters({ query: debouncedSearch });
    }
  }, [debouncedSearch, filters.query, setFilters]);

  const [usernameInput, setUsernameInput] = useState(filters.username || "");
  const [postIdInput, setPostIdInput] = useState(
    filters.postId?.toString() || ""
  );
  const [modelIdInput, setModelIdInput] = useState(
    filters.modelId?.toString() || ""
  );
  const [modelVersionIdInput, setModelVersionIdInput] = useState(
    filters.modelVersionId?.toString() || ""
  );

  const handleReset = () => {
    setUsernameInput("");
    setPostIdInput("");
    setModelIdInput("");
    setModelVersionIdInput("");
    setFilters(defaultFilters);
  };

  const handleUsernameChange = (value: string) => {
    setUsernameInput(value);
    setFilters({ username: value || undefined });
  };

  const handlePostIdChange = (value: string) => {
    setPostIdInput(value);
    const num = parseInt(value);
    setFilters({ postId: isNaN(num) ? undefined : num });
  };

  const handleModelIdChange = (value: string) => {
    setModelIdInput(value);
    const num = parseInt(value);
    setFilters({ modelId: isNaN(num) ? undefined : num });
  };

  const handleModelVersionIdChange = (value: string) => {
    setModelVersionIdInput(value);
    const num = parseInt(value);
    setFilters({ modelVersionId: isNaN(num) ? undefined : num });
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed lg:sticky top-10 left-0 h-[calc(100vh-2.5rem)] w-64 flex flex-col bg-surface-100/95 dark:bg-surface-900/95 backdrop-blur-xl border-r border-surface-200 dark:border-surface-800 z-50 lg:z-auto transform transition-transform duration-300 ease-out shadow-[2px_0_16px_-4px] shadow-surface-900/10 dark:shadow-black/30 ${
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-surface-200 dark:border-surface-800 shrink-0">
          <span className="flex items-center gap-2 text-sm font-semibold text-surface-800 dark:text-surface-100">
            <Filter
              size={16}
              className="text-primary-500 dark:text-primary-400"
            />
            Filters
          </span>
          <button
            onClick={handleReset}
            className="p-2 rounded-lg text-surface-500 dark:text-surface-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors"
            title="Reset all"
            aria-label="Reset filters"
          >
            <RotateCcw size={16} />
          </button>
        </div>

        <div className="shrink-0 p-3 border-b border-surface-200 dark:border-surface-800">
          <div className="relative group">
            <Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-surface-400 group-focus-within:text-primary-500 pointer-events-none"
            />
            <input
              type="text"
              placeholder="Search..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="w-full h-8 pl-8 pr-2.5 rounded-lg border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 text-surface-900 dark:text-surface-100 placeholder:text-surface-400 focus:outline-none focus:ring-1 focus:ring-primary-500/50 focus:border-primary-500 text-sm"
            />
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="p-3 space-y-2">
            <CollapsibleSection
              title="Sort"
              icon={Clock}
              defaultOpen
              active={filters.sort !== "Newest"}
            >
              <div className="flex gap-1.5">
                {sortOptions.map(({ value, icon: Icon, label }) => (
                  <button
                    key={value}
                    onClick={() => setFilters({ sort: value })}
                    title={label}
                    className={`flex-1 flex items-center justify-center p-2 rounded-lg transition-all duration-150 ${
                      filters.sort === value
                        ? "bg-primary-500/15 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400 ring-1 ring-primary-500/30"
                        : "text-surface-500 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800"
                    }`}
                  >
                    <Icon size={18} />
                  </button>
                ))}
              </div>
            </CollapsibleSection>

            <CollapsibleSection
              title="Period"
              icon={Calendar}
              active={filters.period !== "AllTime"}
            >
              <div className="flex flex-wrap gap-1">
                {periodOptions.map(({ value, short, label }) => (
                  <button
                    key={value}
                    onClick={() => setFilters({ period: value })}
                    title={label}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 ${
                      filters.period === value
                        ? "bg-primary-500/15 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400 ring-1 ring-primary-500/30"
                        : "text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800"
                    }`}
                  >
                    {short}
                  </button>
                ))}
              </div>
            </CollapsibleSection>

            <CollapsibleSection
              title="Content"
              icon={Shield}
              defaultOpen
              active={filters.nsfwLevel !== "None"}
            >
              <div className="grid grid-cols-2 gap-1.5">
                {nsfwLevels.map(({ value, icon: Icon, label }) => (
                  <button
                    key={value}
                    onClick={() => setFilters({ nsfwLevel: value })}
                    title={label}
                    className={`flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-medium transition-all duration-150 ${
                      filters.nsfwLevel === value
                        ? "bg-primary-500/15 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400 ring-1 ring-primary-500/30"
                        : "text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800"
                    }`}
                  >
                    <Icon size={14} />
                    <span className="truncate">{label}</span>
                  </button>
                ))}
              </div>
            </CollapsibleSection>

            <CollapsibleSection
              title="Model type"
              icon={Layers}
              defaultOpen={false}
              active={filters.modelType != null}
            >
              <div className="space-y-0.5 max-h-44 overflow-y-auto">
                <button
                  onClick={() => setFilters({ modelType: undefined })}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-all duration-150 ${
                    !filters.modelType
                      ? "bg-primary-500/15 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400 font-medium"
                      : "text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800"
                  }`}
                >
                  All
                </button>
                {modelTypes.map((type) => (
                  <button
                    key={type}
                    onClick={() => setFilters({ modelType: type })}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-all duration-150 truncate ${
                      filters.modelType === type
                        ? "bg-primary-500/15 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400 font-medium"
                        : "text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800"
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </CollapsibleSection>

            <CollapsibleSection
              title="Base model"
              icon={Box}
              defaultOpen={false}
              active={(filters.baseModels?.length ?? 0) > 0}
            >
              <div className="space-y-0.5 max-h-44 overflow-y-auto">
                <button
                  onClick={() => setFilters({ baseModels: undefined })}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-all duration-150 ${
                    !filters.baseModels?.length
                      ? "bg-primary-500/15 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400 font-medium"
                      : "text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800"
                  }`}
                >
                  All
                </button>
                {baseModelOptions.map((model) => {
                  const selected = filters.baseModels?.includes(model) ?? false;
                  return (
                    <button
                      key={model}
                      onClick={() => {
                        const current = filters.baseModels ?? [];
                        if (selected) {
                          setFilters({
                            baseModels:
                              current.length <= 1
                                ? undefined
                                : current.filter((m) => m !== model),
                          });
                        } else {
                          setFilters({
                            baseModels: [...current, model],
                          });
                        }
                      }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-all duration-150 truncate flex items-center gap-2 ${
                        selected
                          ? "bg-primary-500/15 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400 font-medium"
                          : "text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800"
                      }`}
                    >
                      <span
                        className={`shrink-0 w-3.5 h-3.5 rounded border flex items-center justify-center ${
                          selected
                            ? "bg-primary-500 border-primary-500 dark:bg-primary-400 dark:border-primary-400"
                            : "border-surface-400 dark:border-surface-500"
                        }`}
                      >
                        {selected && (
                          <Check
                            size={10}
                            className="text-white"
                            strokeWidth={3}
                          />
                        )}
                      </span>
                      {model}
                    </button>
                  );
                })}
              </div>
            </CollapsibleSection>

            <CollapsibleSection
              title="Advanced"
              icon={Hash}
              defaultOpen={false}
              active={
                !!(
                  filters.username ||
                  filters.postId != null ||
                  filters.modelId != null ||
                  filters.modelVersionId != null
                )
              }
            >
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <User size={14} className="shrink-0 text-surface-400" />
                  <input
                    type="text"
                    value={usernameInput}
                    onChange={(e) => handleUsernameChange(e.target.value)}
                    placeholder="Username"
                    className="flex-1 min-w-0 input text-xs py-1.5 px-2 rounded-lg"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Hash size={14} className="shrink-0 text-surface-400" />
                  <input
                    type="number"
                    value={postIdInput}
                    onChange={(e) => handlePostIdChange(e.target.value)}
                    placeholder="Post ID"
                    className="flex-1 min-w-0 input text-xs py-1.5 px-2 rounded-lg"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Box size={14} className="shrink-0 text-surface-400" />
                  <input
                    type="number"
                    value={modelIdInput}
                    onChange={(e) => handleModelIdChange(e.target.value)}
                    placeholder="Model ID"
                    className="flex-1 min-w-0 input text-xs py-1.5 px-2 rounded-lg"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <FileStack size={14} className="shrink-0 text-surface-400" />
                  <input
                    type="number"
                    value={modelVersionIdInput}
                    onChange={(e) => handleModelVersionIdChange(e.target.value)}
                    placeholder="Version ID"
                    className="flex-1 min-w-0 input text-xs py-1.5 px-2 rounded-lg"
                  />
                </div>
              </div>
            </CollapsibleSection>
          </div>
        </div>

        <div className="shrink-0 p-3 pt-2 border-t border-surface-200 dark:border-surface-800 bg-surface-50/80 dark:bg-surface-800/30 space-y-2">
          <button
            type="button"
            onClick={() => openSettings("comfyui")}
            className={`w-full flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-medium transition-colors ${
              connected
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25"
                : "bg-surface-200 dark:bg-surface-700 text-surface-500 dark:text-surface-400 border border-surface-300 dark:border-surface-600 hover:bg-surface-300 dark:hover:bg-surface-600"
            }`}
            title={
              connected
                ? `Queue: ${queue_running.length} running, ${queue_pending.length} pending`
                : "ComfyUI – set URL"
            }
          >
            {connected ? (
              <>
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <Layers size={16} />
                {queue_running.length + queue_pending.length > 0 ? (
                  <span>
                    {queue_running.length + queue_pending.length} in queue
                  </span>
                ) : (
                  <span>ComfyUI Ready</span>
                )}
              </>
            ) : (
              <>
                <WifiOff size={16} />
                <span>ComfyUI off</span>
                <Settings2 size={14} />
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => openSettings()}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium text-surface-700 dark:text-surface-200 bg-surface-200 dark:bg-surface-700 hover:bg-surface-300 dark:hover:bg-surface-600 transition-colors"
          >
            <Settings2 size={18} />
            Settings
          </button>
        </div>
      </aside>
    </>
  );
}
