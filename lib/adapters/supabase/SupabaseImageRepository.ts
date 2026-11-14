// lib/adapters/supabase/SupabaseImageRepository.ts
// Ticket stubs, photos, custom posters and covers, and the profile picture.
import type { ImageOwner, ImageRepository, StoredImage } from "@/lib/ports/images";
import { fail, ok } from "@/lib/ports/result";
import { getSupabase } from "./client";

const PRIVATE = "media";
const PUBLIC = "covers";
const EXTENSION: Record<string, string> = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png" };

const column = (owner: ImageOwner) => ("sessionId" in owner ? (["session_id", owner.sessionId] as const) : (["media_id", owner.mediaId] as const));

async function userId(): Promise<string | null> {
  const { data } = await getSupabase().auth.getSession();
  return data.session?.user.id ?? null;
}

/** Posters and covers are public links; everything else is signed for an hour. */
async function urlsFor(rows: { path: string; source: string; kind: string }[]): Promise<Map<string, string>> {
  const db = getSupabase();
  const map = new Map<string, string>();
  const signedPaths: string[] = [];
  for (const row of rows) {
    if (row.source === "tmdb") continue;
    if (row.kind === "poster" || row.kind === "backdrop") map.set(row.path, db.storage.from(PUBLIC).getPublicUrl(row.path).data.publicUrl);
    else signedPaths.push(row.path);
  }
  if (signedPaths.length > 0) {
    const signed = await db.storage.from(PRIVATE).createSignedUrls(signedPaths, 3600);
    for (const item of signed.data ?? []) if (item.path && item.signedUrl) map.set(item.path, item.signedUrl);
  }
  return map;
}

export const supabaseImageRepository: ImageRepository = {
  async list(owner, kinds) {
    const [col, id] = column(owner);
    const { data, error } = await getSupabase()
      .from("images")
      .select("id, kind, source, path, note, is_default")
      .eq(col, id)
      .in("kind", kinds)
      .order("is_default", { ascending: false })
      .order("created_at");
    if (error) return fail("Could not load the images.");
    const urls = await urlsFor(data as { path: string; source: string; kind: string }[]);
    return ok(
      data.flatMap((row): StoredImage[] => {
        const url = row.source === "tmdb" ? `https://image.tmdb.org/t/p/w500${row.path}` : urls.get(row.path as string);
        return url ? [{ id: row.id as string, url, note: row.note as string | null, isDefault: row.is_default as boolean, kind: row.kind as string }] : [];
      }),
    );
  },

  async add(owner, kind, blob, note) {
    const db = getSupabase();
    const uid = await userId();
    if (!uid) return fail("Your session has expired. Sign in again.");
    const ext = EXTENSION[blob.type] ?? "bin";
    const isCover = kind === "poster" || kind === "backdrop";
    const bucket = isCover ? PUBLIC : PRIVATE;
    const path = `${uid}/${kind}/${crypto.randomUUID()}.${ext}`;

    const up = await db.storage.from(bucket).upload(path, blob, { contentType: blob.type });
    if (up.error) return fail("Could not upload the image.");

    const [col, id] = column(owner);
    const inserted = await db
      .from("images")
      .insert({ kind, source: "upload", path, note, [col]: id })
      .select("id")
      .single();
    if (inserted.error) {
      await db.storage.from(bucket).remove([path]);
      return fail("Could not save the image.");
    }
    const urls = await urlsFor([{ path, source: "upload", kind }]);
    return ok({ id: inserted.data.id as string, url: urls.get(path) ?? "", note, isDefault: false, kind });
  },

  async setDefault(owner, imageId) {
    const db = getSupabase();
    const image = await db.from("images").select("id, kind, source, path").eq("id", imageId).maybeSingle();
    if (image.error || !image.data) return fail("Could not find that image.");
    const [col, id] = column(owner);
    const clear = await db.from("images").update({ is_default: false }).eq(col, id).eq("kind", image.data.kind);
    if (clear.error) return fail("Could not change the default.");
    const set = await db.from("images").update({ is_default: true }).eq("id", imageId);
    if (set.error) return fail("Could not change the default.");

    // A title's poster or cover is also what the rest of the app shows.
    if ("mediaId" in owner && (image.data.kind === "poster" || image.data.kind === "backdrop")) {
      const value =
        image.data.source === "tmdb" ? (image.data.path as string) : db.storage.from(PUBLIC).getPublicUrl(image.data.path as string).data.publicUrl;
      const field = image.data.kind === "poster" ? "poster_path" : "backdrop_path";
      const update = await db.from("media_items").update({ [field]: value }).eq("id", owner.mediaId);
      if (update.error) return fail("Could not change the poster.");
    }
    return ok(undefined);
  },

  async setNote(imageId, note) {
    const { error } = await getSupabase().from("images").update({ note }).eq("id", imageId);
    return error ? fail("Could not save the note.") : ok(undefined);
  },

  async remove(imageId) {
    const db = getSupabase();
    const image = await db.from("images").select("kind, source, path").eq("id", imageId).maybeSingle();
    if (image.error || !image.data) return fail("Could not find that image.");
    const del = await db.from("images").delete().eq("id", imageId);
    if (del.error) return fail("Could not delete the image.");
    if (image.data.source === "upload") {
      const bucket = image.data.kind === "poster" || image.data.kind === "backdrop" ? PUBLIC : PRIVATE;
      await db.storage.from(bucket).remove([image.data.path as string]);
    }
    return ok(undefined);
  },

  async useTmdbCover(mediaId, kind, tmdbPath) {
    const db = getSupabase();
    const existing = await db.from("images").select("id").eq("media_id", mediaId).eq("kind", kind).eq("source", "tmdb").eq("path", tmdbPath).maybeSingle();
    let imageId = existing.data?.id as string | undefined;
    if (!imageId) {
      const inserted = await db.from("images").insert({ kind, source: "tmdb", path: tmdbPath, media_id: mediaId }).select("id").single();
      if (inserted.error) return fail("Could not save the image.");
      imageId = inserted.data.id as string;
    }
    return supabaseImageRepository.setDefault({ mediaId }, imageId);
  },

  async avatar() {
    const db = getSupabase();
    const { data, error } = await db.from("images").select("path").eq("kind", "avatar").order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (error) return fail("Could not load your picture.");
    if (!data) return ok(null);
    const signed = await db.storage.from(PRIVATE).createSignedUrl(data.path as string, 3600);
    return ok(signed.data?.signedUrl ?? null);
  },

  async setAvatar(blob) {
    const db = getSupabase();
    const uid = await userId();
    if (!uid) return fail("Your session has expired. Sign in again.");
    const path = `${uid}/avatar/${crypto.randomUUID()}.${EXTENSION[blob.type] ?? "bin"}`;
    const up = await db.storage.from(PRIVATE).upload(path, blob, { contentType: blob.type });
    if (up.error) return fail("Could not upload your picture.");

    // Only the newest picture is kept.
    const old = await db.from("images").select("id, path").eq("kind", "avatar");
    const insert = await db.from("images").insert({ kind: "avatar", source: "upload", path, is_default: true });
    if (insert.error) {
      await db.storage.from(PRIVATE).remove([path]);
      return fail("Could not save your picture.");
    }
    if (old.data?.length) {
      await db.from("images").delete().in("id", old.data.map((r) => r.id as string));
      await db.storage.from(PRIVATE).remove(old.data.map((r) => r.path as string));
    }
    const signed = await db.storage.from(PRIVATE).createSignedUrl(path, 3600);
    return ok(signed.data?.signedUrl ?? "");
  },
};
