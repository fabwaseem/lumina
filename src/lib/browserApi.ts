function unavailable(error = "Desktop bridge unavailable") {
  return Promise.resolve({ success: false, error });
}

export function installBrowserApiFallback(): void {
  if (typeof window === "undefined" || window.api) return;

  window.api = {
    windowMinimize: () => Promise.resolve(),
    windowMaximize: () => Promise.resolve(),
    windowClose: () => Promise.resolve(),
    comfyuiSetUrl: () => Promise.resolve(),
    comfyuiSetBasePath: () => Promise.resolve(),
    comfyuiValidateBasePath: () =>
      Promise.resolve({
        valid: false,
        lorasExists: false,
        outputExists: false,
      }),
    comfyuiStatus: () =>
      Promise.resolve({
        connected: false,
        queue_running: [],
        queue_pending: [],
      }),
    comfyuiHistory: () =>
      Promise.resolve({ status: "error", error: "ComfyUI is unavailable" }),
    comfyuiQueue: () =>
      Promise.resolve({ error: "ComfyUI is unavailable in the browser preview" }),
    comfyuiView: () => Promise.resolve(null),
    civitaiSetApiKey: () => Promise.resolve(),
    civitaiSearch: () => Promise.resolve({ id: null }),
    civitaiGetVersionInfo: () => Promise.resolve(null),
    comfyuiValidateResources: () =>
      Promise.resolve({ valid: true, missing: [] }),
    openExternal: (url: string) => {
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
          return unavailable("Invalid URL");
        }
        window.open(parsed.toString(), "_blank", "noopener,noreferrer");
        return Promise.resolve({ success: true });
      } catch {
        return unavailable("Invalid URL");
      }
    },
    downloadImage: () => unavailable("Image download requires the desktop app"),
    downloadStart: () =>
      Promise.resolve({ error: "Downloads require the desktop app" }),
    downloadSetMaxConcurrent: (value: number) =>
      Promise.resolve({ success: true, value }),
    downloadPause: () => unavailable(),
    downloadResume: () => unavailable(),
    downloadCancel: () => unavailable(),
    downloadRetry: () => unavailable(),
    downloadList: () => Promise.resolve({ active: [], history: [] }),
    downloadClearHistory: () => Promise.resolve({ success: true }),
    downloadOpenFolder: () => unavailable(),
    downloadCheckExists: () => Promise.resolve({ exists: false }),
    onDownloadProgress: () => () => undefined,
  };
}
