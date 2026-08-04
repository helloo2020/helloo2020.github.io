const PRECACHE = 'precache-v2';
const RUNTIME = 'runtime';
const HOSTNAME_WHITELIST = [self.location.hostname];

const isNavigationReq = (req) =>
  req.mode === 'navigate' ||
  (req.method === 'GET' && req.headers.get('accept').includes('text/html'));

const endWithExtension = (req) =>
  Boolean(new URL(req.url).pathname.match(/\.\w+$/));

const shouldRedirect = (req) =>
  isNavigationReq(req) &&
  new URL(req.url).pathname.substr(-1) !== '/' &&
  !endWithExtension(req);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(PRECACHE).then((cache) =>
      cache.addAll(['/offline.html', '/css/main.css', '/js/main.js'])
    ).then(self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  if (HOSTNAME_WHITELIST.indexOf(new URL(event.request.url).hostname) === -1) return;

  if (shouldRedirect(event.request)) {
    const url = new URL(event.request.url);
    url.pathname += '/';
    event.respondWith(Response.redirect(url.href));
    return;
  }

  const cached = caches.match(event.request);
  const fetched = fetch(event.request, { cache: 'no-store' });
  const fetchedCopy = fetched.then((resp) => resp.clone());

  event.respondWith(
    Promise.race([fetched.catch(() => cached), cached])
      .then((resp) => resp || fetched)
      .catch(() => caches.match('offline.html'))
  );

  event.waitUntil(
    Promise.all([fetchedCopy, caches.open(RUNTIME)])
      .then(([response, cache]) => response.ok && cache.put(event.request, response))
      .catch(() => {})
  );
});
