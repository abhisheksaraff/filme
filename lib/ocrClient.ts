// lib/ocrClient.ts
import { createWorker } from "tesseract.js";

export interface OcrExtractionResult {
  text: string;
  error?: string;
}

export const OcrClient = {
  /**
   * Extracts raw text from an array of image Data URLs using Tesseract.js.
   */
  async extractTextFromImages(images: string[]): Promise<string[]> {
    if (!images || images.length === 0) {
      return [];
    }

    const worker = await createWorker("eng");
    const extractedTexts: string[] = [];

    try {
      for (let i = 0; i < images.length; i++) {
        try {
          const { data } = await worker.recognize(images[i]);
          const cleanedText = data.text ? data.text.trim() : "";
          extractedTexts.push(cleanedText);
        } catch (imageError) {
          console.error(`OCR processing failed for image index ${i}:`, imageError);
          extractedTexts.push("");
        }
      }
    } finally {
      await worker.terminate();
    }

    return extractedTexts;
  },
};