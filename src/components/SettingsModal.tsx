import {
  useState,
  useEffect,
  useMemo,
  type Dispatch,
  type SetStateAction,
} from "react";
import { createPortal } from "react-dom";
import {
  X,
  Settings2,
  Loader2,
  Clock,
  AlertCircle,
  Layers,
  Key,
  Info,
  FolderDown,
  UploadCloud,
} from "lucide-react";
import { useComfyUI } from "@/context/ComfyUIContext";
import { useGallery } from "@/context/GalleryContext";
import { useSettings } from "@/context/SettingsContext";
import {
  getStoredComfyUrl,
  setStoredComfyUrl,
  getStoredComfyBasePath,
  setStoredComfyBasePath,
  getComfyUIStatus,
  getStoredComfyWorkflow,
  setStoredComfyWorkflow,
  getStoredComfyWorkflowMapping,
  setStoredComfyWorkflowMapping,
  WorkflowNodeMapping,
  ComfyWorkflow,
} from "@/services/comfyui";
import {
  getStoredCivitaiApiKey,
  setStoredCivitaiApiKey,
} from "@/services/civitai";
import {
  getStoredDownloadPath,
  setStoredDownloadPath,
  getStoredAutoLora,
  getStoredMaxConcurrentDownloads,
} from "@/services/app";

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

