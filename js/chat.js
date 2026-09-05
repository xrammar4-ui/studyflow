/* DevFlow Chat — WhatsApp-style receipts (local shared store)
 * Works across tabs/windows on the same browser origin.
 * Presence + messages in localStorage; storage events sync other tabs.
 * Status: sent (✓) → delivered (✓✓ gray) when peer online → read (✓✓ blue) when peer opens chat.
 */

const CHAT_MSGS_KEY = 'devflow_chat_msgs_v1';
const CHAT_PRESENCE_KEY = 'devflow_chat_presence_v1';
const ONLINE_MS = 8000;

let activePeerHandle = null;
let presenceTimer = null;
let receiptTimer = null;

function chatRoomId(a, b) {
  return [a, b].map(x => (x || '').toLowerCase()).sort().join('|');
}

function loadAllMsgs() {
  try { return JSON.parse(localStorage.getItem(CHAT_MSGS_KEY) || '{}'); } catch { return {}; }
}
function saveAllMsgs(data) {
  localStorage.setItem(CHAT_MSGS_KEY, JSON.stringify(data));
}
function loadPresence() {
  try { return JSON.parse(localStorage.getItem(CHAT_PRESENCE_KEY) || '{}'); } catch { return {}; }
}
function savePresence(data) {
  localStorage.setItem(CHAT_PRESENCE_KEY, JSON.stringify(data));
}

function myHandle() {
  return (window.currentUser && currentUser.handle) ? currentUser.handle.toLowerCase() : null;
}

function beatPresence() {
  const h = myHandle();
  if (!h || h === 'guest') return;
  const p = loadPresence();
  p[h] = {
    lastSeen: Date.now(),
    activeChat: activePeerHandle || null,
    name: currentUser.displayName || h,
    avatar: currentUser.avatar || ''
  };
  savePresence(p);
}

function isPeerOnline(handle) {
  if (!handle) return false;
  const p = loadPresence()[handle.toLowerCase()];
  if (!p) return false;
  return (Date.now() - (p.lastSeen || 0)) < ONLINE_MS;
}

function peerActiveChat(handle) {
  const p = loadPresence()[handle.toLowerCase()];
  return p && p.activeChat ? p.activeChat.toLowerCase() : null;
}

function getMessages(peer) {
  const me = myHandle();
  if (!me || !peer) return [];
  const all = loadAllMsgs();
  return all[chatRoomId(me, peer)] || [];
}

function setMessages(peer, list) {
  const me = myHandle();
  if (!me || !peer) return;
  const all = loadAllMsgs();
  all[chatRoomId(me, peer)] = list;
  saveAllMsgs(all);
}

function tickHtml(status) {
  // WhatsApp-style
  if (status === 'read') return '<span class="wa-ticks read">✓✓</span>';
  if (status === 'delivered') return '<span class="wa-ticks delivered">✓✓</span>';
  return '<span class="wa-ticks sent">✓</span>';
}

function formatMsgTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function upgradeReceipts() {
  const me = myHandle();
  if (!me) return;
  const all = loadAllMsgs();
  let changed = false;
  Object.keys(all).forEach(room => {
    const parts = room.split('|');
    if (!parts.includes(me)) return;
    const peer = parts[0] === me ? parts[1] : parts[0];
    const online = isPeerOnline(peer);
    const readingMe = peerActiveChat(peer) === me;
    all[room] = all[room].map(m => {
      if (m.from !== me) return m;
      let st = m.status || 'sent';
      if (st === 'sent' && online) { st = 'delivered'; changed = true; }
      if ((st === 'sent' || st === 'delivered') && readingMe) { st = 'read'; changed = true; }
      return { ...m, status: st };
    });
  });
  if (changed) {
    saveAllMsgs(all);
    if (activePeerHandle) renderChatMessages(activePeerHandle);
    renderChatList();
  }
}

function markIncomingRead(peer) {
  const me = myHandle();
  if (!me || !peer) return;
  const list = getMessages(peer);
  let changed = false;
  const next = list.map(m => {
    if (m.to === me && m.from === peer.toLowerCase() && m.status !== 'read') {
      changed = true;
      return { ...m, status: 'read' };
    }
    return m;
  });
  if (changed) {
    setMessages(peer, next);
    // peer will see blue ticks when they upgrade on their side via storage
  }
}

function sendChatMessage() {
  const input = document.getElementById('chat-input');
  const text = (input && input.value || '').trim();
  if (!text || !activePeerHandle) return;
  const me = myHandle();
  if (!me || me === 'guest') {
    showToast('Sign in', 'Login required to chat');
    return;
  }
  const peer = activePeerHandle.toLowerCase();
  const online = isPeerOnline(peer);
  const reading = peerActiveChat(peer) === me;
  let status = 'sent';
  if (online) status = 'delivered';
  if (reading) status = 'read';

  const msg = {
    id: 'm' + Date.now() + Math.random().toString(36).slice(2, 6),
    from: me,
    to: peer,
    text,
    time: Date.now(),
    status
  };
  const list = getMessages(peer);
  list.push(msg);
  setMessages(peer, list);
  if (input) input.value = '';
  renderChatMessages(peer);
  renderChatList();
  // notify badge for peer is handled when peer loads; local simulation:
  try {
    const bc = new BroadcastChannel('devflow_chat');
    bc.postMessage({ type: 'new_msg', to: peer, from: me });
    bc.close();
  } catch (e) {}
}

