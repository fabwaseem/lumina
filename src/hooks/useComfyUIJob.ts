import { useState, useEffect, useRef, useCallback } from "react";
import { getComfyUIHistory, getComfyUIStatus } from "@/services/comfyui";
import type { ComfyUIHistoryImage } from "@/services/comfyui";
import { isPromptRunning, isPromptQueued } from "@/context/ComfyUIContext";

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_MS = 10 * 60 * 1000;

export type ComfyUIJobPhase = "idle" | "queued" | "running" | "done" | "error";

export interface ComfyUIJobState {
  phase: ComfyUIJobPhase;
  doneImage: ComfyUIHistoryImage | null;
  error: string | null;
}

export function useComfyUIJob(promptId: string | null): ComfyUIJobState {
  const [state, setState] = useState<ComfyUIJobState>({
    phase: "idle",
    doneImage: null,
    error: null,
  });
  const startTimeRef = useRef<number>(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const poll = useCallback(() => {
    if (!promptId) return;
    Promise.all([getComfyUIHistory(promptId), getComfyUIStatus()]).then(
      ([historyResult, status]) => {
        if (historyResult.status === "done") {
          setState({
            phase: "done",
            doneImage:
              historyResult.images && historyResult.images.length > 0
                ? historyResult.images[0]
                : null,
            error: null,
          });
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          return;
        }
        if (historyResult.status === "error") {
          setState((prev) => ({
            ...prev,
            phase: "error",
            error: historyResult.error ?? "Unknown error",
          }));
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          return;
        }
        const running = isPromptRunning(promptId, status.queue_running);
        const queued = isPromptQueued(promptId, status.queue_pending);
        setState((prev) => ({
          ...prev,
          phase: running ? "running" : queued ? "queued" : "queued",
          doneImage: null,
          error: null,
        }));
      }
    );
  }, [promptId]);

  useEffect(() => {
    if (!promptId) {
      setState({ phase: "idle", doneImage: null, error: null });
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }
    startTimeRef.current = Date.now();
    setState({ phase: "queued", doneImage: null, error: null });
    poll();
    intervalRef.current = setInterval(() => {
      if (Date.now() - startTimeRef.current > MAX_POLL_MS) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        setState((prev) =>
          prev.phase === "done"
            ? prev
            : { ...prev, phase: "error", error: "Timeout" }
        );
        return;
      }
      poll();
    }, POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [promptId, poll]);

  return state;
}
