// lib/ports/media.ts
// Openly licensed pictures and music, for decorating stories. Everything here is a nicety: failures just mean "nothing found".

/** The credit a Creative Commons work needs wherever it is shown. */
export interface MediaCredit {
  title: string;
  creator: string | null;
  /** For example "CC BY 4.0". */
  license: string;
}

export interface MediaPicture {
  url: string;
  credit: MediaCredit;
}

export interface MediaTrack {
  url: string;
  seconds: number;
  credit: MediaCredit;
}

export interface MediaSearch {
  /** PNG pictures for a phrase; callers check which are real cut-outs. */
  pictures(query: string): Promise<MediaPicture[]>;
  /** Instrumental music for a phrase, a minute to a few minutes long. */
  music(query: string): Promise<MediaTrack[]>;
}
