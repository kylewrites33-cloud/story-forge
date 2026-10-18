/** One flag from the linter: where it is in the text it was given, and what to do about it. */
export interface LintIssue {
  rule: string;
  cat: string;
  /** 3 strong tell, 2 likely tell, 1 worth a look. */
  sev: number;
  start: number;
  end: number;
  text: string;
  msg: string;
  fix: string;
}

export interface LintStats {
  words: number;
  sentences: number;
  paragraphs: number;
  meanSentence: number;
  sdSentence: number;
  rhythmCV: number;
  longestSentence: number;
  sentenceLengths: number[];
  dialogueRatio: number;
  emdashPer1k: number;
  emdashMax: number;
  ellipsesPer1k: number;
  exclaimNarrationPer1k: number;
  adverbsPer1k: number;
  tricolonsPer1k: number;
  hedgesPer1k: number;
  oneLineParagraphRatio: number;
  fleschReadingEase: number;
  tellIndex: number;
  tellGrade: 'Clean' | 'Light' | 'Noticeable' | 'Heavy';
  bySeverity: Record<string, number>;
  byCategory: Record<string, number>;
}

export interface LintOptions {
  disable?: string[];
  extraPhrases?: string[];
  emdashMax?: number;
  checkEnding?: boolean;
  echo?: boolean;
  properNames?: string[];
}

export declare const Lint: {
  RULES: { id: string; cat: string; sev: number; re: RegExp; msg: string; fix: string }[];
  WATCH: Record<string, number>;
  run(text: string, opts?: LintOptions): { issues: LintIssue[]; stats: LintStats };
  tics(text: string, opts?: { properNames?: string[]; minCount?: number; minPhrase?: number }): unknown;
  adverbCount(text: string): number;
  STOPWORDS: Set<string>;
};
