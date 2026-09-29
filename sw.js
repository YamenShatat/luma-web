// Streams private Drive videos to the page's <video>, which cannot send a sign-in itself.
// The page points the video at an address on this site, stream/<file id>?size=<bytes>; this
// worker fetches that byte range from Drive with the sign-in and answers with a reply built
// the way Safari's player expects (206, exact Content-Range and Content-Length).
var token = '';

self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
// The phone stops idle workers, which loses the variable mid-video; the token is also kept in
// this worker's cache (on the device only) and read back when needed.
self.addEventListener('message', function (e) {
  token = e.data;
  caches.open('luma').then(function (c) { return c.put('/token', new Response(token)); });
});
function getToken() {
  if (token) return Promise.resolve(token);
  return caches.open('luma').then(function (c) { return c.match('/token'); })
    .then(function (r) { return r ? r.text() : ''; })
    .then(function (t) { token = t; return t; });
}

self.addEventListener('fetch', function (e) {
  var url = new URL(e.request.url);
  var m = url.pathname.match(/\/stream\/([\w-]+)$/);
  if (m) { e.respondWith(stream(m[1], +url.searchParams.get('size'), e.request.headers.get('Range'))); return; }
  // Test B: a cross-origin Drive address marked &sw=1, passed through as is.
  if (url.searchParams.get('sw') === '1') {
    url.searchParams.delete('sw');
    var headers = new Headers({ Authorization: 'Bearer ' + token });
    var range = e.request.headers.get('Range');
    if (range) headers.set('Range', range);
    e.respondWith(fetch(url.toString(), { headers: headers, mode: 'cors' }));
  }
});

function stream(id, size, range) {
  var start = 0, end = size - 1;
  var r = /bytes=(\d*)-(\d*)/.exec(range || '');
  if (r) {
    if (r[1]) start = +r[1];
    if (r[2]) end = Math.min(+r[2], size - 1);
    if (!r[1] && r[2]) { start = size - +r[2]; end = size - 1; } // "bytes=-N": the last N bytes
  }
  return getToken().then(function (t) {
    return fetch('https://www.googleapis.com/drive/v3/files/' + id + '?alt=media', {
      headers: { Authorization: 'Bearer ' + t, Range: 'bytes=' + start + '-' + end }
    });
  }).then(function (res) {
    if (!res.ok) return new Response('Drive replied ' + res.status, { status: res.status });
    return new Response(res.body, {
      status: range ? 206 : 200,
      headers: {
        'Content-Type': 'video/mp4',
        'Accept-Ranges': 'bytes',
        'Content-Length': String(end - start + 1),
        'Content-Range': 'bytes ' + start + '-' + end + '/' + size
      }
    });
  });
}
