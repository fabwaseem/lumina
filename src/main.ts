declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;

import { app, BrowserWindow, ipcMain, Menu, protocol, shell } from "electron";
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import started from "electron-squirrel-startup";
import { randomUUID } from "node:crypto";
import { updateElectronApp } from "update-electron-app";
import { ResourceInfo } from "./types";
import {
  isCivitaiAssetUrl,
  isHttpUrl,
  isModelHash,
  isPromptId,
  isSafeComfyName,
  normalizeApiKey,
  parsePositiveInt,
  sanitizeFilename,
  sanitizeQuery,
  sanitizeSaveFolder,
} from "./lib/validate";

try {
  updateElectronApp();
} catch (err) {
  console.error("[update] failed to start", err);
}
protocol.registerSchemesAsPrivileged([
  { scheme: "comfy-view", privileges: { supportFetchAPI: true, secure: true } },
]);

const DEFAULT_COMFYUI_URL = "http://127.0.0.1:8188";
let comfyUiBaseUrl = DEFAULT_COMFYUI_URL;

let _comfyUiBasePath = "";
let _civitaiApiKey = "";

type DownloadStatus =
  | "pending"
  | "downloading"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled";

interface ActiveDownload {
  id: string;
  filename: string;
  url: string;
  status: DownloadStatus;
  bytesReceived: number;
  totalBytes: number | null;
  speed: number;
  progress: number;
  destPath: string;
  tempPath: string;
  createdAt: number;
  completedAt?: number;
  error?: string;
  abortController?: AbortController;
  modelVersionId?: number;
  hash?: string;
  resourceName?: string;
  lastSpeedUpdate: number;
  lastBytesForSpeed: number;
}

const activeDownloads = new Map<string, ActiveDownload>();
const downloadHistory: ActiveDownload[] = [];
let maxConcurrentDownloads = 3;
let mainWindow: BrowserWindow | null = null;

const API_TIMEOUT_MS = 20_000;
const MAX_PROMPT_LENGTH = 20_000;
const MAX_RESOURCES = 64;
const MAX_IMAGE_BYTES = 40 * 1024 * 1024;
const MAX_VIEW_BYTES = 40 * 1024 * 1024;

function parseByteCount(value: string | null): number | null {
  if (!value) return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return null;
  return numeric;
}

async function readJson<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function civitaiHeaders(): Record<string, string> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (_civitaiApiKey) headers.Authorization = `Bearer ${_civitaiApiKey}`;
  return headers;
}

function isInside(root: string, target: string): boolean {
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(target);
  const relative = path.relative(resolvedRoot, resolvedTarget);
  return (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
}

function safeModelFilename(name: string, modelVersionId: number): string {
  return sanitizeFilename(name, `model-${modelVersionId}.safetensors`);
}

function sendDownloadUpdate(download: ActiveDownload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("download:progress", {
      id: download.id,
      filename: download.filename,
      status: download.status,
      bytesReceived: download.bytesReceived,
      totalBytes: download.totalBytes,
      speed: download.speed,
      progress: download.progress,
      error: download.error,
      destPath: download.destPath,
      createdAt: download.createdAt,
      completedAt: download.completedAt,
      modelVersionId: download.modelVersionId,
      hash: download.hash,
      resourceName: download.resourceName,
    });
  }
}

function getLorasPath(): string {
  if (_comfyUiBasePath) {
    return path.join(_comfyUiBasePath, "models", "loras");
  }
  return path.join(app.getPath("downloads"), "lumina-loras");
}

async function getModelVersionInfo(modelVersionId: number): Promise<{
  downloadUrl: string;
  filename: string;
  sizeKB?: number;
  baseModel?: string;
} | null> {
  const versionId = parsePositiveInt(modelVersionId);
  if (!versionId) return null;
  try {
    const res = await fetch(
      `https://civitai.com/api/v1/model-versions/${versionId}`,
      { headers: civitaiHeaders(), signal: AbortSignal.timeout(API_TIMEOUT_MS) },
    );
    if (!res.ok) return null;
    const data = await readJson<{
      id: number;
      baseModel?: string;
      downloadUrl?: string;
      files?: Array<{
        name: string;
        primary?: boolean;
        downloadUrl?: string;
        sizeKB?: number;
      }>;
    }>(res);
    if (!data) return null;
    const primaryFile = data.files?.find((f) => f.primary) ?? data.files?.[0];
    const filename = safeModelFilename(
      primaryFile?.name ?? "",
      versionId,
    );
    const downloadUrl =
      primaryFile?.downloadUrl ??
      data.downloadUrl ??
      `https://civitai.com/api/download/models/${versionId}`;
    if (!isHttpUrl(downloadUrl)) return null;
    return {
      downloadUrl,
      filename,
      sizeKB: primaryFile?.sizeKB,
      baseModel: data.baseModel,
    };
  } catch {
    return null;
  }
}

