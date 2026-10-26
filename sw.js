// Keeps Pocket Ledger working with no signal, and sends the optional evening reminder.
// The app's own files are served from the phone first (instant even on a weak network)
// and refreshed in the background, so a new version shows up on the next open.
// Bump VERSION whenever the app changes so old copies get cleaned up.
const VERSION = "pl-v6";
const KEEP = [VERSION, "pl-fonts", "pl-state"];   // pl-state holds the reminder settings written by the app
const APP_FILES = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png",
  "./sc-quick.png", "./sc-log.png", "./sc-lent.png", "./sc-week.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(APP_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !KEEP.includes(k)).map((k) => caches.delete(k))))
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
        const fresh = fetch(req.mode === "navigate" ? "./index.html" : req).then((res) => {
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

/* ---------- evening reminder ---------- */
const dayKey = (d) => d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();

async function maybeRemind() {
  const c = await caches.open("pl-state");
  const r = await c.match("./state");
  if (!r) return;
  const s = await r.json();
  const now = new Date(), today = dayKey(now);
  if (!s.remind || now.getHours() < 17 || s.remindedDay === today) return;   // evenings only, at most once a day
  s.remindedDay = today;
  await c.put("./state", new Response(JSON.stringify(s), { headers: { "Content-Type": "application/json" } }));
  const logged = s.lastLogDay === today;
  await self.registration.showNotification(logged ? "Anything else to log today?" : "Did you pay for anything today?", {
    body: logged ? "You've logged " + s.todayTotal + " today. Add anything you missed." : "Tap to log it in Pocket Ledger before you forget.",
    icon: "icon-192.png", badge: "icon-192.png", tag: "pl-daily", data: { url: "./?go=quick" },
  });
}

self.addEventListener("periodicsync", (event) => {
  if (event.tag === "pl-daily") event.waitUntil(maybeRemind());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "./?go=quick", self.registration.scope).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) if ("navigate" in w) return w.navigate(url).then((x) => (x || w).focus());
      return self.clients.openWindow(url);
    })
  );
});
