// Adds the Google sign-in to Drive video requests the page marks with &sw=1, since a <video>
// element cannot send an Authorization header itself.
var token = '';

self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener('message', function (e) { token = e.data; });

self.addEventListener('fetch', function (e) {
  var url = new URL(e.request.url);
  if (url.searchParams.get('sw') !== '1') return;
  url.searchParams.delete('sw');
  var headers = new Headers();
  var range = e.request.headers.get('Range');
  if (range) headers.set('Range', range);
  headers.set('Authorization', 'Bearer ' + token);
  e.respondWith(fetch(url.toString(), { headers: headers, mode: 'cors' }));
});
