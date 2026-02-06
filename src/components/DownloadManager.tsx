import { useDownload, DownloadItem } from "../context/DownloadContext";
import {
  X,
  Download,
  Pause,
  Play,
  RotateCcw,
  Folder,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
} from "lucide-react";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatSpeed(bytesPerSecond: number): string {
  return `${formatBytes(bytesPerSecond)}/s`;
}

function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ago`;
  }
  if (minutes > 0) {
    return `${minutes}m ago`;
  }
  return `${seconds}s ago`;
}

interface DownloadItemRowProps {
  item: DownloadItem;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
  onOpenFolder: (path: string) => void;
}

function DownloadItemRow({
  item,
  onPause,
  onResume,
  onCancel,
  onRetry,
  onOpenFolder,
}: DownloadItemRowProps) {
  const statusIcon = {
    pending: <Clock className="w-4 h-4 text-surface-400" />,
    downloading: <Loader2 className="w-4 h-4 text-primary-500 animate-spin" />,
    paused: <Pause className="w-4 h-4 text-amber-500" />,
    completed: <CheckCircle className="w-4 h-4 text-green-500" />,
    failed: <XCircle className="w-4 h-4 text-red-500" />,
    cancelled: <XCircle className="w-4 h-4 text-surface-400" />,
  };

  const isActive =
    item.status === "downloading" ||
    item.status === "pending" ||
    item.status === "paused";

  return (
    <div className="p-3 bg-surface-50 dark:bg-surface-800 rounded-lg space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {statusIcon[item.status]}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-surface-800 dark:text-surface-200 truncate">
              {item.resourceName || item.filename}
            </p>
            <p className="text-xs text-surface-500 truncate">{item.filename}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {item.status === "downloading" && (
            <button
              onClick={() => onPause(item.id)}
              className="p-1.5 hover:bg-surface-200 dark:hover:bg-surface-700 rounded transition-colors"
              title="Pause"
            >
              <Pause className="w-4 h-4" />
            </button>
          )}
          {item.status === "paused" && (
            <button
              onClick={() => onResume(item.id)}
              className="p-1.5 hover:bg-surface-200 dark:hover:bg-surface-700 rounded transition-colors"
              title="Resume"
            >
              <Play className="w-4 h-4" />
            </button>
          )}
          {isActive && (
            <button
              onClick={() => onCancel(item.id)}
              className="p-1.5 hover:bg-surface-200 dark:hover:bg-surface-700 rounded transition-colors text-red-500"
              title="Cancel"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          {item.status === "failed" && (
            <button
              onClick={() => onRetry(item.id)}
              className="p-1.5 hover:bg-surface-200 dark:hover:bg-surface-700 rounded transition-colors"
              title="Retry"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
          {item.status === "completed" && (
            <button
              onClick={() => onOpenFolder(item.destPath)}
              className="p-1.5 hover:bg-surface-200 dark:hover:bg-surface-700 rounded transition-colors"
              title="Open folder"
            >
              <Folder className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {isActive && (
        <>
          <div className="w-full bg-surface-200 dark:bg-surface-700 rounded-full h-1.5">
            <div
              className="bg-primary-500 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, item.progress)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-surface-500">
            <span>
              {formatBytes(item.bytesReceived)}
              {item.totalBytes ? ` / ${formatBytes(item.totalBytes)}` : ""}
            </span>
            {item.status === "downloading" && item.speed > 0 && (
              <span>{formatSpeed(item.speed)}</span>
            )}
            {item.status === "paused" && <span>Paused</span>}
            {item.status === "pending" && <span>Pending...</span>}
          </div>
        </>
      )}

      {item.status === "completed" && item.completedAt && (
        <p className="text-xs text-surface-500">
          Completed {formatTime(Date.now() - item.completedAt)}
        </p>
      )}

      {item.status === "failed" && item.error && (
        <p className="text-xs text-red-500 truncate">{item.error}</p>
      )}
    </div>
  );
}

export function DownloadManager() {
  const {
    activeDownloads,
    downloadHistory,
    isPanelOpen,
    closePanel,
    pauseDownload,
    resumeDownload,
    cancelDownload,
    retryDownload,
    openFolder,
    clearHistory,
  } = useDownload();

  if (!isPanelOpen) return null;

  const hasHistory = downloadHistory.length > 0;
  const hasActive = activeDownloads.length > 0;

  return (
    <div className="fixed bottom-4 right-4 w-96 max-h-[70vh] bg-white dark:bg-surface-900 rounded-xl shadow-2xl border border-surface-200 dark:border-surface-700 flex flex-col z-50 overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-surface-200 dark:border-surface-700 shrink-0">
        <div className="flex items-center gap-2">
          <Download className="w-5 h-5 text-primary-500" />
          <h2 className="font-semibold text-surface-800 dark:text-surface-200">
            Downloads
          </h2>
          {hasActive && (
            <span className="px-2 py-0.5 text-xs font-medium bg-primary-100 dark:bg-primary-900 text-primary-600 dark:text-primary-400 rounded-full">
              {activeDownloads.length}
            </span>
          )}
        </div>
        <button
          onClick={closePanel}
          className="p-1.5 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {hasActive && (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-surface-500 uppercase tracking-wider">
              Active
            </h3>
            <div className="space-y-2">
              {activeDownloads.map((item) => (
                <DownloadItemRow
                  key={item.id}
                  item={item}
                  onPause={pauseDownload}
                  onResume={resumeDownload}
                  onCancel={cancelDownload}
                  onRetry={retryDownload}
                  onOpenFolder={openFolder}
                />
              ))}
            </div>
          </div>
        )}

        {hasHistory && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-surface-500 uppercase tracking-wider">
                History
              </h3>
              <button
                onClick={clearHistory}
                className="text-xs text-surface-500 hover:text-surface-700 dark:hover:text-surface-300 flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" />
                Clear
              </button>
            </div>
            <div className="space-y-2">
              {downloadHistory.map((item) => (
                <DownloadItemRow
                  key={item.id}
                  item={item}
                  onPause={pauseDownload}
                  onResume={resumeDownload}
                  onCancel={cancelDownload}
                  onRetry={retryDownload}
                  onOpenFolder={openFolder}
                />
              ))}
            </div>
          </div>
        )}

        {!hasActive && !hasHistory && (
          <div className="py-8 text-center text-surface-500">
            <Download className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No downloads yet</p>
            <p className="text-xs mt-1">
              Download LoRAs from the lightbox to see them here
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export function DownloadIndicator() {
  const { hasActiveDownloads, totalActive, togglePanel, activeDownloads } =
    useDownload();

  const totalProgress =
    activeDownloads.length > 0
      ? activeDownloads.reduce((sum, d) => sum + d.progress, 0) /
        activeDownloads.length
      : 0;

  return (
    <button
      onClick={togglePanel}
      className="relative p-2 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg transition-colors"
      title="Downloads"
    >
      <Download className="w-5 h-5 text-surface-600 dark:text-surface-400" />
      {hasActiveDownloads && (
        <>
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
            {totalActive}
          </span>
          <svg
            className="absolute inset-0 w-full h-full -rotate-90"
            viewBox="0 0 36 36"
          >
            <circle
              className="text-primary-200 dark:text-primary-900"
              strokeWidth="3"
              stroke="currentColor"
              fill="transparent"
              r="14"
              cx="18"
              cy="18"
            />
            <circle
              className="text-primary-500"
              strokeWidth="3"
              strokeDasharray={`${totalProgress * 0.88} 88`}
              strokeLinecap="round"
              stroke="currentColor"
              fill="transparent"
              r="14"
              cx="18"
              cy="18"
            />
          </svg>
        </>
      )}
    </button>
  );
}
