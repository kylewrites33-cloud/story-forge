/** Types for kindle.js, the copy of sf.js's Kindle section. */
export interface KindleSection { place: 'front' | 'back'; title: string; body: string }
export interface KindlePage { id: string; label: string; html: string; kind: 'title' | 'matter' | 'chapter' }
export interface KindleBook { title: string; number: number | null; url: string }
export interface TitleInfo { title: string; subtitle?: string; series?: string; number?: number | null; author?: string; publisher?: string }
export declare const Kindle: {
  smart(markup: string): string;
  CSS: string;
  LONG_SCREEN: number;
  numberWord(n: number): string;
  subtitleOf(title: string, data: Record<string, unknown>): string;
  titlePage(info: TitleInfo): string;
  matterSections(body: string): KindleSection[];
  mergeMatter(book: KindleSection[], series: KindleSection[]): KindleSection[];
  alsoBy(page: KindleSection, seriesName: string, books: KindleBook[], current: { title: string; url?: string }): KindleSection;
  bookMatter(bookBody: string, seriesBody: string, seriesName: string, books: KindleBook[], current: { title: string; url?: string }): KindleSection[];
  imageSize(bytes: Uint8Array | null): { width: number; height: number } | null;
  coverProblems(bytes: Uint8Array | null): string[];
  check(input: { pages: { label: string; html: string; kind: string }[]; matter: KindleSection[]; cover: Uint8Array | null; author: string }): { problems: string[]; good: string[] };
};
