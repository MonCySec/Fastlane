/* DATA LAYER (shared part). Every read and write of saved data goes through this file and the two backends.
   - store-local.js     keeps data in this browser (default, no setup)
   - store-supabase.js  keeps data in a Supabase project so several computers share it
   The backend is chosen by supabase-config.js. The rest of the app only uses db, save(), log(), notify(), filePut() and fileGet(). */

let db;

const backend = () => (CLOUD ? cloudStore : localStore);
const save = () => backend().save();
const filePut = (k, b) => backend().putFile(k, b);
const fileGet = (k) => backend().getFile(k);

async function resetAll() {
  await backend().reset();
  location.reload();
}

/* Starting data: demo accounts, sample LTO records, vehicle groups, repair shops */
function seedData(pw) {
  const u = (email, name, role) => ({ email, name, role, pw });
  return {
    users: [
      u('customer@demo.ph', 'Demo Customer', 'Customer'),
      u('uw@demo.ph', 'Una Underwriter', 'Underwriter'),
      u('claims@demo.ph', 'Carlo Claims', 'Claims Officer'),
      u('claims2@demo.ph', 'Cathy Claims', 'Claims Officer'),
      u('csr@demo.ph', 'Sam Service', 'Customer Service'),
      u('admin@demo.ph', 'Ada Admin', 'Administrator'),
    ],
    lto: [
      { l: 'N01-23-000001', n: 'Juan Dela Cruz', d: '1990-05-14', s: 'Valid', v: [] },
      {
        l: 'N02-21-000002',
        n: 'Maria Dela Cruz',
        d: '1992-08-02',
        s: 'Valid',
        v: [{ c: 'Illegal parking', sev: 'minor', dt: '2025-06-10' }],
      },
      {
        l: 'N03-19-000003',
        n: 'Pedro Santos',
        d: '1985-01-20',
        s: 'Valid',
        v: [
          { c: 'Reckless driving', sev: 'major', dt: '2024-02-11' },
          { c: 'Beating the red light', sev: 'major', dt: '2025-01-05' },
          { c: 'Drunk driving', sev: 'major', dt: '2025-09-18' },
        ],
      },
      { l: 'N04-22-000004', n: 'Ana Reyes', d: '1998-11-30', s: 'Valid', v: [] },
      {
        l: 'N05-18-000005',
        n: 'Luis Garcia',
        d: '1978-03-09',
        s: 'Suspended',
        v: [{ c: 'Reckless driving', sev: 'major', dt: '2025-04-02' }],
      },
      { l: 'N06-20-000006', n: 'Carla Mendoza', d: '2001-07-17', s: 'Valid', v: [] },
    ],
    vig: [
      { g: 'Economy', max: 800000, base: 18000 },
      { g: 'Standard', max: 2000000, base: 28000 },
      { g: 'Performance', max: 1e12, base: 45000 },
    ],
    shops: ['AutoFix Makati', 'RapidRepair Pasig', 'Metro Body Works'],
    quotes: [],
    apps: [],
    policies: [],
    payments: [],
    claims: [],
    notifs: [],
    audit: [],
  };
}

async function boot() {
  db = await backend().load();
  if (!db) {
    db = seedData('');
    await Promise.all(db.users.map(async (u) => (u.pw = await hashPw('demo1234'))));
    await backend().saveNow();
  }
  /* settings added after the first release: fill them in for data saved by older versions */
  db.reasons ||= [...REASONS];
  db.rules ||= { perMajor: 0.05, cap: 0.3, threshold: 3, years: 3 };
  db.sessions ||= [];
  db.notes ||= [];
  /* accounts saved by the first version used an unsalted hash: upgrade the demo accounts right away
     (other accounts upgrade the next time their owner logs in) */
  const oldDemo = await sha('demo1234');
  await Promise.all(
    db.users.filter((u) => u.pw === oldDemo).map(async (u) => (u.pw = await hashPw('demo1234'))),
  );
  await backend().saveNow();
  backend().start();
}

const unreadCount = () => (me ? db.notifs.filter((n) => n.to === me.email && !n.read).length : 0);

/* A backend calls this after data from another tab or computer has replaced db.
   Screens with half-filled forms (and any focused field) are left alone so typing is not lost. */
function externalChange(unreadBefore) {
  if (!me) return;
  const fresh = db.notifs.filter((n) => n.to === me.email && !n.read);
  if (fresh.length > unreadBefore) toast('New notification: ' + fresh[0].m);
  if (tab === 'payqr') {
    const s = (db.sessions || []).find((x) => x.sid === paySid);
    if (s?.status === 'Paid') {
      tab = 'paydone';
      draw();
      return;
    }
  }
  const busy = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
  if (busy || ['quote', 'payqr', 'paygw'].includes(tab)) return;
  draw();
}

const log = (a) => {
  db.audit.unshift({ id: uid('A'), u: me?.email || 'system', a, t: now() });
  save();
};

const notify = (to, m) => {
  db.notifs.unshift({ id: uid('N'), to, m, t: now(), read: false });
  save();
};
