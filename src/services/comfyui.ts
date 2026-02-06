const COMFYUI_URL_KEY = "comfyui-url";
const COMFYUI_BASE_PATH_KEY = "comfyui-base-path";
const COMFYUI_WORKFLOW_KEY = "comfyui-workflow";
const COMFYUI_WORKFLOW_MAPPING_KEY = "comfyui-workflow-mapping";
const DEFAULT_COMFYUI_URL = "http://127.0.0.1:8188";

export function getStoredComfyUrl(): string {
  if (typeof window === "undefined") return DEFAULT_COMFYUI_URL;
  const stored = localStorage.getItem(COMFYUI_URL_KEY);
  return stored?.trim() || DEFAULT_COMFYUI_URL;
}

export function setStoredComfyUrl(url: string): void {
  if (typeof window === "undefined") return;
  const value = url?.trim() || DEFAULT_COMFYUI_URL;
  localStorage.setItem(COMFYUI_URL_KEY, value);
  window.api.comfyuiSetUrl(value);
}

export function getStoredComfyBasePath(): string {
  if (typeof window === "undefined") return "";
  const stored = localStorage.getItem(COMFYUI_BASE_PATH_KEY);
  return stored?.trim() ?? "";
}

export function setStoredComfyBasePath(basePath: string): void {
  if (typeof window === "undefined") return;
  const value = basePath?.trim() ?? "";
  localStorage.setItem(COMFYUI_BASE_PATH_KEY, value);
  window.api.comfyuiSetBasePath(value);
}

export interface WorkflowNodeMapping {
  promptNodeId: string;
  negativeNodeId?: string;
  samplerNodeId?: string;
  saveImageNodeId?: string;
  resolutionNodeId?: string;
  loraNodeId?: string;
}

export type ComfyWorkflow = Record<
  string,
  { inputs?: Record<string, unknown>; class_type?: string; _meta?: unknown }
>;

export function getStoredComfyWorkflow(): ComfyWorkflow | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(COMFYUI_WORKFLOW_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ComfyWorkflow;
    if (!parsed || Array.isArray(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setStoredComfyWorkflow(workflow: ComfyWorkflow | null): void {
  if (typeof window === "undefined") return;
  if (!workflow) {
    localStorage.removeItem(COMFYUI_WORKFLOW_KEY);
    return;
  }
  localStorage.setItem(COMFYUI_WORKFLOW_KEY, JSON.stringify(workflow));
}

export function getStoredComfyWorkflowMapping(): WorkflowNodeMapping | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(COMFYUI_WORKFLOW_MAPPING_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as WorkflowNodeMapping;
    if (!parsed?.promptNodeId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setStoredComfyWorkflowMapping(
  mapping: WorkflowNodeMapping | null,
): void {
  if (typeof window === "undefined") return;
  if (!mapping) {
    localStorage.removeItem(COMFYUI_WORKFLOW_MAPPING_KEY);
    return;
  }
  localStorage.setItem(COMFYUI_WORKFLOW_MAPPING_KEY, JSON.stringify(mapping));
}

export interface QueueComfyUIParams {
  prompt: string;
  negativePrompt?: string;
  seed?: number;
  saveImageFolder?: string;
  width?: number;
  height?: number;
}

export interface QueueComfyUIResult {
  prompt_id?: string;
  number?: number;
  error?: string;
  node_errors?: Record<string, unknown>;
}

export interface ComfyUIStatusResult {
  connected: boolean;
  queue_running: Array<[string, number, unknown]>;
  queue_pending: Array<[string, number, unknown]>;
}

export interface ComfyUIHistoryImage {
  filename: string;
  subfolder?: string;
  type?: string;
}

export interface ComfyUIHistoryResult {
  status: "pending" | "done" | "error";
  prompt_id?: string;
  images?: ComfyUIHistoryImage[];
  error?: string;
}

export async function queueComfyUI(
  params: QueueComfyUIParams
): Promise<QueueComfyUIResult> {
  const workflow = getStoredComfyWorkflow();
  const workflowMapping = getStoredComfyWorkflowMapping();
  const data = await window.api.comfyuiQueue({
    prompt: params.prompt,
    negativePrompt: params.negativePrompt,
    saveImageFolder: params.saveImageFolder,
    width: params.width,
    height: params.height,
    workflow,
    workflowMapping,
  });
  if (data.error) {
    throw new Error(data.error);
  }
  return data;
}

export async function getComfyUIStatus(): Promise<ComfyUIStatusResult> {
  const data = await window.api.comfyuiStatus();
  return {
    connected: data.connected ?? false,
    queue_running: (data.queue_running ?? []) as Array<
      [string, number, unknown]
    >,
    queue_pending: (data.queue_pending ?? []) as Array<
      [string, number, unknown]
    >,
  };
}

export async function getComfyUIHistory(
  promptId: string
): Promise<ComfyUIHistoryResult> {
  const data = await window.api.comfyuiHistory(promptId);
  if (data.status === "done") {
    return {
      status: "done",
      prompt_id: data.prompt_id,
      images: data.images ?? [],
    };
  }
  if (data.status === "error") {
    return { status: "error", error: data.error };
  }
  return { status: "pending", prompt_id: promptId };
}

export function getComfyUIViewUrl(
  filename: string,
  subfolder?: string,
  type?: string
): string {
  const params = new URLSearchParams();
  params.set("filename", filename);
  if (subfolder) params.set("subfolder", subfolder);
  if (type) params.set("type", type);
  return `comfy-view://view?${params.toString()}`;
}