async function getModelVersionIdByHash(hash: string): Promise<number | null> {
  if (!isModelHash(hash)) return null;
  try {
    const res = await fetch(
      `https://civitai.com/api/v1/model-versions/by-hash/${encodeURIComponent(hash)}`,
      { headers: civitaiHeaders(), signal: AbortSignal.timeout(API_TIMEOUT_MS) },
    );
    if (!res.ok) return null;
    const data = await readJson<{ id?: number }>(res);
    return parsePositiveInt(data?.id);
  } catch {
    return null;
  }
}

async function searchModelByName(query: string): Promise<number | null> {
  const safeQuery = sanitizeQuery(query);
  if (!safeQuery) return null;
  try {
    const res = await fetch(
      `https://civitai.com/api/v1/models?query=${encodeURIComponent(
        safeQuery,
      )}&types=LORA&limit=1`,
      { headers: civitaiHeaders(), signal: AbortSignal.timeout(API_TIMEOUT_MS) },
    );
    if (!res.ok) return null;
    const data = await readJson<{
      items: Array<{
        id: number;
        modelVersions?: Array<{ id: number }>;
      }>;
    }>(res);
    return parsePositiveInt(data?.items?.[0]?.modelVersions?.[0]?.id);
  } catch {
    return null;
  }
}

function parseResourcesForLoras(resources: ResourceInfo[]) {
  const loraResources = resources.filter(
    (r) => r.type?.toLowerCase() === "lora" && r.hash,
  );
  return loraResources;
}

