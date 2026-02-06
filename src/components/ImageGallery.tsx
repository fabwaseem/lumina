import type { RefObject } from "react";
import { Loader2, AlertCircle, ImageOff } from "lucide-react";
import { useGallery } from "@/context/GalleryContext";
import { VirtualizedListView } from "./VirtualizedListView";
import { VirtualizedGridView } from "./VirtualizedGridView";
import { VirtualizedMasonryView } from "./VirtualizedMasonryView";

interface ImageGalleryProps {
  scrollContainerRef: RefObject<HTMLElement | null>;
}

export function ImageGallery({ scrollContainerRef }: ImageGalleryProps) {
  const {
    images,
    loading,
    error,
    hasMore,
    viewMode,
    setSelectedImage,
    loadMore,
    refresh,
  } = useGallery();

  if (loading && images.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-0 p-6">
        <div className="flex flex-col items-center gap-4 rounded-2xl bg-surface-100/95 dark:bg-surface-900/95 border border-surface-200 dark:border-surface-800 shadow-[0_2px_16px_-4px] shadow-surface-900/10 dark:shadow-black/20 px-10 py-8">
          <Loader2
            className="animate-spin text-primary-500 dark:text-primary-400"
            size={32}
          />
          <span className="text-sm font-medium text-surface-600 dark:text-surface-400">
            Loading gallery...
          </span>
        </div>
      </div>
    );
  }

  if (error && images.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <div className="rounded-2xl bg-red-500/10 dark:bg-red-500/15 border border-red-500/20 p-6 mb-6">
          <AlertCircle className="text-red-500 dark:text-red-400" size={40} />
        </div>
        <h3 className="text-xl font-semibold text-surface-800 dark:text-surface-100 mb-2">
          Failed to load images
        </h3>
        <p className="text-surface-500 dark:text-surface-400 mb-6 max-w-sm">
          {error}
        </p>
        <button
          onClick={refresh}
          className="btn btn-primary rounded-xl px-6 py-2.5 shadow-lg shadow-primary-500/20"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!loading && images.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <div className="rounded-2xl bg-surface-100 dark:bg-surface-800/80 border border-surface-200/80 dark:border-surface-700/80 p-6 mb-6">
          <ImageOff
            className="text-surface-400 dark:text-surface-500"
            size={40}
          />
        </div>
        <h3 className="text-xl font-semibold text-surface-800 dark:text-surface-100 mb-2">
          No images found
        </h3>
        <p className="text-surface-500 dark:text-surface-400 max-w-sm">
          Try adjusting your filters or search query to find more images.
        </p>
      </div>
    );
  }

  const renderGallery = () => {
    const scrollParent = scrollContainerRef.current;
    if (!scrollParent) return null;

    if (viewMode === "list") {
      return (
        <VirtualizedListView
          images={images}
          hasMore={hasMore}
          loading={loading}
          onLoadMore={loadMore}
          onImageClick={setSelectedImage}
          scrollParent={scrollParent}
        />
      );
    }

    if (viewMode === "masonry") {
      return (
        <VirtualizedMasonryView
          images={images}
          hasMore={hasMore}
          loading={loading}
          onLoadMore={loadMore}
          onImageClick={setSelectedImage}
          scrollParent={scrollParent}
        />
      );
    }

    return (
      <VirtualizedGridView
        images={images}
        hasMore={hasMore}
        loading={loading}
        onLoadMore={loadMore}
        onImageClick={setSelectedImage}
        scrollParent={scrollParent}
      />
    );
  };

  return <div className="flex-1 p-2">{renderGallery()}</div>;
}
