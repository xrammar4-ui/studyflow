/* DevFlow — Core Logic */

let isLoggedIn = localStorage.getItem('devflow_logged_in') === 'true';
let currentUser = null;
let TASKS = JSON.parse(localStorage.getItem('devflow_tasks') || '[]');
let NOTIFICATIONS = JSON.parse(localStorage.getItem('devflow_notifs') || '[]');
let ACTIVE_TIMER = null;
let UNREAD_CHATS = parseInt(localStorage.getItem('devflow_unread_chats') || '0', 10);
let ACTIVITY = JSON.parse(localStorage.getItem('devflow_activity') || '[]');
let FOCUS_TODAY_MIN = parseInt(localStorage.getItem('devflow_focus_today') || '0', 10);
let COINS = parseInt(localStorage.getItem('devflow_coins') || '0', 10);
let SKILLS_LEARNED = JSON.parse(localStorage.getItem('devflow_skills_learned') || '[]');
let SKILLS_LEARNING = JSON.parse(localStorage.getItem('devflow_skills_learning') || '[]');
let CERTIFICATES = JSON.parse(localStorage.getItem('devflow_certs') || '[]');
let ONBOARDING_DONE = localStorage.getItem('devflow_onboarding') === 'true';
let TERMINAL_ENABLED = localStorage.getItem('devflow_terminal') === 'true';
let timerInterval = null;
let remainingSeconds = 0;
let pendingSignup = { displayName: '', handle: '', avatar: '' };
let pendingAvatarData = '';

const FRIENDS = JSON.parse(localStorage.getItem('devflow_friends') || '[]');
const SKILL_CATALOG = [
  'JavaScript','TypeScript','React','Next.js','Vue','Node.js','Python',
  'Go','Rust','Docker','Kubernetes','AWS','PostgreSQL','MongoDB',
  'GraphQL','System Design','Algorithms','CSS','Tailwind','Git'
];

function saveTasks(){ localStorage.setItem('devflow_tasks', JSON.stringify(TASKS)); }
function saveNotifs(){ localStorage.setItem('devflow_notifs', JSON.stringify(NOTIFICATIONS)); }
function saveFriends(){ localStorage.setItem('devflow_friends', JSON.stringify(FRIENDS)); }
function saveCoins(){ localStorage.setItem('devflow_coins', String(COINS)); updateCoinsUI(); }

function addCoins(n, reason){
  COINS += n;
  saveCoins();
  if(reason) showToast('+' + n + ' coins', reason);
}
function updateCoinsUI(){
  document.querySelectorAll('.coin-value').forEach(el => { el.textContent = COINS; });
}

function formatTime(seconds){
  const m = Math.floor(seconds/60).toString().padStart(2,'0');
  const s = (seconds%60).toString().padStart(2,'0');
  return m+':'+s;
}
function formatDateTime(date){
  return new Intl.DateTimeFormat('en',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(date));
}
function timeUntil(date){
  const diff = new Date(date) - Date.now();
  if(diff < 0) return 'Overdue';
  const mins = Math.floor(diff/60000);
  if(mins < 60) return 'in '+mins+'m';
  const hours = Math.floor(mins/60);
  return 'in '+hours+'h '+(mins%60)+'m';
}

function showToast(title, message, duration=5000){
  const container = document.getElementById('toast-container');
  if(!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = '<div style="flex:1"><div style="font-weight:600;margin-bottom:0.15rem;font-size:0.9rem">'+title+'</div><div class="text-sm text-muted">'+message+'</div></div><button class="icon-btn" style="width:28px;height:28px;border:none;background:transparent" onclick="this.closest(\'.toast\').remove()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button>';
  container.appendChild(toast);
  setTimeout(()=>toast.remove(), duration);
}

function openModal(id){ document.getElementById(id)?.classList.add('open'); }
function closeModal(id){ document.getElementById(id)?.classList.remove('open'); }

/* Auth / Landing */
function showLanding(){
  document.getElementById('landing')?.classList.remove('hidden');
  document.getElementById('app-shell')?.classList.remove('visible');
}
function showApp(){
  document.getElementById('landing')?.classList.add('hidden');
  document.getElementById('app-shell')?.classList.add('visible');
  renderTasks();
  updateStats();
  updateNotifBadge();
  updateCoinsUI();
  renderSkillsOnDashboard();
  renderCertificates();
  applyTerminalPref();
  navigate('dashboard');
  maybeShowOnboarding();
  if(typeof startChatEngine==='function') startChatEngine();
}

function startGoogleSignup(optionalName) {
  closeModal('modal-auth');
  pendingSignup = { displayName: (optionalName || '').trim(), handle: '', avatar: '' };
  pendingAvatarData = '';
  if (pendingSignup.displayName) {
    document.getElementById('setup-displayname').value = pendingSignup.displayName;
  }
  openModal('modal-username');
  setTimeout(() => document.getElementById('setup-username')?.focus(), 100);
}

function submitUsername() {
  let handle = (document.getElementById('setup-username')?.value || '').trim().toLowerCase();
  handle = handle.replace(/^@/, '').replace(/[^a-z0-9_]/g, '');
  const display = (document.getElementById('setup-displayname')?.value || '').trim() || handle || 'Developer';
  if (!handle || handle.length < 3) {
    showToast('Username required', 'At least 3 characters (a-z, 0-9, _)');
    return;
  }
  pendingSignup.handle = handle;
  pendingSignup.displayName = display;
  closeModal('modal-username');
  // reset avatar UI
  const prev = document.getElementById('avatar-preview');
  const ph = document.getElementById('avatar-placeholder');
  if (prev) { prev.style.display = 'none'; prev.src = ''; }
  if (ph) ph.style.display = 'flex';
  pendingAvatarData = '';
  openModal('modal-avatar');
}

function onAvatarSelected(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    showToast('Invalid file', 'Please choose an image');
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    pendingAvatarData = reader.result;
    const prev = document.getElementById('avatar-preview');
    const ph = document.getElementById('avatar-placeholder');
    if (prev) { prev.src = pendingAvatarData; prev.style.display = 'block'; }
    if (ph) ph.style.display = 'none';
  };
  reader.readAsDataURL(file);
}

