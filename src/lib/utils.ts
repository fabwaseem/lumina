import type { ComfyUIJobPhase } from "@/hooks/useComfyUIJob";

export function comfyLabel(isSending: boolean, phase: ComfyUIJobPhase): string {
  if (isSending) return "Sending...";
  switch (phase) {
    case "queued":
      return "Queued";
    case "running":
      return "Running";
    case "done":
      return "Done";
    case "error":
      return "Error";
    default:
      return "Send to ComfyUI";
  }
}
