import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { SettingsModal } from "@/components/SettingsModal";
import type { SettingsTab } from "@/components/SettingsModal";
import {
  getStoredAutoLora,
  setStoredAutoLora,
  getStoredMaxDownloadSize,
  setStoredMaxDownloadSize,
  getStoredMaxConcurrentDownloads,
  setStoredMaxConcurrentDownloads,
} from "@/services/app";

interface SettingsContextValue {
  openSettings: (tab?: SettingsTab) => void;
  openWorkflowModal: () => void;
  autoLora: boolean;
  setAutoLora: (value: boolean) => void;
  maxDownloadSize: number;
  setMaxDownloadSize: (value: number) => void;
  maxConcurrentDownloads: number;
  setMaxConcurrentDownloads: (value: number) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [initialTab, setInitialTab] = useState<SettingsTab>("app");
  const [showWorkflowModal, setShowWorkflowModal] = useState(false);
  const [autoLora, setAutoLoraState] = useState(getStoredAutoLora());
  const [maxDownloadSize, setMaxDownloadSizeState] = useState(
    getStoredMaxDownloadSize(),
  );
  const [maxConcurrentDownloads, setMaxConcurrentDownloadsState] = useState(
    getStoredMaxConcurrentDownloads(),
  );

  const setAutoLora = useCallback((value: boolean) => {
    setAutoLoraState(value);
    setStoredAutoLora(value);
  }, []);

  const setMaxDownloadSize = useCallback((value: number) => {
    setMaxDownloadSizeState(value);
    setStoredMaxDownloadSize(value);
  }, []);

  const setMaxConcurrentDownloads = useCallback((value: number) => {
    const safe = Math.max(1, Math.min(10, value || 1));
    setMaxConcurrentDownloadsState(safe);
    setStoredMaxConcurrentDownloads(safe);
  }, []);

  const openSettings = useCallback((tab?: SettingsTab) => {
    setInitialTab(tab ?? "app");
    setShowWorkflowModal(false);
    setIsOpen(true);
  }, []);

  const openWorkflowModal = useCallback(() => {
    setInitialTab("comfyui");
    setShowWorkflowModal(true);
    setIsOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setShowWorkflowModal(false);
  }, []);

  useEffect(() => {
    window.api.downloadSetMaxConcurrent(maxConcurrentDownloads);
  }, [maxConcurrentDownloads]);

  return (
    <SettingsContext.Provider
      value={{
        openSettings,
        openWorkflowModal,
        autoLora,
        setAutoLora,
        maxDownloadSize,
        setMaxDownloadSize,
        maxConcurrentDownloads,
        setMaxConcurrentDownloads,
      }}
    >
      {children}
      <SettingsModal
        isOpen={isOpen}
        onClose={handleClose}
        initialTab={initialTab}
        showWorkflowModal={showWorkflowModal}
        onWorkflowModalOpened={() => setShowWorkflowModal(false)}
      />
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error("useSettings must be used within SettingsProvider");
  }
  return ctx;
}