function skipAvatar() {
  pendingAvatarData = '';
  finishSignup();
}

function confirmAvatar() {
  finishSignup();
}

function finishSignup() {
  closeModal('modal-avatar');
  const avatar = pendingAvatarData || ('https://api.dicebear.com/7.x/avataaars/svg?seed=' + encodeURIComponent(pendingSignup.handle || 'dev') + '&backgroundColor=09090b');
  login(pendingSignup.displayName, pendingSignup.handle, avatar);
}


function enterGuest(){
  isLoggedIn = false;
  currentUser = { displayName:'Guest', handle:'guest', avatar:'assets/logo.png' };
  updateUserUI();
  showApp();
  setTimeout(()=>{
    if(!localStorage.getItem('devflow_logged_in')){
      openModal('modal-auth');
      showToast('Sign in required','Create an account to save progress and earn coins');
    }
  }, 3000);
}
function login(name, handle, avatarUrl){
  isLoggedIn = true;
  currentUser = {
    displayName: name || 'Developer',
    handle: handle || 'developer',
    avatar: avatarUrl || ('https://api.dicebear.com/7.x/avataaars/svg?seed='+encodeURIComponent(handle||name||'dev')+'&backgroundColor=09090b')
  };
  localStorage.setItem('devflow_logged_in','true');
  localStorage.setItem('devflow_user', JSON.stringify(currentUser));
  updateUserUI();
  showApp();
  showToast('Welcome', 'Signed in as @'+currentUser.handle);
}
function logout(){
  isLoggedIn = false;
  currentUser = null;
  localStorage.removeItem('devflow_logged_in');
  localStorage.removeItem('devflow_user');
  showLanding();
}
function updateUserUI(){
  if(!currentUser) return;
  const n = document.getElementById('sidebar-user-name');
  const h = document.getElementById('sidebar-user-handle');
  const a = document.getElementById('sidebar-user-avatar');
  if(n) n.textContent = currentUser.displayName;
  if(h) h.textContent = '@'+currentUser.handle;
  if(a) a.src = currentUser.avatar;
}
function handleProfileClick(){
  if(!isLoggedIn){ openModal('modal-auth'); return; }
  navigate('profile');
  if(currentUser){
    document.getElementById('profile-name').textContent = currentUser.displayName;
    document.getElementById('profile-handle').textContent = '@'+currentUser.handle;
    document.getElementById('profile-avatar').src = currentUser.avatar;
  }
  renderCertificates();
}

/* Onboarding */
function maybeShowOnboarding(){
  if(!ONBOARDING_DONE && isLoggedIn){
    setTimeout(()=>{ renderOnboardingChips(); openModal('modal-onboarding'); }, 450);
  }
}
function renderOnboardingChips(){
  ['skills-learned','skills-learning'].forEach(id=>{
    const el = document.getElementById(id);
    if(!el) return;
    el.innerHTML = SKILL_CATALOG.map(s=>'<button type="button" class="skill-chip" data-skill="'+s+'" onclick="this.classList.toggle(\'selected\')">'+s+'</button>').join('');
  });
}
function submitOnboarding(){
  const learned = [...document.querySelectorAll('#skills-learned .skill-chip.selected')].map(b=>b.dataset.skill);
  const learning = [...document.querySelectorAll('#skills-learning .skill-chip.selected')].map(b=>b.dataset.skill);
  SKILLS_LEARNED = learned;
  SKILLS_LEARNING = learning;
  localStorage.setItem('devflow_skills_learned', JSON.stringify(learned));
  localStorage.setItem('devflow_skills_learning', JSON.stringify(learning));
  ONBOARDING_DONE = true;
  localStorage.setItem('devflow_onboarding','true');
  learning.forEach(skill=>{
    if(TASKS.some(t=>t.isLearningGoal && t.title.includes(skill))) return;
    TASKS.unshift({
      id:'t'+Date.now()+Math.random().toString(36).slice(2,5),
      title:'Learn: '+skill,
      scheduledAt: new Date(Date.now()+86400000).toISOString(),
      status:'scheduled',
      tech:[skill],
      estimated:60,
      isLearningGoal:true,
      coinReward:25,
      projects:[]
    });
  });
  saveTasks();
  renderTasks();
  updateStats();
  closeModal('modal-onboarding');
  if(learning.length){
    addCoins(10,'Welcome bonus');
    showToast('Learning goals ready', learning.length+' tasks created');
  }
  renderSkillsOnDashboard();
}
function renderSkillsOnDashboard(){
  const box = document.getElementById('skills-summary');
  if(!box) return;
  if(!SKILLS_LEARNED.length && !SKILLS_LEARNING.length){
    box.innerHTML = '<p class="text-sm text-muted">Set your skills from onboarding or profile</p>';
    return;
  }
  let html = '';
  if(SKILLS_LEARNED.length) html += '<div class="text-xs text-muted" style="margin-bottom:0.35rem">Knows</div><div class="tag-list" style="margin-bottom:0.7rem">'+SKILLS_LEARNED.map(s=>'<span class="tag">'+s+'</span>').join('')+'</div>';
  if(SKILLS_LEARNING.length) html += '<div class="text-xs text-muted" style="margin-bottom:0.35rem">Learning</div><div class="tag-list">'+SKILLS_LEARNING.map(s=>'<span class="tag">'+s+'</span>').join('')+'</div>';
  box.innerHTML = html;
}

