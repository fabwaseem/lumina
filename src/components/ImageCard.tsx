import { useState, useEffect } from "react";
import {
  User,
  Sparkles,
  SendHorizontal,
  Loader2,
  Check,
  Box,
  Layers,
  Download,
} from "lucide-react";
import type { CivitAIImage, ViewMode } from "@/types";
import { formatDate, getOptimizedImageUrl } from "@/services/civitai";
import { getStoredDownloadPath } from "@/services/app";
import {
  queueComfyUI,
  getComfyUIViewUrl,
  getStoredComfyWorkflow,
} from "@/services/comfyui";
import { useGallery } from "@/context/GalleryContext";
import { useComfyUI } from "@/context/ComfyUIContext";
import { useComfyUIJob } from "@/hooks/useComfyUIJob";
import { comfyLabel } from "@/lib/utils";
import { useSettings } from "@/context/SettingsContext";
import { LoraMissingModal } from "./LoraMissingModal";

interface ImageCardProps {
  image: CivitAIImage;
  viewMode: ViewMode;
  onClick: () => void;
}

export function ImageCard({ image, viewMode, onClick }: ImageCardProps) {
  const { saveImageFolder } = useGallery();
  const { connected } = useComfyUI();
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [comfyPromptId, setComfyPromptId] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadDone, setDownloadDone] = useState(false);
  const jobState = useComfyUIJob(comfyPromptId);
  const [missingLoras, setMissingLoras] = useState<
    Array<{ name: string; weight: number; id?: number }>
  >([]);
  const [showMissingModal, setShowMissingModal] = useState(false);
  const { autoLora, openWorkflowModal } = useSettings();
  useEffect(() => {
    if (jobState.phase === "done") {
      const t = setTimeout(() => setComfyPromptId(null), 3000);
      return () => clearTimeout(t);
    }
  }, [jobState.phase]);

  const handleSendToComfy = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!image.meta?.prompt || isSending || comfyPromptId) return;
    if (!getStoredComfyWorkflow()) {
      openWorkflowModal();
      return;
    }
    setIsSending(true);

    if (autoLora) {
      const validation = await window.api.comfyuiValidateResources(
        image.meta.resources,
      );
      if (!validation.valid && validation.missing.length > 0) {
        setMissingLoras(validation.missing);
        setShowMissingModal(true);
        setIsSending(false);
        return;
      }
    }

    setIsSending(true);
    try {
      const result = await queueComfyUI({
        prompt: image.meta.prompt,
        negativePrompt: image.meta.negativePrompt,
        seed: image.meta.seed,
        saveImageFolder: saveImageFolder || undefined,
        width: image.width,
        height: image.height,
      });
      if (result.prompt_id) setComfyPromptId(result.prompt_id);
    } catch {
      setIsSending(false);
    } finally {
      setIsSending(false);
    }
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDownloading) return;
    setIsDownloading(true);
    setDownloadDone(false);
    const ext =
      /\.(png|jpe?g|webp|gif)$/i.exec(image.url)?.[1]?.toLowerCase() ?? "png";
    const suggestedName = `lumina-${image.id}.${ext}`;
    const result = await window.api.downloadImage(
      image.url,
      suggestedName,
      getStoredDownloadPath(),
    );
    setIsDownloading(false);
    if (!result.error) {
      setDownloadDone(true);
      setTimeout(() => setDownloadDone(false), 2000);
    }
  };

  const resources = image.meta?.resources ?? [];
  const modelCount = resources.filter(
    (r) => (r.type ?? "").toLowerCase() === "model",
  ).length;
  const loraCount = resources.filter((r) =>
    ["lora", "loras"].includes((r.type ?? "").toLowerCase()),
  ).length;

  const aspectRatio = image.height / image.width;
  const optimizedUrl = getOptimizedImageUrl(
    image.url,
    viewMode === "list" ? 300 : 450,
  );

  if (viewMode === "list") {
    return (
      <article
        onClick={onClick}
        className="flex gap-4 p-4 rounded-xl border border-surface-200/80 dark:border-surface-700/80 bg-white dark:bg-surface-900/80 shadow-sm hover:shadow-md hover:border-primary-300/50 dark:hover:border-primary-600/50 cursor-pointer group animate-fade-in transition-all duration-200"
      >
        <div className="relative w-32 h-32 sm:w-48 sm:h-48 shrink-0 rounded-xl overflow-hidden bg-surface-100 dark:bg-surface-800 ring-1 ring-surface-200/50 dark:ring-surface-700/50">
          {!loaded && !error && <div className="absolute inset-0 skeleton" />}
          {!error ? (
            <img
              src={optimizedUrl}
              alt={image.meta?.prompt?.slice(0, 100) || "AI Generated Image"}
              className={`w-full h-full object-cover transition-all duration-500 group-hover:scale-105 ${
                loaded ? "opacity-100" : "opacity-0"
              }`}
              loading="lazy"
              onLoad={() => setLoaded(true)}
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <Sparkles className="text-surface-400" size={32} />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex items-center gap-2 text-sm text-surface-500 dark:text-surface-400 mb-2">
            <User size={14} />
            <span className="font-medium">{image.username}</span>
            <span className="text-surface-300 dark:text-surface-600">|</span>
            <span>{formatDate(image.createdAt)}</span>
          </div>

          {image.meta?.prompt && (
            <p className="text-sm text-surface-700 dark:text-surface-300 line-clamp-3 mb-3">
              {image.meta.prompt}
            </p>
          )}

          <div className="mt-auto flex flex-wrap items-center gap-3">
            {modelCount > 0 && (
              <span
                className="flex items-center gap-1 text-surface-500 dark:text-surface-400"
                title={`${modelCount} model${modelCount !== 1 ? "s" : ""}`}
              >
                <Box size={15} />
                <span className="text-sm font-medium tabular-nums">
                  {modelCount}
                </span>
              </span>
            )}
            {loraCount > 0 && (
              <span
                className="flex items-center gap-1 text-surface-500 dark:text-surface-400"
                title={`${loraCount} LoRA${loraCount !== 1 ? "s" : ""}`}
              >
                <Layers size={15} />
                <span className="text-sm font-medium tabular-nums">
                  {loraCount}
                </span>
              </span>
            )}
            <span
              className="text-xs text-surface-400 dark:text-surface-500 ml-auto"
              title="Dimensions"
            >
              {image.width}×{image.height}
            </span>
            <button
              type="button"
              onClick={handleDownload}
              disabled={isDownloading}
              className="btn btn-ghost p-1.5 text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800 rounded"
              title={downloadDone ? "Saved" : "Download"}
            >
              {isDownloading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : downloadDone ? (
                <Check size={16} className="text-green-500" />
              ) : (
                <Download size={16} />
              )}
            </button>
            {connected && image.meta?.prompt && (
              <div className="flex items-center gap-1.5">
                {jobState.phase === "done" && jobState.doneImage && (
                  <a
                    href={getComfyUIViewUrl(
                      jobState.doneImage.filename,
                      jobState.doneImage.subfolder,
                      jobState.doneImage.type,
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="w-8 h-8 rounded-lg overflow-hidden border border-surface-200 dark:border-surface-700 shrink-0"
                  >
                    <img
                      src={getComfyUIViewUrl(
                        jobState.doneImage.filename,
                        jobState.doneImage.subfolder,
                        jobState.doneImage.type,
                      )}
                      alt="Output"
                      className="w-full h-full object-cover"
                    />
                  </a>
                )}
                <button
                  type="button"
                  onClick={handleSendToComfy}
                  disabled={isSending || !!comfyPromptId}
                  className="btn btn-ghost p-1.5 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/30 rounded"
                  title={comfyLabel(isSending, jobState.phase)}
                >
                  {isSending ||
                  jobState.phase === "queued" ||
                  jobState.phase === "running" ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : jobState.phase === "done" ? (
                    <Check size={16} className="text-green-500" />
                  ) : (
                    <SendHorizontal size={16} />
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </article>
    );
  }

  return (
    <article
      onClick={onClick}
      className="rounded-xl overflow-hidden cursor-pointer group animate-fade-in border border-surface-200/80 dark:border-surface-700/80 bg-white dark:bg-surface-900/80 shadow-sm hover:shadow-lg hover:border-primary-300/40 dark:hover:border-primary-600/40 transition-all duration-200"
      style={viewMode === "masonry" ? {} : { aspectRatio: "1" }}
    >
      <div
        className="relative overflow-hidden bg-surface-100 dark:bg-surface-800"
        style={
          viewMode === "masonry"
            ? { paddingBottom: `${Math.min(aspectRatio * 100, 150)}%` }
            : { height: "100%" }
        }
      >
        {!loaded && !error && <div className="absolute inset-0 skeleton" />}
        {!error ? (
          <img
            src={optimizedUrl}
            alt={image.meta?.prompt?.slice(0, 100) || "AI Generated Image"}
            className={`absolute inset-0 w-full h-full object-cover transition-all duration-500 group-hover:scale-105 ${
              loaded ? "opacity-100" : "opacity-0"
            }`}
            loading="lazy"
            onLoad={() => setLoaded(true)}
            onError={() => setError(true)}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Sparkles className="text-surface-400" size={32} />
          </div>
        )}

        <div className="absolute inset-0 bg-linear-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        <div className="absolute top-2 right-2 z-10 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button
            type="button"
            onClick={handleDownload}
            disabled={isDownloading}
            className="p-2 rounded-xl bg-black/50 text-white hover:bg-black/70 transition-colors border border-white/20"
            title={downloadDone ? "Saved" : "Download"}
          >
            {isDownloading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : downloadDone ? (
              <Check size={18} className="text-green-400" />
            ) : (
              <Download size={18} />
            )}
          </button>
          {connected && image.meta?.prompt && (
            <>
              {jobState.phase === "done" && jobState.doneImage && (
                <a
                  href={getComfyUIViewUrl(
                    jobState.doneImage.filename,
                    jobState.doneImage.subfolder,
                    jobState.doneImage.type,
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="p-1 rounded-xl bg-black/50 text-white hover:bg-black/70 transition-colors w-9 h-9 flex items-center justify-center overflow-hidden border border-white/20"
                >
                  <img
                    src={getComfyUIViewUrl(
                      jobState.doneImage.filename,
                      jobState.doneImage.subfolder,
                      jobState.doneImage.type,
                    )}
                    alt="Output"
                    className="w-full h-full object-cover"
                  />
                </a>
              )}
              <button
                type="button"
                onClick={handleSendToComfy}
                disabled={isSending || !!comfyPromptId}
                className="p-2 rounded-xl bg-black/50 text-white hover:bg-black/70 transition-colors border border-white/20"
                title={comfyLabel(isSending, jobState.phase)}
              >
                {isSending ||
                jobState.phase === "queued" ||
                jobState.phase === "running" ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : jobState.phase === "done" ? (
                  <Check size={18} className="text-green-400" />
                ) : (
                  <SendHorizontal size={18} />
                )}
              </button>
            </>
          )}
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-3 translate-y-full group-hover:translate-y-0 transition-transform duration-200 bg-linear-to-t from-black/80 to-transparent">
          <div className="flex items-center justify-between gap-2 text-white">
            <div className="flex items-center gap-1.5 min-w-0">
              <User size={14} className="shrink-0" />
              <span className="text-sm font-medium truncate max-w-30">
                {image.username}
              </span>
            </div>
            <div className="flex items-center gap-2.5 shrink-0">
              {modelCount > 0 && (
                <span
                  className="flex items-center gap-0.5 text-white/85"
                  title={`${modelCount} model${modelCount !== 1 ? "s" : ""}`}
                >
                  <Box size={13} />
                  <span className="text-xs font-medium tabular-nums">
                    {modelCount}
                  </span>
                </span>
              )}
              {loraCount > 0 && (
                <span
                  className="flex items-center gap-0.5 text-white/85"
                  title={`${loraCount} LoRA${loraCount !== 1 ? "s" : ""}`}
                >
                  <Layers size={13} />
                  <span className="text-xs font-medium tabular-nums">
                    {loraCount}
                  </span>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
      {showMissingModal && (
        <LoraMissingModal
          isOpen={showMissingModal}
          onClose={() => setShowMissingModal(false)}
          missingLoras={missingLoras}
          onDownloadComplete={() => {
            setShowMissingModal(false);
            handleSendToComfy();
          }}
        />
      )}
    </article>
  );
}
