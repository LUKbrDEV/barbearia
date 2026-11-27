// Service worker: offline + instalável. Troque VERSAO a cada atualização publicada.
const VERSAO = "lkbarber-v10";
const ESCOPO = self.registration.scope; // "/" ou "/repo/" no GitHub Pages
const ARQUIVOS = ["./", "index.html", "css/style.css", "js/config.js", "js/agenda.js", "js/store.js", "js/app.js", "js/landing.js",
  "js/cliente.js", "js/painel.js", "js/admin.js", "js/movimento.js", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/maskable-512.png", "icons/apple-touch-icon.png"];

self.addEventListener("install", e => { e.waitUntil(caches.open(VERSAO).then(c => c.addAll(ARQUIVOS)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSAO).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET") return;
  // ícones das barbearias (Storage público): cache primeiro; a URL muda (?v=) quando o dono troca o ícone
  if (url.pathname.includes("/storage/v1/object/public/logos/")) {
    e.respondWith(caches.open(VERSAO).then(c => c.match(req).then(r => r || fetch(req).then(n => { if (n.ok) c.put(req, n.clone()); return n; }))));
    return;
  }
  if (url.hostname.endsWith("supabase.co") || url.pathname.includes("/rest/v1/") || url.pathname.includes("/auth/v1/")) return;
  if (url.hostname.includes("fonts.g") || url.hostname === "cdnjs.cloudflare.com" || url.hostname === "cdn.jsdelivr.net") {
    e.respondWith(caches.open(VERSAO).then(c => c.match(req).then(r => r || fetch(req).then(n => { c.put(req, n.clone()); return n; }))));
    return;
  }
  if (url.origin !== location.origin) return;
  // páginas (/navalha, /painel...) sempre caem no index.html
  if (req.mode === "navigate") {
    e.respondWith(fetch(req, { cache: "no-cache" }).catch(() => caches.match(ESCOPO + "index.html")));
    return;
  }
  // cache: "no-cache" = sempre confere com o servidor (o GitHub Pages guarda arquivos por 10 min)
  e.respondWith(fetch(req, { cache: "no-cache" }).then(n => { if (n.ok) { const cp = n.clone(); caches.open(VERSAO).then(c => c.put(req, cp)); } return n; })
    .catch(() => caches.match(req, { ignoreSearch: true })));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window" }).then(cs => cs.length ? cs[0].focus() : self.clients.openWindow(ESCOPO + "painel")));
});
