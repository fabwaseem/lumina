import type {
  CivitAIImage,
  CivitAIImagesResponse,
  ImageFilters,
} from "@/types";
import { Models as BASE_MODEL_OPTIONS } from "@/data/civitai";
import { readStorage, sanitizeCursor, sanitizeQuery, sanitizeUsername, writeStorage } from "@/lib/validate";

const API_BASE = "https://civitai.com/api/v1";
const MAX_FETCH_ATTEMPTS = 5;
const CIVITAI_API_KEY_STORAGE = "civitai-api-key";

export function getStoredCivitaiApiKey(): string {
  return readStorage(CIVITAI_API_KEY_STORAGE) ?? "";
}

export function setStoredCivitaiApiKey(key: string): void {
  writeStorage(CIVITAI_API_KEY_STORAGE, key);
}

function applyClientFilters(images: CivitAIImage[]): CivitAIImage[] {
  return images.filter((image) => {
    const prompt = image?.meta?.prompt;
    if (typeof prompt !== "string") return false;
    return prompt.trim().split(/\s+/).length >= 10;
  });
}

async function fetchSinglePage(
  filters: ImageFilters,
  cursor?: string
): Promise<CivitAIImagesResponse> {
  const params = new URLSearchParams();
  params.set("limit", "200");
  params.set("withMeta", "true");
  params.set("useIndex", "true");
  params.set("type", "image");

  const query = sanitizeQuery(filters.query);
  if (query) {
    params.set("query", query);
  }
  if (filters.sort) {
    params.set("sort", filters.sort);
  }
  if (filters.period && filters.period !== "AllTime") {
    params.set("period", filters.period);
  }
  const username = sanitizeUsername(filters.username);
  if (username) {
    params.set("username", username);
  }
  if (filters.postId != null && Number.isInteger(filters.postId) && filters.postId > 0) {
    params.set("postId", filters.postId.toString());
  }
  if (filters.modelId != null && Number.isInteger(filters.modelId) && filters.modelId > 0) {
    params.set("modelId", filters.modelId.toString());
  }
  if (
    filters.modelVersionId != null &&
    Number.isInteger(filters.modelVersionId) &&
    filters.modelVersionId > 0
  ) {
    params.set("modelVersionId", filters.modelVersionId.toString());
  }
  if (filters.baseModels && filters.baseModels.length > 0) {
    params.set("baseModels", filters.baseModels.join(","));
  } else {
    params.set("baseModels", BASE_MODEL_OPTIONS.join(","));
  }
  const nsfwMap: Record<string, string> = {
    None: "1",
    Soft: "2",
    Mature: "4",
    X: "8",
  };
  if (filters.nsfwLevel && nsfwMap[filters.nsfwLevel]) {
    params.set("nsfw", filters.nsfwLevel === "None" ? "false" : "true");
  }
  const safeCursor = sanitizeCursor(cursor);
  if (safeCursor) {
    params.set("cursor", safeCursor);
  }
  const headers: Record<string, string> = { Accept: "application/json" };
  const apiKey = getStoredCivitaiApiKey().trim();
  if (apiKey && !/\s/.test(apiKey)) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/images?${params.toString()}`, {
      headers,
      signal: AbortSignal.timeout(20_000),
    });
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new Error("CivitAI request timed out");
    }
    throw new Error("Could not reach CivitAI");
  }
  if (response.status === 401 || response.status === 403) {
    throw new Error("CivitAI rejected the API key");
  }
  if (!response.ok) {
    throw new Error(`CivitAI request failed (${response.status})`);
  }
  let payload: CivitAIImagesResponse;
  try {
    payload = (await response.json()) as CivitAIImagesResponse;
  } catch {
    throw new Error("CivitAI returned an unreadable response");
  }
  if (!payload || !Array.isArray(payload.items)) {
    throw new Error("CivitAI returned an unexpected response");
  }
  return {
    items: payload.items,
    metadata: payload.metadata ?? {},
  };
}

export async function fetchImages(
  filters: ImageFilters,
  cursor?: string
): Promise<CivitAIImagesResponse> {
  let accumulatedItems: CivitAIImage[] = [];
  let currentCursor = cursor;
  let lastMetadata: CivitAIImagesResponse["metadata"] | null = null;
  let attempts = 0;

  while (attempts < MAX_FETCH_ATTEMPTS) {
    attempts++;
    const data = await fetchSinglePage(filters, currentCursor);
    lastMetadata = data.metadata;
    const filteredItems = applyClientFilters(data.items);
    accumulatedItems = [...accumulatedItems, ...filteredItems];

    if (accumulatedItems.length > 0 || !data.metadata.nextCursor) {
      return {
        items: accumulatedItems,
        metadata: { ...lastMetadata, nextCursor: data.metadata.nextCursor },
      };
    }
    currentCursor = data.metadata.nextCursor;
  }

  return {
    items: accumulatedItems,
    metadata: lastMetadata || { nextCursor: undefined },
  };
}

export function getOptimizedImageUrl(url: string, width = 450): string {
  if (!url || typeof url !== "string") return "";
  const safeWidth = Number.isFinite(width)
    ? Math.max(64, Math.min(2048, Math.round(width)))
    : 450;
  if (url.includes("/width=")) {
    return url.replace(/\/width=\d+/, `/width=${safeWidth}`);
  }
  return url;
}

export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + "M";
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + "K";
  }
  return num.toString();
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours === 0) {
      const diffMins = Math.floor(diffMs / (1000 * 60));
      return `${diffMins}m ago`;
    }
    return `${diffHours}h ago`;
  }
  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }
  if (diffDays < 30) {
    return `${Math.floor(diffDays / 7)}w ago`;
  }
  if (diffDays < 365) {
    return `${Math.floor(diffDays / 30)}mo ago`;
  }
  return `${Math.floor(diffDays / 365)}y ago`;
}