/* Navigation */
function navigate(page){
  if(!isLoggedIn && !currentUser && page!=='landing'){ openModal('modal-auth'); return; }
  document.querySelectorAll('.page-view').forEach(p=>p.classList.add('hidden'));
  document.getElementById('page-'+page)?.classList.remove('hidden');
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  document.querySelector('[data-nav="'+page+'"]')?.classList.add('active');
  if(page==='focus') initTimerUI();
  if(page==='messages'){ if(typeof renderMessagesPage==='function') renderMessagesPage(); setUnreadChats(0); if(activePeerHandle) markIncomingRead(activePeerHandle); }
  if(page==='analytics'){ renderAnalyticsEmpty(); renderAnalyticsCharts(); }
  
  updateMiniTimer();
  persistTimer();
}

/* Tasks */
function renderTasks(){
  const sorted = [...TASKS].sort((a,b)=>{
    const order = {active:0,delayed:1,scheduled:2,completed:3};
    return (order[a.status]||9)-(order[b.status]||9);
  });
  const html = sorted.length===0
    ? '<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg><h3>No tasks yet</h3><p class="text-sm">Use + New Task in the top bar when you need one</p></div>'
    : sorted.map(t=>`
      <div class="glass-card task-card interactive">
        <div class="task-status ${t.status}"></div>
        <div class="task-body">
          <div class="task-title">${t.title}</div>
          <div class="task-meta"><span>${formatDateTime(t.scheduledAt)} · ${timeUntil(t.scheduledAt)}</span><span>${t.estimated} min</span></div>
          ${t.tech?.length?`<div class="tag-list" style="margin-top:0.45rem">${t.tech.map(tag=>`<span class="tag">${tag}</span>`).join('')}</div>`:''}
          ${t.isLearningGoal?`<div class="text-xs" style="margin-top:0.35rem;color:#FBBF24">+${t.coinReward||25} coins on complete</div>`:''}
          ${t.projects?.length?`<div class="sub-projects">${t.projects.map((pr,i)=>`<label class="sub-project"><input type="checkbox" ${pr.done?'checked':''} onchange="toggleProject('${t.id}',${i})"/> ${pr.name}</label>`).join('')}</div>`:''}
        </div>
        <div class="task-actions" onclick="event.stopPropagation()">
          ${t.status==='scheduled'||t.status==='delayed'?`<button class="btn btn-sm btn-primary" onclick="startTask('${t.id}')">Start</button><button class="btn btn-sm btn-outline" onclick="snoozeTask('${t.id}')">Snooze</button>`:t.status==='active'?`<button class="btn btn-sm btn-primary" onclick="navigate('focus')">Focus</button>`:`<span class="text-xs text-muted">Done</span>`}
        </div>
      </div>`).join('');
  const list = document.getElementById('task-list');
  if(list) list.innerHTML = html;
  const all = document.getElementById('all-tasks-container');
  if(all) all.innerHTML = html;
}
function toggleProject(taskId, idx){
  const t = TASKS.find(x=>x.id===taskId);
  if(!t||!t.projects) return;
  t.projects[idx].done = !t.projects[idx].done;
  saveTasks();
  if(t.projects[idx].done) addCoins(2,'Checkpoint: '+t.projects[idx].name);
  renderTasks();
}
function openCreateTask(){
  if(!isLoggedIn){ openModal('modal-auth'); return; }
  openModal('modal-create-task');
}
function submitCreateTask(e){
  e.preventDefault();
  const title = document.getElementById('task-title').value.trim();
  const datetime = document.getElementById('task-datetime').value;
  const estimated = parseInt(document.getElementById('task-estimated').value)||60;
  const tech = document.getElementById('task-tech').value.split(',').map(s=>s.trim()).filter(Boolean);
  const projects = (document.getElementById('task-projects')?.value||'').split(',').map(s=>s.trim()).filter(Boolean).map(name=>({name,done:false}));
  if(!title||!datetime) return;
  TASKS.unshift({
    id:'t'+Date.now(), title,
    scheduledAt:new Date(datetime).toISOString(),
    status:'scheduled', tech, estimated, projects, coinReward:5
  });
  saveTasks();
  renderTasks();
  updateStats();
  closeModal('modal-create-task');
  document.getElementById('form-create-task').reset();
  showToast('Task scheduled', title);
  addActivity('Scheduled: '+title,'done');
}
function startTask(id){
  const task = TASKS.find(t=>t.id===id);
  if(!task) return;
  task.status = 'active';
  saveTasks();
  ACTIVE_TIMER = { taskId:id, title:task.title, totalSeconds:task.estimated*60, remaining:task.estimated*60 };
  remainingSeconds = ACTIVE_TIMER.remaining;
  renderTasks();
  updateStats();
  navigate('focus');
  showToast('Focus started', task.title);
  startTimerCountdown();
  updateMiniTimer();
}

function startFreeTimerFromInput() {
  const n = parseInt(document.getElementById('free-duration')?.value, 10);
  const unit = document.getElementById('free-duration-unit')?.value || 'min';
  if (!n || n < 1) {
    showToast('Invalid', 'Enter a valid duration');
    return;
  }
  const minutes = unit === 'hour' ? n * 60 : n;
  if (minutes > 24 * 60) {
    showToast('Too long', 'Max 24 hours');
    return;
  }
  startFreeTimer(minutes);
}

function startFreeTimer(minutes) {
  const mins = minutes || 25;
  ACTIVE_TIMER = {
    taskId: null,
    title: 'Free focus · ' + mins + ' min',
    totalSeconds: mins * 60,
    remaining: mins * 60,
    free: true
  };
  remainingSeconds = ACTIVE_TIMER.remaining;
  navigate('focus');
  showToast('Focus started', mins + ' minute session');
  startTimerCountdown();
  updateMiniTimer();
  initTimerUI();
}