async function findLoraInFolder(
  lorasPath: string,
  resourceName: string,
): Promise<string | null> {
  try {
    const entries = await fs.promises.readdir(lorasPath, {
      withFileTypes: true,
    });
    const lower = resourceName.toLowerCase();
    const safeName = resourceName.replace(/[<>:"/\\|?*]/g, "_").trim();
    const safeLower = safeName.toLowerCase();

    // 1. Try exact match
    if (entries.some((e) => e.isFile() && e.name === resourceName))
      return resourceName;

    // 2. Try safe name
    if (entries.some((e) => e.isFile() && e.name === safeName)) return safeName;

    // 3. Try with .safetensors
    if (!lower.endsWith(".safetensors")) {
      const withExt = `${resourceName}.safetensors`;
      if (entries.some((e) => e.isFile() && e.name === withExt)) return withExt;
      const safeWithExt = `${safeName}.safetensors`;
      if (entries.some((e) => e.isFile() && e.name === safeWithExt))
        return safeWithExt;
    }

    // 4. Case insensitive search
    const found = entries.find(
      (e) =>
        e.isFile() &&
        (e.name.toLowerCase() === lower ||
          e.name.toLowerCase() === `${lower}.safetensors` ||
          e.name.toLowerCase() === safeLower ||
          e.name.toLowerCase() === `${safeLower}.safetensors`),
    );
    return found ? found.name : null;
  } catch {
    return null;
  }
}

async function startDownload(download: ActiveDownload): Promise<void> {
  const abortController = new AbortController();
  download.abortController = abortController;
  download.status = "downloading";
  download.lastSpeedUpdate = Date.now();
  download.lastBytesForSpeed = download.bytesReceived;
  sendDownloadUpdate(download);

  let url = download.url;
  if (!isHttpUrl(url)) {
    download.status = "failed";
    download.error = "Invalid download URL";
    sendDownloadUpdate(download);
    return;
  }
  if (_civitaiApiKey && url.includes("civitai.com")) {
    const separator = url.includes("?") ? "&" : "?";
    url = `${url}${separator}token=${encodeURIComponent(_civitaiApiKey)}`;
  }

  const headers: Record<string, string> = {};
  if (download.bytesReceived > 0) {
    headers["Range"] = `bytes=${download.bytesReceived}-`;
  }

  try {
    const res = await fetch(url, {
      headers,
      signal: AbortSignal.any([
        abortController.signal,
        AbortSignal.timeout(30 * 60 * 1000),
      ]),
      redirect: "follow",
    });

    if (!res.ok && res.status !== 206) {
      download.status = "failed";
      download.error = `HTTP ${res.status}: ${res.statusText}`;
      sendDownloadUpdate(download);
      return;
    }

    if (download.bytesReceived > 0 && res.status === 200) {
      download.bytesReceived = 0;
    }

    const contentLength = res.headers.get("content-length");
    const contentRange = res.headers.get("content-range");

    if (contentRange) {
      const match = contentRange.match(/bytes \d+-\d+\/(\d+)/);
      if (match) {
        download.totalBytes = parseByteCount(match[1]);
      }
    } else if (contentLength && download.bytesReceived === 0) {
      download.totalBytes = parseByteCount(contentLength);
    }

    if (!res.body) {
      download.status = "failed";
      download.error = "No response body";
      sendDownloadUpdate(download);
      return;
    }

    const dir = path.dirname(download.tempPath);
    fs.mkdirSync(dir, { recursive: true });

    const flags = download.bytesReceived > 0 ? "a" : "w";
    const writeStream = fs.createWriteStream(download.tempPath, { flags });
    const reader = res.body.getReader();

    const writeChunk = async (chunk: Uint8Array) => {
      if (writeStream.write(chunk)) return;
      await new Promise<void>((resolve, reject) => {
        writeStream.once("drain", () => resolve());
        writeStream.once("error", reject);
      });
    };

    try {
      for (;;) {
        const currentStatus = download.status as DownloadStatus;
        if (currentStatus === "paused" || currentStatus === "cancelled") {
          reader.cancel();
          writeStream.end();
          break;
        }

        const { done, value } = await reader.read();
        if (done) break;

        await writeChunk(value);
        download.bytesReceived += value.length;

        const now = Date.now();
        const timeDiff = (now - download.lastSpeedUpdate) / 1000;
        if (timeDiff >= 0.5) {
          const bytesDiff = download.bytesReceived - download.lastBytesForSpeed;
          download.speed = Math.round(bytesDiff / timeDiff);
          download.lastSpeedUpdate = now;
          download.lastBytesForSpeed = download.bytesReceived;
        }

        if (download.totalBytes && download.totalBytes > 0) {
          download.progress = Math.min(
            100,
            (download.bytesReceived / download.totalBytes) * 100,
          );
        }

        sendDownloadUpdate(download);
      }

      writeStream.end();
      await new Promise<void>((resolve, reject) => {
        writeStream.on("finish", resolve);
        writeStream.on("error", reject);
      });

      if (download.status === "downloading") {
        fs.renameSync(download.tempPath, download.destPath);
        download.status = "completed";
        download.progress = 100;
        download.completedAt = Date.now();
        download.speed = 0;
        console.log("[Download] completed:", download.filename);
      }
    } catch (err) {
      writeStream.destroy();
      if (download.status === "downloading") {
        download.status = "failed";
        download.error = err instanceof Error ? err.message : "Download failed";
      }
    }
  } catch (err) {
    const statusAtCatch = download.status as DownloadStatus;
    if (statusAtCatch === "downloading") {
      if (err instanceof Error && err.name === "AbortError") {
        const currentStatus = download.status as DownloadStatus;
        if (currentStatus !== "paused" && currentStatus !== "cancelled") {
          download.status = "cancelled";
        }
      } else {
        download.status = "failed";
        download.error = err instanceof Error ? err.message : "Download failed";
      }
    }
  }

  download.abortController = undefined;
  sendDownloadUpdate(download);

  if (download.status === "completed" || download.status === "failed") {
    activeDownloads.delete(download.id);
    downloadHistory.unshift(download);
    if (downloadHistory.length > 100) {
      downloadHistory.pop();
    }
  }
  startQueuedDownloads();
}

function startQueuedDownloads() {
  const downloadingCount = Array.from(activeDownloads.values()).filter(
    (d) => d.status === "downloading",
  ).length;
  if (downloadingCount >= maxConcurrentDownloads) return;

  let available = maxConcurrentDownloads - downloadingCount;
  const pending = Array.from(activeDownloads.values()).filter(
    (d) => d.status === "pending",
  );
  for (const download of pending) {
    if (available <= 0) break;
    startDownload(download);
    available -= 1;
  }
}

function resolveDownloadDir(destDir: unknown): string | { error: string } {
  if (destDir == null || destDir === "") return getLorasPath();
  if (typeof destDir !== "string" || destDir.includes("\0")) {
    return { error: "Invalid destination" };
  }
  const trimmed = destDir.trim();
  if (!trimmed || trimmed.split(/[\\/]/).includes("..")) {
    return { error: "Invalid destination" };
  }
  const resolved = path.resolve(trimmed);
  if (resolved === path.parse(resolved).root) {
    return { error: "Invalid destination" };
  }
  return resolved;
}

async function startModelDownload(params: {
  hash?: string;
  modelVersionId?: number;
  resourceName?: string;
  destDir?: string;
}): Promise<{
  id?: string;
  filename?: string;
  path?: string;
  alreadyExists?: boolean;
  error?: string;
  success?: boolean;
}> {
  if (!params || typeof params !== "object") {
    return { error: "Invalid download request" };
  }
  const resourceName =
    typeof params.resourceName === "string" ? params.resourceName.trim() : "";
  if (!resourceName || resourceName.length > 180) {
    return { error: "Resource name is required" };
  }
  const hash = params.hash && isModelHash(params.hash) ? params.hash : undefined;
  if (params.hash && !hash) return { error: "Invalid model hash" };
  let modelVersionId = parsePositiveInt(params.modelVersionId) ?? undefined;

  const existing = Array.from(activeDownloads.values()).find(
    (d) =>
      ((hash && d.hash === hash) ||
        (modelVersionId && d.modelVersionId === modelVersionId)) &&
      (d.status === "downloading" || d.status === "pending"),
  );
  if (existing) {
    return { id: existing.id, error: "Already downloading" };
  }

  if (!modelVersionId && hash) {
    modelVersionId = (await getModelVersionIdByHash(hash)) ?? undefined;
  }

  if (!modelVersionId) {
    return { error: "Failed to get model version id" };
  }
  const versionInfo = await getModelVersionInfo(modelVersionId);

  if (!versionInfo) {
    return { error: "Failed to get model version info" };
  }

  const lorasPath = resolveDownloadDir(params.destDir);
  if (typeof lorasPath !== "string") return lorasPath;
  try {
    fs.mkdirSync(lorasPath, { recursive: true });
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to create folder",
    };
  }

  const id = randomUUID();
  const filename = versionInfo.filename;
  const destPath = path.join(lorasPath, filename);
  const tempPath = `${destPath}.download`;

  let bytesReceived = 0;
  try {
    if (fs.existsSync(tempPath)) {
      bytesReceived = fs.statSync(tempPath).size;
    }
    if (fs.existsSync(destPath)) {
      return { id, path: destPath, alreadyExists: true, success: true };
    }
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Could not inspect download path",
    };
  }

  const download: ActiveDownload = {
    id,
    filename,
    url: versionInfo.downloadUrl,
    status: "pending",
    bytesReceived,
    totalBytes: null,
    speed: 0,
    progress: 0,
    destPath,
    tempPath,
    createdAt: Date.now(),
    modelVersionId,
    hash,
    resourceName,
    lastSpeedUpdate: Date.now(),
    lastBytesForSpeed: bytesReceived,
  };

  activeDownloads.set(id, download);
  sendDownloadUpdate(download);
  startQueuedDownloads();
  return { id, filename, success: true };
}

