// app/layout.tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
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
  "img-src 'self' data: blob: https://image.tmdb.org https://*.supabase.co",
  "font-src 'self' data:",
  "worker-src 'self' blob: https://cdn.jsdelivr.net",
  [
    "connect-src 'self'",
    "https://*.supabase.co wss://*.supabase.co",
    "https://api.themoviedb.org",
    "https://generativelanguage.googleapis.com https://api.openai.com https://api.anthropic.com",
    "https://musicbrainz.org https://nominatim.openstreetmap.org",
    "https://cdn.jsdelivr.net https://tessdata.projectnaptha.com",
    isDev ? "ws://localhost:* ws://10.0.0.169:*" : "",
  ].filter(Boolean).join(" "),
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

export const metadata: Metadata = {
  title: "Filme",
  description: "Movie ticket stub scanner and log",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <meta httpEquiv="Content-Security-Policy" content={csp} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}