function snoozeTask(id){
  const task = TASKS.find(t=>t.id===id);
  if(!task) return;
  task.scheduledAt = new Date(Date.now()+15*60000).toISOString();
  task.status = 'scheduled';
  saveTasks();
  renderTasks();
  showToast('Snoozed','+15 minutes');
  updateNextUp();
}

/* Timer + Mini PiP */
function initTimerUI(){
  if(!ACTIVE_TIMER){
    document.getElementById('timer-empty')?.classList.remove('hidden');
    document.getElementById('timer-active')?.classList.add('hidden');
    updateMiniTimer();
    return;
  }
  document.getElementById('timer-empty')?.classList.add('hidden');
  document.getElementById('timer-active')?.classList.remove('hidden');
  document.getElementById('timer-task-title').textContent = ACTIVE_TIMER.title;
  updateTimerDisplay();
}
function updateTimerDisplay(){
  const timeEl = document.getElementById('timer-time');
  const progressEl = document.getElementById('timer-progress');
  if(timeEl) timeEl.textContent = formatTime(remainingSeconds);
  if(progressEl && ACTIVE_TIMER){
    const circumference = 2*Math.PI*120;
    progressEl.style.strokeDasharray = circumference;
    progressEl.style.strokeDashoffset = circumference*(1-remainingSeconds/ACTIVE_TIMER.totalSeconds);
  }
  updateMiniTimer();
  persistTimer();
}

function persistTimer() {
  if (ACTIVE_TIMER && remainingSeconds > 0) {
    localStorage.setItem('devflow_active_timer', JSON.stringify({
      ...ACTIVE_TIMER,
      remaining: remainingSeconds,
      savedAt: Date.now()
    }));
  } else {
    localStorage.removeItem('devflow_active_timer');
  }
}

function restoreTimer() {
  try {
    const raw = localStorage.getItem('devflow_active_timer');
    if (!raw) return;
    const data = JSON.parse(raw);
    const elapsed = Math.floor((Date.now() - data.savedAt) / 1000);
    const left = (data.remaining || 0) - elapsed;
    if (left <= 0) {
      localStorage.removeItem('devflow_active_timer');
      return;
    }
    ACTIVE_TIMER = {
      taskId: data.taskId || null,
      title: data.title || 'Focus',
      totalSeconds: data.totalSeconds,
      remaining: left,
      free: data.free
    };
    remainingSeconds = left;
    startTimerCountdown();
    updateMiniTimer();
    // show mini by default when restoring (user reopened site)
    const el = document.getElementById('mini-timer');
    if (el) el.classList.add('visible');
  } catch (e) {}
}

