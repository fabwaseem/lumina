import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import type {
  CivitAIImage,
  GalleryContextType,
  ImageFilters,
  ViewMode,
} from "@/types";
import { useDebounce } from "@/hooks/useDebounce";
import { fetchImages } from "@/services/civitai";

export const defaultFilters: ImageFilters = {
  query: "",
  sort: "Newest",
  period: "AllTime",
  nsfwLevel: "None",
};

const STORAGE_KEY = "civitai-gallery-filters";

function loadFiltersFromStorage(): ImageFilters {
  if (typeof window === "undefined") return defaultFilters;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultFilters;
    const parsed = JSON.parse(raw) as Partial<ImageFilters>;
    return {
      ...defaultFilters,
      ...parsed,
      query:
        typeof parsed.query === "string" ? parsed.query : defaultFilters.query,
      sort: parsed.sort ?? defaultFilters.sort,
      period: parsed.period ?? defaultFilters.period,
      nsfwLevel: parsed.nsfwLevel ?? defaultFilters.nsfwLevel,
      baseModels: Array.isArray(parsed.baseModels)
        ? parsed.baseModels
        : defaultFilters.baseModels,
    };
  } catch {
    void 0;
    return defaultFilters;
  }
}

function saveFiltersToStorage(filters: ImageFilters): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
  } catch {
    void 0;
  }
}

const GalleryContext = createContext<GalleryContextType | null>(null);

export function GalleryProvider({ children }: { children: ReactNode }) {
  const [images, setImages] = useState<CivitAIImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [cursor, setCursor] = useState<string | undefined>();
  const [filters, setFiltersState] = useState<ImageFilters>(
    loadFiltersFromStorage
  );

  useEffect(() => {
    saveFiltersToStorage(filters);
  }, [filters]);

  const [viewMode, setViewMode] = useState<ViewMode>("masonry");
  const [selectedImage, setSelectedImageState] = useState<CivitAIImage | null>(
    null
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [saveImageFolder, setSaveImageFolder] = useState("");
  const debouncedFilters = useDebounce(filters, 400);

  const filteredImages = useMemo(() => {
    const hasModel = (img: CivitAIImage) => {
      const resources = img.meta?.resources ?? [];
      return resources.some((r) => (r.type ?? "").toLowerCase() === "model");
    };
    const seenPrompts = new Set<string>();
    const filtered: CivitAIImage[] = [];
    for (const img of images) {
      if (!hasModel(img)) continue;
      const p = img.meta?.prompt ?? "";
      if (seenPrompts.has(p)) continue;
      seenPrompts.add(p);
      filtered.push(img);
    }
    return filtered;
  }, [images]);

  const selectedIndex = useMemo(() => {
    if (!selectedImage) return -1;
    return filteredImages.findIndex((img) => img.id === selectedImage.id);
  }, [selectedImage, filteredImages]);

  const loadImages = useCallback(
    async (isRefresh = false) => {
      if (loading) return;
      setLoading(true);
      setError(null);
      try {
        const currentCursor = isRefresh ? undefined : cursor;
        const response = await fetchImages(filters, currentCursor);
        if (isRefresh) {
          setImages(response.items);
        } else {
          setImages((prev) => [...prev, ...response.items]);
        }
        setCursor(response.metadata.nextCursor);
        setHasMore(!!response.metadata.nextCursor);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load images");
      } finally {
        setLoading(false);
      }
    },
    [filters, cursor, loading]
  );

  const refresh = useCallback(() => {
    setCursor(undefined);
    setImages([]);
    setHasMore(true);
    loadImages(true);
  }, [loadImages]);

  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      loadImages(false);
    }
  }, [loading, hasMore, loadImages]);

  const setFilters = useCallback((newFilters: Partial<ImageFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...newFilters }));
  }, []);

  const setSelectedImage = useCallback((image: CivitAIImage | null) => {
    setSelectedImageState(image);
  }, []);

  const navigateImage = useCallback(
    (direction: "prev" | "next") => {
      if (selectedIndex === -1) return;
      const newIndex =
        direction === "prev" ? selectedIndex - 1 : selectedIndex + 1;
      if (newIndex >= 0 && newIndex < filteredImages.length) {
        setSelectedImageState(filteredImages[newIndex]);
      }
      if (
        direction === "next" &&
        newIndex >= filteredImages.length - 3 &&
        hasMore &&
        !loading
      ) {
        loadMore();
      }
    },
    [selectedIndex, filteredImages, hasMore, loading, loadMore]
  );

  useEffect(() => {
    setCursor(undefined);
    setImages([]);
    setHasMore(true);
    loadImages(true);
  }, [debouncedFilters]);

  return (
    <GalleryContext.Provider
      value={{
        images: filteredImages,
        loading,
        error,
        hasMore,
        filters,
        viewMode,
        selectedImage,
        selectedIndex,
        sidebarCollapsed,
        saveImageFolder,
        setSaveImageFolder,
        setFilters,
        setViewMode,
        setSelectedImage,
        setSidebarCollapsed,
        navigateImage,
        loadMore,
        refresh,
      }}
    >
      {children}
    </GalleryContext.Provider>
  );
}

export function useGallery() {
  const context = useContext(GalleryContext);
  if (!context) {
    throw new Error("useGallery must be used within GalleryProvider");
  }
  return context;
}
