
export interface HistoryItem {
  id: string;
  type: 'transcription' | 'text';
  text: string;
  language?: 'fr' | 'en';
  languageCodes?: Array<'fr' | 'en'>;
  metadata?: {
    filename?: string;
    speakerLabels?: boolean;
    punctuate?: boolean;
  };
  createdAt: string;
}
