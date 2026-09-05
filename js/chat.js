/* DevFlow Chat — Firebase Firestore realtime + WhatsApp receipts */

let activePeerHandle = null;
let activePeerUid = null;
let unsubMessages = null;
let unsubPresence = null;
let presenceInterval = null;

function fbReady() {
  return !!(window.firebase && firebase.apps && firebase.apps.length);
}

function db() { return firebase.firestore(); }
function auth() { return firebase.auth(); }

function chatRoomId(a, b) {
  return [String(a).toLowerCase(), String(b).toLowerCase()].sort().join('_');
}

function tickHtml(status) {
  if (status === 'read') return '<span class="wa-ticks read">✓✓</span>';
  if (status === 'delivered') return '<span class="wa-ticks delivered">✓✓</span>';
  return '<span class="wa-ticks sent">✓</span>';
}

function formatMsgTime(ts) {
  const d = ts && ts.toDate ? ts.toDate() : new Date(ts || Date.now());
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

async function beatPresence() {
  if (!fbReady() || !auth().currentUser) return;
  const u = auth().currentUser;
  const handle = (window.currentUser && currentUser.handle) || '';
  await db().collection('presence').doc(u.uid).set({
    uid: u.uid,
    handle: handle.toLowerCase(),
    name: (currentUser && currentUser.displayName) || '',
    avatar: (currentUser && currentUser.avatar) || '',
    lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
    activeChat: activePeerUid || null,
    online: true
  }, { merge: true });
}

async function setOffline() {
  if (!fbReady() || !auth().currentUser) return;
  try {
    await db().collection('presence').doc(auth().currentUser.uid).set({
      online: false,
      activeChat: null,
      lastSeen: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  } catch (e) {}
}

async function findUserByHandle(handle) {
  const q = await db().collection('users').where('handle', '==', handle.toLowerCase()).limit(1).get();
  if (q.empty) return null;
  const doc = q.docs[0];
  return { uid: doc.id, ...doc.data() };
}

async function openChatWith(peerHandle) {
  if (!fbReady()) {
    showToast('Firebase', 'Add your config in js/firebase-config.js');
    return;
  }
  const peer = await findUserByHandle(peerHandle);
  if (!peer) {
    showToast('User not found', '@' + peerHandle + ' is not registered');
    return;
  }
  activePeerHandle = peer.handle || peerHandle.toLowerCase();
  activePeerUid = peer.uid;

  const ph = document.getElementById('chat-placeholder');
  const active = document.getElementById('chat-active');
  if (ph) ph.style.display = 'none';
  if (active) { active.classList.remove('hidden'); active.style.display = 'flex'; }

  document.getElementById('chat-peer-name').textContent = peer.displayName || peer.handle;
  document.getElementById('chat-peer-avatar').src = peer.avatar || ('https://api.dicebear.com/7.x/avataaars/svg?seed=' + encodeURIComponent(activePeerHandle));
  updatePeerStatusFromPresence(peer.uid);

  beatPresence();
  listenMessages();
  markChatRead();
  renderChatList();
}

function updatePeerStatusFromPresence(uid) {
  if (unsubPresence) unsubPresence();
  unsubPresence = db().collection('presence').doc(uid).onSnapshot(snap => {
    const stEl = document.getElementById('chat-peer-status');
    if (!stEl) return;
    const d = snap.data() || {};
    const online = d.online === true;
    stEl.textContent = online ? 'online' : 'offline';
    stEl.className = 'text-xs ' + (online ? 'chat-peer-online' : 'chat-peer-offline');
  });
}

function listenMessages() {
  if (unsubMessages) unsubMessages();
  const me = auth().currentUser.uid;
  const room = chatRoomId(me, activePeerUid);
  unsubMessages = db().collection('chats').doc(room).collection('messages')
    .orderBy('createdAt', 'asc')
    .onSnapshot(async snap => {
      const box = document.getElementById('chat-messages');
      if (!box) return;
      const meUid = auth().currentUser.uid;
      let html = '';
      const batch = db().batch();
      let batchCount = 0;

      snap.forEach(doc => {
        const m = doc.data();
        const mine = m.fromUid === meUid;
        // Upgrade receipts for my messages when peer is viewing / online
        if (mine) {
          // handled separately by presence upgrades
        } else {
          // incoming: mark delivered then read if chat open
          if (m.status === 'sent') {
            batch.update(doc.ref, { status: 'delivered' });
            batchCount++;
          }
          if (activePeerUid && m.status !== 'read') {
            batch.update(doc.ref, { status: 'read' });
            batchCount++;
          }
        }
        const ticks = mine ? tickHtml(m.status || 'sent') : '';
        html += `<div class="wa-bubble ${mine ? 'sent' : 'received'}">
          <div>${escapeHtml(m.text || '')}</div>
          <div class="wa-meta"><span>${formatMsgTime(m.createdAt)}</span>${ticks}</div>
        </div>`;
      });
      box.innerHTML = html;
      box.scrollTop = box.scrollHeight;
      if (batchCount) {
        try { await batch.commit(); } catch (e) {}
      }
      // upgrade my messages to read if peer activeChat is me
      upgradeMyReceipts(room, meUid);
    });
}

async function upgradeMyReceipts(room, meUid) {
  try {
    const peerPres = await db().collection('presence').doc(activePeerUid).get();
    const pd = peerPres.data() || {};
    const peerOnline = pd.online === true;
    const peerReading = pd.activeChat === meUid;
    const q = await db().collection('chats').doc(room).collection('messages')
      .where('fromUid', '==', meUid).get();
    const batch = db().batch();
    let n = 0;
    q.forEach(doc => {
      const st = doc.data().status || 'sent';
      let next = st;
      if (st === 'sent' && peerOnline) next = 'delivered';
      if ((st === 'sent' || st === 'delivered') && peerReading) next = 'read';
      if (next !== st) {
        batch.update(doc.ref, { status: next });
        n++;
      }
    });
    if (n) await batch.commit();
  } catch (e) {}
}

async function markChatRead() {
  if (!activePeerUid || !auth().currentUser) return;
  const me = auth().currentUser.uid;
  const room = chatRoomId(me, activePeerUid);
  try {
    const q = await db().collection('chats').doc(room).collection('messages')
      .where('toUid', '==', me).where('status', 'in', ['sent', 'delivered']).get();
    const batch = db().batch();
    q.forEach(doc => batch.update(doc.ref, { status: 'read' }));
    if (!q.empty) await batch.commit();
  } catch (e) {}
}

async function sendChatMessage() {
  if (!fbReady() || !auth().currentUser) {
    showToast('Sign in', 'Firebase login required');
    return;
  }
  if (!activePeerUid) {
    showToast('No chat', 'Select a conversation first');
    return;
  }
  const input = document.getElementById('chat-input');
  const text = (input && input.value || '').trim();
  if (!text) return;

  const me = auth().currentUser.uid;
  const room = chatRoomId(me, activePeerUid);

  let status = 'sent';
  try {
    const peerPres = await db().collection('presence').doc(activePeerUid).get();
    const pd = peerPres.data() || {};
    if (pd.online) status = 'delivered';
    if (pd.activeChat === me) status = 'read';
  } catch (e) {}

  await db().collection('chats').doc(room).set({
    members: [me, activePeerUid],
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    lastText: text
  }, { merge: true });

  await db().collection('chats').doc(room).collection('messages').add({
    fromUid: me,
    toUid: activePeerUid,
    fromHandle: (currentUser && currentUser.handle) || '',
    text,
    status,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  if (input) input.value = '';
}

async function renderChatList() {
  const el = document.getElementById('chat-conversations');
  if (!el) return;
  if (!fbReady() || !auth().currentUser) {
    el.innerHTML = '<div class="empty-state" style="padding:2rem 1rem"><p class="text-sm">Sign in with Google to chat</p></div>';
    return;
  }
  const me = auth().currentUser.uid;
  try {
    const q = await db().collection('chats').where('members', 'array-contains', me).get();
    if (q.empty) {
      el.innerHTML = '<div class="empty-state" style="padding:2rem 1rem"><p class="text-sm">No chats yet</p><p class="text-xs text-muted">Search a user by @handle and message them</p></div>';
      return;
    }
    const rows = [];
    for (const doc of q.docs) {
      const data = doc.data();
      const otherUid = (data.members || []).find(id => id !== me);
      if (!otherUid) continue;
      const userDoc = await db().collection('users').doc(otherUid).get();
      const u = userDoc.data() || {};
      const pres = await db().collection('presence').doc(otherUid).get();
      const online = (pres.data() || {}).online === true;
      const name = u.displayName || u.handle || 'User';
      const handle = u.handle || otherUid;
      const avatar = u.avatar || '';
      rows.push(`<div class="chat-item" onclick="openChatWith('${handle}')">
        <img class="avatar ${online ? 'online' : ''}" src="${avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + handle}" alt="" />
        <div style="min-width:0;flex:1">
          <div style="font-weight:600;font-size:0.9rem">${escapeHtml(name)}</div>
          <div class="text-xs text-muted truncate">${escapeHtml(data.lastText || '')}</div>
        </div>
      </div>`);
    }
    el.innerHTML = rows.join('') || '<div class="empty-state" style="padding:2rem 1rem"><p class="text-sm">No chats yet</p></div>';
  } catch (e) {
    el.innerHTML = '<div class="empty-state" style="padding:2rem 1rem"><p class="text-sm">Could not load chats</p><p class="text-xs text-muted">' + escapeHtml(e.message || '') + '</p></div>';
  }
}

function renderMessagesPage() {
  renderChatList();
}

function startChatEngine() {
  if (!fbReady()) return;
  if (presenceInterval) clearInterval(presenceInterval);
  presenceInterval = setInterval(beatPresence, 4000);
  beatPresence();
  window.addEventListener('beforeunload', setOffline);
  auth().onAuthStateChanged(u => {
    if (u) beatPresence();
    else setOffline();
  });
}

window.sendChatMessage = sendChatMessage;
window.openChatWith = openChatWith;
window.renderMessagesPage = renderMessagesPage;
window.startChatEngine = startChatEngine;
window.findUserByHandle = findUserByHandle;
