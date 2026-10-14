import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
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
import { readStorage, sanitizeFilters, writeStorage } from "@/lib/validate";

export const defaultFilters: ImageFilters = {
  query: "",
  sort: "Newest",
  period: "AllTime",
  nsfwLevel: "None",
};

const STORAGE_KEY = "civitai-gallery-filters";

function loadFiltersFromStorage(): ImageFilters {
  const raw = readStorage(STORAGE_KEY);
  if (!raw) return defaultFilters;
  try {
    const parsed = JSON.parse(raw) as Partial<ImageFilters>;
    return sanitizeFilters(parsed, defaultFilters);
  } catch {
    return defaultFilters;
  }
}

function saveFiltersToStorage(filters: ImageFilters): void {
  writeStorage(STORAGE_KEY, JSON.stringify(filters));
}

const GalleryContext = createContext<GalleryContextType | null>(null);

export function GalleryProvider({ children }: { children: ReactNode }) {
  const [images, setImages] = useState<CivitAIImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
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
  const cursorRef = useRef<string | undefined>(undefined);
  const generationRef = useRef(0);
  const [refreshNonce, setRefreshNonce] = useState(0);

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

  const applyPage = useCallback(
    (generation: number, items: CivitAIImage[], nextCursor: string | undefined, append: boolean) => {
      if (generation !== generationRef.current) return;
      setImages((prev) => (append ? [...prev, ...items] : items));
      cursorRef.current = nextCursor;
      setHasMore(!!nextCursor);
      setLoading(false);
    },
    [],
  );

  const loadMore = useCallback(() => {
    if (loading || !hasMore || !cursorRef.current) return;
    const generation = generationRef.current;
    const cursor = cursorRef.current;
    setLoading(true);
    setError(null);
    fetchImages(debouncedFilters, cursor)
      .then((response) => {
        applyPage(
          generation,
          response.items,
          response.metadata.nextCursor,
          true,
        );
      })
      .catch((err: unknown) => {
        if (generation !== generationRef.current) return;
        setError(err instanceof Error ? err.message : "Failed to load images");
        setLoading(false);
      });
  }, [loading, hasMore, debouncedFilters, applyPage]);

  const refresh = useCallback(() => {
    setRefreshNonce((value) => value + 1);
  }, []);

  const setFilters = useCallback((newFilters: Partial<ImageFilters>) => {
    setFiltersState((prev) => sanitizeFilters({ ...prev, ...newFilters }, prev));
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
    const generation = ++generationRef.current;
    let cancelled = false;
    cursorRef.current = undefined;
    setImages([]);
    setHasMore(true);
    setLoading(true);
    setError(null);
    fetchImages(debouncedFilters)
      .then((response) => {
        if (cancelled) return;
        applyPage(generation, response.items, response.metadata.nextCursor, false);
      })
      .catch((err: unknown) => {
        if (cancelled || generation !== generationRef.current) return;
        setError(err instanceof Error ? err.message : "Failed to load images");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedFilters, refreshNonce, applyPage]);

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
