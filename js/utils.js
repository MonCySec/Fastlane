/* Small helpers with no business logic: DOM shortcut, text escaping, peso and date formatting, hashing, toast messages, status badges. */

const $ = (s) => document.querySelector(s);

const esc = (s) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );

const peso = (n) => '₱' + Math.round(n).toLocaleString('en-PH');

const now = () => new Date().toISOString();

const when = (s) =>
  s
    ? new Date(s).toLocaleString('en-PH', {
        timeZone: 'Asia/Manila',
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : '-';

const hrs = (a, b) => (new Date(b) - new Date(a)) / 36e5;

const sha = async (p) =>
  [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(p)))]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

/* Passwords: salted, deliberately slow PBKDF2-SHA256. Each password gets its own random salt, so the same
   password gives a different stored value, and guessing a password costs about 150,000 hash rounds.
   sha() is only kept to recognise accounts saved by the first version, which are upgraded on login. */
const PW_ITER = 150000;
const b64 = (u8) => btoa(String.fromCharCode(...u8));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
async function pbkdf2(p, salt, iter) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(p), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter },
    key,
    256,
  );
  return new Uint8Array(bits);
}
async function hashPw(p) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${PW_ITER}$${b64(salt)}$${b64(await pbkdf2(p, salt, PW_ITER))}`;
}
const isLegacyPw = (stored) => !String(stored).startsWith('pbkdf2$');
async function checkPw(p, stored) {
  if (isLegacyPw(stored)) return (await sha(p)) === stored;
  const [, iter, salt, hash] = stored.split('$');
  return b64(await pbkdf2(p, unb64(salt), +iter)) === hash;
}

const uid = (p) => p + '-' + Math.random().toString(36).slice(2, 8).toUpperCase();

const toast = (m) => {
  clearTimeout(toastT);
  let t = $('.toast');
  if (!t) {
    t = document.createElement('div');
    t.className = 'toast';
    t.setAttribute('role', 'status');
    document.body.append(t);
  }
  t.textContent = m;
  toastT = setTimeout(() => t.remove(), 3500);
};

const BADGE = (s) =>
  `<span class="b ${/Active|Approved|Accepted|Verified/.test(s) ? 'ok' : /Declined|Rejected|Retake|Lapsed/.test(s) ? 'bad' : /Hold|Exception|Resubmitted/.test(s) ? 'warn' : ''}">${s}</span>`;
