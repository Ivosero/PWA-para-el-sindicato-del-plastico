const CACHE = "plastico-shell-v1";
const BUILD_ASSETS = /* BUILD_ASSETS */ [];
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) =>
        c.addAll([
          "/",
          "/icon.svg",
          "/icon-192.png",
          "/icon-512.png",
          "/manifest.webmanifest",
          "/logo-uoyep.webp",
          "/logo-cfp.webp",
          ...BUILD_ASSETS,
        ]),
      ),
  );
  self.skipWaiting();
});
self.addEventListener("activate", (event) =>
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => (k.startsWith("plastico-") || k.startsWith("uti-")) && k !== CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  ),
);
// Only public application assets are cached. Never cache API responses or the padrón.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin)
    return;
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).catch(() => caches.match("/")));
    return;
  }
  if (url.pathname.startsWith("/assets/") || url.pathname.startsWith("/icon"))
    event.respondWith(
      caches.match(event.request, { ignoreVary: true }).then(
        (hit) =>
          hit ||
          fetch(event.request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches
                .open(CACHE)
                .then((cache) => cache.put(event.request, copy));
            }
            return response;
          }),
      ),
    );
});
self.addEventListener("push", (event) => {
  let data = {
    title: "Plástico · Nueva convocatoria",
    body: "Ingresá para consultar la convocatoria y confirmar tu asistencia.",
  };
  try {
    data = { ...data, ...event.data.json() };
  } catch {}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: "plastico-convocatoria",
      data: { url: "/?view=agenda" },
    }),
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        const client = clients.find(
          (c) => new URL(c.url).origin === self.location.origin,
        );
        if (client) {
          client.navigate("/?view=agenda");
          return client.focus();
        }
        return self.clients.openWindow("/?view=agenda");
      }),
  );
});
