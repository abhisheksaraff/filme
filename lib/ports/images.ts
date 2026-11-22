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
export type ImageOwner = { sessionId: string } | { mediaId: string } | { completionId: string } | { scope: string };

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
  /**
   * The poster and cover chosen for a season, an episode or a collection (a "scope" such as "collection:10"): a TMDB picture path or
   * the link of an upload. A kind that has not been chosen is left out, and the page keeps showing TMDB's own.
   */
  chosen(scope: string): Promise<Result<Partial<Record<"poster" | "backdrop", string>>>>;
  /** Uses a TMDB picture for a scope; an upload of yours is kept but stops being the main one. */
  useTmdbPicture(scope: string, kind: "poster" | "backdrop", tmdbPath: string): Promise<Result<void>>;
  /** Goes back to TMDB's own picture for a scope. */
  clearChoice(scope: string, kind: "poster" | "backdrop"): Promise<Result<void>>;
  avatar(): Promise<Result<string | null>>;
  setAvatar(blob: Blob): Promise<Result<string>>;
  /** Deletes the uploaded profile picture, so the default shows again. */
  removeAvatar(): Promise<Result<void>>;
}
