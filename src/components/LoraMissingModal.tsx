import { useState, useEffect } from "react";
import {
  Download,
  AlertCircle,
  Check,
  Loader2,
  X,
  AlertTriangle,
} from "lucide-react";
import { useDownload } from "@/context/DownloadContext";
import { useSettings } from "@/context/SettingsContext";

export interface MissingLora {
  name: string;
  weight: number;
  modelVersionId?: number;
  baseModel?: string;
}

interface LoraMissingModalProps {
  isOpen: boolean;
  onClose: () => void;
  missingLoras: MissingLora[];
  onDownloadComplete: () => void;
}

export function LoraMissingModal({
  isOpen,
  onClose,
  missingLoras,
  onDownloadComplete,
}: LoraMissingModalProps) {
  const { startDownload, activeDownloads, downloadHistory } = useDownload();
  const { maxDownloadSize } = useSettings();
  const [downloading, setDownloading] = useState<Record<string, boolean>>({});
  const [completed, setCompleted] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sizes, setSizes] = useState<Record<string, number>>({});
  const [loadingSizes, setLoadingSizes] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setDownloading({});
      setCompleted({});
      setErrors({});
      setSizes({});
      setLoadingSizes(true);

      const fetchSizes = async () => {
        const newSizes: Record<string, number> = {};
        await Promise.all(
          missingLoras.map(async (lora) => {
            if (lora.modelVersionId) {
              try {
                const info = await window.api.civitaiGetVersionInfo(
                  lora.modelVersionId,
                );
                if (info?.sizeKB) {
                  newSizes[lora.name] = info.sizeKB;
                }
              } catch (e) {
                console.error("Failed to fetch size for", lora.name, e);
              }
            }
          }),
        );
        setSizes(newSizes);
        setLoadingSizes(false);
      };
      fetchSizes();
    }
  }, [isOpen, missingLoras]);

  const handleDownloadAll = async () => {
    for (const lora of missingLoras) {
      if (!lora.modelVersionId) continue;
      if (downloading[lora.name] || completed[lora.name]) continue;

      setDownloading((prev) => ({ ...prev, [lora.name]: true }));
      try {
        const res = await startDownload({
          modelVersionId: lora.modelVersionId,
          resourceName: lora.name,
        });
        if (res.error) {
          setErrors((prev) => ({
            ...prev,
            [lora.name]: res.error || "Failed to start",
          }));
          setDownloading((prev) => ({ ...prev, [lora.name]: false }));
        } else if (res.alreadyExists) {
          setCompleted((prev) => ({ ...prev, [lora.name]: true }));
          setDownloading((prev) => ({ ...prev, [lora.name]: false }));
        }
      } catch (e) {
        setErrors((prev) => ({ ...prev, [lora.name]: "Failed to start" }));
        setDownloading((prev) => ({ ...prev, [lora.name]: false }));
      }
    }
  };

  // Watch download history to mark completions
  useEffect(() => {
    if (!isOpen) return;
    missingLoras.forEach((lora) => {
      if (!lora.modelVersionId) return;
      if (completed[lora.name]) return;

      const inHistory = downloadHistory.find(
        (d) => d.modelVersionId === lora.modelVersionId,
      );
      if (inHistory && inHistory.status === "completed") {
        setCompleted((prev) => ({ ...prev, [lora.name]: true }));
        setDownloading((prev) => ({ ...prev, [lora.name]: false }));
      }
    });
  }, [downloadHistory, isOpen, missingLoras, completed]);

  const getStatus = (lora: MissingLora) => {
    if (completed[lora.name]) return "completed";
    if (errors[lora.name]) return "error";
    if (!lora.modelVersionId) return "unavailable";

    const active = activeDownloads.find(
      (d) => d.modelVersionId === lora.modelVersionId,
    );
    if (active) return "downloading";

    if (downloading[lora.name]) return "downloading"; // optimistic

    return "pending";
  };

  if (!isOpen) return null;

  // Check if all downloadable items are completed
  const allCompleted = missingLoras.every(
    (l) => completed[l.name] || l.modelVersionId === undefined,
  );

  const totalSizeKB = Object.values(sizes).reduce((a, b) => a + b, 0);
  const totalSizeMB = totalSizeKB / 1024;
  const isOverLimit = maxDownloadSize > 0 && totalSizeMB > maxDownloadSize;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="bg-white dark:bg-surface-900 rounded-xl shadow-xl border border-surface-200 dark:border-surface-700 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-surface-200 dark:border-surface-700 flex justify-between items-center">
          <h3 className="font-semibold text-lg flex items-center gap-2 text-surface-900 dark:text-surface-100">
            <AlertCircle className="text-amber-500" size={20} />
            Missing Resources
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-surface-100 dark:hover:bg-surface-800 rounded text-surface-500"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1">
          <p className="mb-4 text-sm text-surface-600 dark:text-surface-300">
            The following LoRA models are missing.
          </p>

          {loadingSizes ? (
            <div className="flex items-center gap-2 text-sm text-surface-500 mb-4">
              <Loader2 className="animate-spin" size={14} /> Calculating
              download size...
            </div>
          ) : (
            <div
              className={`mb-4 p-3 rounded-lg border ${
                isOverLimit
                  ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
                  : "bg-surface-50 dark:bg-surface-800 border-surface-200 dark:border-surface-700"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-surface-700 dark:text-surface-300">
                  Total Download Size:
                </span>
                <span
                  className={`text-sm font-bold ${
                    isOverLimit
                      ? "text-red-600 dark:text-red-400"
                      : "text-surface-900 dark:text-surface-100"
                  }`}
                >
                  {totalSizeMB.toFixed(1)} MB
                </span>
              </div>
              {isOverLimit && (
                <div className="mt-2 flex items-start gap-2 text-xs text-red-600 dark:text-red-400">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                  <span>
                    Exceeds configured limit of {maxDownloadSize} MB. Please
                    confirm you want to proceed with this large download.
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            {missingLoras.map((lora, idx) => {
              const status = getStatus(lora);
              const active = activeDownloads.find(
                (d) => d.modelVersionId === lora.modelVersionId,
              );

              return (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 rounded-lg bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate text-sm text-surface-900 dark:text-surface-100">
                      {lora.name}
                    </div>
                    <div className="text-xs text-surface-500 flex items-center gap-2">
                      Strength: {lora.weight}
                      {lora.baseModel && (
                        <>
                          <span className="text-surface-300">•</span>
                          <span>{lora.baseModel}</span>
                        </>
                      )}
                      {status !== "downloading" && sizes[lora.name] && (
                        <>
                          <span className="text-surface-300">•</span>
                          <span>{(sizes[lora.name] / 1024).toFixed(1)} MB</span>
                        </>
                      )}
                      {status === "unavailable" && (
                        <span className="text-red-500">
                          (Not found on CivitAI)
                        </span>
                      )}
                      {status === "error" && (
                        <span className="text-red-500">
                          ({errors[lora.name]})
                        </span>
                      )}
                    </div>
                    {status === "downloading" && active && (
                      <div className="w-full bg-surface-200 dark:bg-surface-700 h-1.5 mt-2 rounded-full overflow-hidden">
                        <div
                          className="bg-primary-500 h-full transition-all duration-300"
                          style={{ width: `${active.progress}%` }}
                        />
                      </div>
                    )}
                  </div>
                  <div className="ml-3 shrink-0">
                    {status === "completed" ? (
                      <Check className="text-green-500" size={20} />
                    ) : status === "downloading" ? (
                      <Loader2
                        className="animate-spin text-primary-500"
                        size={20}
                      />
                    ) : status === "error" ? (
                      <AlertCircle className="text-red-500" size={20} />
                    ) : (
                      <div className="w-5" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-4 border-t border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800/50 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-surface-700 dark:text-surface-300 hover:bg-surface-200 dark:hover:bg-surface-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
          {allCompleted ? (
            <button
              onClick={onDownloadComplete}
              className="px-4 py-2 text-sm font-medium bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors flex items-center gap-2"
            >
              Proceed
            </button>
          ) : (
            <button
              onClick={handleDownloadAll}
              disabled={Object.values(downloading).some(Boolean)}
              className="px-4 py-2 text-sm font-medium bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {Object.values(downloading).some(Boolean) ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Downloading...
                </>
              ) : (
                <>
                  <Download size={16} />
                  Download All
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
