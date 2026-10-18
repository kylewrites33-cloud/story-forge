export declare const Prose: {
  stripComments(s: string): string;
  inline(text: string): string;
  proseLines(body: string): string;
  proseText(body: string): string;
  cleanProse(body: string): string;
  sentences(text: string): { text: string; start: number; end: number }[];
  paragraphs(text: string): { text: string; start: number; end: number }[];
  paraHtml(text: string, breakMark: string): string;
};
export declare function wordCount(text: string): number;
