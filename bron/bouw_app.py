"""Bouwt de installeerbare app (PWA) in app/: index.html, manifest, service worker en iconen.
Eerst bouw.py draaien (maakt dist/tekentrainer.html), daarna dit script.
De map app/ kan zo op GitHub Pages (of een andere statische host) gezet worden."""
import hashlib
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
APP = os.path.join(ROOT, "app")
os.makedirs(APP, exist_ok=True)

subprocess.run([sys.executable, os.path.join(ROOT, "bouw.py")], check=True)
body = open(os.path.join(ROOT, "dist", "tekentrainer.html"), encoding="utf-8").read()

ACCENT, PAPER, BG = "#b02a66", "#fafbfb", "#e4e8ec"

# --- iconen (PyQt5, zonder scherm) --------------------------------------------
os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")
from PyQt5.QtCore import QPointF, QRectF, Qt  # noqa: E402
from PyQt5.QtGui import QColor, QGuiApplication, QImage, QPainter, QPen  # noqa: E402

qapp = QGuiApplication([])


def icoon(size, maskable):
    img = QImage(size, size, QImage.Format_ARGB32)
    img.fill(Qt.transparent)
    p = QPainter(img)
    p.setRenderHint(QPainter.Antialiasing)
    p.setPen(Qt.NoPen)
    p.setBrush(QColor(ACCENT))
    if maskable:
        p.drawRect(0, 0, size, size)          # Android knipt zelf de vorm uit
    else:
        p.drawRoundedRect(QRectF(0, 0, size, size), size * 0.22, size * 0.22)
    s = size * (0.78 if maskable else 1.0)    # inhoud binnen de veilige zone houden
    p.translate(size / 2, size / 2)
    p.rotate(-28)
    # Kader (hulplijn) met de vier raakstreepjes, en de ellips erin.
    w, h = s * 0.62, s * 0.36
    p.setPen(QPen(QColor(255, 255, 255, 110), s * 0.022))
    p.setBrush(Qt.NoBrush)
    p.drawRect(QRectF(-w / 2, -h / 2, w, h))
    t = s * 0.045
    for a, b in (((-w / 2 - t, 0), (-w / 2 + t, 0)), ((w / 2 - t, 0), (w / 2 + t, 0)),
                 ((0, -h / 2 - t), (0, -h / 2 + t)), ((0, h / 2 - t), (0, h / 2 + t))):
        p.drawLine(QPointF(*a), QPointF(*b))
    pen = QPen(QColor(PAPER), s * 0.06)
    pen.setCapStyle(Qt.RoundCap)
    p.setPen(pen)
    p.drawArc(QRectF(-w / 2, -h / 2, w, h), 100 * 16, 330 * 16)
    p.end()
    return img


icons = [("icon-192.png", 192, False), ("icon-512.png", 512, False), ("icon-maskable-512.png", 512, True)]
for name, size, mask in icons:
    icoon(size, mask).save(os.path.join(APP, name))

# --- manifest -----------------------------------------------------------------
manifest = {
    "name": "S Pen Tekentrainer",
    "short_name": "Tekentrainer",
    "description": "Tekenoefeningen voor de S Pen die elke streek meteen nakijken.",
    "lang": "nl",
    "start_url": "./",
    "scope": "./",
    "display": "fullscreen",
    "display_override": ["fullscreen", "standalone"],
    "orientation": "any",
    "background_color": BG,
    "theme_color": BG,
    "icons": [
        {"src": "icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any"},
        {"src": "icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any"},
        {"src": "icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"},
    ],
}
with open(os.path.join(APP, "manifest.webmanifest"), "w", encoding="utf-8") as fh:
    json.dump(manifest, fh, ensure_ascii=False, indent=2)

# --- index.html -----------------------------------------------------------------
head = """<!doctype html>
<html lang="nl">
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icon-192.png">
<meta name="mobile-web-app-capable" content="yes">
"""
registreer = """
<script>
// Offline: service worker registreren (alleen via http(s), niet vanaf een los bestand).
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(function () {});
}
</script>
"""
html = head + body + registreer
with open(os.path.join(APP, "index.html"), "w", encoding="utf-8") as fh:
    fh.write(html)

# --- service worker ---------------------------------------------------------------
# De versie is een hash van de inhoud: elke nieuwe build ververst de cache vanzelf.
versie = hashlib.sha1(html.encode("utf-8")).hexdigest()[:10]
bestanden = ["./", "index.html", "manifest.webmanifest"] + [n for n, _, _ in icons]
sw = """// Service worker: app-bestanden vooraf in de cache, lettertypes bij eerste gebruik.
const CACHE = 'tekentrainer-%s';
const BESTANDEN = %s;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(BESTANDEN)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (url.origin === location.origin) {
    // Eerst online proberen (zo krijg je updates), anders de cache.
    e.respondWith(fetch(e.request)
      .then((r) => { const kopie = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, kopie)); return r; })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('index.html'))));
  } else if (/fonts\\.(googleapis|gstatic)\\.com$/.test(url.hostname)) {
    // Lettertypes: uit de cache als ze er zijn, anders ophalen en bewaren.
    e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request).then((res) => {
      const kopie = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, kopie)); return res;
    })));
  }
});
""" % (versie, json.dumps(bestanden))
with open(os.path.join(APP, "sw.js"), "w", encoding="utf-8") as fh:
    fh.write(sw)

print("app gebouwd in", APP, "· versie", versie)
for f in sorted(os.listdir(APP)):
    print("  ", f, os.path.getsize(os.path.join(APP, f)) // 1024, "KB")