function updateMiniTimer(){
  const el = document.getElementById('mini-timer');
  if(!el) return;
  const onFocus = !document.getElementById('page-focus')?.classList.contains('hidden');
  if(ACTIVE_TIMER && remainingSeconds>0 && !onFocus){
    el.classList.add('visible');
    document.getElementById('mini-timer-time').textContent = formatTime(remainingSeconds);
    document.getElementById('mini-timer-title').textContent = ACTIVE_TIMER.title;
  } else el.classList.remove('visible');
}
function startTimerCountdown(){
  if(timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(()=>{
    if(remainingSeconds<=0){ clearInterval(timerInterval); completeSession(); return; }
    remainingSeconds--;
    if(ACTIVE_TIMER) ACTIVE_TIMER.remaining = remainingSeconds;
    updateTimerDisplay();
  },1000);
}
function pauseTimer(){
  if(timerInterval){ clearInterval(timerInterval); timerInterval=null; showToast('Paused','Resume when ready'); }
  else { startTimerCountdown(); showToast('Resumed','Back to focus'); }
}
function completeSession(){
  if(!ACTIVE_TIMER) return;
  const task = ACTIVE_TIMER.taskId ? TASKS.find(t=>t.id===ACTIVE_TIMER.taskId) : null;
  if(task) { task.status='completed'; saveTasks(); }
  showToast('Session complete', ACTIVE_TIMER.title);
  addActivity('Completed focus: '+ACTIVE_TIMER.title,'focus');
  const spent = Math.round((ACTIVE_TIMER.totalSeconds-remainingSeconds)/60);
  FOCUS_TODAY_MIN += Math.max(spent,1);
  localStorage.setItem('devflow_focus_today', String(FOCUS_TODAY_MIN));
  if(task && task.isLearningGoal && task.coinReward) addCoins(task.coinReward,'Learning goal: '+task.title);
  else if(task) addCoins(5,'Task completed');
  else addCoins(3,'Free focus session');
  ACTIVE_TIMER = null;
  remainingSeconds = 0;
  localStorage.removeItem('devflow_active_timer');
  renderTasks();
  updateStats();
  initTimerUI();
  updateMiniTimer();
}
function logDistraction(){ showToast('Logged','Distraction recorded'); }
function toggleFocusMode(){
  document.body.classList.toggle('focus-mode');
  const btn = document.getElementById('btn-zen');
  if(btn) btn.textContent = document.body.classList.contains('focus-mode')?'Exit Zen':'Zen Mode';
}

/* Notifications */
function updateNotifBadge(){
  const unread = NOTIFICATIONS.filter(n=>!n.read).length;
  const badge = document.getElementById('notif-badge');
  if(!badge) return;
  if(unread>0){ badge.textContent=unread; badge.classList.remove('hidden'); }
  else badge.classList.add('hidden');
}
function toggleNotifPanel(){
  const panel = document.getElementById('notif-panel');
  if(!panel) return;
  panel.classList.toggle('open');
  renderNotifications();
}
function renderNotifications(){
  const list = document.getElementById('notif-list');
  if(!list) return;
  if(!NOTIFICATIONS.length){ list.innerHTML='<div class="empty-state" style="padding:2rem 1rem"><p class="text-sm">No notifications</p></div>'; return; }
  list.innerHTML = NOTIFICATIONS.map((n,i)=>`
    <div class="notif-item ${n.read?'':'unread'}">
      <div style="flex:1">
        <div style="font-weight:600;font-size:0.875rem">${n.title}</div>
        <div class="text-xs text-muted" style="margin-top:0.15rem">${n.message}</div>
        ${n.type==='friend_request'&&!n.handled?`<div class="notif-actions"><button class="btn btn-sm btn-primary" onclick="acceptFriend(${i})">Accept</button><button class="btn btn-sm btn-outline" onclick="declineFriend(${i})">Decline</button></div>`:''}
      </div>
    </div>`).join('');
}
function addFriendRequest(fromName, fromHandle){
  NOTIFICATIONS.unshift({ id:'n'+Date.now(), type:'friend_request', title:'Friend Request', message:fromName+' (@'+fromHandle+') wants to connect', fromName, fromHandle, read:false, handled:false, time:Date.now() });
  saveNotifs(); updateNotifBadge();
  showToast('Friend Request', fromName+' sent you a request');
}
function acceptFriend(i){
  const n = NOTIFICATIONS[i]; if(!n) return;
  n.handled=true; n.read=true; n.message='You are now friends with '+n.fromName;
  FRIENDS.push({name:n.fromName,handle:n.fromHandle}); saveFriends(); saveNotifs();
  updateNotifBadge(); renderNotifications(); showToast('Friend added', n.fromName);
}
function declineFriend(i){
  const n = NOTIFICATIONS[i]; if(!n) return;
  n.handled=true; n.read=true; n.message='Declined request from '+n.fromName;
  saveNotifs(); updateNotifBadge(); renderNotifications();
}
function simulateFriendRequest(){
  if(!isLoggedIn) return;
  const names=[{name:'Jordan Lee',handle:'jordanlee'},{name:'Sam Okonkwo',handle:'samok'},{name:'Riley Quinn',handle:'rileyq'}];
  const pick=names[Math.floor(Math.random()*names.length)];
  if(!NOTIFICATIONS.some(n=>n.fromHandle===pick.handle&&!n.handled)) addFriendRequest(pick.name,pick.handle);
}

/* Messages badge */
function updateMsgBadge(){
  const badge=document.getElementById('msg-badge');
  if(!badge) return;
  if(UNREAD_CHATS>0){ badge.textContent=UNREAD_CHATS>9?'9+':String(UNREAD_CHATS); badge.classList.remove('hidden'); }
  else badge.classList.add('hidden');
}
function setUnreadChats(n){ UNREAD_CHATS=Math.max(0,n); localStorage.setItem('devflow_unread_chats',String(UNREAD_CHATS)); updateMsgBadge(); }
function simulateIncomingMessage(){ setUnreadChats(UNREAD_CHATS+1); showToast('New message','You have '+UNREAD_CHATS+' unread chat'+(UNREAD_CHATS>1?'s':'')); }

/* Search / empty pages */
function openSearch(){
  if(!isLoggedIn){ openModal('modal-auth'); return; }
  openModal('modal-search');
  document.getElementById('search-results').innerHTML='<div class="empty-state" style="padding:2rem 1rem"><p class="text-sm">Search by @handle or email</p><p class="text-xs text-muted" style="margin-top:0.5rem">Users appear after they register</p></div>';
  setTimeout(()=>document.getElementById('search-input')?.focus(),80);
}
function handleSearchInput(e){
  const q=e.target.value.trim();
  const c=document.getElementById('search-results');
  if(!q){ c.innerHTML='<div class="empty-state" style="padding:2rem 1rem"><p class="text-sm">Type a name or @handle</p></div>'; return; }
  c.innerHTML='<div class="empty-state" style="padding:2rem 1rem"><p class="text-sm">No results for "'+q+'"</p></div>';
}
function renderMessagesEmpty(){}


/* Charts */
function dayLabels(n) {
  const labels = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    labels.push(d.getDate().toString().padStart(2,'0') + '-' + (d.getMonth()+1).toString().padStart(2,'0'));
  }
  return labels;
}

function weekDayLabels() {
  const names = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  return names;
}

function buildSmoothPath(points, w, h, pad) {
  if (!points.length) return { line: '', area: '', coords: [], max: 1 };
  const max = Math.max(...points, 1);
  const step = (w - pad * 2) / Math.max(points.length - 1, 1);
  const coords = points.map((v, i) => {
    const x = pad + i * step;
    const y = h - pad - (v / max) * (h - pad * 2);
    return [x, y, v];
  });
  let line = 'M ' + coords[0][0] + ' ' + coords[0][1];
  for (let i = 1; i < coords.length; i++) {
    const [x0, y0] = coords[i - 1];
    const [x1, y1] = coords[i];
    const cx = (x0 + x1) / 2;
    line += ' C ' + cx + ' ' + y0 + ', ' + cx + ' ' + y1 + ', ' + x1 + ' ' + y1;
  }
  const area = line + ' L ' + coords[coords.length - 1][0] + ' ' + (h - pad) + ' L ' + coords[0][0] + ' ' + (h - pad) + ' Z';
  return { line, area, coords, max, step, pad, w, h };
}