function renderJsonValue(value: JsonValue, depth: number, path: string) {
  if (value === null) {
    return <span className="text-rose-500">null</span>;
  }
  if (typeof value === "string") {
    return <span className="text-emerald-500">"{value}"</span>;
  }
  if (typeof value === "number") {
    return <span className="text-amber-500">{value}</span>;
  }
  if (typeof value === "boolean") {
    return <span className="text-purple-500">{value ? "true" : "false"}</span>;
  }
  const isArray = Array.isArray(value);
  const entries = isArray
    ? value.map((item, index) => [String(index), item] as const)
    : Object.entries(value);
  const open = depth < 1;
  return (
    <details className="group" open={open}>
      <summary className="cursor-pointer select-none text-surface-500 dark:text-surface-400">
        <span className="text-surface-400">{isArray ? "[" : "{"}</span>
        <span className="mx-1 text-surface-500 dark:text-surface-400">
          {isArray ? `${entries.length} items` : `${entries.length} keys`}
        </span>
        <span className="text-surface-400">{isArray ? "]" : "}"}</span>
      </summary>
      <div className="mt-2 space-y-1 pl-3 border-l border-surface-200 dark:border-surface-700">
        {entries.map(([key, child], index) => (
          <div key={`${path}.${key}`} className="flex items-start gap-2">
            {isArray ? (
              <span className="text-surface-500 dark:text-surface-400">
                [{key}]
              </span>
            ) : (
              <>
                <span className="text-sky-600 dark:text-sky-400">"{key}"</span>
                <span className="text-surface-400 dark:text-surface-500">
                  :
                </span>
              </>
            )}
            <div className="min-w-0">
              {renderJsonValue(child, depth + 1, `${path}.${key}`)}
              {index < entries.length - 1 && (
                <span className="text-surface-400 dark:text-surface-500">
                  ,
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </details>
  );
}

interface WorkflowModalProps {
  isOpen: boolean;
  onClose: () => void;
  workflowJsonText: string;
  parsedWorkflow: JsonValue | null;
  workflowNodes: Array<{ id: string; label: string }>;
  workflowMapping: WorkflowNodeMapping;
  setWorkflowMapping: Dispatch<SetStateAction<WorkflowNodeMapping>>;
  workflowFileName: string | null;
  workflowError: string | null;
  onFile: (file: File) => void;
  onSave: () => void;
}

function WorkflowModal({
  isOpen,
  onClose,
  workflowJsonText,
  parsedWorkflow,
  workflowNodes,
  workflowMapping,
  setWorkflowMapping,
  workflowFileName,
  workflowError,
  onFile,
  onSave,
}: WorkflowModalProps) {
  if (!isOpen) return null;
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Add workflow"
    >
      <div
        className="w-full max-w-4xl rounded-3xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-700 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-surface-200 dark:border-surface-700">
          <div>
            <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-100">
              Add workflow
            </h3>
            <p className="text-xs text-surface-500 dark:text-surface-400">
              Import a ComfyUI API workflow and map node IDs.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-surface-500 hover:text-surface-700 dark:hover:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="grid grid-cols-12 gap-4 p-5 overflow-y-auto">
          <div className="col-span-12 md:col-span-5 space-y-4">
            <label
              className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-surface-300 dark:border-surface-700 bg-surface-50/80 dark:bg-surface-800/40 p-6 text-center cursor-pointer"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files?.[0];
                if (file) void onFile(file);
              }}
            >
              <input
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void onFile(file);
                }}
              />
              <UploadCloud size={24} className="text-primary-600" />
              <div className="text-sm font-medium text-surface-700 dark:text-surface-300">
                Drag and drop API workflow JSON
              </div>
              <div className="text-xs text-surface-500 dark:text-surface-400 text-center">
                In ComfyUI, use Save → API Format and upload that JSON here.
              </div>
              {workflowFileName && (
                <div className="text-xs text-surface-600 dark:text-surface-400 font-mono">
                  {workflowFileName}
                </div>
              )}
            </label>
            <div className="rounded-2xl border border-surface-200 dark:border-surface-700 bg-surface-50/60 dark:bg-surface-800/40 p-4">
              <div className="text-sm font-semibold text-surface-800 dark:text-surface-200 mb-3">
                Node mapping
              </div>
              <div className="text-xs text-surface-500 dark:text-surface-400 mb-3">
                Map the prompt node and any optional nodes you want Lumina to
                control (negative prompt, sampler seed, resolution, LoRAs, save
                path).
              </div>
              <div className="space-y-3">
                <label className="text-xs font-semibold text-surface-600 dark:text-surface-400">
                  Prompt node
                </label>
                <select
                  value={workflowMapping.promptNodeId}
                  onChange={(e) =>
                    setWorkflowMapping((prev) => ({
                      ...prev,
                      promptNodeId: e.target.value,
                    }))
                  }
                  className="input w-full text-sm"
                >
                  <option value="">Select a node</option>
                  {workflowNodes.map((node) => (
                    <option key={`prompt-${node.id}`} value={node.id}>
                      {node.label}
                    </option>
                  ))}
                </select>
                <label className="text-xs font-semibold text-surface-600 dark:text-surface-400">
                  Negative prompt node
                </label>
                <select
                  value={workflowMapping.negativeNodeId ?? ""}
                  onChange={(e) =>
                    setWorkflowMapping((prev) => ({
                      ...prev,
                      negativeNodeId: e.target.value,
                    }))
                  }
                  className="input w-full text-sm"
                >
                  <option value="">Not set</option>
                  {workflowNodes.map((node) => (
                    <option key={`neg-${node.id}`} value={node.id}>
                      {node.label}
                    </option>
                  ))}
                </select>
                <label className="text-xs font-semibold text-surface-600 dark:text-surface-400">
                  Sampler node
                </label>
                <select
                  value={workflowMapping.samplerNodeId ?? ""}
                  onChange={(e) =>
                    setWorkflowMapping((prev) => ({
                      ...prev,
                      samplerNodeId: e.target.value,
                    }))
                  }
                  className="input w-full text-sm"
                >
                  <option value="">Not set</option>
                  {workflowNodes.map((node) => (
                    <option key={`sampler-${node.id}`} value={node.id}>
                      {node.label}
                    </option>
                  ))}
                </select>
                <label className="text-xs font-semibold text-surface-600 dark:text-surface-400">
                  Save image node
                </label>
                <select
                  value={workflowMapping.saveImageNodeId ?? ""}
                  onChange={(e) =>
                    setWorkflowMapping((prev) => ({
                      ...prev,
                      saveImageNodeId: e.target.value,
                    }))
                  }
                  className="input w-full text-sm"
                >
                  <option value="">Not set</option>
                  {workflowNodes.map((node) => (
                    <option key={`save-${node.id}`} value={node.id}>
                      {node.label}
                    </option>
                  ))}
                </select>
                <label className="text-xs font-semibold text-surface-600 dark:text-surface-400">
                  Resolution node
                </label>
                <select
                  value={workflowMapping.resolutionNodeId ?? ""}
                  onChange={(e) =>
                    setWorkflowMapping((prev) => ({
                      ...prev,
                      resolutionNodeId: e.target.value,
                    }))
                  }
                  className="input w-full text-sm"
                >
                  <option value="">Not set</option>
                  {workflowNodes.map((node) => (
                    <option key={`res-${node.id}`} value={node.id}>
                      {node.label}
                    </option>
                  ))}
                </select>
                <label className="text-xs font-semibold text-surface-600 dark:text-surface-400">
                  LoRA loader node
                </label>
                <select
                  value={workflowMapping.loraNodeId ?? ""}
                  onChange={(e) =>
                    setWorkflowMapping((prev) => ({
                      ...prev,
                      loraNodeId: e.target.value,
                    }))
                  }
                  className="input w-full text-sm"
                >
                  <option value="">Not set</option>
                  {workflowNodes.map((node) => (
                    <option key={`lora-${node.id}`} value={node.id}>
                      {node.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div className="col-span-12 md:col-span-7">
            <div className="rounded-2xl border border-surface-200 dark:border-surface-700 bg-surface-50/60 dark:bg-surface-800/40 p-4 h-full flex flex-col">
              <div className="text-sm font-semibold text-surface-800 dark:text-surface-200 mb-3">
                Workflow preview
              </div>
              {workflowJsonText ? (
                parsedWorkflow ? (
                  <div className="flex-1 max-h-125 overflow-y-auto text-xs text-surface-700 dark:text-surface-300 bg-white/80 dark:bg-surface-900/60 rounded-xl border border-surface-200 dark:border-surface-700 p-3 font-mono">
                    {renderJsonValue(parsedWorkflow, 0, "root")}
                  </div>
                ) : (
                  <div className="flex-1 overflow-auto text-xs text-red-600 dark:text-red-400 bg-white/80 dark:bg-surface-900/60 rounded-xl border border-red-200 dark:border-red-900/50 p-3 font-mono">
                    Invalid JSON
                  </div>
                )
              ) : (
                <div className="flex-1 flex items-center justify-center text-sm text-surface-500 dark:text-surface-400">
                  Upload a workflow to preview the JSON.
                </div>
              )}
            </div>
          </div>
        </div>
        {workflowError && (
          <div className="px-5 pb-2 text-sm text-red-600 dark:text-red-400">
            {workflowError}
          </div>
        )}
        <div className="flex items-center justify-between gap-2 px-5 py-4 border-t border-surface-200 dark:border-surface-700">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-surface-600 dark:text-surface-300 hover:text-surface-900 dark:hover:text-surface-100"
          >
            Cancel
          </button>
          <button type="button" onClick={onSave} className="btn btn-primary">
            Save workflow
          </button>
        </div>
      </div>
    </div>
  );
}

export type SettingsTab = "comfyui" | "civitai" | "app" | "developer";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: SettingsTab;
  showWorkflowModal?: boolean;
  onWorkflowModalOpened?: () => void;
}

export function SettingsModal({
  isOpen,
  onClose,
  initialTab = "app",
  showWorkflowModal = false,
  onWorkflowModalOpened,
}: SettingsModalProps) {
  const { connected, queue_running, queue_pending, refetch } = useComfyUI();
  const { saveImageFolder, setSaveImageFolder } = useGallery();
  const { setAutoLora, setMaxDownloadSize, setMaxConcurrentDownloads } =
    useSettings();
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
  const [urlInput, setUrlInput] = useState("");
  const [basePathInput, setBasePathInput] = useState("");
  const [comfySaveError, setComfySaveError] = useState<string | null>(null);
  const [comfySaving, setComfySaving] = useState(false);
  const [civitaiKeyInput, setCivitaiKeyInput] = useState("");
  const [downloadPathInput, setDownloadPathInput] = useState("");
  const [autoLoraInput, setAutoLoraInput] = useState(false);
  const [maxDownloadSizeInput, setMaxDownloadSizeInput] = useState(500);
  const [maxConcurrentDownloadsInput, setMaxConcurrentDownloadsInput] =
    useState(3);
  const [workflowModalOpen, setWorkflowModalOpen] = useState(false);
  const [workflowOnly, setWorkflowOnly] = useState(false);
  const [workflowJsonText, setWorkflowJsonText] = useState("");
  const [workflowNodes, setWorkflowNodes] = useState<
    Array<{ id: string; label: string }>
  >([]);
  const [workflowMapping, setWorkflowMapping] = useState<WorkflowNodeMapping>({
    promptNodeId: "",
    negativeNodeId: "",
    samplerNodeId: "",
    saveImageNodeId: "",
    resolutionNodeId: "",
    loraNodeId: "",
  });
  const [workflowError, setWorkflowError] = useState<string | null>(null);
  const [workflowFileName, setWorkflowFileName] = useState<string | null>(null);
  const [hasCustomWorkflow, setHasCustomWorkflow] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setUrlInput(getStoredComfyUrl());
      setBasePathInput(getStoredComfyBasePath());
      setComfySaveError(null);
      setCivitaiKeyInput(getStoredCivitaiApiKey());
      setDownloadPathInput(getStoredDownloadPath());
      setAutoLoraInput(getStoredAutoLora());
      setMaxConcurrentDownloadsInput(getStoredMaxConcurrentDownloads());
      setHasCustomWorkflow(!!getStoredComfyWorkflow());
    }
  }, [isOpen, initialTab]);

  const parsedWorkflow = useMemo(() => {
    if (!workflowJsonText) return null;
    try {
      return JSON.parse(workflowJsonText) as JsonValue;
    } catch {
      return null;
    }
  }, [workflowJsonText]);

  const saveComfyUI = async (): Promise<boolean> => {
    const url = urlInput.trim();
    const basePath = basePathInput.trim();
    setComfySaveError(null);
    setComfySaving(true);
    const previousUrl = getStoredComfyUrl();
    const previousBasePath = getStoredComfyBasePath();
    const urlChanged = url !== previousUrl;
    const basePathChanged = basePath !== previousBasePath;
    if (urlChanged) {
      if (!url) {
        setComfySaveError("Server URL is required.");
        setComfySaving(false);
        setActiveTab("comfyui");
        return false;
      }
      try {
        window.api.comfyuiSetUrl(url);
        const data = await getComfyUIStatus();
        if (!data.connected) {
          setComfySaveError(
            "Could not connect to ComfyUI. Check the URL and ensure the server is running.",
          );
          window.api.comfyuiSetUrl(previousUrl);
          setComfySaving(false);
          setActiveTab("comfyui");
          return false;
        }
      } catch {
        setComfySaveError(
          "Could not connect to ComfyUI. Check the URL and ensure the server is running.",
        );
        window.api.comfyuiSetUrl(previousUrl);
        setComfySaving(false);
        setActiveTab("comfyui");
        return false;
      }
    }
    if (basePathChanged && basePath) {
      try {
        const pathCheck = await window.api.comfyuiValidateBasePath(basePath);
        if (!pathCheck.valid) {
          const missing: string[] = [];
          if (!pathCheck.lorasExists) missing.push("models/loras");
          if (!pathCheck.outputExists) missing.push("output (or outputs)");
          setComfySaveError(
            `Base path invalid: missing folder(s) — ${missing.join(", ")}. Ensure the path points to your ComfyUI installation root.`,
          );
          window.api.comfyuiSetBasePath(previousBasePath);
          setComfySaving(false);
          setActiveTab("comfyui");
          return false;
        }
      } catch {
        setComfySaveError(
          "Base path invalid or inaccessible. Check the path and permissions.",
        );
        window.api.comfyuiSetBasePath(previousBasePath);
        setComfySaving(false);
        setActiveTab("comfyui");
        return false;
      }
    }
    if (urlChanged) {
      setStoredComfyUrl(url);
    }
    if (basePathChanged) {
      setStoredComfyBasePath(basePath);
    }
    if (urlChanged || basePathChanged) {
      refetch();
    }
    setComfySaving(false);
    return true;
  };

  const handleSaveAll = async () => {
    setStoredDownloadPath(downloadPathInput.trim() || "lumina");
    setStoredCivitaiApiKey(civitaiKeyInput.trim());
    window.api.civitaiSetApiKey(civitaiKeyInput.trim());
    setAutoLora(autoLoraInput);
    setMaxDownloadSize(maxDownloadSizeInput);
    setMaxConcurrentDownloads(maxConcurrentDownloadsInput);
    const comfyOk = await saveComfyUI();
    if (comfyOk) onClose();
  };

  const buildWorkflowNodes = (workflow: ComfyWorkflow) => {
    return Object.entries(workflow)
      .map(([id, node]) => {
        const classType = node?.class_type ? String(node.class_type) : "Node";
        const title =
          node && typeof node === "object" && "_meta" in node
            ? (node._meta as { title?: string })?.title
            : undefined;
        const label = [id, classType, title].filter(Boolean).join(" · ");
        return { id, label };
      })
      .sort((a, b) => {
        const aNum = Number(a.id);
        const bNum = Number(b.id);
        if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) return aNum - bNum;
        return a.id.localeCompare(b.id);
      });
  };

  const sanitizeMapping = (
    mapping: WorkflowNodeMapping,
    workflow: ComfyWorkflow,
  ): WorkflowNodeMapping => {
    const hasNode = (id?: string) => (id ? !!workflow[id] : false);
    return {
      promptNodeId: hasNode(mapping.promptNodeId) ? mapping.promptNodeId : "",
      negativeNodeId: hasNode(mapping.negativeNodeId)
        ? mapping.negativeNodeId
        : "",
      samplerNodeId: hasNode(mapping.samplerNodeId)
        ? mapping.samplerNodeId
        : "",
      saveImageNodeId: hasNode(mapping.saveImageNodeId)
        ? mapping.saveImageNodeId
        : "",
      resolutionNodeId: hasNode(mapping.resolutionNodeId)
        ? mapping.resolutionNodeId
        : "",
      loraNodeId: hasNode(mapping.loraNodeId) ? mapping.loraNodeId : "",
    };
  };

  const handleOpenWorkflowModal = () => {
    const storedWorkflow = getStoredComfyWorkflow();
    const storedMapping = getStoredComfyWorkflowMapping();
    if (storedWorkflow) {
      setWorkflowJsonText(JSON.stringify(storedWorkflow, null, 2));
      setWorkflowNodes(buildWorkflowNodes(storedWorkflow));
      setWorkflowMapping(
        sanitizeMapping(
          {
            promptNodeId: storedMapping?.promptNodeId ?? "",
            negativeNodeId: storedMapping?.negativeNodeId ?? "",
            samplerNodeId: storedMapping?.samplerNodeId ?? "",
            saveImageNodeId: storedMapping?.saveImageNodeId ?? "",
            resolutionNodeId: storedMapping?.resolutionNodeId ?? "",
            loraNodeId: storedMapping?.loraNodeId ?? "",
          },
          storedWorkflow,
        ),
      );
      setWorkflowFileName("Stored workflow");
    } else {
      setWorkflowJsonText("");
      setWorkflowNodes([]);
      setWorkflowMapping({
        promptNodeId: "",
        negativeNodeId: "",
        samplerNodeId: "",
        saveImageNodeId: "",
        resolutionNodeId: "",
        loraNodeId: "",
      });
      setWorkflowFileName(null);
    }
    setWorkflowError(null);
    setWorkflowModalOpen(true);
  };

  useEffect(() => {
    if (isOpen && showWorkflowModal) {
      setWorkflowOnly(true);
      handleOpenWorkflowModal();
      onWorkflowModalOpened?.();
    }
  }, [
    isOpen,
    showWorkflowModal,
    onWorkflowModalOpened,
    handleOpenWorkflowModal,
  ]);

  if (!isOpen) return null;

  const handleWorkflowFile = async (file: File) => {
    setWorkflowError(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as ComfyWorkflow;
      if (!parsed || Array.isArray(parsed)) {
        setWorkflowError("Invalid workflow JSON.");
        return;
      }
      setWorkflowJsonText(JSON.stringify(parsed, null, 2));
      setWorkflowNodes(buildWorkflowNodes(parsed));
      setWorkflowMapping((current) => sanitizeMapping(current, parsed));
      setWorkflowFileName(file.name);
    } catch {
      setWorkflowError("Failed to parse workflow JSON.");
    }
  };

  const handleWorkflowSave = () => {
    if (!workflowJsonText) {
      setWorkflowError("Upload a workflow JSON to continue.");
      return;
    }
    if (!workflowMapping.promptNodeId) {
      setWorkflowError("Prompt node mapping is required.");
      return;
    }
    try {
      const parsed = JSON.parse(workflowJsonText) as ComfyWorkflow;
      setStoredComfyWorkflow(parsed);
      setStoredComfyWorkflowMapping({
        promptNodeId: workflowMapping.promptNodeId,
        negativeNodeId: workflowMapping.negativeNodeId || undefined,
        samplerNodeId: workflowMapping.samplerNodeId || undefined,
        saveImageNodeId: workflowMapping.saveImageNodeId || undefined,
        resolutionNodeId: workflowMapping.resolutionNodeId || undefined,
        loraNodeId: workflowMapping.loraNodeId || undefined,
      });
      setHasCustomWorkflow(true);
      setWorkflowModalOpen(false);
      if (workflowOnly) {
        setWorkflowOnly(false);
        onClose();
      }
    } catch {
      setWorkflowError("Workflow JSON is invalid.");
    }
  };

  const tabs: {
    id: SettingsTab;
    label: string;
    icon: typeof Layers;
    description: string;
  }[] = [
    {
      id: "app",
      label: "App",
      icon: FolderDown,
      description: "Downloads and local paths",
    },
    {
      id: "comfyui",
      label: "ComfyUI",
      icon: Layers,
      description: "Server and workflow defaults",
    },
    {
      id: "civitai",
      label: "CivitAI",
      icon: Key,
      description: "API keys and access",
    },
    {
      id: "developer",
      label: "Developer",
      icon: Info,
      description: "Credits and links",
    },
  ];

  const modal = workflowOnly ? null : (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
    >
      <div
        className="w-full max-w-4xl rounded-3xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-700 shadow-2xl overflow-hidden max-h-[92vh] min-h-[34rem] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-surface-200 dark:border-surface-700">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-primary-500/10 dark:bg-primary-500/15 flex items-center justify-center">
              <Settings2
                size={20}
                className="text-primary-600 dark:text-primary-400"
              />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-100">
                Settings
              </h3>
              <p className="text-xs text-surface-500 dark:text-surface-400">
                Manage downloads, ComfyUI, and integrations
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-surface-500 hover:text-surface-700 dark:hover:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
        <div className="grid grid-cols-12 min-h-0 flex-1">
          <div className="col-span-12 md:col-span-4 border-b md:border-b-0 md:border-r border-surface-200 dark:border-surface-700 p-3 md:p-4">
            <div className="space-y-2">
              {tabs.map(({ id, label, icon: Icon, description }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveTab(id)}
                  className={`w-full flex items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors ${
                    activeTab === id
                      ? "bg-primary-500/10 text-primary-700 dark:text-primary-300 border border-primary-500/20"
                      : "text-surface-600 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-800 border border-transparent"
                  }`}
                >
                  <div
                    className={`h-9 w-9 rounded-xl flex items-center justify-center ${
                      activeTab === id
                        ? "bg-primary-500/15 text-primary-600 dark:text-primary-400"
                        : "bg-surface-100 dark:bg-surface-800 text-surface-500 dark:text-surface-400"
                    }`}
                  >
                    <Icon size={18} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">{label}</div>
                    <div className="text-xs text-surface-500 dark:text-surface-500 truncate">
                      {description}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
          <div className="col-span-12 md:col-span-8 p-4 md:p-6 overflow-y-auto min-h-0">
            {activeTab === "app" && (
              <div className="space-y-5">
                <div className="rounded-2xl border border-surface-200 dark:border-surface-700 bg-surface-50/60 dark:bg-surface-800/40 p-4">
                  <div className="text-sm font-semibold text-surface-800 dark:text-surface-200 mb-3">
                    Storage
                  </div>
                  <label className="flex items-center gap-2 text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                    Image download path
                    <span
                      title="Relative to Downloads folder (e.g. lumina or lumina/subfolder) or a full path (e.g. C:\Images\Lumina). Directories are created if missing."
                      className="text-surface-400 hover:text-surface-500 cursor-help"
                    >
                      <Info size={14} />
                    </span>
                  </label>
                  <input
                    type="text"
                    value={downloadPathInput}
                    onChange={(e) => setDownloadPathInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveAll();
                      if (e.key === "Escape") onClose();
                    }}
                    placeholder="lumina or C:\\Images\\Lumina"
                    className="input w-full text-sm font-mono"
                  />
                </div>
                <div className="rounded-2xl border border-surface-200 dark:border-surface-700 bg-surface-50/60 dark:bg-surface-800/40 p-4">
                  <div className="text-sm font-semibold text-surface-800 dark:text-surface-200 mb-3">
                    Downloads
                  </div>
                  <label className="flex items-center gap-2 text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                    Max concurrent downloads
                    <span
                      title="Maximum number of downloads that can run at the same time."
                      className="text-surface-400 hover:text-surface-500 cursor-help"
                    >
                      <Info size={14} />
                    </span>
                  </label>
                  <input
                    type="number"
                    value={maxConcurrentDownloadsInput}
                    onChange={(e) =>
                      setMaxConcurrentDownloadsInput(
                        parseInt(e.target.value, 10) || 1,
                      )
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveAll();
                      if (e.key === "Escape") onClose();
                    }}
                    min="1"
                    max="10"
                    step="1"
                    className="input w-full text-sm font-mono"
                  />
                </div>
              </div>
            )}
            {activeTab === "comfyui" && (
              <div className="space-y-5">
                <div className="rounded-2xl border border-surface-200 dark:border-surface-700 bg-surface-50/60 dark:bg-surface-800/40 p-4">
                  <div className="text-sm font-semibold text-surface-800 dark:text-surface-200 mb-3">
                    Connection
                  </div>
                  <label className="flex items-center gap-2 text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                    Server URL
                    <span
                      title="Base URL of your ComfyUI server (e.g. http://127.0.0.1:8188)."
                      className="text-surface-400 hover:text-surface-500 cursor-help"
                    >
                      <Info size={14} />
                    </span>
                  </label>
                  <input
                    type="url"
                    value={urlInput}
                    onChange={(e) => {
                      setUrlInput(e.target.value);
                      setComfySaveError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveAll();
                      if (e.key === "Escape") onClose();
                    }}
                    placeholder="http://127.0.0.1:8188"
                    className="input w-full text-sm"
                    disabled={comfySaving}
                  />
                  <label className="flex items-center gap-2 text-sm font-medium text-surface-700 dark:text-surface-300 mt-4 mb-2">
                    ComfyUI base path
                    <span
                      title="Folder containing your ComfyUI installation. LoRAs will be loaded from models/loras inside this path."
                      className="text-surface-400 hover:text-surface-500 cursor-help"
                    >
                      <Info size={14} />
                    </span>
                  </label>
                  <input
                    type="text"
                    value={basePathInput}
                    onChange={(e) => {
                      setBasePathInput(e.target.value);
                      setComfySaveError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveAll();
                      if (e.key === "Escape") onClose();
                    }}
                    placeholder="C:\path\to\ComfyUI"
                    className="input w-full text-sm font-mono"
                    disabled={comfySaving}
                  />
                  {comfySaveError && (
                    <div className="mt-3 flex items-start gap-2 rounded-xl bg-red-500/10 dark:bg-red-500/15 border border-red-500/20 dark:border-red-500/30 p-3 text-sm text-red-700 dark:text-red-400">
                      <AlertCircle size={18} className="shrink-0 mt-0.5" />
                      <span>{comfySaveError}</span>
                    </div>
                  )}
                </div>
                <div className="rounded-2xl border border-surface-200 dark:border-surface-700 bg-surface-50/60 dark:bg-surface-800/40 p-4">
                  <div className="text-sm font-semibold text-surface-800 dark:text-surface-200 mb-3">
                    Workflow Defaults
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <label className="flex flex-col text-sm font-medium text-surface-700 dark:text-surface-300">
                      <span>Auto LoRA management</span>
                      <span className="text-xs font-normal text-surface-500 dark:text-surface-400">
                        Validate and download LoRAs before queuing
                      </span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setAutoLoraInput(!autoLoraInput)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                        autoLoraInput
                          ? "bg-primary-600"
                          : "bg-surface-200 dark:bg-surface-700"
                      }`}
                      role="switch"
                      aria-checked={autoLoraInput}
                    >
                      <span
                        aria-hidden="true"
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          autoLoraInput ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                  <label className="flex items-center gap-2 text-sm font-medium text-surface-700 dark:text-surface-300 mt-4 mb-2">
                    Max download size (MB)
                    <span
                      title="Warning threshold for automatic downloads. Workflow will be cancelled if a missing LoRA exceeds this size."
                      className="text-surface-400 hover:text-surface-500 cursor-help"
                    >
                      <Info size={14} />
                    </span>
                  </label>
                  <input
                    type="number"
                    value={maxDownloadSizeInput}
                    onChange={(e) =>
                      setMaxDownloadSizeInput(parseInt(e.target.value, 10) || 0)
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveAll();
                      if (e.key === "Escape") onClose();
                    }}
                    min="0"
                    step="50"
                    className="input w-full text-sm font-mono"
                  />
                  <label className="flex items-center gap-2 text-sm font-medium text-surface-700 dark:text-surface-300 mt-4 mb-2">
                    Save folder
                    <span
                      title="Subfolder name under ComfyUI output (e.g. ZIT). Leave empty for default."
                      className="text-surface-400 hover:text-surface-500 cursor-help"
                    >
                      <Info size={14} />
                    </span>
                  </label>
                  <input
                    type="text"
                    value={saveImageFolder}
                    onChange={(e) => setSaveImageFolder(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") onClose();
                    }}
                    placeholder="e.g. ZIT"
                    className="input w-full text-sm font-mono"
                    disabled={comfySaving}
                  />
                </div>
                <div className="rounded-2xl border border-surface-200 dark:border-surface-700 bg-surface-50/60 dark:bg-surface-800/40 p-4">
                  <div className="text-sm font-semibold text-surface-800 dark:text-surface-200 mb-3">
                    Workflow
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-surface-700 dark:text-surface-300">
                        ComfyUI workflow JSON
                      </div>
                      <div className="text-xs text-surface-500 dark:text-surface-400">
                        Upload a prompt-format workflow and map nodes.
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleOpenWorkflowModal}
                      className="btn btn-primary"
                    >
                      {hasCustomWorkflow ? "Replace workflow" : "Add workflow"}
                    </button>
                  </div>
                  <div className="mt-3 text-xs text-surface-500 dark:text-surface-400">
                    {hasCustomWorkflow
                      ? "Custom workflow is active."
                      : "Workflow required before sending to ComfyUI."}
                  </div>
                </div>
                <div className="rounded-2xl border border-surface-200 dark:border-surface-700 bg-surface-50/60 dark:bg-surface-800/40 p-4">
                  <div className="text-sm font-semibold text-surface-800 dark:text-surface-200 mb-3">
                    Queue
                  </div>
                  {connected &&
                    (queue_running.length > 0 || queue_pending.length > 0) && (
                      <div className="space-y-3 text-sm">
                        {queue_running.length > 0 && (
                          <div>
                            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-1">
                              <Loader2
                                size={14}
                                className="animate-spin shrink-0"
                              />
                              <span className="font-medium">
                                Running ({queue_running.length})
                              </span>
                            </div>
                            <ul className="ml-6 space-y-0.5 text-surface-600 dark:text-surface-400 font-mono text-xs">
                              {queue_running.map(([promptId], i) => (
                                <li
                                  key={`run-${promptId}-${i}`}
                                  className="truncate"
                                  title={String(promptId)}
                                >
                                  {String(promptId)}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {queue_pending.length > 0 && (
                          <div>
                            <div className="flex items-center gap-2 text-surface-500 dark:text-surface-400 mb-1">
                              <Clock size={14} className="shrink-0" />
                              <span className="font-medium">
                                Pending ({queue_pending.length})
                              </span>
                            </div>
                            <ul className="ml-6 space-y-0.5 text-surface-600 dark:text-surface-400 font-mono text-xs">
                              {queue_pending.map(([promptId], i) => (
                                <li
                                  key={`pend-${promptId}-${i}`}
                                  className="truncate"
                                  title={String(promptId)}
                                >
                                  {String(promptId)}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  {connected &&
                    queue_running.length === 0 &&
                    queue_pending.length === 0 && (
                      <p className="text-sm text-surface-500 dark:text-surface-400">
                        No jobs running or pending.
                      </p>
                    )}
                  {!connected && (
                    <p className="text-sm text-surface-500 dark:text-surface-400">
                      Connect to ComfyUI to see queue status.
                    </p>
                  )}
                </div>
              </div>
            )}
            {activeTab === "civitai" && (
              <div className="space-y-5">
                <div className="rounded-2xl border border-surface-200 dark:border-surface-700 bg-surface-50/60 dark:bg-surface-800/40 p-4">
                  <div className="text-sm font-semibold text-surface-800 dark:text-surface-200 mb-2">
                    API Key
                  </div>
                  <p className="text-xs text-surface-500 dark:text-surface-400 mb-3">
                    Use a CivitAI API key for higher rate limits and smoother
                    browsing. Get it from civitai.com → Account → API Keys.
                  </p>
                  <input
                    type="password"
                    value={civitaiKeyInput}
                    onChange={(e) => setCivitaiKeyInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveAll();
                      if (e.key === "Escape") onClose();
                    }}
                    placeholder="Your CivitAI API key"
                    className="input w-full text-sm font-mono"
                    autoComplete="off"
                  />
                </div>
              </div>
            )}
            {activeTab === "developer" && (
              <div className="space-y-5">
                <div className="rounded-2xl border border-surface-200 dark:border-surface-700 bg-surface-50/60 dark:bg-surface-800/40 p-4">
                  <div className="text-sm font-semibold text-surface-800 dark:text-surface-200 mb-2">
                    Developer
                  </div>
                  <div className="space-y-3 text-sm text-surface-600 dark:text-surface-300">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs uppercase tracking-wide text-surface-500 dark:text-surface-400">
                        Name
                      </span>
                      <span className="font-medium">Waseem Anjum</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs uppercase tracking-wide text-surface-500 dark:text-surface-400">
                        Website
                      </span>
                      <a
                        href="https://waseemanjum.com"
                        className="text-primary-600 dark:text-primary-400 hover:underline"
                        onClick={(event) => {
                          event.preventDefault();
                          void window.api.openExternal(
                            "https://waseemanjum.com",
                          );
                        }}
                      >
                        waseemanjum.com
                      </a>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs uppercase tracking-wide text-surface-500 dark:text-surface-400">
                        GitHub
                      </span>
                      <a
                        href="https://github.com/fabwaseem/lumina"
                        className="text-primary-600 dark:text-primary-400 hover:underline"
                        onClick={(event) => {
                          event.preventDefault();
                          void window.api.openExternal(
                            "https://github.com/fabwaseem/lumina",
                          );
                        }}
                      >
                        github.com/fabwaseem/lumina
                      </a>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs uppercase tracking-wide text-surface-500 dark:text-surface-400">
                        Downloads
                      </span>
                      <a
                        href="https://github.com/fabwaseem/lumina/releases/latest"
                        className="text-primary-600 dark:text-primary-400 hover:underline"
                        onClick={(event) => {
                          event.preventDefault();
                          void window.api.openExternal(
                            "https://github.com/fabwaseem/lumina/releases/latest",
                          );
                        }}
                      >
                        Latest release
                      </a>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs uppercase tracking-wide text-surface-500 dark:text-surface-400">
                        License
                      </span>
                      <span className="font-medium">MIT</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs uppercase tracking-wide text-surface-500 dark:text-surface-400">
                        Copyright
                      </span>
                      <span className="font-medium">
                        © {new Date().getFullYear()} Waseem Anjum
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 px-5 py-4 border-t border-surface-200 dark:border-surface-700 shrink-0 bg-white/80 dark:bg-surface-900/80">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-surface-600 dark:text-surface-300 hover:text-surface-900 dark:hover:text-surface-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSaveAll}
            disabled={comfySaving}
            className="btn btn-primary"
          >
            {comfySaving ? (
              <>
                <Loader2 size={16} className="animate-spin shrink-0" />
                Checking...
              </>
            ) : (
              "Save changes"
            )}
          </button>
        </div>
      </div>
    </div>
  );

  const closeWorkflowModal = () => {
    setWorkflowModalOpen(false);
    if (workflowOnly) {
      setWorkflowOnly(false);
      onClose();
    }
  };

  return createPortal(
    <>
      {modal}
      <WorkflowModal
        isOpen={workflowModalOpen}
        onClose={closeWorkflowModal}
        workflowJsonText={workflowJsonText}
        parsedWorkflow={parsedWorkflow}
        workflowNodes={workflowNodes}
        workflowMapping={workflowMapping}
        setWorkflowMapping={setWorkflowMapping}
        workflowFileName={workflowFileName}
        workflowError={workflowError}
        onFile={handleWorkflowFile}
        onSave={handleWorkflowSave}
      />
    </>,
    document.body,
  );
}
