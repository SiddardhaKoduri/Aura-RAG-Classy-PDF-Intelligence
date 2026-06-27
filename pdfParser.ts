import * as pdfjs from 'pdfjs-dist';

// @ts-ignore
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export interface PDFPageData {
  pageNumber: number;
  text: string;
}

export interface PDFDocumentData {
  id: string;
  fileName: string;
  fileSize: string;
  totalPages: number;
  pages: PDFPageData[];
  uploadedAt: string;
}

export async function parsePDF(file: File, onProgress?: (percent: number) => void): Promise<PDFDocumentData> {
  const arrayBuffer = await file.arrayBuffer();
  
  // Set up loading task
  const loadingTask = pdfjs.getDocument({ 
    data: arrayBuffer,
    useSystemFonts: true
  });
  
  if (onProgress) {
    onProgress(10); // Initial load progress
  }

  const pdf = await loadingTask.promise;
  const totalPages = pdf.numPages;
  const pages: PDFPageData[] = [];

  for (let i = 1; i <= totalPages; i++) {
    try {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const textItems = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      
      // Clean up multiple spaces, line endings and trim
      const cleanText = textItems.replace(/\s+/g, ' ').trim();
      
      pages.push({
        pageNumber: i,
        text: cleanText
      });
      
      if (onProgress) {
        // Map page processing from 10% to 100%
        const percent = Math.round(10 + ((i / totalPages) * 90));
        onProgress(percent);
      }
    } catch (pageError) {
      console.error(`Error parsing page ${i}:`, pageError);
      pages.push({
        pageNumber: i,
        text: `[Error parsing text from page ${i}]`
      });
    }
  }

  // Format file size
  let fileSize = `${(file.size / 1024).toFixed(1)} KB`;
  if (file.size > 1024 * 1024) {
    fileSize = `${(file.size / (1024 * 1024)).toFixed(1)} MB`;
  }

  return {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    fileName: file.name,
    fileSize,
    totalPages,
    pages,
    uploadedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  };
}
