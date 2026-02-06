import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Copy,
  Download,
  Loader2,
  SendHorizontal,
  Sparkles,
  User,
  X,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useComfyUI } from "../context/ComfyUIContext";
import { useGallery } from "../context/GalleryContext";
import { useDownload } from "../context/DownloadContext";
import { useSettings } from "../context/SettingsContext";
import { useComfyUIJob } from "../hooks/useComfyUIJob";
import { comfyLabel } from "@/lib/utils";
import { formatDate, getOptimizedImageUrl } from "../services/civitai";
import { getStoredDownloadPath } from "../services/app";
import {
  getComfyUIViewUrl,
  queueComfyUI,
  getStoredComfyWorkflow,
} from "../services/comfyui";
import { LoraMissingModal } from "./LoraMissingModal";

type LoraDownloadState = {
  status: "idle" | "checking" | "downloading" | "done" | "error" | "exists";
  error?: string;
};

export function Lightbox() {
  const {
    selectedImage,
    setSelectedImage,
    selectedIndex,
    images,
    navigateImage,
    saveImageFolder,
  } = useGallery();
  const { startDownload, checkExists, activeDownloads } = useDownload();
  const [loaded, setLoaded] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [copiedNegative, setCopiedNegative] = useState(false);
  const [showFullPrompt, setShowFullPrompt] = useState(false);
  const [showFullNegative, setShowFullNegative] = useState(false);
  const [comfyPromptId, setComfyPromptId] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [downloadState, setDownloadState] = useState<
    "idle" | "downloading" | "done" | "error"
  >("idle");
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [loraStates, setLoraStates] = useState<
    Record<string, LoraDownloadState>
  >({});
  const { connected } = useComfyUI();
  const { autoLora, openWorkflowModal } = useSettings();
  const [missingLoras, setMissingLoras] = useState<
    Array<{ name: string; weight: number; id?: number }>
  >([]);
  const [showMissingModal, setShowMissingModal] = useState(false);
  const jobState = useComfyUIJob(comfyPromptId);

  useEffect(() => {
    if (jobState.phase === "done") {
      const t = setTimeout(() => setComfyPromptId(null), 3000);
      return () => clearTimeout(t);
    }
  }, [jobState.phase]);

  useEffect(() => {
    setDownloadState("idle");
    setDownloadError(null);
    setLoraStates({});
  }, [selectedImage?.id]);

  useEffect(() => {
    const resources = selectedImage?.meta?.resources;
    if (!resources) return;

    const loraResources = resources.filter(
      (r) => r.type?.toLowerCase() === "lora" && r.hash,
    );

    loraResources.forEach(async (resource) => {
      if (!resource.hash) return;
      setLoraStates((prev) => ({
        ...prev,
        [resource.hash!]: { status: "checking" },
      }));
      try {
        const result = await checkExists({
          hash: resource.hash,
          name: resource.name,
        });
        setLoraStates((prev) => ({
          ...prev,
          [resource.hash!]: {
            status: result.exists ? "exists" : "idle",
          },
        }));
      } catch {
        setLoraStates((prev) => ({
          ...prev,
          [resource.hash!]: { status: "idle" },
        }));
      }
    });
  }, [selectedImage?.id, selectedImage?.meta?.resources, checkExists]);

  const handleLoraDownload = useCallback(
    async (hash: string, resourceName: string) => {
      setLoraStates((prev) => ({
        ...prev,
        [hash]: { status: "downloading" },
      }));

      const result = await startDownload({ hash, resourceName });

      if (result.alreadyExists) {
        setLoraStates((prev) => ({
          ...prev,
          [hash]: { status: "exists" },
        }));
      } else if (result.error) {
        setLoraStates((prev) => ({
          ...prev,
          [hash]: { status: "error", error: result.error },
        }));
      } else {
        setLoraStates((prev) => ({
          ...prev,
          [hash]: { status: "downloading" },
        }));
      }
    },
    [startDownload],
  );

  const getLoraDownloadStatus = useCallback(
    (hash: string) => {
      const localState = loraStates[hash];
      if (localState?.status === "exists" || localState?.status === "done") {
        return localState;
      }
      const activeDownload = activeDownloads.find((d) => d.hash === hash);
      if (activeDownload) {
        if (activeDownload.status === "completed") {
          return { status: "done" as const };
        }
        return {
          status: "downloading" as const,
          progress: activeDownload.progress,
        };
      }
      return localState || { status: "idle" as const };
    },
    [loraStates, activeDownloads],
  );

  const handleDownload = useCallback(async () => {
    if (!selectedImage) return;
    setDownloadState("downloading");
    setDownloadError(null);
    const ext =
      /\.(png|jpe?g|webp|gif)$/i.exec(selectedImage.url)?.[1] ?? "png";
    const suggestedName = `lumina-${selectedImage.id}.${ext}`;
    const result = await window.api.downloadImage(
      selectedImage.url,
      suggestedName,
      getStoredDownloadPath(),
    );
    if (result.error) {
      setDownloadError(result.error);
      setDownloadState("error");
    } else {
      setDownloadState("done");
      const t = setTimeout(() => setDownloadState("idle"), 2000);
      return () => clearTimeout(t);
    }
  }, [selectedImage]);

  const canGoPrev = selectedIndex > 0;
  const canGoNext = selectedIndex < images.length - 1;

  const handleClose = useCallback(() => {
    setSelectedImage(null);
    setLoaded(false);
    setShowFullPrompt(false);
    setShowFullNegative(false);
  }, [setSelectedImage]);

  const handlePrev = useCallback(() => {
    if (canGoPrev) {
      setLoaded(false);
      navigateImage("prev");
    }
  }, [canGoPrev, navigateImage]);

  const handleNext = useCallback(() => {
    if (canGoNext) {
      setLoaded(false);
      navigateImage("next");
    }
  }, [canGoNext, navigateImage]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      } else if (e.key === "ArrowLeft") {
        handlePrev();
      } else if (e.key === "ArrowRight") {
        handleNext();
      }
    };

    if (selectedImage) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedImage, handleClose, handlePrev, handleNext]);

  const copyToClipboard = async (text: string, type: "prompt" | "negative") => {
    await navigator.clipboard.writeText(text);
    if (type === "prompt") {
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2000);
    } else {
      setCopiedNegative(true);
      setTimeout(() => setCopiedNegative(false), 2000);
    }
  };

  if (!selectedImage) return null;

  const image = selectedImage;

  const handleSendToComfy = async () => {
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

  const meta = image.meta;

  const fullResUrl = getOptimizedImageUrl(image.url, 1200);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm animate-fade-in"
      onClick={handleClose}
    >
      <div
        className="h-full flex flex-row overflow-x-auto min-w-0"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
          aria-label="Close"
        >
          <X size={24} />
        </button>

        <div className="absolute top-4 left-4 z-10 px-3 py-1.5 rounded-full bg-black/50 text-white text-sm">
          {selectedIndex + 1} / {images.length}
        </div>

        {canGoPrev && (
          <button
            onClick={handlePrev}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-black/50 text-white hover:bg-black/70 transition-all hover:scale-110"
            aria-label="Previous image"
          >
            <ChevronLeft size={28} />
          </button>
        )}

        {canGoNext && (
          <button
            onClick={handleNext}
            className="absolute right-96 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-black/50 text-white hover:bg-black/70 transition-all hover:scale-110"
            aria-label="Next image"
          >
            <ChevronRight size={28} />
          </button>
        )}

        <div className="flex-1 min-w-50 flex items-center justify-center p-4 min-h-0">
          <div className="relative max-w-full max-h-full w-full h-full flex items-center justify-center">
            {!loaded && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-12 h-12 rounded-full border-4 border-white/20 border-t-white animate-spin" />
              </div>
            )}
            <img
              src={fullResUrl}
              alt={meta?.prompt?.slice(0, 100) || "AI Generated Image"}
              className={`max-w-full max-h-full object-contain rounded-lg transition-opacity duration-300 ${
                loaded ? "opacity-100" : "opacity-0"
              }`}
              onLoad={() => setLoaded(true)}
            />
          </div>
        </div>

        <aside className="w-96 min-w-96 shrink-0 bg-white dark:bg-surface-900 overflow-y-auto h-full border-l border-surface-200 dark:border-surface-800">
          <div className="p-5 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-linear-to-br from-primary-400 to-primary-600 flex items-center justify-center">
                <User size={18} className="text-white" />
              </div>
              <div>
                <p className="font-semibold text-surface-900 dark:text-surface-100">
                  {image.username}
                </p>
                <p className="text-sm text-surface-500 dark:text-surface-400">
                  {formatDate(image.createdAt)}
                </p>
              </div>
            </div>

            <div className="h-px bg-surface-200 dark:bg-surface-700" />

            {meta?.prompt && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-surface-700 dark:text-surface-300 flex items-center gap-2">
                    <Sparkles size={14} />
                    Prompt
                  </h3>
                  <button
                    onClick={() => copyToClipboard(meta.prompt!, "prompt")}
                    className="btn btn-ghost p-1.5 text-xs"
                  >
                    {copiedPrompt ? (
                      <>
                        <Check size={14} className="text-green-500" />
                        <span className="text-green-500">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy size={14} />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="relative">
                  <p
                    className={`text-sm text-surface-600 dark:text-surface-400 bg-surface-50 dark:bg-surface-800 rounded-lg p-3 leading-relaxed ${
                      !showFullPrompt ? "line-clamp-3" : ""
                    }`}
                  >
                    {meta.prompt}
                  </p>
                  {meta.prompt.length > 200 && (
                    <button
                      onClick={() => setShowFullPrompt(!showFullPrompt)}
                      className="mt-1 text-xs text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1"
                    >
                      {showFullPrompt ? (
                        <>
                          Show less <ChevronUp size={12} />
                        </>
                      ) : (
                        <>
                          Show more <ChevronDown size={12} />
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            )}

            {meta?.negativePrompt && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-surface-700 dark:text-surface-300">
                    Negative Prompt
                  </h3>
                  <button
                    onClick={() =>
                      copyToClipboard(meta.negativePrompt!, "negative")
                    }
                    className="btn btn-ghost p-1.5 text-xs"
                  >
                    {copiedNegative ? (
                      <>
                        <Check size={14} className="text-green-500" />
                        <span className="text-green-500">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy size={14} />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="relative">
                  <p
                    className={`text-sm text-surface-600 dark:text-surface-400 bg-surface-50 dark:bg-surface-800 rounded-lg p-3 leading-relaxed ${
                      !showFullNegative ? "line-clamp-2" : ""
                    }`}
                  >
                    {meta.negativePrompt}
                  </p>
                  {meta.negativePrompt.length > 150 && (
                    <button
                      onClick={() => setShowFullNegative(!showFullNegative)}
                      className="mt-1 text-xs text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1"
                    >
                      {showFullNegative ? (
                        <>
                          Show less <ChevronUp size={12} />
                        </>
                      ) : (
                        <>
                          Show more <ChevronDown size={12} />
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="h-px bg-surface-200 dark:bg-surface-700" />

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-surface-700 dark:text-surface-300">
                Generation Details
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {meta?.Model && <DetailItem label="Model" value={meta.Model} />}
                {meta?.sampler && (
                  <DetailItem label="Sampler" value={meta.sampler} />
                )}
                {meta?.steps && (
                  <DetailItem label="Steps" value={meta.steps.toString()} />
                )}
                {meta?.cfgScale && (
                  <DetailItem
                    label="CFG Scale"
                    value={meta.cfgScale.toString()}
                  />
                )}
                {meta?.seed ? (
                  <DetailItem label="Seed" value={meta.seed.toString()} />
                ) : null}
                <DetailItem
                  label="Size"
                  value={`${image.width} x ${image.height}`}
                />
              </div>
            </div>

            {meta?.resources && meta.resources.length > 0 && (
              <>
                <div className="h-px bg-surface-200 dark:bg-surface-700" />
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-surface-700 dark:text-surface-300">
                    Resources Used
                  </h3>
                  <div className="space-y-2">
                    {meta.resources.map((resource, index) => {
                      const isLora = resource.type?.toLowerCase() === "lora";
                      const hasHash = resource.hash !== undefined;
                      const downloadStatus = hasHash
                        ? getLoraDownloadStatus(resource.hash!)
                        : null;

                      return (
                        <div
                          key={index}
                          className="bg-surface-50 dark:bg-surface-800 rounded-lg p-2.5"
                        >
                          <div className="flex items-center justify-between">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-surface-700 dark:text-surface-300 truncate">
                                {resource.name}
                              </p>
                              <p className="text-xs text-surface-500">
                                {resource.type}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {resource.weight !== undefined && (
                                <span className="text-xs font-mono bg-surface-200 dark:bg-surface-700 px-2 py-1 rounded">
                                  {resource.weight}
                                </span>
                              )}
                              {isLora && hasHash && (
                                <>
                                  {downloadStatus?.status === "idle" && (
                                    <button
                                      onClick={() =>
                                        handleLoraDownload(
                                          resource.hash!,
                                          resource.name,
                                        )
                                      }
                                      className="p-1.5 hover:bg-surface-200 dark:hover:bg-surface-700 rounded transition-colors text-primary-500"
                                      title="Download LoRA"
                                    >
                                      <Download className="w-4 h-4" />
                                    </button>
                                  )}
                                  {downloadStatus?.status === "checking" && (
                                    <Loader2 className="w-4 h-4 animate-spin text-surface-400" />
                                  )}
                                  {downloadStatus?.status === "downloading" && (
                                    <Loader2 className="w-4 h-4 animate-spin text-primary-500" />
                                  )}
                                  {(downloadStatus?.status === "done" ||
                                    downloadStatus?.status === "exists") && (
                                    <CheckCircle className="w-4 h-4 text-green-500" />
                                  )}
                                  {downloadStatus?.status === "error" && (
                                    <button
                                      onClick={() =>
                                        handleLoraDownload(
                                          resource.hash!,
                                          resource.name,
                                        )
                                      }
                                      className="p-1.5 hover:bg-surface-200 dark:hover:bg-surface-700 rounded transition-colors text-red-500"
                                      title={
                                        downloadStatus.error ||
                                        "Download failed"
                                      }
                                    >
                                      <XCircle className="w-4 h-4" />
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            <div className="pt-2 space-y-2">
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
                      className="block w-full rounded-lg overflow-hidden border border-surface-200 dark:border-surface-700 aspect-square max-h-32 bg-surface-100 dark:bg-surface-800"
                    >
                      <img
                        src={getComfyUIViewUrl(
                          jobState.doneImage.filename,
                          jobState.doneImage.subfolder,
                          jobState.doneImage.type,
                        )}
                        alt="ComfyUI output"
                        className="w-full h-full object-contain"
                      />
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={handleSendToComfy}
                    disabled={isSending || !!comfyPromptId}
                    className="btn btn-outline w-full"
                  >
                    {isSending ||
                    jobState.phase === "queued" ||
                    jobState.phase === "running" ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : jobState.phase === "done" ? (
                      <Check size={18} className="text-green-500" />
                    ) : (
                      <SendHorizontal size={18} />
                    )}
                    {" " + comfyLabel(isSending, jobState.phase)}
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={handleDownload}
                disabled={downloadState === "downloading"}
                className="btn btn-primary w-full"
              >
                {downloadState === "downloading" ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : downloadState === "done" ? (
                  <Check size={18} />
                ) : (
                  <Download size={18} />
                )}
                {downloadState === "downloading"
                  ? "Downloading…"
                  : downloadState === "done"
                    ? "Saved to Downloads/lumina"
                    : downloadState === "error"
                      ? "Download failed"
                      : "Download Full Resolution"}
              </button>
              {downloadError && (
                <p className="text-xs text-red-500 dark:text-red-400 mt-1">
                  {downloadError}
                </p>
              )}
            </div>
          </div>
        </aside>
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
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface-50 dark:bg-surface-800 rounded-lg p-2.5">
      <p className="text-xs text-surface-500 dark:text-surface-400 mb-0.5">
        {label}
      </p>
      <p className="text-sm font-medium text-surface-700 dark:text-surface-200 truncate">
        {value}
      </p>
    </div>
  );
}