ipcMain.handle(
  "download:start",
  async (
    _e,
    params: {
      hash?: string;
      modelVersionId?: number;
      resourceName: string;
      destDir?: string;
    },
  ) => startModelDownload(params),
);

ipcMain.handle("download:setMaxConcurrent", (_e, value: number) => {
  const numeric = typeof value === "number" ? value : Number(value);
  const safe = Math.max(
    1,
    Math.min(10, Number.isFinite(numeric) ? numeric : 1),
  );
  maxConcurrentDownloads = safe;
  startQueuedDownloads();
  return { success: true, value: safe };
});

function requireDownloadId(id: unknown): string | null {
  return typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id) ? id : null;
}

ipcMain.handle("download:pause", (_e, id: unknown) => {
  const downloadId = requireDownloadId(id);
  const download = downloadId ? activeDownloads.get(downloadId) : undefined;
  if (download && download.status === "downloading") {
    download.status = "paused";
    download.speed = 0;
    download.abortController?.abort();
    sendDownloadUpdate(download);
    startQueuedDownloads();
    return { success: true };
  }
  return { success: false, error: "Download not found or not active" };
});

ipcMain.handle("download:resume", (_e, id: unknown) => {
  const downloadId = requireDownloadId(id);
  const download = downloadId ? activeDownloads.get(downloadId) : undefined;
  if (download && download.status === "paused") {
    download.status = "pending";
    sendDownloadUpdate(download);
    startQueuedDownloads();
    return { success: true };
  }
  return { success: false, error: "Download not found or not paused" };
});

ipcMain.handle("download:cancel", (_e, id: unknown) => {
  const downloadId = requireDownloadId(id);
  const download = downloadId ? activeDownloads.get(downloadId) : undefined;
  if (download) {
    download.status = "cancelled";
    download.abortController?.abort();
    if (fs.existsSync(download.tempPath)) {
      try {
        fs.unlinkSync(download.tempPath);
      } catch {
        void 0;
      }
    }
    activeDownloads.delete(download.id);
    sendDownloadUpdate(download);
    startQueuedDownloads();
    return { success: true };
  }
  return { success: false, error: "Download not found" };
});

ipcMain.handle("download:retry", async (_e, id: unknown) => {
  const downloadId = requireDownloadId(id);
  const historyItem = downloadId
    ? downloadHistory.find((d) => d.id === downloadId)
    : undefined;
  if (historyItem && historyItem.modelVersionId) {
    const idx = downloadHistory.indexOf(historyItem);
    if (idx > -1) downloadHistory.splice(idx, 1);
    return startModelDownload({
      modelVersionId: historyItem.modelVersionId,
      resourceName: historyItem.resourceName || historyItem.filename,
      hash: historyItem.hash,
    });
  }
  return { success: false, error: "Download not found in history" };
});

