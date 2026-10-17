export declare const Prose: {
  stripComments(s: string): string;
  inline(text: string): string;
  proseLines(body: string): string;
  proseText(body: string): string;
  cleanProse(body: string): string;
  paraHtml(text: string, breakMark: string): string;
};
export declare function wordCount(text: string): number;