function renderLineAreaChart(svgId, points, opts) {
  const svg = document.getElementById(svgId);
  if (!svg) return;
  const w = opts.w || 400, h = opts.h || 160, pad = 20;
  const color = opts.color || 'purple';
  const labels = opts.labels || dayLabels(points.length);
  const valueLabel = opts.valueLabel || 'value';
  const built = buildSmoothPath(points, w, h, pad);
  const { line, area, coords, step } = built;
  const stroke = color === 'pink' ? '#E879A9' : '#818CF8';
  const fillFrom = color === 'pink' ? 'rgba(232,121,169,0.45)' : 'rgba(129,140,248,0.4)';
  const fillTo = color === 'pink' ? 'rgba(232,121,169,0.02)' : 'rgba(129,140,248,0.02)';
  const gradId = 'grad-' + svgId;

  let grid = '';
  for (let i = 0; i < 4; i++) {
    const y = pad + i * ((h - pad * 2) / 3);
    grid += '<line class="chart-grid-line" x1="'+pad+'" y1="'+y+'" x2="'+(w-pad)+'" y2="'+y+'"/>';
  }

  // X-axis date labels (show subset to avoid clutter)
  let axisLabels = '';
  const labelEvery = Math.max(1, Math.ceil(labels.length / 6));
  labels.forEach((lab, i) => {
    if (i % labelEvery !== 0 && i !== labels.length - 1) return;
    const x = pad + i * step;
    axisLabels += '<text x="'+x+'" y="'+(h-4)+'" text-anchor="middle" class="chart-axis-label">'+lab+'</text>';
  });

  svg.innerHTML = `
    <defs>
      <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${fillFrom}"/>
        <stop offset="100%" stop-color="${fillTo}"/>
      </linearGradient>
    </defs>
    ${grid}
    <path d="${area}" style="fill:url(#${gradId});opacity:0.9"/>
    <path d="${line}" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <line id="${svgId}-cross" x1="0" y1="${pad}" x2="0" y2="${h-pad}" stroke="rgba(255,255,255,0.25)" stroke-width="1" visibility="hidden"/>
    <circle id="${svgId}-dot" r="5" fill="${stroke}" stroke="#18181B" stroke-width="2" visibility="hidden"/>
    <g id="${svgId}-tip" visibility="hidden">
      <rect id="${svgId}-tip-bg" x="0" y="0" width="88" height="42" rx="6" fill="#27272A" stroke="rgba(255,255,255,0.1)"/>
      <text id="${svgId}-tip-date" x="8" y="16" fill="#A1A1AA" font-size="10" font-family="Inter,system-ui,sans-serif"></text>
      <text id="${svgId}-tip-val" x="8" y="32" fill="#E4E4E7" font-size="11" font-family="Inter,system-ui,sans-serif"></text>
    </g>
    ${axisLabels}
    <rect x="0" y="0" width="${w}" height="${h}" fill="transparent" style="cursor:crosshair"
      data-chart="${svgId}" class="chart-hit"/>
  `;

  // Store data for hover
  svg._chartData = { coords, labels, valueLabel, pad, h, w, step };

  const hit = svg.querySelector('.chart-hit');
  if (hit) {
    hit.addEventListener('mousemove', (e) => onChartHover(e, svg));
    hit.addEventListener('mouseleave', () => onChartLeave(svg));
  }
}

function onChartHover(e, svg) {
  const data = svg._chartData;
  if (!data || !data.coords.length) return;
  const rect = svg.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * data.w;
  // nearest point
  let best = 0, bestDist = Infinity;
  data.coords.forEach((c, i) => {
    const d = Math.abs(c[0] - x);
    if (d < bestDist) { bestDist = d; best = i; }
  });
  const [cx, cy, val] = data.coords[best];
  const cross = document.getElementById(svg.id + '-cross');
  const dot = document.getElementById(svg.id + '-dot');
  const tip = document.getElementById(svg.id + '-tip');
  const tipDate = document.getElementById(svg.id + '-tip-date');
  const tipVal = document.getElementById(svg.id + '-tip-val');
  if (cross) {
    cross.setAttribute('x1', cx);
    cross.setAttribute('x2', cx);
    cross.setAttribute('visibility', 'visible');
  }
  if (dot) {
    dot.setAttribute('cx', cx);
    dot.setAttribute('cy', cy);
    dot.setAttribute('visibility', 'visible');
  }
  if (tip && tipDate && tipVal) {
    tipDate.textContent = data.labels[best] || '';
    tipVal.textContent = data.valueLabel + ': ' + (Math.round(val * 10) / 10);
    let tx = cx + 10;
    let ty = Math.max(data.pad, cy - 50);
    if (tx + 90 > data.w) tx = cx - 98;
    tip.setAttribute('transform', 'translate(' + tx + ',' + ty + ')');
    tip.setAttribute('visibility', 'visible');
  }
}

function onChartLeave(svg) {
  ['-cross','-dot','-tip'].forEach(s => {
    const el = document.getElementById(svg.id + s);
    if (el) el.setAttribute('visibility', 'hidden');
  });
}

function getFocusSeries() {
  const days = 14;
  const series = Array(days).fill(0);
  ACTIVITY.forEach(a => {
    if (a.type !== 'focus' && a.type !== 'done') return;
    const dayIdx = Math.min(days - 1, Math.floor((Date.now() - a.time) / 86400000));
    const i = days - 1 - dayIdx;
    if (i >= 0) series[i] += a.type === 'focus' ? 2 : 1;
  });
  if (series.every(v => v === 0)) return series.map((_, i) => (i === days - 1 ? 0.1 : 0));
  return series;
}

function getTasksSeries() {
  const days = 14;
  const series = Array(days).fill(0);
  TASKS.filter(t => t.status === 'completed').forEach((t, idx) => {
    const i = Math.min(days - 1, days - 1 - (idx % days));
    series[i] += 1;
  });
  return series;
}

