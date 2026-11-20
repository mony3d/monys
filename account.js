// অ্যাকাউন্ট: Google বা ইমেল দিয়ে ঢোকা, আর প্রোফাইলগুলো Firebase-এ জমা রাখা।
// অ্যাপের মূল কোড window.FH দিয়ে এই ফাইলের সঙ্গে কথা বলে।
import { firebaseConfig } from './firebase-config.js';

const SDK = 'https://www.gstatic.com/firebasejs/12.18.0/';
const box = document.getElementById('acct');
const FH = window.FH;
const CONS = 'fh-consent';
const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const bn = n => String(n).replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[d]);
const hhmm = d => bn(String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'));
const ls = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; } };
const say = (t, bad) => { const m = document.getElementById('amsg'); if (m) { m.textContent = t || ''; m.className = 'sub' + (bad ? ' no' : ''); } };
const toast = t => { const el = document.getElementById('toast'); if (!el) return; el.textContent = t; el.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(() => { el.hidden = true; }, 2600); };

const ERR = {
  'auth/invalid-credential': 'ইমেল বা পাসওয়ার্ড মেলেনি।',
  'auth/wrong-password': 'ইমেল বা পাসওয়ার্ড মেলেনি।',
  'auth/user-not-found': 'এই ইমেলে কোনো অ্যাকাউন্ট নেই। “নতুন অ্যাকাউন্ট” চাপুন।',
  'auth/email-already-in-use': 'এই ইমেলে আগেই অ্যাকাউন্ট আছে। “ঢুকুন” চাপুন।',
  'auth/weak-password': 'পাসওয়ার্ড অন্তত ৬ অক্ষরের দিন।',
  'auth/invalid-email': 'ইমেলটা ঠিকমতো লিখুন।',
  'auth/missing-password': 'পাসওয়ার্ড লিখুন।',
  'auth/popup-closed-by-user': 'Google-এর জানালা বন্ধ হয়ে গেছে। আবার চেষ্টা করুন।',
  'auth/cancelled-popup-request': 'Google-এর জানালা বন্ধ হয়ে গেছে। আবার চেষ্টা করুন।',
  'auth/network-request-failed': 'ইন্টারনেট সংযোগ নেই। পরে আবার চেষ্টা করুন।',
  'auth/too-many-requests': 'অনেকবার চেষ্টা হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।',
  'auth/unauthorized-domain': 'এই ওয়েবসাইটের ঠিকানা Firebase-এ যোগ করা হয়নি (Authorized domains)।',
  'auth/operation-not-allowed': 'Firebase-এ এই লগইন পদ্ধতি চালু করা হয়নি।',
  'auth/requires-recent-login': 'নিরাপত্তার জন্য একবার বের হয়ে আবার ঢুকুন, তারপর মুছুন।',
  'permission-denied': 'ডাটাবেস অনুমতি দিচ্ছে না; Firestore-এর নিয়ম (rules) ঠিকমতো বসানো হয়েছে কি না দেখুন।'
};
const errText = e => ERR[e && e.code] || ERR[e && e.code && e.code.replace('firestore/', '')] || 'কিছু একটা ভুল হয়েছে। আবার চেষ্টা করুন।';

const card = inner => { box.innerHTML = '<h3>অ্যাকাউন্ট</h3>' + inner; };

const configured = firebaseConfig && typeof firebaseConfig.apiKey === 'string' && firebaseConfig.apiKey && !/^PASTE|এখানে/.test(firebaseConfig.apiKey);
if (!box || !FH) {
  // কিছু করার নেই
} else if (!configured) {
  card('<p class="sub" style="margin-top:6px">লগইন এখনো চালু হয়নি: firebase-config.js ফাইলে Firebase-এর তথ্য বসানো হয়নি। ততক্ষণ অ্যাপ চলবে, তথ্য শুধু এই ফোনে থাকবে।</p>');
} else {
  start().catch(e => {
    console.error(e);
    card('<p class="sub" style="margin-top:6px">এখন লগইন চালু করা গেল না (ইন্টারনেট নেই?)। অ্যাপ চলছে, তথ্য এই ফোনে থাকছে।</p>');
  });
}