function renderChatMessages(peer) {
  const box = document.getElementById('chat-messages');
  if (!box) return;
  const me = myHandle();
  const list = getMessages(peer);
  box.innerHTML = list.map(m => {
    const mine = m.from === me;
    const ticks = mine ? tickHtml(m.status || 'sent') : '';
    return `<div class="wa-bubble ${mine ? 'sent' : 'received'}">
      <div>${escapeHtml(m.text)}</div>
      <div class="wa-meta"><span>${formatMsgTime(m.time)}</span>${ticks}</div>
    </div>`;
  }).join('');
  box.scrollTop = box.scrollHeight;
}

function escapeHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function getConversationPeers() {
  const me = myHandle();
  if (!me) return [];
  const all = loadAllMsgs();
  const peers = new Set();
  Object.keys(all).forEach(room => {
    const parts = room.split('|');
    if (parts.includes(me)) {
      const other = parts[0] === me ? parts[1] : parts[0];
      if (other) peers.add(other);
    }
  });
  // friends
  (window.FRIENDS || []).forEach(f => {
    if (f.handle) peers.add(f.handle.toLowerCase());
  });
  return [...peers];
}

function renderChatList() {
  const el = document.getElementById('chat-conversations');
  if (!el) return;
  const me = myHandle();
  const peers = getConversationPeers();
  if (!peers.length) {
    el.innerHTML = '<div class="empty-state" style="padding:2rem 1rem"><p class="text-sm">No chats yet</p><p class="text-xs text-muted" style="margin-top:0.35rem">Accept a friend request, then message them</p></div>';
    return;
  }
  const presence = loadPresence();
  el.innerHTML = peers.map(peer => {
    const msgs = getMessages(peer);
    const last = msgs[msgs.length - 1];
    const p = presence[peer] || {};
    const online = isPeerOnline(peer);
    const name = p.name || peer;
    const avatar = p.avatar || ('https://api.dicebear.com/7.x/avataaars/svg?seed=' + encodeURIComponent(peer) + '&backgroundColor=09090b');
    const preview = last ? escapeHtml(last.text).slice(0, 40) : 'No messages yet';
    const active = activePeerHandle === peer ? ' active' : '';
    const unread = msgs.filter(m => m.to === me && m.status !== 'read').length;
    return `<div class="chat-item${active}" onclick="openChatWith('${peer}')">
      <img class="avatar ${online ? 'online' : ''}" src="${avatar}" alt="" />
      <div style="min-width:0;flex:1">
        <div class="flex justify-between"><span style="font-weight:600;font-size:0.9rem">${escapeHtml(name)}</span>
          <span class="text-xs text-muted">${last ? formatMsgTime(last.time) : ''}</span></div>
        <div class="text-xs text-muted truncate">${preview}</div>
      </div>
      ${unread ? `<span class="nav-badge" style="position:static;transform:none">${unread}</span>` : ''}
    </div>`;
  }).join('');
}

function openChatWith(peer) {
  activePeerHandle = (peer || '').toLowerCase();
  const ph = document.getElementById('chat-placeholder');
  const active = document.getElementById('chat-active');
  if (ph) ph.style.display = 'none';
  if (active) { active.classList.remove('hidden'); active.style.display = 'flex'; }
  const presence = loadPresence()[activePeerHandle] || {};
  const name = presence.name || activePeerHandle;
  const avatar = presence.avatar || ('https://api.dicebear.com/7.x/avataaars/svg?seed=' + encodeURIComponent(activePeerHandle) + '&backgroundColor=09090b');
  const nameEl = document.getElementById('chat-peer-name');
  const avEl = document.getElementById('chat-peer-avatar');
  const stEl = document.getElementById('chat-peer-status');
  if (nameEl) nameEl.textContent = name;
  if (avEl) avEl.src = avatar;
  updatePeerStatusUI();
  markIncomingRead(activePeerHandle);
  beatPresence();
  renderChatMessages(activePeerHandle);
  renderChatList();
  upgradeReceipts();
}

function updatePeerStatusUI() {
  const stEl = document.getElementById('chat-peer-status');
  if (!stEl || !activePeerHandle) return;
  if (isPeerOnline(activePeerHandle)) {
    stEl.textContent = 'online';
    stEl.className = 'text-xs chat-peer-online';
  } else {
    stEl.textContent = 'offline';
    stEl.className = 'text-xs chat-peer-offline';
  }
}

function startChatEngine() {
  if (presenceTimer) clearInterval(presenceTimer);
  if (receiptTimer) clearInterval(receiptTimer);
  presenceTimer = setInterval(() => {
    beatPresence();
    updatePeerStatusUI();
    upgradeReceipts();
  }, 2500);
  receiptTimer = setInterval(upgradeReceipts, 2000);
  beatPresence();
  try {
    const bc = new BroadcastChannel('devflow_chat');
    bc.onmessage = (ev) => {
      if (!ev.data) return;
      if (ev.data.type === 'new_msg' && ev.data.to === myHandle()) {
        renderChatList();
        if (activePeerHandle === ev.data.from) {
          markIncomingRead(ev.data.from);
          renderChatMessages(ev.data.from);
        } else {
          setUnreadChats((typeof UNREAD_CHATS !== 'undefined' ? UNREAD_CHATS : 0) + 1);
        }
      }
    };
  } catch (e) {}
  window.addEventListener('storage', (e) => {
    if (e.key === CHAT_MSGS_KEY || e.key === CHAT_PRESENCE_KEY) {
      upgradeReceipts();
      renderChatList();
      if (activePeerHandle) {
        renderChatMessages(activePeerHandle);
        updatePeerStatusUI();
      }
    }
  });
}

function renderMessagesPage() {
  renderChatList();
  if (activePeerHandle) openChatWith(activePeerHandle);
}

window.sendChatMessage = sendChatMessage;
window.openChatWith = openChatWith;
window.renderMessagesPage = renderMessagesPage;
window.startChatEngine = startChatEngine;
window.getMessages = getMessages;
window.markIncomingRead = markIncomingRead;
