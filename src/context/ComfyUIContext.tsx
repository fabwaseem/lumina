import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import {
  getComfyUIStatus,
  getStoredComfyUrl,
  getStoredComfyBasePath,
} from "@/services/comfyui";
import { getStoredCivitaiApiKey } from "@/services/civitai";
import type { ComfyUIStatusResult } from "@/services/comfyui";

interface ComfyUIContextValue extends ComfyUIStatusResult {
  refetch: () => Promise<void>;
}

const ComfyUIContext = createContext<ComfyUIContextValue | null>(null);

const POLL_INTERVAL_MS = 5000;

export function ComfyUIProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<ComfyUIStatusResult>({
    connected: false,
    queue_running: [],
    queue_pending: [],
  });

  const refetch = useCallback(async () => {
    const data = await getComfyUIStatus();
    setStatus(data);
  }, []);

  useEffect(() => {
    window.api.comfyuiSetUrl(getStoredComfyUrl());
    window.api.comfyuiSetBasePath(getStoredComfyBasePath());
    window.api.civitaiSetApiKey(getStoredCivitaiApiKey());
  }, []);

  useEffect(() => {
    let cancelled = false;
    const tick = () => {
      getComfyUIStatus().then((data) => {
        if (!cancelled) setStatus(data);
      });
    };
    tick();
    const id = setInterval(tick, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const value: ComfyUIContextValue = {
    ...status,
    refetch,
  };

  return (
    <ComfyUIContext.Provider value={value}>{children}</ComfyUIContext.Provider>
  );
}

export function useComfyUI() {
  const ctx = useContext(ComfyUIContext);
  if (!ctx) {
    throw new Error("useComfyUI must be used within ComfyUIProvider");
  }
  return ctx;
}

export function isPromptRunning(
  promptId: string,
  queueRunning: Array<[string, number, unknown]>
): boolean {
  return queueRunning.some(([id]) => id === promptId);
}

export function isPromptQueued(
  promptId: string,
  queuePending: Array<[string, number, unknown]>
): boolean {
  return queuePending.some(([id]) => id === promptId);
}