ipcMain.handle("download:list", () => {
  const active = Array.from(activeDownloads.values()).map((d) => ({
    id: d.id,
    filename: d.filename,
    status: d.status,
    bytesReceived: d.bytesReceived,
    totalBytes: d.totalBytes,
    speed: d.speed,
    progress: d.progress,
    error: d.error,
    destPath: d.destPath,
    createdAt: d.createdAt,
    completedAt: d.completedAt,
    modelVersionId: d.modelVersionId,
    hash: d.hash,
    resourceName: d.resourceName,
  }));
  const history = downloadHistory.map((d) => ({
    id: d.id,
    filename: d.filename,
    status: d.status,
    bytesReceived: d.bytesReceived,
    totalBytes: d.totalBytes,
    speed: 0,
    progress: d.progress,
    error: d.error,
    destPath: d.destPath,
    createdAt: d.createdAt,
    completedAt: d.completedAt,
    modelVersionId: d.modelVersionId,
    hash: d.hash,
    resourceName: d.resourceName,
  }));
  return { active, history };
});

ipcMain.handle("download:clearHistory", () => {
  downloadHistory.length = 0;
  return { success: true };
});

ipcMain.handle("download:openFolder", (_e, filePath: unknown) => {
  if (typeof filePath !== "string" || !filePath.trim() || filePath.includes("\0")) {
    return { success: false, error: "Invalid path" };
  }
  const resolved = path.resolve(filePath);
  const allowedRoots = [
    app.getPath("downloads"),
    getLorasPath(),
    ...Array.from(activeDownloads.values()).map((item) => path.dirname(item.destPath)),
    ...downloadHistory.map((item) => path.dirname(item.destPath)),
  ];
  if (!allowedRoots.some((root) => isInside(root, resolved))) {
    return { success: false, error: "Path is outside the download folders" };
  }
  if (fs.existsSync(resolved)) {
    shell.showItemInFolder(resolved);
    return { success: true };
  }
  const dir = path.dirname(resolved);
  if (allowedRoots.some((root) => isInside(root, dir)) && fs.existsSync(dir)) {
    void shell.openPath(dir);
    return { success: true };
  }
  return { success: false, error: "Path not found" };
});

ipcMain.handle(
  "download:checkExists",
  async (
    _e,
    params: { hash?: string; name?: string },
  ): Promise<{ exists: boolean; path?: string }> => {
    const lorasPath = getLorasPath();
    const hash = isModelHash(params?.hash) ? params.hash : undefined;
    const name =
      typeof params?.name === "string" &&
      params.name.length <= 180 &&
      !params.name.includes("\0") &&
      !/[\\/]/.test(params.name)
        ? params.name
        : "";

    if (hash) {
      const modelVersionId = await getModelVersionIdByHash(hash);
      if (modelVersionId) {
        const versionInfo = await getModelVersionInfo(modelVersionId);
        if (versionInfo) {
          const destPath = path.join(lorasPath, versionInfo.filename);
          if (fs.existsSync(destPath)) {
            return { exists: true, path: destPath };
          }
        }
      }
    }

    if (name) {
      const found = await findLoraInFolder(lorasPath, name);
      if (found) {
        return { exists: true, path: path.join(lorasPath, found) };
      }
    }
    return { exists: false };
  },
);

interface WorkflowNodeMapping {
  promptNodeId?: string;
  negativeNodeId?: string;
  samplerNodeId?: string;
  saveImageNodeId?: string;
  resolutionNodeId?: string;
  loraNodeId?: string;
}

ipcMain.handle("comfyui:setUrl", (_e, url: unknown) => {
  if (typeof url !== "string" || !url.trim()) {
    return { success: false, error: "URL required" };
  }
  const trimmed = url.trim().replace(/\/$/, "");
  if (!isHttpUrl(trimmed)) {
    return { success: false, error: "ComfyUI URL must be http or https" };
  }
  comfyUiBaseUrl = trimmed;
  return { success: true };
});

ipcMain.handle("comfyui:setBasePath", (_e, basePath: unknown) => {
  if (basePath == null || basePath === "") {
    _comfyUiBasePath = "";
    return { success: true };
  }
  if (typeof basePath !== "string" || basePath.includes("\0")) {
    return { success: false, error: "Invalid path" };
  }
  const trimmed = basePath.trim().replace(/[/\\]+$/, "");
  if (trimmed && !path.isAbsolute(trimmed)) {
    return { success: false, error: "Base path must be absolute" };
  }
  _comfyUiBasePath = trimmed;
  return { success: true };
});

ipcMain.handle("civitai:setApiKey", (_e, key: unknown) => {
  const normalized = normalizeApiKey(key);
  if (normalized == null) return { success: false, error: "Invalid API key" };
  _civitaiApiKey = normalized;
  return { success: true };
});

ipcMain.handle("civitai:getVersionInfo", async (_e, modelVersionId: unknown) => {
  const versionId = parsePositiveInt(modelVersionId);
  if (!versionId) return null;
  return await getModelVersionInfo(versionId);
});

ipcMain.handle("app:openExternal", async (_e, url: unknown) => {
  if (typeof url !== "string" || !isHttpUrl(url)) {
    return { success: false, error: "Invalid URL" };
  }
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Could not open URL",
    };
  }
});

