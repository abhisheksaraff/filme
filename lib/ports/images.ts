// lib/ports/images.ts
import type { Result } from "./result";

export interface StoredImage {
  id: string;
  /** A link the page can show: signed for private files, public for posters and covers. */
  url: string;
  note: string | null;
  isDefault: boolean;
  kind: string;
}

/** Whose image it is: a viewing's own, or a title's. */
export type ImageOwner = { sessionId: string } | { mediaId: string };

export type ImageKind = "ticket" | "photo" | "poster" | "backdrop";

/** Ticket stubs, photos, custom posters and covers, and the profile picture. */
export interface ImageRepository {
  list(owner: ImageOwner, kinds: ImageKind[]): Promise<Result<StoredImage[]>>;
  add(owner: ImageOwner, kind: ImageKind, blob: Blob, note: string | null): Promise<Result<StoredImage>>;
  /** Makes one image the default of its kind. For a title's poster or cover it also becomes the one shown everywhere. */
  setDefault(owner: ImageOwner, imageId: string): Promise<Result<void>>;
  setNote(imageId: string, note: string | null): Promise<Result<void>>;
  remove(imageId: string): Promise<Result<void>>;
  /** Uses a TMDB poster or cover instead of an uploaded one. */
  useTmdbCover(mediaId: string, kind: "poster" | "backdrop", tmdbPath: string): Promise<Result<void>>;
  avatar(): Promise<Result<string | null>>;
  setAvatar(blob: Blob): Promise<Result<string>>;
}
