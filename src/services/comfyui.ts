import {
  isHttpUrl,
  readStorage,
  removeStorage,
  writeStorage,
} from "@/lib/validate";

const COMFYUI_URL_KEY = "comfyui-url";
const COMFYUI_BASE_PATH_KEY = "comfyui-base-path";
const COMFYUI_WORKFLOW_KEY = "comfyui-workflow";
const COMFYUI_WORKFLOW_MAPPING_KEY = "comfyui-workflow-mapping";
const DEFAULT_COMFYUI_URL = "http://127.0.0.1:8188";

export function getStoredComfyUrl(): string {
  const stored = readStorage(COMFYUI_URL_KEY)?.trim() ?? "";
  return isHttpUrl(stored) ? stored.replace(/\/$/, "") : DEFAULT_COMFYUI_URL;
}

export function setStoredComfyUrl(url: string): void {
  const value = url?.trim().replace(/\/$/, "") || DEFAULT_COMFYUI_URL;
  if (!isHttpUrl(value)) return;
  writeStorage(COMFYUI_URL_KEY, value);
  void window.api?.comfyuiSetUrl(value);
}

export function getStoredComfyBasePath(): string {
  return readStorage(COMFYUI_BASE_PATH_KEY)?.trim() ?? "";
}

export function setStoredComfyBasePath(basePath: string): void {
  const value = basePath?.trim().split("\u0000").join("") ?? "";
  writeStorage(COMFYUI_BASE_PATH_KEY, value);
  void window.api?.comfyuiSetBasePath(value);
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

function parseStoredJson(raw: string | null): unknown {
  if (!raw || raw.length > 2_000_000) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

export function getStoredComfyWorkflow(): ComfyWorkflow | null {
  const parsed = parseStoredJson(readStorage(COMFYUI_WORKFLOW_KEY));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  return parsed as ComfyWorkflow;
}

export function setStoredComfyWorkflow(workflow: ComfyWorkflow | null): void {
  if (!workflow) {
    removeStorage(COMFYUI_WORKFLOW_KEY);
    return;
  }
  writeStorage(COMFYUI_WORKFLOW_KEY, JSON.stringify(workflow));
}

export function getStoredComfyWorkflowMapping(): WorkflowNodeMapping | null {
  const parsed = parseStoredJson(readStorage(COMFYUI_WORKFLOW_MAPPING_KEY));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const mapping = parsed as WorkflowNodeMapping;
  if (typeof mapping.promptNodeId !== "string" || !mapping.promptNodeId.trim()) {
    return null;
  }
  return mapping;
}

export function setStoredComfyWorkflowMapping(
  mapping: WorkflowNodeMapping | null,
): void {
  if (!mapping) {
    removeStorage(COMFYUI_WORKFLOW_MAPPING_KEY);
    return;
  }
  writeStorage(COMFYUI_WORKFLOW_MAPPING_KEY, JSON.stringify(mapping));
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
  if (!window.api?.comfyuiQueue) {
    throw new Error("ComfyUI is unavailable");
  }
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
  if (!window.api?.comfyuiStatus) {
    return { connected: false, queue_running: [], queue_pending: [] };
  }
  try {
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
  } catch {
    return { connected: false, queue_running: [], queue_pending: [] };
  }
}

export async function getComfyUIHistory(
  promptId: string
): Promise<ComfyUIHistoryResult> {
  if (!window.api?.comfyuiHistory) {
    return { status: "error", error: "ComfyUI is unavailable" };
  }
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
