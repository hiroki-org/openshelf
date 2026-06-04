export type PdfTextContent = {
  items: unknown[];
};

export type PdfPageProxy = {
  getTextContent: () => Promise<PdfTextContent>;
};

export type PdfDocumentProxy = {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfPageProxy>;
};

export type ViewMode = "paged" | "continuous";
