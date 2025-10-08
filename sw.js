// sw.js (UPDATED FOR BACKGROUND SYNC)

// Import the idb and db helper scripts
importScripts('https://cdn.jsdelivr.net/npm/idb@7/build/umd.js');
importScripts('db.js');

const CACHE_NAME = 'tracker-timer-v5'; // Bump version for updates
const URLS_TO_CACHE = [
  '/',
  'index.html',
  'timetable.html',
  'analysis.html',
  'monthly.html',
  'style.css',
  'timer.js',
  'timetable.js',
  'analysis.js',
  'monthly.js',
  'db.js',
  'images/icon-1024.png',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://cdn.jsdelivr.net/npm/idb@7/build/umd.js' // Cache the idb library
];

// Install: Cache core files
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(URLS_TO_CACHE))
  );
});

// Activate: Clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(name => name !== CACHE_NAME)
                  .map(name => caches.delete(name))
      );
    })
  );
});


// Fetch: Serve from cache first
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});

// --- NEW: BACKGROUND SYNC EVENT LISTENER ---
self.addEventListener('sync', event => {
  if (event.tag === 'sync-timer-data') {
    console.log('Service Worker: Sync event triggered!');
    event.waitUntil(syncOfflineData());
  }
});

async function syncOfflineData() {
  const entries = await getAllEntriesFromOutbox();
  console.log(`Service Worker: Found ${entries.length} entries to sync.`);

  for (const entry of entries) {
    try {
      const response = await fetch('/api/save-time', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      });

      if (response.ok) {
        console.log(`Service Worker: Synced entry #${entry.id}, deleting from outbox.`);
        // If the server accepted the entry, delete it from the outbox
        await deleteEntryFromOutbox(entry.id);
      } else {
        // If the server returns an error, stop and try again later
        console.error('Server responded with an error, will retry sync later.', response);
        return;
      }
    } catch (error) {
      // If there's a network error, stop and try again later
      console.error('Network error during sync, will retry later.', error);
      return;
    }
  }
  console.log('Service Worker: Sync complete.');
}