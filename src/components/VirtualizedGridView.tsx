import { forwardRef, useMemo } from "react";
import { VirtuosoGrid } from "react-virtuoso";
import type { CivitAIImage } from "@/types";
import { ImageCard } from "./ImageCard";

interface VirtualizedGridViewProps {
  images: CivitAIImage[];
  hasMore: boolean;
  loading: boolean;
  onLoadMore: () => void;
  onImageClick: (image: CivitAIImage) => void;
  scrollParent: HTMLElement;
}

const gridComponents = {
  List: forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ style, children, ...props }, ref) => (
      <div
        ref={ref}
        {...props}
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))",
          gap: "3px",
          ...style,
        }}
      >
        {children}
      </div>
    )
  ),
  Item: ({
    children,
    ...props
  }: React.HTMLAttributes<HTMLDivElement> & { children?: React.ReactNode }) => (
    <div {...props} style={{ aspectRatio: "1" }}>
      {children}
    </div>
  ),
};

export function VirtualizedGridView({
  images,
  hasMore,
  loading,
  onLoadMore,
  onImageClick,
  scrollParent,
}: VirtualizedGridViewProps) {
  const Footer = useMemo(
    () => () =>
      loading ? (
        <div className="py-6 flex justify-center col-span-full">
          <div className="flex items-center gap-3 text-surface-500 dark:text-surface-400 px-4 py-3 rounded-xl bg-surface-100/80 dark:bg-surface-800/80 border border-surface-200/60 dark:border-surface-700/60">
            <div className="animate-spin h-5 w-5 border-2 border-current border-t-transparent rounded-full" />
            <span className="text-sm font-medium">Loading more...</span>
          </div>
        </div>
      ) : !hasMore && images.length > 0 ? (
        <div className="py-6 flex justify-center col-span-full">
          <p className="text-sm text-surface-400 dark:text-surface-500">
            You've reached the end
          </p>
        </div>
      ) : null,
    [loading, hasMore, images.length]
  );

  return (
    <VirtuosoGrid
      customScrollParent={scrollParent}
      totalCount={images.length}
      components={{
        ...gridComponents,
        Footer,
      }}
      endReached={() => {
        if (hasMore && !loading) {
          onLoadMore();
        }
      }}
      increaseViewportBy={400}
      itemContent={(index) => {
        const image = images[index];
        return (
          <ImageCard
            image={image}
            viewMode="grid"
            onClick={() => onImageClick(image)}
          />
        );
      }}
    />
  );
}
