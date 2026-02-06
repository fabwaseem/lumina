import { useEffect, useState, useCallback, useRef } from "react";
import { VirtuosoMasonry } from "@virtuoso.dev/masonry";
import type { CivitAIImage } from "@/types";
import { ImageCard } from "./ImageCard";

interface VirtualizedMasonryViewProps {
  images: CivitAIImage[];
  hasMore: boolean;
  loading: boolean;
  onLoadMore: () => void;
  onImageClick: (image: CivitAIImage) => void;
  scrollParent: HTMLElement;
}

function useColumnCount() {
  const [columnCount, setColumnCount] = useState(() => {
    if (typeof window === "undefined") return 4;
    if (window.innerWidth < 500) return 1;
    if (window.innerWidth < 768) return 2;
    if (window.innerWidth < 1280) return 3;
    return 4;
  });

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 500) {
        setColumnCount(1);
      } else if (window.innerWidth < 768) {
        setColumnCount(2);
      } else if (window.innerWidth < 1280) {
        setColumnCount(3);
      } else {
        setColumnCount(4);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return columnCount;
}

function useScrollEndDetection(
  scrollParent: HTMLElement | null,
  onEndReached: () => void,
  threshold = 400
) {
  const lastCallRef = useRef(0);

  useEffect(() => {
    if (!scrollParent) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollParent;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

      if (distanceFromBottom < threshold) {
        const now = Date.now();
        if (now - lastCallRef.current > 300) {
          lastCallRef.current = now;
          onEndReached();
        }
      }
    };

    scrollParent.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => {
      scrollParent.removeEventListener("scroll", handleScroll);
    };
  }, [scrollParent, onEndReached, threshold]);
}

const ItemContent = ({
  data,
  context,
}: {
  data: CivitAIImage;
  context: { onImageClick: (image: CivitAIImage) => void };
}) => {
  return (
    <div className="pb-0.75 px-0.5">
      <ImageCard
        image={data}
        viewMode="masonry"
        onClick={() => context.onImageClick(data)}
      />
    </div>
  );
};

export function VirtualizedMasonryView({
  images,
  hasMore,
  loading,
  onLoadMore,
  onImageClick,
  scrollParent,
}: VirtualizedMasonryViewProps) {
  const columnCount = useColumnCount();

  const handleEndReached = useCallback(() => {
    if (hasMore && !loading) {
      onLoadMore();
    }
  }, [hasMore, loading, onLoadMore]);

  useScrollEndDetection(scrollParent, handleEndReached, 400);

  return (
    <div className="relative">
      <VirtuosoMasonry
        data={images}
        columnCount={columnCount}
        context={{ onImageClick }}
        ItemContent={ItemContent}
      />
      {loading && (
        <div className="py-6 flex justify-center">
          <div className="flex items-center gap-3 text-surface-500 dark:text-surface-400 px-4 py-3 rounded-xl bg-surface-100/80 dark:bg-surface-800/80 border border-surface-200/60 dark:border-surface-700/60">
            <div className="animate-spin h-5 w-5 border-2 border-current border-t-transparent rounded-full" />
            <span className="text-sm font-medium">Loading more...</span>
          </div>
        </div>
      )}
      {!loading && !hasMore && images.length > 0 && (
        <div className="py-6 flex justify-center">
          <p className="text-sm text-surface-400 dark:text-surface-500">
            You've reached the end
          </p>
        </div>
      )}
    </div>
  );
}
