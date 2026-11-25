// VerifyCheck — service worker du scanner.
// Objectif : l'app s'ouvre et fonctionne même sans réseau (connectivité faible).
// Les présences scannées hors ligne sont conservées côté client (IndexedDB,
// voir lib/api.js) puis synchronisées quand le réseau revient.

const CACHE = "verifycheck-scan-v6";

// Coquille minimale mise en cache à l'installation. La librairie QR
// (vendor/html5-qrcode.min.js, ≈ 360 Ko) est VOLONTAIREMENT exclue : elle n'est
// téléchargée qu'en repli (voir lib/qr.js) et sera mise en cache à la première
// utilisation par la stratégie stale-while-revalidate ci-dessous.
const SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./lib/feedback.js",
  "./lib/api.js",
  "./lib/qr.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  // Mise en cache individuelle (allSettled) : si UN fichier échoue (réseau
  // instable), l'installation réussit quand même et l'app reste utilisable.
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => Promise.allSettled(SHELL.map((url) => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Les appels API dépendent de la session admin et de l'heure courante : ils
  // ne doivent JAMAIS être servis depuis le cache (sinon un état obsolète —
  // voire un contexte après déconnexion — serait réutilisé). On laisse le
  // navigateur gérer le réseau ; l'absence de réseau est traitée par lib/api.js
  // (file IndexedDB).
  if (url.pathname.startsWith("/api/")) return;

  // Navigations : réseau d'abord (contenu frais), repli sur le cache hors ligne.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match("./index.html")))
    );
    return;
  }

  // Ressources statiques de l'app : stale-while-revalidate (démarrage instantané
  // en connectivité faible, mise à jour silencieuse en arrière-plan).
  event.respondWith(
    caches.match(request).then((cached) => {
      const fromNetwork = fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
          return response;
        })
        .catch(() => cached || Response.error());
      return cached || fromNetwork;
    })
  );
});
