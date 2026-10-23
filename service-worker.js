"use strict";

const CACHE_NAME = "karfivo-static-v1";
const APP_FILES = [
  "./index.html",
  "./styles.css",
  "./data.js",
  "./storage.js",
  "./generator.js",
  "./analytics.js",
  "./app.js",
  "./manifest.webmanifest",
  "./icon.svg",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_FILES))
    .then(() => self.skipWaiting())
    .catch(error => {
      console.error("KARFIVO offline app-shell installation failed.", error);
      throw error;
    }));
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key.startsWith("karfivo-static-") && key !== CACHE_NAME).map(key => caches.delete(key))
  )).then(() => self.clients.claim()));
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin) return;
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).then(response => {
      if (!response.ok) return response;
      const copy = response.clone();
      return caches.open(CACHE_NAME).then(cache => cache.put("./index.html", copy)).then(() => response);
    }).catch(() => caches.match("./index.html")));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    if (!response.ok) return response;
    const copy = response.clone();
    return caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy)).then(() => response);
  })));
});
