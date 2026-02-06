export interface CivitAIImage {
  id: number;
  url: string;
  hash: string;
  width: number;
  height: number;
  nsfwLevel: number;
  nsfw: boolean;
  browsingLevel: number;
  createdAt: string;
  postId: number;
  stats: ImageStats;
  meta: ImageMeta | null;
  username: string;
  type: string;
}

export interface ImageStats {
  cryCount: number;
  laughCount: number;
  likeCount: number;
  dislikeCount: number;
  heartCount: number;
  commentCount: number;
}

export interface ImageMeta {
  Size?: string;
  seed?: number;
  steps?: number;
  prompt?: string;
  sampler?: string;
  cfgScale?: number;
  negativePrompt?: string;
  Model?: string;
  "Model hash"?: string;
  resources?: ResourceInfo[];
  [key: string]: unknown;
}

export interface ResourceInfo {
  name: string;
  type: string;
  weight?: number;
  hash?: string;
}

export interface CivitAIImagesResponse {
  items: CivitAIImage[];
  metadata: {
    nextCursor?: string;
    currentPage?: number;
    pageSize?: number;
    nextPage?: string;
  };
}

export type ModelType =
  | "Checkpoint"
  | "TextualInversion"
  | "Hypernetwork"
  | "AestheticGradient"
  | "LORA"
  | "LoCon"
  | "Controlnet"
  | "Poses"
  | "Wildcards"
  | "VAE"
  | "Upscaler"
  | "MotionModule"
  | "Other";

export type SortOption = "Most Reactions" | "Most Comments" | "Newest";

export type PeriodOption = "AllTime" | "Year" | "Month" | "Week" | "Day";

export type NsfwLevel = "None" | "Soft" | "Mature" | "X";

export interface ImageFilters {
  query: string;
  sort: SortOption;
  period: PeriodOption;
  modelType?: ModelType;
  baseModels?: string[];
  nsfwLevel: NsfwLevel;
  username?: string;
  postId?: number;
  modelId?: number;
  modelVersionId?: number;
  minReactions?: number;
  minComments?: number;
}

export type ViewMode = "grid" | "list" | "masonry";

export interface ThemeContextType {
  isDark: boolean;
  toggle: () => void;
}

export interface GalleryContextType {
  images: CivitAIImage[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  filters: ImageFilters;
  viewMode: ViewMode;
  selectedImage: CivitAIImage | null;
  selectedIndex: number;
  sidebarCollapsed: boolean;
  saveImageFolder: string;
  setSaveImageFolder: (prefix: string) => void;
  setFilters: (filters: Partial<ImageFilters>) => void;
  setViewMode: (mode: ViewMode) => void;
  setSelectedImage: (image: CivitAIImage | null) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  navigateImage: (direction: "prev" | "next") => void;
  loadMore: () => void;
  refresh: () => void;
}
