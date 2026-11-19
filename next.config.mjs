/** @type {import('next').NextConfig} */
const nextConfig = {
  // La PWA scanner est statique (public/scanner/). On redirige l'URL propre
  // /scanner vers son index.html pour que les chemins relatifs (styles, lib/*,
  // service worker, manifest) résolvent bien sous /scanner/ et que le scope du
  // service worker reste /scanner/.
  async redirects() {
    return [{ source: "/scanner", destination: "/scanner/index.html", permanent: false }];
  },

  // Sécurité : headers HTTP pour protéger l'application
  async headers() {
    const assetCache = "public, max-age=604800, stale-while-revalidate=86400";
    const isDev = process.env.NODE_ENV === "development";
    const securityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-XSS-Protection", value: "1; mode=block" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      // CSP restrictif : scripts/styles 'self' + inline pour styles (CSS modules)
      // 'unsafe-eval' requis pour Next.js dev (HMR) — en production next build le retire
      {
        key: "Content-Security-Policy",
        value: [
          "default-src 'self'",
          `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: blob:",
          "font-src 'self' data:",
          "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
          "frame-ancestors 'none'",
          "base-uri 'self'",
          "form-action 'self'",
        ].join("; "),
      },
    ];
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/scanner/vendor/:path*", headers: [{ key: "Cache-Control", value: assetCache }] },
      { source: "/scanner/lib/:path*", headers: [{ key: "Cache-Control", value: assetCache }] },
      { source: "/scanner/icons/:path*", headers: [{ key: "Cache-Control", value: assetCache }] },
      { source: "/scanner/styles.css", headers: [{ key: "Cache-Control", value: assetCache }] },
      { source: "/scanner/app.js", headers: [{ key: "Cache-Control", value: assetCache }] },
      { source: "/scanner/manifest.webmanifest", headers: [{ key: "Cache-Control", value: assetCache }] },
      { source: "/scanner/index.html", headers: [{ key: "Cache-Control", value: "no-cache" }] },
      { source: "/scanner/service-worker.js", headers: [{ key: "Cache-Control", value: "no-cache" }] },
    ];
  },
};
export default nextConfig;
