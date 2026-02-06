export {};

interface DownloadProgressData {
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
}

interface DownloadListItem {
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
}

declare global {
  interface Window {
    api: {
      windowMinimize: () => Promise<void>;
      windowMaximize: () => Promise<void>;
      windowClose: () => Promise<void>;
      comfyuiSetUrl: (url: string) => Promise<void>;
      comfyuiSetBasePath: (basePath: string) => Promise<void>;
      comfyuiValidateBasePath: (basePath: string) => Promise<{
        valid: boolean;
        lorasExists: boolean;
        outputExists: boolean;
      }>;
      comfyuiStatus: () => Promise<{
        connected: boolean;
        queue_running: unknown[];
        queue_pending: unknown[];
      }>;
      comfyuiHistory: (promptId: string) => Promise<{
        status: string;
        prompt_id?: string;
        images?: Array<{ filename: string; subfolder?: string; type?: string }>;
        error?: string;
      }>;
      comfyuiQueue: (
        params: unknown,
      ) => Promise<{ prompt_id?: string; number?: number; error?: string }>;
      comfyuiView: (
        filename: string,
        subfolder?: string,
        type?: string,
      ) => Promise<number[] | null>;
      civitaiSetApiKey: (key: string) => Promise<void>;
      civitaiSearch: (query: string) => Promise<{ id: number | null }>;
      civitaiGetVersionInfo: (modelVersionId: number) => Promise<{
        downloadUrl: string;
        filename: string;
        sizeKB?: number;
        baseModel?: string;
      } | null>;
      comfyuiValidateResources: (resources: ResourceInfo[]) => Promise<{
        valid: boolean;
        missing: Array<{
          name: string;
          weight: number;
          id?: number;
          baseModel?: string;
        }>;
      }>;
      openExternal: (
        url: string,
      ) => Promise<{ success: boolean; error?: string }>;
      downloadImage: (
        url: string,
        suggestedName?: string,
        downloadPath?: string,
      ) => Promise<{ path?: string; error?: string }>;
      downloadStart: (params: {
        hash?: string;
        modelVersionId?: number;
        resourceName: string;
        destDir?: string;
      }) => Promise<{
        id?: string;
        filename?: string;
        path?: string;
        alreadyExists?: boolean;
        error?: string;
      }>;
      downloadSetMaxConcurrent: (value: number) => Promise<{
        success: boolean;
        value?: number;
        error?: string;
      }>;
      downloadPause: (
        id: string,
      ) => Promise<{ success: boolean; error?: string }>;
      downloadResume: (
        id: string,
      ) => Promise<{ success: boolean; error?: string }>;
      downloadCancel: (
        id: string,
      ) => Promise<{ success: boolean; error?: string }>;
      downloadRetry: (
        id: string,
      ) => Promise<{ success: boolean; error?: string }>;
      downloadList: () => Promise<{
        active: DownloadListItem[];
        history: DownloadListItem[];
      }>;
      downloadClearHistory: () => Promise<{ success: boolean }>;
      downloadOpenFolder: (
        filePath: string,
      ) => Promise<{ success: boolean; error?: string }>;
      downloadCheckExists: (params: {
        hash?: string;
        name?: string;
      }) => Promise<{ exists: boolean; path?: string }>;
      onDownloadProgress: (
        callback: (data: DownloadProgressData) => void,
      ) => () => void;
    };
  }
}
