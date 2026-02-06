import type {
  CivitAIImage,
  CivitAIImagesResponse,
  ImageFilters,
} from "@/types";
import { Models as BASE_MODEL_OPTIONS } from "@/data/civitai";

const API_BASE = "https://civitai.com/api/v1";
const MAX_FETCH_ATTEMPTS = 5;
const CIVITAI_API_KEY_STORAGE = "civitai-api-key";

export function getStoredCivitaiApiKey(): string {
  try {
    return localStorage.getItem(CIVITAI_API_KEY_STORAGE) ?? "";
  } catch {
    return "";
  }
}

export function setStoredCivitaiApiKey(key: string): void {
  try {
    localStorage.setItem(CIVITAI_API_KEY_STORAGE, key);
  } catch {
    void 0;
  }
}

function applyClientFilters(images: CivitAIImage[]): CivitAIImage[] {
  return images.filter((image) => {
    if (!image.meta?.prompt) {
      return false;
    }
    if (image.meta?.prompt.split(" ").length < 10) {
      return false;
    }
    return true;
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

  if (filters.query) {
    params.set("query", filters.query);
  }
  if (filters.sort) {
    params.set("sort", filters.sort);
  }
  if (filters.period && filters.period !== "AllTime") {
    params.set("period", filters.period);
  }
  if (filters.username) {
    params.set("username", filters.username);
  }
  if (filters.postId != null) {
    params.set("postId", filters.postId.toString());
  }
  if (filters.modelId != null) {
    params.set("modelId", filters.modelId.toString());
  }
  if (filters.modelVersionId != null) {
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
  if (cursor) {
    params.set("cursor", cursor);
  }
  const apiKey = getStoredCivitaiApiKey();
  if (apiKey) {
    params.set("apiKey", apiKey);
  }

  const response = await fetch(`${API_BASE}/images?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`);
  }
  return response.json();
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
  if (url.includes("/width=")) {
    return url.replace(/\/width=\d+/, `/width=${width}`);
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
