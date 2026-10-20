/*
 * ALVZ Studio hors connexion (navigateur, application iPhone, application Mac).
 *
 * - Pages du studio (/admin…) : toujours demandées au serveur ; une copie est gardée, servie seulement sans réseau.
 * - Fichiers du site (/_next/static, polices, logo) : gardés et réutilisés (leur nom change à chaque version).
 * - Photos des tableaux (Oracle) : gardées une fois affichées.
 * - Message « warm » : la page d'un tableau demande de préparer tout son projet (chaque planche et ses photos),
 *   pour pouvoir l'ouvrir plus tard sans réseau.
 * - Message « clear » (déconnexion) : copies des pages et des photos effacées de l'appareil.
 */
const VERSION = "v1";
const STATIC = `alvz-static-${VERSION}`;
const PAGES = `alvz-pages-${VERSION}`;
const MEDIA = `alvz-media-${VERSION}`;
const MAX_MEDIA = 1500;

const OFFLINE_HTML = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>ALVZ Studio</title><style>html,body{margin:0;height:100%;background:#0e0e0d;color:#ece8e2;font:15px -apple-system,Helvetica,Arial,sans-serif}
main{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;text-align:center;padding:24px}
p{margin:0;color:#8e8a83;max-width:36ch;line-height:1.5}a{color:#ece8e2}</style></head><body><main>
<strong>Hors connexion</strong><p>Cette page n'a pas encore été gardée sur l'appareil. Les tableaux déjà ouverts restent consultables.</p>
<p><a href="/admin/boards">Voir les tableaux</a> · <a href="javascript:location.reload()">Réessayer</a></p></main></body></html>`;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = [STATIC, PAGES, MEDIA];
      for (const name of await caches.keys()) if (name.startsWith("alvz-") && !keep.includes(name)) await caches.delete(name);
      await self.clients.claim();
    })(),
  );
});

/** Clé d'une page : son adresse sans paramètres (les paramètres de rafraîchissement ne changent pas la page). */
const pageKey = (url) => {
  const u = new URL(url, self.location.origin);
  return u.origin + u.pathname;
};
const isMedia = (url) => /objectstorage\.[^/]*oraclecloud\.com$/i.test(url.hostname);
const isStatic = (url) => url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/brand/") || /\.(woff2?|ttf|ico)$/.test(url.pathname);

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    if (isStatic(url)) return event.respondWith(cacheFirst(STATIC, req));
    // Navigation vers une page du studio : réseau d'abord, copie gardée seulement si le réseau manque.
    if (req.mode === "navigate" && url.pathname.startsWith("/admin") && !url.pathname.startsWith("/admin/login")) {
      return event.respondWith(networkFirstPage(req));
    }
    return; // le reste (API, données des pages) passe tel quel
  }
  if (isMedia(url) && (req.destination === "image" || req.destination === "")) return event.respondWith(cacheFirst(MEDIA, req, true));
});

async function cacheFirst(name, req, trim) {
  const cache = await caches.open(name);
  const hit = await cache.match(req, { ignoreVary: true });
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === "opaque") {
    await cache.put(req, res.clone()).catch(() => {});
    if (trim) void trimMedia(cache);
  }
  return res;
}

async function networkFirstPage(req) {
  const cache = await caches.open(PAGES);
  try {
    const res = await fetch(req);
    // Page complète du studio (pas une redirection vers la connexion) : copie gardée.
    if (res.ok && !res.redirected && (res.headers.get("content-type") || "").includes("text/html")) {
      await cache.put(pageKey(req.url), res.clone()).catch(() => {});
    }
    return res;
  } catch {
    const hit = await cache.match(pageKey(req.url));
    return hit || new Response(OFFLINE_HTML, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
}

let putsSinceTrim = 0;
async function trimMedia(cache) {
  if (++putsSinceTrim < 50) return;
  putsSinceTrim = 0;
  const keys = await cache.keys();
  for (const k of keys.slice(0, Math.max(0, keys.length - MAX_MEDIA))) await cache.delete(k);
}

/** Adresses des photos (Oracle) et des fichiers du site présents dans une page (données JSON comprises). */
function extractUrls(html) {
  const media = new Set();
  const assets = new Set();
  for (const m of html.matchAll(/https:\/\/[a-z0-9.-]*objectstorage[a-z0-9.-]*oraclecloud\.com[^"'\s<>]*/gi)) {
    const u = m[0].replace(/\\+u0026/g, "&").replace(/&amp;/g, "&").replace(/\\+$/g, "");
    media.add(u);
  }
  for (const m of html.matchAll(/\/_next\/static\/[^"'\s<>)\\]+/g)) assets.add(self.location.origin + m[0]);
  return { media: [...media], assets: [...assets] };
}

/** Prépare plusieurs pages (planches d'un projet) et tout ce qu'elles affichent, 4 téléchargements à la fois. */
async function warm(pages) {
  const pageCache = await caches.open(PAGES);
  const media = new Set();
  const assets = new Set();
  for (const p of pages) {
    try {
      const res = await fetch(p, { credentials: "same-origin" });
      if (!res.ok || res.redirected) continue;
      const html = await res.clone().text();
      await pageCache.put(pageKey(p), res);
      const found = extractUrls(html);
      found.media.forEach((u) => media.add(u));
      found.assets.forEach((u) => assets.add(u));
    } catch {
      return; // plus de réseau : on s'arrête là
    }
  }
  const staticCache = await caches.open(STATIC);
  const mediaCache = await caches.open(MEDIA);
  const jobs = [
    ...[...assets].map((u) => async () => {
      if (!(await staticCache.match(u))) await staticCache.put(u, await fetch(u));
    }),
    ...[...media].slice(0, 600).map((u) => async () => {
      if (await mediaCache.match(u)) return;
      let res;
      try {
        res = await fetch(u, { mode: "cors" });
      } catch {
        res = await fetch(u, { mode: "no-cors" });
      }
      if (res.ok || res.type === "opaque") await mediaCache.put(u, res);
    }),
  ];
  const run = async () => {
    for (let job = jobs.shift(); job; job = jobs.shift()) await job().catch(() => {});
  };
  await Promise.all([run(), run(), run(), run()]);
  void trimMedia(mediaCache);
}

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "warm" && Array.isArray(data.pages)) {
    const pages = data.pages.filter((p) => typeof p === "string" && p.startsWith("/admin")).slice(0, 40);
    event.waitUntil(warm(pages));
  }
  if (data.type === "clear") event.waitUntil(Promise.all([caches.delete(PAGES), caches.delete(MEDIA)]));
});
