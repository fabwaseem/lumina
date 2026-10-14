import { clampInt, readStorage, writeStorage } from "@/lib/validate";

const DOWNLOAD_PATH_KEY = "lumina-download-path";
const AUTO_LORA_KEY = "lumina-auto-lora";
const MAX_DOWNLOAD_SIZE_KEY = "lumina-max-download-size";
const MAX_CONCURRENT_DOWNLOADS_KEY = "lumina-max-concurrent-downloads";
const DEFAULT_DOWNLOAD_PATH = "lumina";
const DEFAULT_MAX_DOWNLOAD_SIZE = 500; // MB
const DEFAULT_MAX_CONCURRENT_DOWNLOADS = 3;

export function getStoredDownloadPath(): string {
  const stored = readStorage(DOWNLOAD_PATH_KEY)?.split("\u0000").join("").trim();
  return stored || DEFAULT_DOWNLOAD_PATH;
}

export function setStoredDownloadPath(value: string): void {
  const next = value?.split("\u0000").join("").trim() || DEFAULT_DOWNLOAD_PATH;
  if (next.split(/[\\/]/).includes("..")) return;
  writeStorage(DOWNLOAD_PATH_KEY, next);
}

export function getStoredAutoLora(): boolean {
  return readStorage(AUTO_LORA_KEY) === "true";
}

export function setStoredAutoLora(value: boolean): void {
  writeStorage(AUTO_LORA_KEY, String(value));
}

export function getStoredMaxDownloadSize(): number {
  return clampInt(
    readStorage(MAX_DOWNLOAD_SIZE_KEY),
    0,
    20480,
    DEFAULT_MAX_DOWNLOAD_SIZE,
  );
}

export function setStoredMaxDownloadSize(value: number): void {
  writeStorage(
    MAX_DOWNLOAD_SIZE_KEY,
    String(clampInt(value, 0, 20480, DEFAULT_MAX_DOWNLOAD_SIZE)),
  );
}

export function getStoredMaxConcurrentDownloads(): number {
  return clampInt(
    readStorage(MAX_CONCURRENT_DOWNLOADS_KEY),
    1,
    10,
    DEFAULT_MAX_CONCURRENT_DOWNLOADS,
  );
}

export function setStoredMaxConcurrentDownloads(value: number): void {
  writeStorage(
    MAX_CONCURRENT_DOWNLOADS_KEY,
    String(clampInt(value, 1, 10, DEFAULT_MAX_CONCURRENT_DOWNLOADS)),
  );
}
