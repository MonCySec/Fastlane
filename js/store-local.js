/* Backend 1: this browser only. Records in localStorage, uploaded files in IndexedDB.
   Two tabs of the same browser stay in sync through the "storage" event. */

const localStore = {
  async load() {
    return JSON.parse(localStorage.getItem(K) || 'null');
  },
  save() {
    localStorage.setItem(K, JSON.stringify(db));
  },
  async saveNow() {
    this.save();
  },
  start() {},
  async reset() {
    localStorage.removeItem(K);
    indexedDB.deleteDatabase('fastlane_files');
  },

  idb() {
    return new Promise((ok, no) => {
      const r = indexedDB.open('fastlane_files', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('f');
      r.onsuccess = () => ok(r.result);
      r.onerror = () => no(r.error);
    });
  },
  async putFile(k, b) {
    const d = await this.idb();
    return new Promise((ok, no) => {
      const t = d.transaction('f', 'readwrite');
      t.objectStore('f').put(b, k);
      t.oncomplete = ok;
      t.onerror = () => no(t.error);
    });
  },
  async getFile(k) {
    const d = await this.idb();
    return new Promise((ok, no) => {
      const q = d.transaction('f').objectStore('f').get(k);
      q.onsuccess = () => ok(q.result);
      q.onerror = () => no(q.error);
    });
  },
};

addEventListener('storage', (e) => {
  if (CLOUD || e.key !== K) return;
  if (e.newValue === null) return location.reload(); /* the other tab reset the data */
  const before = unreadCount();
  db = JSON.parse(e.newValue);
  externalChange(before);
});
