import * as pdfjsLib from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";
import mammoth from "mammoth";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

export async function parseDocument(file: File): Promise<{ success: boolean; text?: string; error?: string }> {
  try {
    const arrayBuffer = await file.arrayBuffer();

    if (file.type === "application/pdf") {
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        fullText += content.items.map((item: any) => item.str).join(" ") + "\n";
      }
      const trimmed = fullText.trim();
      if (!trimmed) return { success: false, error: "Could not extract text from PDF. The file may be image-only." };
      return { success: true, text: trimmed };
    }

    if (
      file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      file.type === "application/msword"
    ) {
      const result = await mammoth.extractRawText({ arrayBuffer });
      const trimmed = result.value.trim();
      if (!trimmed) return { success: false, error: "Could not extract text from document." };
      return { success: true, text: trimmed };
    }

    return { success: false, error: "Unsupported file type. Please upload a PDF or Word document." };
  } catch (error) {
    console.error("Error parsing document:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to parse document" };
  }
}
