import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react";

export type DownloadStatus =
  | "pending"
  | "downloading"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled";

export interface DownloadItem {
  id: string;
  filename: string;
  status: DownloadStatus;
  bytesReceived: number;
  totalBytes: number | null;
  speed: number;
  progress: number;
  error?: string;
  destPath: string;
  createdAt: number;
  completedAt?: number;
  modelVersionId?: number;
  hash?: string;
  resourceName?: string;
}

interface DownloadContextValue {
  activeDownloads: DownloadItem[];
  downloadHistory: DownloadItem[];
  isPanelOpen: boolean;
  startDownload: (params: {
    hash?: string;
    modelVersionId?: number;
    resourceName: string;
    destDir?: string;
  }) => Promise<{ success: boolean; error?: string; alreadyExists?: boolean }>;
  pauseDownload: (id: string) => Promise<void>;
  resumeDownload: (id: string) => Promise<void>;
  cancelDownload: (id: string) => Promise<void>;
  retryDownload: (id: string) => Promise<void>;
  clearHistory: () => Promise<void>;
  openFolder: (filePath: string) => Promise<void>;
  checkExists: (params: {
    hash?: string;
    name?: string;
  }) => Promise<{ exists: boolean; path?: string }>;
  togglePanel: () => void;
  openPanel: () => void;
  closePanel: () => void;
  totalActive: number;
  hasActiveDownloads: boolean;
}

const DownloadContext = createContext<DownloadContextValue | null>(null);

export function useDownload(): DownloadContextValue {
  const context = useContext(DownloadContext);
  if (!context) {
    throw new Error("useDownload must be used within a DownloadProvider");
  }
  return context;
}

interface DownloadProviderProps {
  children: ReactNode;
}

export function DownloadProvider({ children }: DownloadProviderProps) {
  const [activeDownloads, setActiveDownloads] = useState<DownloadItem[]>([]);
  const [downloadHistory, setDownloadHistory] = useState<DownloadItem[]>([]);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  useEffect(() => {
    window.api.downloadList().then((result) => {
      setActiveDownloads(result.active as DownloadItem[]);
      setDownloadHistory(result.history as DownloadItem[]);
    });

    const unsubscribe = window.api.onDownloadProgress((data) => {
      const item: DownloadItem = {
        id: data.id,
        filename: data.filename,
        status: data.status as DownloadStatus,
        bytesReceived: data.bytesReceived,
        totalBytes: data.totalBytes,
        speed: data.speed,
        progress: data.progress,
        error: data.error,
        destPath: data.destPath,
        createdAt: data.createdAt,
        completedAt: data.completedAt,
        modelVersionId: data.modelVersionId,
        resourceName: data.resourceName,
      };

      if (
        item.status === "completed" ||
        item.status === "failed" ||
        item.status === "cancelled"
      ) {
        setActiveDownloads((prev) => prev.filter((d) => d.id !== item.id));
        if (item.status !== "cancelled") {
          setDownloadHistory((prev) => {
            const filtered = prev.filter((d) => d.id !== item.id);
            return [item, ...filtered];
          });
        }
      } else {
        setActiveDownloads((prev) => {
          const existing = prev.findIndex((d) => d.id === item.id);
          if (existing >= 0) {
            const updated = [...prev];
            updated[existing] = item;
            return updated;
          }
          return [item, ...prev];
        });
      }
    });

    return unsubscribe;
  }, []);

  const startDownload = useCallback(
    async (params: {
      hash?: string;
      modelVersionId?: number;
      resourceName: string;
      destDir?: string;
    }): Promise<{
      success: boolean;
      error?: string;
      alreadyExists?: boolean;
    }> => {
      const result = await window.api.downloadStart(params);

      if (result.alreadyExists) {
        return { success: true, alreadyExists: true };
      }

      if (result.error) {
        return { success: false, error: result.error };
      }

      setIsPanelOpen(true);
      return { success: true };
    },
    [],
  );

  const pauseDownload = useCallback(async (id: string) => {
    await window.api.downloadPause(id);
  }, []);

  const resumeDownload = useCallback(async (id: string) => {
    await window.api.downloadResume(id);
  }, []);

  const cancelDownload = useCallback(async (id: string) => {
    await window.api.downloadCancel(id);
  }, []);

  const retryDownload = useCallback(async (id: string) => {
    await window.api.downloadRetry(id);
  }, []);

  const clearHistory = useCallback(async () => {
    await window.api.downloadClearHistory();
    setDownloadHistory([]);
  }, []);

  const openFolder = useCallback(async (filePath: string) => {
    await window.api.downloadOpenFolder(filePath);
  }, []);

  const checkExists = useCallback(
    async (params: { hash?: string; name?: string }) => {
      return window.api.downloadCheckExists(params);
    },
    [],
  );

  const togglePanel = useCallback(() => {
    setIsPanelOpen((prev) => !prev);
  }, []);

  const openPanel = useCallback(() => {
    setIsPanelOpen(true);
  }, []);

  const closePanel = useCallback(() => {
    setIsPanelOpen(false);
  }, []);

  const value: DownloadContextValue = {
    activeDownloads,
    downloadHistory,
    isPanelOpen,
    startDownload,
    pauseDownload,
    resumeDownload,
    cancelDownload,
    retryDownload,
    clearHistory,
    openFolder,
    checkExists,
    togglePanel,
    openPanel,
    closePanel,
    totalActive: activeDownloads.length,
    hasActiveDownloads: activeDownloads.length > 0,
  };

  return (
    <DownloadContext.Provider value={value}>
      {children}
    </DownloadContext.Provider>
  );
}
