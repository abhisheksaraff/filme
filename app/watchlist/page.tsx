// app/watchlist/page.tsx
"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import type { FileProcessingError } from "@/components/UploadToImages";

const UploadToImages = dynamic(() => import("@/components/UploadToImages"), {
  ssr: false,
});

export default function WatchlistPage() {
  const router = useRouter();

  const handleUpload = (images: string[], errors: FileProcessingError[]) => {
    // Save images and errors (if present) so /scan can handle them
    if (images.length > 0) {
      sessionStorage.setItem("scanned_ticket_images", JSON.stringify(images));
    } else {
      sessionStorage.removeItem("scanned_ticket_images");
    }

    if (errors.length > 0) {
      sessionStorage.setItem("scanned_ticket_errors", JSON.stringify(errors));
    } else {
      sessionStorage.removeItem("scanned_ticket_errors");
    }

    if (images.length > 0 || errors.length > 0) {
      router.push("/scan");
    }
  };

  const handleManualInput = () => {
    sessionStorage.removeItem("scanned_ticket_images");
    sessionStorage.removeItem("scanned_ticket_errors");
    router.push("/scan");
  };

  return (
    <main>
      <button type="button" onClick={handleManualInput}>
        Manual Input
      </button>

      <button type="button" onClick={() => document.getElementById("file-upload")?.click()}>
        Upload
      </button>

      <UploadToImages
        id="file-upload"
        onUpload={handleUpload}
      />
    </main>
  );
}