function getWeekSeries() {
  const series = [0,0,0,0,0,0,0];
  const today = new Date().getDay();
  const monIndex = (today + 6) % 7;
  series[monIndex] = FOCUS_TODAY_MIN || 0;
  ACTIVITY.forEach(a => {
    if (a.type !== 'focus') return;
    const d = new Date(a.time);
    const idx = (d.getDay() + 6) % 7;
    series[idx] += 25;
  });
  return series;
}

function renderAnalyticsCharts() {
  const focus = getFocusSeries();
  const tasks = getTasksSeries();
  const week = getWeekSeries();
  renderLineAreaChart('chart-focus', focus, { color: 'purple', w: 400, h: 160, labels: dayLabels(14), valueLabel: 'activity' });
  renderLineAreaChart('chart-tasks', tasks, { color: 'purple', w: 400, h: 160, labels: dayLabels(14), valueLabel: 'tasks' });
  renderLineAreaChart('chart-week', week, { color: 'pink', w: 560, h: 180, labels: weekDayLabels(), valueLabel: 'minutes' });

  const fs = document.getElementById('chart-focus-summary');
  if (fs) fs.textContent = ACTIVITY.filter(a => a.type === 'focus').length + ' sessions';
  const ts = document.getElementById('chart-tasks-summary');
  if (ts) ts.textContent = TASKS.filter(t => t.status === 'completed').length + ' total';
  const ws = document.getElementById('chart-week-summary');
  if (ws) ws.textContent = (FOCUS_TODAY_MIN || 0) + 'm today';
}

function renderAnalyticsEmpty(){
  const hm=document.getElementById('heatmap');
  if(hm&&!hm.children.length){ let h=''; for(let i=0;i<53*7;i++) h+='<div class="heatmap-cell"></div>'; hm.innerHTML=h; }
  renderAnalyticsCharts();
}

/* Stats / activity / next up */
function updateStats(){
  const completed=TASKS.filter(t=>t.status==='completed').length;
  const delayed=TASKS.filter(t=>t.status==='delayed').length;
  const scheduled=TASKS.filter(t=>t.status==='scheduled'||t.status==='active').length;
  const onTime=completed===0?'—':Math.round((completed/Math.max(completed+delayed,1))*100)+'%';
  const el=(id,val)=>{ const e=document.getElementById(id); if(e) e.textContent=val; };
  el('stat-completed', completed);
  el('stat-streak', completed>0?Math.min(completed,7):0);
  el('stat-scheduled', scheduled);
  el('stat-delayed', delayed);
  el('stat-focus-today', FOCUS_TODAY_MIN>0?(FOCUS_TODAY_MIN>=60?Math.floor(FOCUS_TODAY_MIN/60)+'h '+(FOCUS_TODAY_MIN%60)+'m':FOCUS_TODAY_MIN+'m'):'0m');
  el('stat-ontime', onTime);
  updateNextUp();
  renderActivity();
  updateMsgBadge();
  updateGreeting();
  updateCoinsUI();
}
function updateGreeting(){
  const h=new Date().getHours();
  let g='Good evening';
  if(h<12) g='Good morning'; else if(h<18) g='Good afternoon';
  const name=currentUser?.displayName&&currentUser.displayName!=='Guest'?', '+currentUser.displayName.split(' ')[0]:'';
  const el=document.getElementById('dash-greeting');
  if(el) el.textContent=g+name;
  const sub=document.getElementById('dash-subtitle');
  if(sub){
    const upcoming=TASKS.filter(t=>t.status==='scheduled'||t.status==='active').length;
    sub.textContent=upcoming?upcoming+' task'+(upcoming>1?'s':'')+' on your schedule':'No tasks scheduled yet';
  }
}
function updateNextUp(){
  const next=TASKS.filter(t=>t.status==='scheduled'||t.status==='delayed'||t.status==='active').sort((a,b)=>new Date(a.scheduledAt)-new Date(b.scheduledAt))[0];
  const textEl=document.getElementById('next-up-text');
  const actions=document.getElementById('next-up-actions');
  if(!textEl) return;
  if(!next){ textEl.textContent='Nothing scheduled'; if(actions) actions.style.display='none'; return; }
  textEl.textContent=next.title+' · '+timeUntil(next.scheduledAt);
  if(actions){
    actions.style.display='flex';
    const s=document.getElementById('next-up-start');
    const z=document.getElementById('next-up-snooze');
    if(s) s.onclick=()=>startTask(next.id);
    if(z) z.onclick=()=>snoozeTask(next.id);
  }
}
function addActivity(text, type){
  ACTIVITY.unshift({text, type:type||'done', time:Date.now()});
  if(ACTIVITY.length>20) ACTIVITY=ACTIVITY.slice(0,20);
  localStorage.setItem('devflow_activity', JSON.stringify(ACTIVITY));
  renderActivity();
}
function renderActivity(){
  const feed=document.getElementById('activity-feed');
  if(!feed) return;
  if(!ACTIVITY.length){ feed.innerHTML='<div class="empty-state" style="padding:2rem 1rem"><p class="text-sm">No activity yet</p></div>'; return; }
  feed.innerHTML=ACTIVITY.slice(0,8).map(a=>{
    const ago=Math.max(1,Math.floor((Date.now()-a.time)/60000));
    const t=ago<60?ago+'m ago':Math.floor(ago/60)+'h ago';
    return '<div class="activity-row"><div class="activity-dot '+(a.type||'')+'"></div><div style="flex:1">'+a.text+'</div><span class="text-xs text-muted">'+t+'</span></div>';
  }).join('');
}

