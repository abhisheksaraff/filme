// components/UploadToImages.tsx
"use client";

import { ChangeEvent, useRef } from "react";

export interface FileProcessingError {
  fileName: string;
  fileType: string;
  reason: string;
}

interface UploadToImagesProps {
  id: string;
  onUpload: (images: string[], errors: FileProcessingError[]) => void;
}

export default function UploadToImages({
  id,
  onUpload,
}: UploadToImagesProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const convertPdfToImages = async (
    file: File,
    errors: FileProcessingError[]
  ): Promise<string[]> => {
    const pageImages: string[] = [];

    try {
      const pdfjsLib = await import("pdfjs-dist");
      // The worker must match the installed pdf.js version, so the bundler serves it from this site.
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url
      ).toString();

      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

      for (let i = 1; i <= pdf.numPages; i++) {
        let canvas: HTMLCanvasElement | null = null;

        try {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 2.0 });

          canvas = document.createElement("canvas");
          canvas.style.display = "none";
          document.body.appendChild(canvas);

          const context = canvas.getContext("2d");
          canvas.height = viewport.height;
          canvas.width = viewport.width;

          if (context) {
            await page.render({
              canvas,
              canvasContext: context,
              viewport: viewport,
            }).promise;

            pageImages.push(canvas.toDataURL("image/jpeg", 0.92));
          }
        } catch (pageErr) {
          errors.push({
            fileName: file.name,
            fileType: file.type || "application/pdf",
            reason: `Failed rendering page ${i}: ${pageErr instanceof Error ? pageErr.message : "Unknown error"}`,
          });
        } finally {
          if (canvas && document.body.contains(canvas)) {
            document.body.removeChild(canvas);
          }
        }
      }
    } catch (docErr) {
      errors.push({
        fileName: file.name,
        fileType: file.type || "application/pdf",
        reason: docErr instanceof Error ? docErr.message : "Failed to load PDF document.",
      });
    }

    return pageImages;
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const allImages: string[] = [];
    const errors: FileProcessingError[] = [];

    for (const file of Array.from(files)) {
      if (file.type === "application/pdf") {
        const extractedPages = await convertPdfToImages(file, errors);
        allImages.push(...extractedPages);
      } else if (file.type.startsWith("image/")) {
        try {
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              if (typeof reader.result === "string") resolve(reader.result);
              else reject(new Error("Failed converting image to Data URL."));
            };
            reader.onerror = () => reject(reader.error || new Error("FileReader error."));
            reader.readAsDataURL(file);
          });
          allImages.push(dataUrl);
        } catch (imgErr) {
          errors.push({
            fileName: file.name,
            fileType: file.type,
            reason: imgErr instanceof Error ? imgErr.message : "Failed to process image.",
          });
        }
      } else {
        errors.push({
          fileName: file.name,
          fileType: file.type || "unknown",
          reason: "Unsupported file format.",
        });
      }
    }

    onUpload(allImages, errors);

    if (e.target) {
      e.target.value = "";
    }
  };

  return (
    <input
      id={id}
      ref={inputRef}
      type="file"
      accept="image/*,application/pdf"
      multiple
      onChange={handleFileChange}
      style={{ display: "none" }}
    />
  );
}