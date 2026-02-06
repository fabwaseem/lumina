const DOWNLOAD_PATH_KEY = "lumina-download-path";
const AUTO_LORA_KEY = "lumina-auto-lora";
const MAX_DOWNLOAD_SIZE_KEY = "lumina-max-download-size";
const MAX_CONCURRENT_DOWNLOADS_KEY = "lumina-max-concurrent-downloads";
const DEFAULT_DOWNLOAD_PATH = "lumina";
const DEFAULT_MAX_DOWNLOAD_SIZE = 500; // MB
const DEFAULT_MAX_CONCURRENT_DOWNLOADS = 3;

export function getStoredDownloadPath(): string {
  if (typeof window === "undefined") return DEFAULT_DOWNLOAD_PATH;
  const stored = localStorage.getItem(DOWNLOAD_PATH_KEY);
  return stored?.trim() || DEFAULT_DOWNLOAD_PATH;
}

export function setStoredDownloadPath(value: string): void {
  if (typeof window === "undefined") return;
  const v = value?.trim() ?? DEFAULT_DOWNLOAD_PATH;
  localStorage.setItem(DOWNLOAD_PATH_KEY, v);
}

export function getStoredAutoLora(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(AUTO_LORA_KEY) === "true";
}

export function setStoredAutoLora(value: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(AUTO_LORA_KEY, String(value));
}

export function getStoredMaxDownloadSize(): number {
  if (typeof window === "undefined") return DEFAULT_MAX_DOWNLOAD_SIZE;
  const stored = localStorage.getItem(MAX_DOWNLOAD_SIZE_KEY);
  const val = stored ? parseInt(stored, 10) : NaN;
  return isNaN(val) ? DEFAULT_MAX_DOWNLOAD_SIZE : val;
}

export function setStoredMaxDownloadSize(value: number): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(MAX_DOWNLOAD_SIZE_KEY, String(value));
}

export function getStoredMaxConcurrentDownloads(): number {
  if (typeof window === "undefined") return DEFAULT_MAX_CONCURRENT_DOWNLOADS;
  const stored = localStorage.getItem(MAX_CONCURRENT_DOWNLOADS_KEY);
  const val = stored ? parseInt(stored, 10) : NaN;
  return isNaN(val) ? DEFAULT_MAX_CONCURRENT_DOWNLOADS : val;
}

export function setStoredMaxConcurrentDownloads(value: number): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(MAX_CONCURRENT_DOWNLOADS_KEY, String(value));
}