/* Certificates */
function renderCertificates(){
  const list=document.getElementById('cert-list');
  if(!list) return;
  if(!CERTIFICATES.length){ list.innerHTML='<p class="text-sm text-muted">No certificates yet</p>'; return; }
  list.innerHTML=CERTIFICATES.map((c,i)=>`
    <div class="glass-card cert-card">
      <div class="cert-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg></div>
      <div style="flex:1;min-width:0"><div style="font-weight:600;font-size:0.9rem">${c.title}</div><div class="text-xs text-muted">${c.issuer||'Certificate'}${c.year?' · '+c.year:''}</div></div>
      <button class="btn btn-ghost btn-sm" onclick="removeCert(${i})">Remove</button>
    </div>`).join('');
}
function addCertificate(e){
  e.preventDefault();
  const title=document.getElementById('cert-title').value.trim();
  const issuer=document.getElementById('cert-issuer').value.trim();
  const year=document.getElementById('cert-year').value.trim();
  if(!title) return;
  CERTIFICATES.unshift({title,issuer,year});
  localStorage.setItem('devflow_certs', JSON.stringify(CERTIFICATES));
  document.getElementById('form-cert')?.reset();
  renderCertificates();
  addCoins(15,'Certificate added');
}
function removeCert(i){
  CERTIFICATES.splice(i,1);
  localStorage.setItem('devflow_certs', JSON.stringify(CERTIFICATES));
  renderCertificates();
}

/* Terminal (optional) */
function applyTerminalPref(){
  const bar=document.getElementById('terminal-bar');
  if(!bar) return;
  if(TERMINAL_ENABLED && (isLoggedIn||currentUser)) bar.classList.add('open');
  else bar.classList.remove('open');
  const chk=document.getElementById('pref-terminal');
  if(chk) chk.checked=TERMINAL_ENABLED;
}
function toggleTerminalPref(checked){
  TERMINAL_ENABLED=!!checked;
  localStorage.setItem('devflow_terminal', TERMINAL_ENABLED?'true':'false');
  applyTerminalPref();
  showToast(TERMINAL_ENABLED?'Terminal on':'Terminal off', TERMINAL_ENABLED?'Type help':'Classic UI only');
}
function runTerminalCommand(raw){
  const cmd=(raw||'').trim().toLowerCase();
  if(!cmd) return;
  const input=document.getElementById('terminal-input');
  if(input) input.value='';
  if(cmd==='help'){ showToast('Commands','add <title> | start | done | focus | coins'); return; }
  if(cmd.startsWith('add ')){
    const title=raw.trim().slice(4);
    TASKS.unshift({id:'t'+Date.now(),title,scheduledAt:new Date(Date.now()+3600000).toISOString(),status:'scheduled',tech:[],estimated:60,projects:[],coinReward:5});
    saveTasks(); renderTasks(); updateStats(); showToast('Task added',title); return;
  }
  if(cmd==='start'){ const next=TASKS.find(t=>t.status==='scheduled'||t.status==='delayed'); if(next) startTask(next.id); else showToast('No task','Nothing to start'); return; }
  if(cmd==='done'||cmd==='complete'){ if(ACTIVE_TIMER) completeSession(); else showToast('No session','Start a timer first'); return; }
  if(cmd==='focus'){ navigate('focus'); return; }
  if(cmd==='coins'){ showToast('Balance', COINS+' coins'); return; }
  showToast('Unknown','Type help');
}

/* Init */
document.addEventListener('DOMContentLoaded',()=>{
  const saved=localStorage.getItem('devflow_user');
  if(isLoggedIn&&saved){ currentUser=JSON.parse(saved); updateUserUI(); showApp(); }
  else showLanding();
  restoreTimer();
  document.addEventListener('keydown',e=>{
    if((e.metaKey||e.ctrlKey)&&e.key==='k'){ e.preventDefault(); openSearch(); }
    if(e.key==='Escape'){ document.querySelectorAll('.modal-overlay.open').forEach(m=>m.classList.remove('open')); document.getElementById('notif-panel')?.classList.remove('open'); }
  });
  document.addEventListener('click',e=>{
    const panel=document.getElementById('notif-panel');
    const btn=document.getElementById('notif-btn');
    if(panel&&panel.classList.contains('open')&&!panel.contains(e.target)&&!btn?.contains(e.target)) panel.classList.remove('open');
  });
});

window.navigate=navigate; window.openModal=openModal; window.closeModal=closeModal;
window.openCreateTask=openCreateTask; window.submitCreateTask=submitCreateTask;
window.startTask=startTask;
window.startFreeTimer=startFreeTimer;
window.startFreeTimerFromInput=startFreeTimerFromInput; window.snoozeTask=snoozeTask;
window.openSearch=openSearch; window.handleSearchInput=handleSearchInput;
window.handleProfileClick=handleProfileClick; window.login=login;
window.confirmAvatar=confirmAvatar;
window.skipAvatar=skipAvatar;
window.onAvatarSelected=onAvatarSelected;
window.submitUsername=submitUsername;
window.startGoogleSignup=startGoogleSignup; window.logout=logout;
window.pauseTimer=pauseTimer; window.completeSession=completeSession;
window.logDistraction=logDistraction; window.toggleFocusMode=toggleFocusMode;
window.toggleNotifPanel=toggleNotifPanel; window.acceptFriend=acceptFriend; window.declineFriend=declineFriend;
window.simulateFriendRequest=simulateFriendRequest; window.showApp=showApp; window.enterGuest=enterGuest;
window.simulateIncomingMessage=simulateIncomingMessage; window.setUnreadChats=setUnreadChats;
window.submitOnboarding=submitOnboarding; window.toggleProject=toggleProject;
window.addCertificate=addCertificate; window.removeCert=removeCert;
window.toggleTerminalPref=toggleTerminalPref; window.runTerminalCommand=runTerminalCommand;
window.renderOnboardingChips=renderOnboardingChips;
