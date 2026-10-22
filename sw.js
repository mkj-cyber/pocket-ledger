// Keeps Pocket Ledger working with no signal.
// The app's own files are served from the phone first (instant even on a weak network)
// and refreshed in the background, so a new version shows up on the next open.
// Bump VERSION whenever the app changes so old copies get cleaned up.
const VERSION = "pl-v3";
const APP_FILES = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(APP_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== "pl-fonts").map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // App files: answer from the phone straight away, update the stored copy in the background
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.open(VERSION).then(async (cache) => {
        const key = req.mode === "navigate" ? "./index.html" : req;
        const stored = await cache.match(key, { ignoreSearch: true });
        const fresh = fetch(req).then((res) => {
          if (res.ok) cache.put(key, res.clone());
          return res;
        }).catch(() => stored);
        return stored || fresh;
      })
    );
    return;
  }

  // Fonts: keep a copy once downloaded
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    event.respondWith(
      caches.open("pl-fonts").then(async (cache) => {
        const stored = await cache.match(req);
        if (stored) return stored;
        try {
          const res = await fetch(req);
          if (res.ok || res.type === "opaque") cache.put(req, res.clone());
          return res;
        } catch {
          return new Response("", { status: 504 });
        }
      })
    );
  }
  // Everything else (Google Sheet sync, Excel library) goes straight to the network.
});
