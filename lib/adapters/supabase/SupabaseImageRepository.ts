// lib/adapters/supabase/SupabaseImageRepository.ts
// Ticket stubs, photos, custom posters and covers, and the profile picture.
// Stubs, photos and the profile picture go to the active file store; custom posters and covers stay
// in Supabase's public "covers" bucket because a title stores their link as its poster address.
import { putWithFallback, storeFor } from "@/lib/files";
import type { ImageOwner, ImageRepository, StoredImage } from "@/lib/ports/images";
import { fail, ok } from "@/lib/ports/result";
import { getSupabase } from "./client";

const PUBLIC = "covers";
const EXTENSION: Record<string, string> = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png" };

const column = (owner: ImageOwner) => ("sessionId" in owner ? (["session_id", owner.sessionId] as const) : "completionId" in owner ? (["completion_id", owner.completionId] as const) : (["media_id", owner.mediaId] as const));
const isCover = (kind: string) => kind === "poster" || kind === "backdrop";

async function userId(): Promise<string | null> {
  const { data } = await getSupabase().auth.getSession();
  return data.session?.user.id ?? null;
}

interface UrlRow {
  path: string;
  source: string;
  kind: string;
  store: string;
}

/** Posters and covers are public links; everything else is a link from the store that holds it. */
async function urlsFor(rows: UrlRow[]): Promise<Map<string, string>> {
  const db = getSupabase();
  const map = new Map<string, string>();
  const byStore = new Map<string, string[]>();
  for (const row of rows) {
    if (row.source === "tmdb") continue;
    if (isCover(row.kind)) map.set(row.path, db.storage.from(PUBLIC).getPublicUrl(row.path).data.publicUrl);
    else byStore.set(row.store, [...(byStore.get(row.store) ?? []), row.path]);
  }
  for (const [store, paths] of byStore) {
    const res = await storeFor(store).urls(paths);
    if (res.ok) for (const [path, url] of res.value) map.set(path, url);
  }
  return map;
}

export const supabaseImageRepository: ImageRepository = {
  async list(owner, kinds) {
    const [col, id] = column(owner);
    const { data, error } = await getSupabase()
      .from("images")
      .select("id, kind, source, path, note, is_default, store")
      .eq(col, id)
      .in("kind", kinds)
      // Only pictures you uploaded: a TMDB poster or cover is just a link the title holds, not one of your files.
      .eq("source", "upload")
      .order("is_default", { ascending: false })
      .order("created_at");
    if (error) return fail("Could not load the images.");
    const urls = await urlsFor(data as UrlRow[]);
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
    const cover = isCover(kind);
    let store: string = "supabase";
    const path = `${uid}/${kind}/${crypto.randomUUID()}.${ext}`;

    const [col, id] = column(owner);
    // A title keeps only its latest custom poster and cover, so older uploads are removed first.
    const old = cover && "mediaId" in owner
      ? await db.from("images").select("id, path").eq(col, id).eq("kind", kind).eq("source", "upload")
      : null;

    if (cover) {
      const up = await db.storage.from(PUBLIC).upload(path, blob, { contentType: blob.type });
      if (up.error) return fail("Could not upload the image.");
    } else {
      const up = await putWithFallback(path, blob);
      if (!up.ok) return fail(up.error);
      store = up.value.id;
    }
    const inserted = await db
      .from("images")
      .insert({ kind, source: "upload", path, note, store, [col]: id })
      .select("id")
      .single();
    if (inserted.error) {
      if (cover) await db.storage.from(PUBLIC).remove([path]);
      else await storeFor(store).remove([path]);
      return fail("Could not save the image.");
    }
    if (old?.data?.length) {
      await db.from("images").delete().in("id", old.data.map((r) => r.id as string));
      await db.storage.from(PUBLIC).remove(old.data.map((r) => r.path as string));
    }
    const urls = await urlsFor([{ path, source: "upload", kind, store }]);
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
    if ("mediaId" in owner && isCover(image.data.kind as string)) {
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
    const image = await db.from("images").select("kind, source, path, store").eq("id", imageId).maybeSingle();
    if (image.error || !image.data) return fail("Could not find that image.");
    const del = await db.from("images").delete().eq("id", imageId);
    if (del.error) return fail("Could not delete the image.");
    if (image.data.source === "upload") {
      // A completion card can share a file with the viewing it copied; the file stays while any picture still uses it.
      const still = await db.from("images").select("id", { count: "exact", head: true }).eq("path", image.data.path as string);
      if ((still.count ?? 0) === 0) {
        if (isCover(image.data.kind as string)) await db.storage.from(PUBLIC).remove([image.data.path as string]);
        else await storeFor(image.data.store).remove([image.data.path as string]);
      }
    }
    return ok(undefined);
  },

  async useTmdbCover(mediaId, kind, tmdbPath) {
    const db = getSupabase();
    // The title simply points at TMDB's picture; nothing is stored for it. An upload of yours is kept but stops being the main one.
    const clear = await db.from("images").update({ is_default: false }).eq("media_id", mediaId).eq("kind", kind);
    if (clear.error) return fail("Could not change the picture.");
    // Earlier versions saved a row for every TMDB pick; those are no longer needed.
    await db.from("images").delete().eq("media_id", mediaId).eq("kind", kind).eq("source", "tmdb");
    const field = kind === "poster" ? "poster_path" : "backdrop_path";
    const update = await db.from("media_items").update({ [field]: tmdbPath }).eq("id", mediaId);
    return update.error ? fail("Could not change the picture.") : ok(undefined);
  },

  async avatar() {
    const db = getSupabase();
    const { data, error } = await db.from("images").select("path, store").eq("kind", "avatar").order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (error) return fail("Could not load your picture.");
    if (!data) return ok(null);
    const urls = await storeFor(data.store).urls([data.path as string]);
    return ok(urls.ok ? (urls.value.get(data.path as string) ?? null) : null);
  },

  async removeAvatar() {
    const db = getSupabase();
    const rows = await db.from("images").select("id, path, store").eq("kind", "avatar");
    if (rows.error) return fail("Could not remove your picture.");
    if (!rows.data?.length) return ok(undefined);
    // The record goes first, so a failure leaves the picture as it was rather than a record with no file.
    const removed = await db.from("images").delete().in("id", rows.data.map((r) => r.id as string));
    if (removed.error) return fail("Could not remove your picture.");
    for (const row of rows.data) await storeFor(row.store).remove([row.path as string]);
    return ok(undefined);
  },

  async setAvatar(blob) {
    const db = getSupabase();
    const uid = await userId();
    if (!uid) return fail("Your session has expired. Sign in again.");
    const path = `${uid}/avatar/${crypto.randomUUID()}.${EXTENSION[blob.type] ?? "bin"}`;
    const up = await putWithFallback(path, blob);
    if (!up.ok) return fail(up.error);
    const store = up.value;

    // Only the newest picture is kept.
    const old = await db.from("images").select("id, path, store").eq("kind", "avatar");
    const insert = await db.from("images").insert({ kind: "avatar", source: "upload", path, is_default: true, store: store.id });
    if (insert.error) {
      await store.remove([path]);
      return fail("Could not save your picture.");
    }
    if (old.data?.length) {
      await db.from("images").delete().in("id", old.data.map((r) => r.id as string));
      for (const row of old.data) await storeFor(row.store).remove([row.path as string]);
    }
    const urls = await store.urls([path]);
    return ok(urls.ok ? (urls.value.get(path) ?? "") : "");
  },
};
