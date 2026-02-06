import { Virtuoso } from "react-virtuoso";
import type { CivitAIImage } from "@/types";
import { ImageCard } from "./ImageCard";

interface VirtualizedListViewProps {
  images: CivitAIImage[];
  hasMore: boolean;
  loading: boolean;
  onLoadMore: () => void;
  onImageClick: (image: CivitAIImage) => void;
  scrollParent: HTMLElement;
}

export function VirtualizedListView({
  images,
  hasMore,
  loading,
  onLoadMore,
  onImageClick,
  scrollParent,
}: VirtualizedListViewProps) {
  return (
    <Virtuoso
      customScrollParent={scrollParent}
      data={images}
      endReached={() => {
        if (hasMore && !loading) {
          onLoadMore();
        }
      }}
      increaseViewportBy={400}
      itemContent={(index, image) => (
        <div className="pb-0.75">
          <ImageCard
            image={image}
            viewMode="list"
            onClick={() => onImageClick(image)}
          />
        </div>
      )}
      components={{
        Footer: () =>
          loading ? (
            <div className="py-6 flex justify-center">
              <div className="flex items-center gap-3 text-surface-500 dark:text-surface-400 px-4 py-3 rounded-xl bg-surface-100/80 dark:bg-surface-800/80 border border-surface-200/60 dark:border-surface-700/60">
                <div className="animate-spin h-5 w-5 border-2 border-current border-t-transparent rounded-full" />
                <span className="text-sm font-medium">Loading more...</span>
              </div>
            </div>
          ) : !hasMore && images.length > 0 ? (
            <div className="py-6 flex justify-center">
              <p className="text-sm text-surface-400 dark:text-surface-500">
                You've reached the end
              </p>
            </div>
          ) : null,
      }}
    />
  );
}
