import { useState, useRef } from "react";
import {
  AppChrome,
  FilterSidebar,
  ImageGallery,
  Lightbox,
  DownloadManager,
} from "@/components";
import { useGallery } from "@/context/GalleryContext";
import { Providers } from "@/Providers";

function AppContent() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { sidebarCollapsed, setSidebarCollapsed } = useGallery();
  const scrollContainerRef = useRef<HTMLElement>(null);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-surface-50 dark:bg-surface-950">
      <AppChrome
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        sidebarOpen={sidebarOpen}
        sidebarCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <div className="flex flex-1 min-h-0">
        {!sidebarCollapsed && (
          <FilterSidebar
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
          />
        )}
        <main
          ref={scrollContainerRef}
          className="flex flex-1 min-w-0 flex-col min-h-0 overflow-auto"
        >
          <ImageGallery scrollContainerRef={scrollContainerRef} />
        </main>
      </div>
      <Lightbox />
      <DownloadManager />
    </div>
  );
}

export function App() {
  return (
    <Providers>
      <AppContent />
    </Providers>
  );
}
