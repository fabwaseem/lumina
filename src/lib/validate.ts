export type SortOption = "Most Reactions" | "Most Comments" | "Newest";
export type PeriodOption = "AllTime" | "Year" | "Month" | "Week" | "Day";
export type NsfwLevel = "None" | "Soft" | "Mature" | "X";

export interface SanitizedFilters {
  query: string;
  sort: SortOption;
  period: PeriodOption;
  nsfwLevel: NsfwLevel;
  baseModels?: string[];
  username?: string;
  postId?: number;
  modelId?: number;
  modelVersionId?: number;
}

const SORT_OPTIONS: readonly SortOption[] = [
  "Most Reactions",
  "Most Comments",
  "Newest",
];
const PERIOD_OPTIONS: readonly PeriodOption[] = [
  "AllTime",
  "Year",
  "Month",
  "Week",
  "Day",
];
const NSFW_LEVELS: readonly NsfwLevel[] = ["None", "Soft", "Mature", "X"];

function hasControlChar(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 31 || code === 127) return true;
  }
  return false;
}

const MAX_QUERY_LENGTH = 200;
const MAX_USERNAME_LENGTH = 100;
const MAX_CURSOR_LENGTH = 2000;

export function isOneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
): value is T {
  return typeof value === "string" && allowed.some((item) => item === value);
}

export function isHttpUrl(value: string): boolean {
  if (!value || value.length > 2048) return false;
  try {
    const url = new URL(value);
    if (url.username || url.password) return false;
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    if (!url.hostname || url.hostname.includes(" ")) return false;
    return true;
  } catch {
    return false;
  }
}

export function isCivitaiAssetUrl(value: string): boolean {
  if (!isHttpUrl(value)) return false;
  const url = new URL(value);
  if (url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase();
  return host === "civitai.com" || host.endsWith(".civitai.com");
}

export function isModelHash(value: unknown): value is string {
  return typeof value === "string" && /^[a-fA-F0-9]{8,64}$/.test(value);
}

export function parsePositiveInt(
  value: unknown,
  max = Number.MAX_SAFE_INTEGER,
): number | null {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(numeric) || numeric <= 0 || numeric > max) return null;
  return numeric;
}

export function clampInt(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(min, Math.min(max, Math.round(numeric)));
}

export function sanitizeFilename(name: string, fallback = "download"): string {
  const leaf = name.replace(/\\/g, "/").split("/").pop() ?? "";
  const cleaned = leaf
    .split("")
    .map((char) =>
      hasControlChar(char) || "<>:\"/\\|?*".includes(char) ? "_" : char,
    )
    .join("")
    .replace(/^\.+/, "")
    .trim()
    .slice(0, 180);
  if (!cleaned || cleaned === "." || cleaned === "..") return fallback;
  return cleaned;
}

export function isSafeComfyName(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (!value || value.length > 255) return false;
  if (value.includes("\0") || value.includes("..")) return false;
  if (/[\\/]/.test(value)) return false;
  return true;
}

export function isPromptId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);
}

export function normalizeApiKey(value: unknown): string | null {
  if (value == null) return "";
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.length > 256 || /\s/.test(trimmed)) return null;
  return trimmed;
}

export function sanitizeQuery(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .split("")
    .filter((char) => !hasControlChar(char))
    .join("")
    .trim()
    .slice(0, MAX_QUERY_LENGTH);
}

export function sanitizeUsername(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value
    .split("")
    .filter((char) => !hasControlChar(char))
    .join("")
    .trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, MAX_USERNAME_LENGTH);
}

export function sanitizeCursor(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_CURSOR_LENGTH) return undefined;
  if (hasControlChar(trimmed)) return undefined;
  return trimmed;
}

export function sanitizeSaveFolder(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > 120 || trimmed.includes("\0") || trimmed.includes("..")) {
    return undefined;
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9 _./\\-]{0,119}$/.test(trimmed)) return undefined;
  return trimmed;
}

export function sanitizeFilters(
  input: Partial<SanitizedFilters> | null | undefined,
  fallback: SanitizedFilters,
): SanitizedFilters {
  const source = input ?? {};
  const baseModels = Array.isArray(source.baseModels)
    ? source.baseModels
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter((item) => item.length > 0 && item.length <= 80)
        .slice(0, 40)
    : fallback.baseModels;

  return {
    ...fallback,
    query: sanitizeQuery(source.query ?? fallback.query),
    sort: isOneOf(source.sort, SORT_OPTIONS) ? source.sort : fallback.sort,
    period: isOneOf(source.period, PERIOD_OPTIONS)
      ? source.period
      : fallback.period,
    nsfwLevel: isOneOf(source.nsfwLevel, NSFW_LEVELS)
      ? source.nsfwLevel
      : fallback.nsfwLevel,
    baseModels,
    username: sanitizeUsername(source.username),
    postId: parsePositiveInt(source.postId) ?? undefined,
    modelId: parsePositiveInt(source.modelId) ?? undefined,
    modelVersionId: parsePositiveInt(source.modelVersionId) ?? undefined,
  };
}

export function readStorage(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    return;
  }
}

export function removeStorage(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    return;
  }
}