ipcMain.handle(
  "app:downloadImage",
  async (
    _e,
    url: string,
    suggestedName?: string,
    downloadPathSetting?: string,
  ): Promise<{ path?: string; error?: string }> => {
    if (!url || typeof url !== "string" || !isCivitaiAssetUrl(url)) {
      return { error: "Only CivitAI image URLs can be downloaded" };
    }
    const raw = (downloadPathSetting ?? "lumina").split("\u0000").join("").trim() || "lumina";
    if (raw.split(/[\\/]/).includes("..")) {
      return { error: "Invalid download folder" };
    }
    const dir = path.isAbsolute(raw)
      ? path.resolve(raw)
      : path.join(app.getPath("downloads"), raw);
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : "Failed to create folder",
      };
    }
    let filename = typeof suggestedName === "string" ? suggestedName : "";
    if (!filename || !/\.(png|jpe?g|webp|gif)$/i.test(filename)) {
      const ext =
        /\.(png|jpe?g|webp|gif)$/i.exec(url)?.[1]?.toLowerCase() ?? "png";
      const base = filename.replace(/\.[^.]+$/, "") || `image-${Date.now()}`;
      filename = `${base}.${ext}`;
    }
    const safeName = sanitizeFilename(filename, `image-${Date.now()}.png`);
    const filePath = path.join(dir, safeName);
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
      if (!res.ok) {
        return { error: res.statusText || "Download failed" };
      }
      const declaredSize = parseByteCount(res.headers.get("content-length"));
      if (declaredSize != null && declaredSize > MAX_IMAGE_BYTES) {
        return { error: "Image is too large to download" };
      }
      const body = res.body;
      if (!body) {
        return { error: "No response body" };
      }
      const nodeReadable = Readable.fromWeb(
        body as Parameters<typeof Readable.fromWeb>[0],
      );
      const writeStream = fs.createWriteStream(filePath);
      let received = 0;
      nodeReadable.on("data", (chunk: Buffer) => {
        received += chunk.length;
        if (received > MAX_IMAGE_BYTES) {
          nodeReadable.destroy(new Error("Image is too large to download"));
        }
      });
      await pipeline(nodeReadable, writeStream);
      return { path: filePath };
    } catch (err) {
      try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      } catch {
        void 0;
      }
      return {
        error: err instanceof Error ? err.message : "Download failed",
      };
    }
  },
);

ipcMain.handle(
  "comfyui:validateBasePath",
  (
    _e,
    basePath: string,
  ): { valid: boolean; lorasExists: boolean; outputExists: boolean } => {
    if (typeof basePath !== "string" || basePath.includes("\0")) {
      return { valid: false, lorasExists: false, outputExists: false };
    }
    const trimmed = basePath.trim().replace(/[/\\]+$/, "");
    if (!trimmed) {
      return { valid: true, lorasExists: false, outputExists: false };
    }
    const isDir = (target: string) => {
      try {
        return fs.existsSync(target) && fs.statSync(target).isDirectory();
      } catch {
        return false;
      }
    };
    const lorasExists = isDir(path.join(trimmed, "models", "loras"));
    const outputExists =
      isDir(path.join(trimmed, "output")) || isDir(path.join(trimmed, "outputs"));
    return {
      valid: lorasExists && outputExists,
      lorasExists,
      outputExists,
    };
  },
);

ipcMain.handle("civitai:search", async (_e, query: string) => {
  const id = await searchModelByName(query);
  return { id };
});

ipcMain.handle(
  "comfyui:validateResources",
  async (_e, resources: ResourceInfo[]) => {
    if (!Array.isArray(resources) || resources.length === 0)
      return { valid: true, missing: [] };
    const loras = parseResourcesForLoras(resources.slice(0, MAX_RESOURCES));
    const lorasPath = getLorasPath();
    const missing: Array<{
      modelVersionId: number;
      baseModel: string;
      name: string;
      type: string;
      weight?: number;
      hash?: string;
    }> = [];

    for (const l of loras) {
      const found = await findLoraInFolder(lorasPath, l.name);
      if (!found) {
        const modelVersionId = await getModelVersionIdByHash(l.hash);
        let baseModel: string | undefined;
        if (modelVersionId) {
          const info = await getModelVersionInfo(modelVersionId);
          baseModel = info?.baseModel;
        }
        missing.push({
          ...l,
          modelVersionId: modelVersionId ?? undefined,
          baseModel,
        });
      }
    }

    return { valid: missing.length === 0, missing };
  },
);

