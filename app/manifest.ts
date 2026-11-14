// app/manifest.ts
// Lets the site be added to the iPhone home screen and open like an app, without browser bars.
import type { MetadataRoute } from "next";

export const dynamic = "force-static";

// GitHub Pages serves the site from /<repo>, so the paths need the same prefix as the pages.
const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Filme",
    short_name: "Filme",
    description: "A private log of films, shows and concerts, with the ticket stubs.",
    start_url: `${base}/home/`,
    scope: `${base}/`,
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    icons: [{ src: `${base}/icon.png`, sizes: "512x512", type: "image/png" }],
  };
}
