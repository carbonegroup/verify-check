/** @type {import('next').NextConfig} */
const nextConfig = {
  // La PWA scanner est statique (public/scanner/). On redirige l'URL propre
  // /scanner vers son index.html pour que les chemins relatifs (styles, lib/*,
  // service worker, manifest) résolvent bien sous /scanner/ et que le scope du
  // service worker reste /scanner/.
  async redirects() {
    return [{ source: "/scanner", destination: "/scanner/index.html", permanent: false }];
  },

  // Connectivité faible : les assets statiques du scanner sont mis en cache
  // longuement par le navigateur (revalidation en arrière-plan), ce qui évite
  // de les retélécharger à chaque ouverture. index.html et le service worker
  // restent toujours revalidés pour que les mises à jour de l'app arrivent.
  async headers() {
    const assetCache = "public, max-age=604800, stale-while-revalidate=86400";
    return [
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
