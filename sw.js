// Service worker: caché de la app + notificaciones push de Firebase.
const VERSION = 'portal-v1.9.3';
const SHELL = ['./', './index.html', './css/app.css', './manifest.webmanifest', './js/app.js', './js/api.js', './js/media.js', './js/config.js',
  './icons/icon-192.png', './icons/icon-512.png'];

importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');
firebase.initializeApp({
  apiKey: 'AIzaSyAsfJqMplaZtDDEX_rBIwNsU6eTfd2cks4',
  authDomain: 'flotilla-packatelas.firebaseapp.com',
  projectId: 'flotilla-packatelas',
  storageBucket: 'flotilla-packatelas.firebasestorage.app',
  messagingSenderId: '361944784904',
  appId: '1:361944784904:web:f7edcf16bec97f0dd8f1bd',
});
firebase.messaging(); // con payload "notification" el SDK la muestra en segundo plano

self.addEventListener('install', e => e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys()
  .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())));
// Red primero (para ver versiones nuevas), pero sin quedarse colgado: si la red tarda más de 3 s
// (datos móviles lentos o señal débil) se abre con la copia guardada y la red actualiza la copia para la próxima.
// Cuando una carga ya fue lenta, los demás archivos de esa apertura salen directo de la copia.
let lentoHasta = 0;
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  const red = fetch(e.request, { cache: 'no-cache' }).then(res => {
    if (res && res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); }
    return res;
  });
  e.waitUntil(red.catch(() => {}));
  const usarCopia = () => caches.match(e.request).then(r => r || (e.request.mode === 'navigate' ? caches.match('./index.html') : null));
  e.respondWith(new Promise(resolve => {
    let listo = false;
    const fin = r => { if (!listo && r) { listo = true; clearTimeout(t); resolve(r); return true; } return false; };
    const t = setTimeout(() => usarCopia().then(r => { if (fin(r)) lentoHasta = Date.now() + 20000; }), Date.now() < lentoHasta ? 0 : 3000);
    red.then(res => fin(res)).catch(() => { lentoHasta = Date.now() + 20000; usarCopia().then(r => fin(r || Response.error())); });
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const open = list.find(c => c.url.includes(self.registration.scope));
    return open ? open.focus() : self.clients.openWindow(self.registration.scope);
  }));
});