ipcMain.handle("comfyui:status", async () => {
  try {
    const base = comfyUiBaseUrl.replace(/\/$/, "");
    const res = await fetch(`${base}/queue`, {
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });
    if (!res.ok) {
      return { connected: false, queue_running: [], queue_pending: [] };
    }
    const data = await readJson<{
      queue_running?: unknown[];
      queue_pending?: unknown[];
    }>(res);
    if (!data) {
      return { connected: false, queue_running: [], queue_pending: [] };
    }
    return {
      connected: true,
      queue_running: data.queue_running ?? [],
      queue_pending: data.queue_pending ?? [],
    };
  } catch {
    return { connected: false, queue_running: [], queue_pending: [] };
  }
});

ipcMain.handle("comfyui:history", async (_e, promptId: unknown) => {
  if (!isPromptId(promptId)) {
    return { status: "error", error: "prompt_id required" };
  }
  const base = comfyUiBaseUrl.replace(/\/$/, "");
  try {
    let res = await fetch(`${base}/history/${encodeURIComponent(promptId)}`, {
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });
    if (res.status === 404) {
      res = await fetch(`${base}/history`, {
        signal: AbortSignal.timeout(API_TIMEOUT_MS),
      });
    }
    if (!res.ok) {
      return { status: "error", error: res.statusText || "ComfyUI request failed" };
    }
    const data = await readJson<
      Record<
        string,
        {
          outputs?: Record<
            string,
            {
              images?: Array<{
                filename: string;
                subfolder?: string;
                type?: string;
              }>;
            }
          >;
        }
      >
    >(res);
    if (!data) return { status: "error", error: "ComfyUI returned an unreadable response" };
    const entry = data[promptId];
    if (!entry) {
      return { status: "pending", prompt_id: promptId };
    }
    const images: Array<{
      filename: string;
      subfolder?: string;
      type?: string;
    }> = [];
    if (entry.outputs) {
      for (const nodeOutput of Object.values(entry.outputs)) {
        if (nodeOutput?.images?.length) {
          images.push(...nodeOutput.images);
        }
      }
    }
    return { status: "done", prompt_id: promptId, images };
  } catch (e) {
    return {
      status: "error",
      error: e instanceof Error ? e.message : "ComfyUI request failed",
    };
  }
});

ipcMain.handle(
  "comfyui:view",
  async (_e, filename: unknown, subfolder?: unknown, type?: unknown) => {
    if (!isSafeComfyName(filename)) return null;
    const folder = typeof subfolder === "string" ? subfolder : "";
    if (folder.includes("\0") || folder.includes("..")) return null;
    const viewType = type === "input" || type === "temp" ? type : "output";
    const base = comfyUiBaseUrl.replace(/\/$/, "");
    const params = new URLSearchParams({
      filename,
      subfolder: folder,
      type: viewType,
    });
    try {
      const res = await fetch(`${base}/view?${params.toString()}`, {
        signal: AbortSignal.timeout(API_TIMEOUT_MS),
      });
      if (!res.ok) return null;
      const declared = parseByteCount(res.headers.get("content-length"));
      if (declared != null && declared > MAX_VIEW_BYTES) return null;
      const buffer = await res.arrayBuffer();
      if (buffer.byteLength > MAX_VIEW_BYTES) return null;
      return Array.from(new Uint8Array(buffer));
    } catch {
      return null;
    }
  },
);

interface QueueParams {
  prompt: string;
  negativePrompt?: string;
  saveImageFolder?: string;
  width?: number;
  height?: number;
  loras?: ResourceInfo[];
  workflow?: Record<string, { inputs?: Record<string, unknown> }>;
  workflowMapping?: WorkflowNodeMapping;
}

