// supabase/functions/files/index.ts
// Stores and serves the user's ticket stubs and photos in an S3-compatible bucket (Backblaze B2,
// Cloudflare R2, Wasabi...). The bucket keys live only here; the browser never sees them.
// Switching provider means changing the B2_* secrets, not this code.
import { AwsClient } from "npm:aws4fetch@1";
import { requireUser } from "../_shared/auth.ts";
import { HttpError, readJson, serve } from "../_shared/http.ts";

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const LINK_SECONDS = 3600;
const MAX_PATHS = 100;
// SECURITY: a path is "<user id>/<folders>/<file>" with plain characters only, and must start with
// the caller's own id, so one user can never reach another user's files or climb out with "..".
const SAFE_PATH = /^[0-9a-f-]{36}\/[A-Za-z0-9_./-]{1,200}$/;

function bucket() {
  const endpoint = Deno.env.get("B2_ENDPOINT")?.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const name = Deno.env.get("B2_BUCKET");
  const accessKeyId = Deno.env.get("B2_KEY_ID");
  const secretAccessKey = Deno.env.get("B2_APPLICATION_KEY");
  const region = Deno.env.get("B2_REGION");
  if (!endpoint || !name || !accessKeyId || !secretAccessKey || !region) {
    throw new HttpError(503, "Image storage is not set up yet. Add the B2 secrets in Supabase.");
  }
  return { aws: new AwsClient({ accessKeyId, secretAccessKey, region, service: "s3" }), base: `https://${endpoint}/${name}` };
}

function ownPath(userId: string, value: unknown): string {
  if (typeof value !== "string" || !value.startsWith(`${userId}/`) || value.includes("..") || !SAFE_PATH.test(value)) {
    throw new HttpError(400, "That file path is not allowed.");
  }
  return value;
}

function ownPaths(userId: string, value: unknown): string[] {
  if (!Array.isArray(value) || value.length > MAX_PATHS) throw new HttpError(400, "paths must be a short list.");
  return value.map((path) => ownPath(userId, path));
}

serve(async (req) => {
  const { userId } = await requireUser(req);
  const { aws, base } = bucket();

  // Uploads send the file itself as the body, with the action and path in headers.
  if (req.headers.get("x-action") === "put") {
    const path = ownPath(userId, req.headers.get("x-path"));
    const body = await req.arrayBuffer();
    if (body.byteLength === 0 || body.byteLength > MAX_UPLOAD_BYTES) throw new HttpError(413, "That file is too large.");
    const type = req.headers.get("content-type") ?? "application/octet-stream";
    const res = await aws.fetch(`${base}/${path}`, { method: "PUT", body, headers: { "content-type": type } });
    if (!res.ok) throw new HttpError(502, "The image store refused the upload.");
    return { ok: true };
  }

  const body = await readJson(req);
  switch (body.action) {
    case "sign": {
      const urls: Record<string, string> = {};
      for (const path of ownPaths(userId, body.paths)) {
        const url = new URL(`${base}/${path}`);
        url.searchParams.set("X-Amz-Expires", String(LINK_SECONDS));
        urls[path] = (await aws.sign(url, { method: "GET", aws: { signQuery: true } })).url;
      }
      return { urls };
    }

    case "get": {
      const res = await aws.fetch(`${base}/${ownPath(userId, body.path)}`);
      if (res.status === 404) throw new HttpError(404, "That file is not in the image store.");
      if (!res.ok) throw new HttpError(502, "The image store could not return the file.");
      return new Response(res.body, { headers: { "content-type": res.headers.get("content-type") ?? "application/octet-stream" } });
    }

    case "delete": {
      for (const path of ownPaths(userId, body.paths)) {
        const res = await aws.fetch(`${base}/${path}`, { method: "DELETE" });
        if (!res.ok && res.status !== 404) throw new HttpError(502, "The image store could not delete a file.");
      }
      return { ok: true };
    }

    case "usage": {
      let bytes = 0;
      let token: string | null = null;
      do {
        const url = new URL(base);
        url.searchParams.set("list-type", "2");
        url.searchParams.set("prefix", `${userId}/`);
        if (token) url.searchParams.set("continuation-token", token);
        const res = await aws.fetch(url);
        if (!res.ok) throw new HttpError(502, "The image store could not report its size.");
        const xml = await res.text();
        for (const match of xml.matchAll(/<Size>(\d+)<\/Size>/g)) bytes += Number(match[1]);
        token = xml.includes("<IsTruncated>true</IsTruncated>") ? (xml.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/)?.[1] ?? null) : null;
      } while (token);
      return { bytes };
    }

    default:
      throw new HttpError(400, "Unknown action.");
  }
});
