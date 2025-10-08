// db.js

// Open the IndexedDB database
async function openDB() {
  return idb.openDB('tracker-timer-db', 1, {
    upgrade(db) {
      // Create an object store for unsynced timer entries
      if (!db.objectStoreNames.contains('sync-outbox')) {
        db.createObjectStore('sync-outbox', { autoIncrement: true, keyPath: 'id' });
      }
    },
  });
}

// Function to save an entry to the outbox
async function saveEntryToOutbox(entry) {
  const db = await openDB();
  await db.add('sync-outbox', entry);
}

// Function to get all entries from the outbox
async function getAllEntriesFromOutbox() {
  const db = await openDB();
  return db.getAll('sync-outbox');
}

// Function to delete an entry from the outbox by its ID
async function deleteEntryFromOutbox(id) {
  const db = await openDB();
  await db.delete('sync-outbox', id);
}