import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("api", {
  windowMinimize: () => ipcRenderer.invoke("window:minimize"),
  windowMaximize: () => ipcRenderer.invoke("window:maximize"),
  windowClose: () => ipcRenderer.invoke("window:close"),
  comfyuiSetUrl: (url: string) => ipcRenderer.invoke("comfyui:setUrl", url),
  comfyuiSetBasePath: (basePath: string) =>
    ipcRenderer.invoke("comfyui:setBasePath", basePath),
  comfyuiValidateBasePath: (basePath: string) =>
    ipcRenderer.invoke("comfyui:validateBasePath", basePath),
  comfyuiStatus: () => ipcRenderer.invoke("comfyui:status"),
  comfyuiHistory: (promptId: string) =>
    ipcRenderer.invoke("comfyui:history", promptId),
  comfyuiQueue: (params: unknown) =>
    ipcRenderer.invoke("comfyui:queue", params),
  comfyuiView: (filename: string, subfolder?: string, type?: string) =>
    ipcRenderer.invoke("comfyui:view", filename, subfolder, type),
  civitaiSetApiKey: (key: string) =>
    ipcRenderer.invoke("civitai:setApiKey", key),
  civitaiSearch: (query: string) => ipcRenderer.invoke("civitai:search", query),
  civitaiGetVersionInfo: (modelVersionId: number) =>
    ipcRenderer.invoke("civitai:getVersionInfo", modelVersionId),
  comfyuiValidateResources: (prompt: string) =>
    ipcRenderer.invoke("comfyui:validateResources", prompt),
  openExternal: (url: string) => ipcRenderer.invoke("app:openExternal", url),
  downloadImage: (url: string, suggestedName?: string, downloadPath?: string) =>
    ipcRenderer.invoke("app:downloadImage", url, suggestedName, downloadPath),
  downloadStart: (params: {
    modelVersionId: number;
    resourceName: string;
    destDir?: string;
  }) => ipcRenderer.invoke("download:start", params),
  downloadSetMaxConcurrent: (value: number) =>
    ipcRenderer.invoke("download:setMaxConcurrent", value),
  downloadPause: (id: string) => ipcRenderer.invoke("download:pause", id),
  downloadResume: (id: string) => ipcRenderer.invoke("download:resume", id),
  downloadCancel: (id: string) => ipcRenderer.invoke("download:cancel", id),
  downloadRetry: (id: string) => ipcRenderer.invoke("download:retry", id),
  downloadList: () => ipcRenderer.invoke("download:list"),
  downloadClearHistory: () => ipcRenderer.invoke("download:clearHistory"),
  downloadOpenFolder: (filePath: string) =>
    ipcRenderer.invoke("download:openFolder", filePath),
  downloadCheckExists: (params: { hash?: string; name?: string }) =>
    ipcRenderer.invoke("download:checkExists", params),
  onDownloadProgress: (
    callback: (data: {
      id: string;
      filename: string;
      status: string;
      bytesReceived: number;
      totalBytes: number | null;
      speed: number;
      progress: number;
      error?: string;
      destPath: string;
      createdAt: number;
      completedAt?: number;
      modelVersionId?: number;
      resourceName?: string;
    }) => void,
  ) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      data: Parameters<typeof callback>[0],
    ) => callback(data);
    ipcRenderer.on("download:progress", listener);
    return () => ipcRenderer.removeListener("download:progress", listener);
  },
});
