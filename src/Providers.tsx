import { GalleryProvider } from "@/context/GalleryContext";
import { ComfyUIProvider } from "@/context/ComfyUIContext";
import { SettingsProvider } from "@/context/SettingsContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { DownloadProvider } from "@/context/DownloadContext";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <GalleryProvider>
        <ComfyUIProvider>
          <DownloadProvider>
            <SettingsProvider>
              {children}
            </SettingsProvider>
          </DownloadProvider>
        </ComfyUIProvider>
      </GalleryProvider>
    </ThemeProvider>
  );
}