ipcMain.handle("comfyui:queue", async (_e, params: QueueParams) => {
  const {
    prompt,
    negativePrompt = "blurry ugly bad",
    saveImageFolder,
    width,
    height,
    loras,
  } = params ?? {};

  if (!prompt || typeof prompt !== "string" || prompt.length > MAX_PROMPT_LENGTH) {
    return { error: "prompt is required" };
  }
  const workflowSource = params.workflow;
  if (
    !workflowSource ||
    typeof workflowSource !== "object" ||
    Array.isArray(workflowSource)
  ) {
    return {
      error: "Workflow is required. Upload an API workflow in Settings.",
    };
  }
  const mapping = params.workflowMapping ?? {};
  let workflow: Record<string, { inputs?: Record<string, unknown> }>;
  try {
    const serialized = JSON.stringify(workflowSource);
    if (serialized.length > 2_000_000) {
      return { error: "Workflow JSON is too large." };
    }
    workflow = JSON.parse(serialized) as Record<
      string,
      { inputs?: Record<string, unknown> }
    >;
  } catch {
    return { error: "Workflow JSON is invalid." };
  }
  const promptNodeId = mapping.promptNodeId?.trim();
  if (!promptNodeId) {
    return { error: "Workflow mapping required: prompt node." };
  }
  if (!workflow[promptNodeId]?.inputs) {
    return { error: "Workflow mapping invalid: prompt node not found." };
  }
  if (workflow[promptNodeId]?.inputs) {
    workflow[promptNodeId].inputs = {
      ...workflow[promptNodeId].inputs,
      text: prompt,
    };
  }
  if (mapping.negativeNodeId && workflow[mapping.negativeNodeId]?.inputs) {
    workflow[mapping.negativeNodeId].inputs = {
      ...workflow[mapping.negativeNodeId].inputs,
      text: negativePrompt,
    };
  }
  if (mapping.samplerNodeId && workflow[mapping.samplerNodeId]?.inputs) {
    workflow[mapping.samplerNodeId].inputs = {
      ...workflow[mapping.samplerNodeId].inputs,
      seed: Math.floor(Math.random() * 2 ** 32),
    };
  }
  const safeFolder = sanitizeSaveFolder(saveImageFolder);
  if (
    saveImageFolder != null &&
    saveImageFolder !== "" &&
    !safeFolder
  ) {
    return { error: "Save folder contains unsupported characters." };
  }
  if (
    safeFolder &&
    mapping.saveImageNodeId &&
    workflow[mapping.saveImageNodeId]?.inputs
  ) {
    workflow[mapping.saveImageNodeId].inputs = {
      ...workflow[mapping.saveImageNodeId].inputs,
      output_path: safeFolder,
    };
  }
  const safeWidth = parsePositiveInt(width, 8192);
  const safeHeight = parsePositiveInt(height, 8192);
  if (
    safeWidth &&
    safeHeight &&
    mapping.resolutionNodeId &&
    workflow[mapping.resolutionNodeId]?.inputs
  ) {
    workflow[mapping.resolutionNodeId].inputs = {
      ...workflow[mapping.resolutionNodeId].inputs,
      width: safeWidth,
      height: safeHeight,
    };
  }

  if (
    loras &&
    loras?.length > 0 &&
    mapping.loraNodeId &&
    workflow[mapping.loraNodeId]?.inputs
  ) {
    const lorasPath = getLorasPath();
    const loraNode = workflow[mapping.loraNodeId];
    for (let i = 1; i <= 8; i++) {
      const key = `lora_${i}`;
      if (loraNode.inputs?.[key]) {
        loraNode.inputs[key] = { on: false, lora: "None", strength: 1 };
      }
    }
    for (let i = 0; i < Math.min(loras.length, 8); i++) {
      const l = loras[i];
      const foundName = await findLoraInFolder(lorasPath, l.name);
      if (foundName) {
        const key = `lora_${i + 1}`;
        if (!loraNode.inputs) {
          loraNode.inputs = {};
        }
        loraNode.inputs[key] = {
          on: true,
          lora: foundName,
          strength: l.weight,
        };
      }
    }
  }

  try {
    const base = comfyUiBaseUrl.replace(/\/$/, "");
    const res = await fetch(`${base}/prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: workflow,
        client_id: `lumina-${Date.now()}`,
      }),
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });
    const data = (await readJson<{
      prompt_id?: string;
      number?: number;
      error?: string;
    }>(res)) ?? { error: "ComfyUI returned an unreadable response" };
    if (!res.ok) {
      console.log("[ComfyUI] POST failed:", data.error ?? res.statusText);
      return { error: data.error ?? "ComfyUI request failed" };
    }
    return data;
  } catch (e) {
    console.log("[ComfyUI] request failed:", e);
    return { error: e instanceof Error ? e.message : "ComfyUI request failed" };
  }
});

if (started) {
  app.quit();
}

const MIN_WIDTH = 800;
const MIN_HEIGHT = 600;

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }
};

ipcMain.handle("window:minimize", (e) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  if (win && !win.isDestroyed()) win.minimize();
});

ipcMain.handle("window:maximize", (e) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  if (win && !win.isDestroyed()) {
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  }
});

ipcMain.handle("window:close", (e) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  if (win && !win.isDestroyed()) win.close();
});

app.on("ready", () => {
  Menu.setApplicationMenu(null);
  protocol.handle("comfy-view", async (request) => {
    const url = new URL(request.url);
    const filename = url.searchParams.get("filename") ?? "";
    const subfolder = url.searchParams.get("subfolder") ?? "";
    const requestedType = url.searchParams.get("type") ?? "output";
    const type =
      requestedType === "input" || requestedType === "temp"
        ? requestedType
        : "output";
    if (!isSafeComfyName(filename) || subfolder.includes("..") || subfolder.includes("\0")) {
      return new Response("Missing filename", { status: 400 });
    }
    const base = comfyUiBaseUrl.replace(/\/$/, "");
    const params = new URLSearchParams({ filename, subfolder, type });
    try {
      const res = await fetch(`${base}/view?${params.toString()}`, {
        signal: AbortSignal.timeout(API_TIMEOUT_MS),
      });
      const contentType = res.headers.get("content-type") ?? "application/octet-stream";
      return new Response(res.body, {
        headers: { "content-type": contentType },
        status: res.status,
      });
    } catch {
      return new Response("Failed to fetch", { status: 502 });
    }
  });
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
