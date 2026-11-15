// app/layout.tsx
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Libre_Caslon_Text, Playfair_Display } from "next/font/google";
import Decorations from "@/components/Decorations";
import PageAccents from "@/components/decor/PageAccents";
import Shell from "@/components/Shell";
import ToastHost from "@/components/Toast";
import ThemeApplier from "@/components/ThemeApplier";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
});

// Only the italic f of the logo uses this one.
const caslon = Libre_Caslon_Text({
  variable: "--font-caslon",
  subsets: ["latin"],
  weight: "400",
  style: "italic",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// SECURITY: the CSP limits where scripts can run and which hosts the page may call, so injected
// code cannot send data elsewhere. Next's dev server needs eval for hot reload, so it is dev-only.
const isDev = process.env.NODE_ENV !== "production";
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://cdn.jsdelivr.net${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://image.tmdb.org https://*.supabase.co https://basemaps.cartocdn.com https://*.basemaps.cartocdn.com https://*.backblazeb2.com",
  "font-src 'self' data:",
  "worker-src 'self' blob: https://cdn.jsdelivr.net",
  [
    "connect-src 'self'",
    "https://*.supabase.co wss://*.supabase.co",
    "https://musicbrainz.org https://nominatim.openstreetmap.org",
    "https://cdn.jsdelivr.net https://tessdata.projectnaptha.com",
    isDev ? "ws://localhost:* ws://10.0.0.169:*" : "",
  ].filter(Boolean).join(" "),
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

export const metadata: Metadata = {
  title: "filmè",
  description: "Movie ticket stub scanner and log",
  appleWebApp: { capable: true, title: "filmè", statusBarStyle: "default" },
};

// viewport-fit=cover lets the bottom bar sit above the iPhone's home indicator.
export const viewport: Viewport = { viewportFit: "cover", width: "device-width", initialScale: 1 };

// Runs before the page paints so a dark phone does not flash white. It only reads the saved look.
const themeScript = `try{var a=JSON.parse(localStorage.getItem("filme-appearance")||"{}");var d=a.themeMode==="dark"||(a.themeMode!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d)}catch(e){}`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${playfair.variable} ${caslon.variable} h-full antialiased`}
    >
      <head>
        <meta httpEquiv="Content-Security-Policy" content={csp} />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeApplier />
        <Decorations />
        <Shell>{children}</Shell>
        <PageAccents />
          <ToastHost />
      </body>
    </html>
  );
}