async function start() {
  const [{ initializeApp }, A, S] = await Promise.all([
    import(SDK + 'firebase-app.js'),
    import(SDK + 'firebase-auth.js'),
    import(SDK + 'firebase-firestore.js')
  ]);
  const app = initializeApp(firebaseConfig);
  const auth = A.getAuth(app);
  auth.languageCode = 'bn';
  const db = S.getFirestore(app);
  const ref = uid => S.doc(db, 'users', uid);

  let user = null, rev = 0, dirty = false, busy = false, timer = 0, lastOk = null, offline = false;

  // ---------- drawing ----------
  const drawOut = () => {
    const c = ls(CONS) === '1';
    card(`<p class="sub" style="margin-top:4px">ঢুকলে আপনার সব প্রোফাইল অনলাইনে জমা থাকবে; যেকোনো ফোন বা কম্পিউটার থেকে ঢুকে পাবেন। না ঢুকলেও অ্যাপ চলবে, তথ্য শুধু এই ফোনে থাকবে।</p>
<label class="ck" style="margin-top:10px"><input type="checkbox" id="acons"${c ? ' checked' : ''}><span>আমি রাজি যে আমার দেওয়া স্বাস্থ্য-তথ্য (রোগ, ওজন, রক্ত পরীক্ষা, ধর্ম, অ্যালার্জি) আমার অ্যাকাউন্টে জমা থাকবে। <a href="privacy.html" target="_blank" rel="noopener">গোপনীয়তা নীতি পড়ুন</a></span></label>
<button class="qbtn pri wide" type="button" id="agoogle" style="margin-top:12px">Google দিয়ে ঢুকুন</button>
<details class="acc" style="margin-top:6px"><summary>ইমেল আর পাসওয়ার্ড দিয়ে</summary><div class="in">
<label for="aemail">ইমেল</label><input id="aemail" type="email" autocomplete="email" inputmode="email">
<label for="apass" style="margin-top:10px;display:block">পাসওয়ার্ড (অন্তত ৬ অক্ষর)</label><input id="apass" type="password" autocomplete="current-password">
<div class="prow"><button class="qbtn pri" type="button" id="asignin">ঢুকুন</button><button class="qbtn" type="button" id="asignup">নতুন অ্যাকাউন্ট</button></div>
<button class="linkbtn" type="button" id="areset">পাসওয়ার্ড ভুলে গেছেন?</button>
</div></details>
<p class="sub" id="amsg" role="status" aria-live="polite"></p>`);
  };
  const status = () => {
    if (offline) return 'ইন্টারনেট নেই; পরিবর্তন এই ফোনে আছে, সংযোগ ফিরলে জমা হবে।';
    if (busy || dirty) return 'জমা হচ্ছে…';
    return lastOk ? `সব তথ্য অনলাইনে জমা আছে · শেষ জমা ${hhmm(lastOk)}` : 'সব তথ্য অনলাইনে জমা আছে।';
  };
  const drawIn = () => {
    const who = user.email || user.displayName || 'আপনার অ্যাকাউন্ট';
    card(`<p style="margin:6px 0 2px">ঢুকেছেন: <b>${esc(who)}</b></p>
<p class="sub" id="async" role="status" aria-live="polite">${status()}</p>
<div class="prow"><button class="qbtn" type="button" id="aout">বের হন</button><button class="qbtn" type="button" id="aexport">আমার তথ্য ডাউনলোড</button><button class="qbtn warn" type="button" id="adel">অ্যাকাউন্ট ও সব তথ্য মুছুন</button></div>
<p class="sub" id="amsg" role="status"></p>`);
  };
  const drawChoice = (cloud) => {
    const names = (() => { try { return JSON.parse(cloud.pp).L.map(x => x.name).join(', '); } catch (e) { return ''; } })();
    card(`<p style="margin:6px 0">ঢুকেছেন: <b>${esc(user.email || user.displayName || '')}</b></p>
<div class="vbox v-lim"><b>এই ফোনে আগে থেকে তথ্য আছে, অনলাইনেও আছে।</b><br>কোনটা রাখবেন? অন্যটা মুছে যাবে।<br>অনলাইনে: ${esc(names)}<br>এই ফোনে: ${esc(FH.names().join(', '))}</div>
<div class="prow"><button class="qbtn pri" type="button" id="akeepcloud">অনলাইনেরটা রাখুন</button><button class="qbtn" type="button" id="akeeplocal">এই ফোনেরটা রাখুন</button></div>`);
  };
  const setStatus = () => { const el = document.getElementById('async'); if (el) el.textContent = status(); };

  // ---------- cloud ----------
  const push = async (first) => {
    if (!user) return;
    if (busy) { dirty = true; return; }
    busy = true; dirty = false; setStatus();
    const d = FH.get(), r = Date.now();
    const data = { v: 1, pp: d.pp, shop: d.shop, rev: r, updatedAt: S.serverTimestamp() };
    if (first) data.consentAt = S.serverTimestamp();
    try {
      await S.setDoc(ref(user.uid), data, { merge: true });
      rev = r; lastOk = new Date(); offline = false;
    } catch (e) {
      console.error(e); dirty = true; offline = e && (e.code === 'unavailable' || !navigator.onLine);
      if (!offline) say(errText(e), true);
    }
    busy = false; setStatus();
    if (dirty && !offline) schedule();
  };
  const schedule = () => { dirty = true; setStatus(); clearTimeout(timer); timer = setTimeout(() => push(false), 1200); };
  const flush = async () => { clearTimeout(timer); if (dirty || busy) { const t0 = Date.now(); while (busy && Date.now() - t0 < 5000) await new Promise(r => setTimeout(r, 100)); if (!busy) await push(false); } };
  const pull = async () => {
    if (!user || dirty || busy) return;
    try {
      const s = await S.getDoc(ref(user.uid));
      if (s.exists()) { const d = s.data(); if ((d.rev || 0) > rev && d.pp) { FH.apply(d); rev = d.rev; lastOk = new Date(); setStatus(); toast('অন্য ডিভাইসের পরিবর্তন আনা হয়েছে'); } }
    } catch (e) { /* পরে আবার */ }
  };
  const connect = () => { FH.onSave = schedule; drawIn(); };

  const afterSignIn = async () => {
    say('তথ্য আনা হচ্ছে…');
    let snap;
    try { snap = await S.getDoc(ref(user.uid)); }
    catch (e) { console.error(e); card(`<p class="no" style="margin-top:6px">${esc(errText(e))}</p><button class="qbtn" type="button" id="aout">বের হন</button>`); return; }
    if (snap.exists() && snap.data().pp) {
      const cloud = snap.data();
      const same = cloud.pp === FH.get().pp;
      if (!same && FH.hasData()) { drawChoice(cloud); return; }
      FH.apply(cloud); rev = cloud.rev || 0; lastOk = new Date(); connect();
      toast('আপনার তথ্য আনা হয়েছে');
    } else {
      ls(CONS, '1');
      connect(); await push(true);
      toast('আপনার তথ্য অনলাইনে জমা হয়েছে');
    }
  };

  // ---------- events ----------
  const needConsent = () => {
    const c = document.getElementById('acons');
    if (c && c.checked) { ls(CONS, '1'); return true; }
    say('আগে “আমি রাজি” ঘরে টিক দিন।', true);
    if (c) c.focus();
    return false;
  };
  const emailPass = () => {
    const e = (document.getElementById('aemail') || {}).value || '', p = (document.getElementById('apass') || {}).value || '';
    return [e.trim(), p];
  };
  box.addEventListener('click', async ev => {
    const b = ev.target.closest('button'); if (!b) return;
    const id = b.id;
    try {
      if (id === 'agoogle') {
        if (!needConsent()) return;
        say('Google-এর জানালা খুলছে…');
        const prov = new A.GoogleAuthProvider();
        prov.setCustomParameters({ prompt: 'select_account' });
        try { await A.signInWithPopup(auth, prov); }
        catch (e) { if (e && (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment')) await A.signInWithRedirect(auth, prov); else throw e; }
      } else if (id === 'asignin' || id === 'asignup') {
        if (!needConsent()) return;
        const [e, p] = emailPass();
        say(id === 'asignin' ? 'ঢোকা হচ্ছে…' : 'অ্যাকাউন্ট তৈরি হচ্ছে…');
        if (id === 'asignin') await A.signInWithEmailAndPassword(auth, e, p);
        else await A.createUserWithEmailAndPassword(auth, e, p);
      } else if (id === 'areset') {
        const [e] = emailPass();
        if (!e) { say('ওপরে ইমেলটা লিখে তারপর চাপুন।', true); return; }
        await A.sendPasswordResetEmail(auth, e);
        say('পাসওয়ার্ড বদলানোর লিংক আপনার ইমেলে পাঠানো হয়েছে (স্প্যাম ফোল্ডারও দেখুন)।');
      } else if (id === 'aout') {
        say('বের হওয়া হচ্ছে…');
        await flush();
        FH.onSave = null;
        await A.signOut(auth);
        FH.reset();
        toast('বের হয়েছেন; এই ফোন থেকে তথ্য সরানো হয়েছে, আবার ঢুকলে ফিরে আসবে');
      } else if (id === 'aexport') {
        const d = FH.get();
        const out = { app: 'খাবার ও স্বাস্থ্য', exportedAt: new Date().toISOString(), account: user && (user.email || user.uid), profiles: JSON.parse(d.pp), shopping: JSON.parse(d.shop) };
        const url = URL.createObjectURL(new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' }));
        const a = document.createElement('a'); a.href = url; a.download = 'amar-tothyo.json'; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
      } else if (id === 'adel') {
        if (!b.dataset.arm) { b.dataset.arm = '1'; b.textContent = 'নিশ্চিত? সব মুছে যাবে, আবার চাপুন'; setTimeout(() => { if (b.isConnected) { delete b.dataset.arm; b.textContent = 'অ্যাকাউন্ট ও সব তথ্য মুছুন'; } }, 5000); return; }
        const t = Date.parse(user.metadata && user.metadata.lastSignInTime);
        if (!(Date.now() - t < 4 * 60 * 1000)) { say('নিরাপত্তার জন্য আগে “বের হন” চেপে আবার ঢুকুন, তারপর ৪ মিনিটের মধ্যে মুছুন। কিছুই মোছা হয়নি।', true); delete b.dataset.arm; b.textContent = 'অ্যাকাউন্ট ও সব তথ্য মুছুন'; return; }
        say('মোছা হচ্ছে…');
        FH.onSave = null; clearTimeout(timer); dirty = false;
        await S.deleteDoc(ref(user.uid));
        await A.deleteUser(user);
        ls(CONS, null);
        FH.reset();
        toast('অ্যাকাউন্ট আর অনলাইনের সব তথ্য মুছে ফেলা হয়েছে');
      } else if (id === 'akeepcloud' || id === 'akeeplocal') {
        const snap = await S.getDoc(ref(user.uid));
        if (id === 'akeepcloud' && snap.exists()) { FH.apply(snap.data()); rev = snap.data().rev || 0; lastOk = new Date(); connect(); toast('অনলাইনের তথ্য রাখা হয়েছে'); }
        else { connect(); await push(!snap.exists()); toast('এই ফোনের তথ্য অনলাইনে জমা হয়েছে'); }
      }
    } catch (e) {
      console.error(e);
      if (id === 'adel' && e && e.code === 'auth/requires-recent-login') { FH.onSave = schedule; }
      say(errText(e), true);
    }
  });

  addEventListener('online', () => { if (user && offline) { offline = false; push(false); } });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') pull(); });
  addEventListener('pagehide', () => { if (dirty) push(false); });

  try { await A.getRedirectResult(auth); } catch (e) { say(errText(e), true); }
  A.onAuthStateChanged(auth, u => {
    const was = user; user = u;
    if (u && (!was || was.uid !== u.uid)) afterSignIn();
    else if (!u) { FH.onSave = null; rev = 0; lastOk = null; dirty = false; drawOut(); }
  });
}
