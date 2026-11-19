'use strict';
/* ========== Estado y utilidades ========== */
const KEY = 'personalfit-v1';
const $app = document.getElementById('app');
let S = load();
let tab = 'home';
let player = null;     // entrenamiento en curso
let toolTimer = null;  // intervalos de contadores

function load(){ try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch { return null; } }
function save(){ try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {} }
const pad = n => String(n).padStart(2,'0');
const keyOf = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const today = () => keyOf(new Date());
const addDays = (d,n) => { const x = new Date(d); x.setDate(x.getDate()+n); return x; };
const parseKey = k => { const [y,m,d] = k.split('-').map(Number); return new Date(y,m-1,d); };
const fmt = s => `${Math.floor(s/60)}:${pad(s%60)}`;
const pick = a => a[Math.floor(Math.random()*a.length)];
const day = k => (S.days[k] ||= {w:[], habits:{}});
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/* ========== Rachas, XP, mascota ========== */
const isDone = k => (S.days[k]?.w?.length || 0) > 0;
const isNeutral = d => d.getDay() === 0 || S.days[keyOf(d)]?.freeze; // domingo = descanso, o comodín
function streak(){
  let d = new Date(); let n = 0;
  if (!isDone(keyOf(d))) d = addDays(d,-1);
  const start = parseKey(S.created);
  while (d >= start) {
    const k = keyOf(d);
    if (isDone(k)) n++; else if (!isNeutral(d)) break;
    d = addDays(d,-1);
  }
  if (n > (S.best||0)) { S.best = n; save(); }
  return n;
}
function weekStart(d=new Date()){ const x = new Date(d); const g = (x.getDay()+6)%7; x.setDate(x.getDate()-g); x.setHours(0,0,0,0); return x; }
function freezeUsedThisWeek(){
  const ws = weekStart();
  for (let i=0;i<7;i++) if (S.days[keyOf(addDays(ws,i))]?.freeze) return true;
  return false;
}
const level = () => Math.floor(S.xp/200) + 1;
const xpInLevel = () => S.xp % 200;
function petStage(){ const l = level(); return l>=10?3 : l>=6?2 : l>=3?1 : 0; }
function lastWorkoutDaysAgo(){
  for (let i=0;i<60;i++) if (isDone(keyOf(addDays(new Date(),-i)))) return i;
  return 99;
}
function petMood(){
  if (isDone(today())) return 'done';
  const ago = lastWorkoutDaysAgo();
  return (ago >= 3 && ago !== 99) ? 'sad' : 'happy';
}
function petEmoji(){ return petArt(); }
function planWeek(){ return Math.min(8, Math.floor((new Date() - parseKey(S.created))/864e5/7) + 1); }
function planLevel(){ const w = planWeek(); return w<=3?1 : w<=6?2 : 3; }
function addXP(n){ const before = level(); S.xp += n; save(); return level() > before; }

function stats(){
  let total=0, minutes=0, perfectFood=0;
  for (const k in S.days){ const d=S.days[k]; total += d.w.length; minutes += d.w.reduce((a,b)=>a+(b.min||0),0); if (habitsDone(d)===HABITS.length) perfectFood++; }
  return {total, minutes, perfectFood, best:S.best||0, level:level()};
}
function habitsDone(d){ return HABITS.filter(h => h.count ? (d.habits[h.id]||0) >= h.goal : d.habits[h.id]).length; }

/* ========== Sonido / vibración ========== */
let actx;
function beep(f=880, ms=150){
  try { actx ||= new (window.AudioContext||window.webkitAudioContext)();
    const o = actx.createOscillator(), g = actx.createGain();
    o.frequency.value = f; o.connect(g); g.connect(actx.destination);
    g.gain.setValueAtTime(.25, actx.currentTime); g.gain.exponentialRampToValueAtTime(.001, actx.currentTime+ms/1000);
    o.start(); o.stop(actx.currentTime+ms/1000);
  } catch {}
}
const vibe = p => { try { navigator.vibrate && navigator.vibrate(p); } catch {} };
let wakeLock = null;
async function keepAwake(on){
  try { if (on && 'wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen');
        else if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; } } catch {}
}

/* ========== Navegación ========== */
document.getElementById('tabs').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  stopTool(); tab = b.dataset.tab; render(); window.scrollTo(0,0);
});
function render(){
  if (!S) return renderOnboarding();
  document.body.classList.toggle('in-player', !!player);
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab===tab));
  if (player) return renderPlayer();
  ({home:renderHome, train:renderTrain, tools:renderTools, food:renderFood, progress:renderProgress})[tab]();
}

/* ========== Onboarding ========== */
let ob = {type:'dog', name:''};
function renderOnboarding(){
  document.body.classList.add('in-player');
  $app.innerHTML = `
  <section class="onb">
    <div class="big-emoji bounce">${petArt(0,'happy',ob.type)}</div>
    <h1>¡Bienvenido a PersonalFit!</h1>
    <p class="muted">Elige a tu compañero. Crecerá y evolucionará contigo mientras entrenas.</p>
    <div class="pet-grid">
      ${Object.entries(PETS).map(([k,p])=>`
        <button class="pet-opt ${ob.type===k?'sel':''}" onclick="ob.type='${k}';renderOnboarding()">
          <span>${petArt(0,'happy',k)}</span>${p.name}</button>`).join('')}
    </div>
    <label class="field">¿Cómo se llamará?
      <input id="petname" maxlength="16" placeholder="Ej. Rocky" value="${esc(ob.name)}" oninput="ob.name=this.value"></label>
    <button class="btn primary block" onclick="finishOnboarding()">Empezar mi aventura 🚀</button>
  </section>`;
}
function finishOnboarding(){
  S = {pet:{type:ob.type, name:(ob.name.trim()||PETS[ob.type].name)}, xp:0, best:0, created:today(), days:{}, measures:[]};
  save(); document.body.classList.remove('in-player'); render();
}

/* ========== Inicio ========== */
function todayRoutine(){ const id = WEEK_PLAN[new Date().getDay()]; return id ? ROUTINES.find(r=>r.id===id) : null; }
function petCard(line){
  const mood = petMood();
  return `<div class="pet-card mood-${mood}">
    <div class="pet ${mood==='sad'?'sad':'bounce'}">${petEmoji()}</div>
    <div class="bubble">${esc(line || pick(PET_LINES[mood]))}</div>
    <div class="pet-name">${esc(S.pet.name)} · <span class="muted">${STAGE_NAMES[petStage()]}</span></div>
  </div>`;
}
function renderHome(){
  const st = streak(), r = todayRoutine(), done = isDone(today()), sunday = new Date().getDay()===0;
  const ws = weekStart();
  const canFreeze = !done && !sunday && !freezeUsedThisWeek() && !S.days[today()]?.freeze;
  const d = S.days[today()] || {w:[],habits:{}};
  $app.innerHTML = `
  <header class="top"><div><p class="muted">${DAY_NAMES[new Date().getDay()]} · Semana ${planWeek()} de 8</p><h1>¡Hola! 👋</h1></div>
    <div class="lvl-pill">Nv ${level()}</div></header>
  ${petCard()}
  <div class="streak-card">
    <div class="flame ${st?'on':''}">🔥</div>
    <div><div class="streak-n">${st} ${st===1?'día':'días'}</div><div class="muted">Racha actual · Mejor: ${S.best||0}</div></div>
  </div>
  <div class="week">${[...Array(7)].map((_,i)=>{ const dd=addDays(ws,i), k=keyOf(dd);
      const cls = isDone(k)?'done': S.days[k]?.freeze?'frz' : dd.getDay()===0?'rest' : k===today()?'now':'';
      return `<div class="wd ${cls}"><small>${'LMMJVSD'[i]}</small><b>${isDone(k)?'✓':S.days[k]?.freeze?'❄️':dd.getDay()===0?'😴':dd.getDate()}</b></div>`}).join('')}</div>
  <h2>Entreno de hoy</h2>
  ${done ? `<div class="card ok">✅ ¡Ya entrenaste hoy! Si quieres más, ve a <b>Entrenar</b>.</div>` :
    r ? routineCard(r, planLevel(), true) :
    `<div class="card">😴 <b>Domingo de descanso.</b> Tu racha está protegida. Estira, camina o haz el Express si te sobran ganas.</div>`}
  ${canFreeze ? `<button class="btn ghost block" onclick="useFreeze()">❄️ Usar comodín de la semana (descanso sin perder racha)</button>`:''}
  <h2>Alimentación de hoy</h2>
  <button class="card row" onclick="tab='food';render()"><span>🥗 ${habitsDone(d)}/${HABITS.length} hábitos · 💧 ${d.habits.water||0}/8</span><span>›</span></button>`;
}
function useFreeze(){
  if (!confirm('Solo tienes 1 comodín por semana. ¿Usarlo hoy?')) return;
  day(today()).freeze = true; save(); syncPush(); render();
}

/* ========== Entrenar ========== */
let selLevel = null;
function routineCard(r, lv, big){
  const mins = Math.round(routineSeconds(r,lv)/60);
  return `<div class="routine ${big?'big':''}" style="--c:${r.color}">
    <div class="r-head"><span class="r-emoji">${r.emoji}</span><div><h3>${r.name}</h3><p class="muted">${r.desc}</p></div></div>
    <div class="chips"><span>⏱️ ~${mins} min</span><span>🔁 ${r.rounds[lv-1]} rondas</span><span>📶 Nivel ${lv}</span></div>
    <div class="r-ex">${r.items.map(([e])=>EXERCISES[e].e).join(' ')}</div>
    <button class="btn primary block" onclick="startWorkout('${r.id}',${lv})">Empezar ▶</button>
  </div>`;
}
function routineSeconds(r,lv){
  const steps = buildSteps(r,lv);
  return steps.reduce((a,s)=>a+(s.kind==='reps'?s.val*3:s.secs||0),0);
}
function renderTrain(){
  const lv = selLevel || planLevel();
  $app.innerHTML = `
  <header class="top"><h1>Entrenar 💪</h1></header>
  <div class="seg">${[1,2,3].map(l=>`<button class="${l===lv?'sel':''}" onclick="selLevel=${l};renderTrain()">Nivel ${l}${l===planLevel()?' ★':''}</button>`).join('')}</div>
  <p class="muted small">★ = nivel recomendado por tu plan (semana ${planWeek()}/8). Sube de nivel cuando lo sientas fácil.</p>
  ${ROUTINES.map(r=>routineCard(r,lv)).join('')}
  <h2>Plan semanal</h2>
  <div class="card plan">${[1,2,3,4,5,6,0].map(d=>{const r=ROUTINES.find(x=>x.id===WEEK_PLAN[d]);
     return `<div class="row"><span>${DAY_NAMES[d]}</span><span>${r?r.emoji+' '+r.name:'😴 Descanso'}</span></div>`}).join('')}</div>
  <h2>Ejercicios</h2>
  ${Object.entries(EXERCISES).map(([id,x])=>`<details class="ex"><summary><span>${x.e}</span>${x.n}<b class="qbtn">?</b></summary>${demoSVG(id,'lg')}<p>${x.d}</p></details>`).join('')}`;
}

/* ========== Reproductor de entrenamiento ========== */
function buildSteps(r, lv){
  const steps = [{kind:'ready', secs:10, label:'Prepárate'}];
  const rounds = r.rounds[lv-1];
  for (let rd=0; rd<rounds; rd++){
    r.items.forEach(([ex,type,vals],i)=>{
      steps.push(type==='time' ? {kind:'time', ex, secs:vals[lv-1], round:rd, idx:i} : {kind:'reps', ex, val:vals[lv-1], round:rd, idx:i});
      const last = i===r.items.length-1;
      if (!last) steps.push({kind:'rest', secs:r.rest[lv-1], round:rd});
      else if (rd<rounds-1) steps.push({kind:'rest', secs:r.roundRest, round:rd, long:true});
    });
  }
  return steps;
}
function startWorkout(id, lv){
  const r = ROUTINES.find(x=>x.id===id);
  player = {r, lv, steps:buildSteps(r,lv), i:0, left:10, paused:false, reps:0, done:{}, started:Date.now(), line:pick(PET_LINES.work)};
  keepAwake(true); beep(660,80);
  clearInterval(player.t); player.t = setInterval(tick, 1000);
  render();
}
function cur(){ return player.steps[player.i]; }
function tick(){
  if (!player || player.paused) return;
  const s = cur();
  if (s.kind === 'reps') return;
  player.left--;
  if (player.left <= 3 && player.left > 0) beep(880,90);
  if (player.left <= 0) return nextStep();
  updatePlayerTime();
}
function nextStep(){
  const s = cur();
  if (s.kind==='time' || s.kind==='reps') player.done[`${s.round}-${s.idx}`] = true;
  player.i++;
  if (player.i >= player.steps.length) return finishWorkout();
  const n = cur();
  player.left = n.secs || 0; player.reps = 0;
  player.line = pick(n.kind==='rest' ? ['Respira profundo 😮‍💨','Toma agüita 💧','¡Vas increíble!','Descansa, ya viene lo bueno'] : PET_LINES.work);
  beep(n.kind==='rest'?520:1040, 300); vibe(n.kind==='rest'?[100]:[200,80,200]);
  renderPlayer();
}
function prevStep(){ if (player.i>1){ player.i--; player.left = cur().secs||0; player.reps=0; renderPlayer(); } }
function togglePause(){ player.paused = !player.paused; renderPlayer(); }
function quitWorkout(){
  if (!confirm('¿Salir del entrenamiento? No contará para tu racha.')) return;
  clearInterval(player.t); player = null; keepAwake(false); render();
}
function upcomingEx(){ for (let j=player.i+1;j<player.steps.length;j++){ const s=player.steps[j]; if (s.ex) return s; } return null; }
function renderPlayer(){
  const s = cur(), r = player.r, rounds = r.rounds[player.lv-1];
  const pct = Math.round(player.i / (player.steps.length-1) * 100);
  const nx = upcomingEx();
  let main;
  if (s.kind==='ready') main = `<div class="p-label">¡Prepárate!</div><div class="p-ex">${EXERCISES[nx.ex].e} ${EXERCISES[nx.ex].n}</div><div class="p-time" id="ptime">${player.left}</div>`;
  else if (s.kind==='rest') main = `<div class="p-label rest">${s.long?'Descanso entre rondas':'Descanso'}</div><div class="p-time" id="ptime">${fmt(player.left)}</div>${nx?`<div class="muted">Sigue: ${EXERCISES[nx.ex].e} ${EXERCISES[nx.ex].n}</div>${demoSVG(nx.ex,'sm')}<button class="howbtn" onclick="howTo('${nx.ex}')">❓ ¿Cómo se hace?</button>`:''}`;
  else if (s.kind==='time') main = `<div class="p-label">Ronda ${s.round+1}/${rounds}</div><div class="p-ex">${EXERCISES[s.ex].e} ${EXERCISES[s.ex].n}</div>${demoSVG(s.ex)}<div class="p-time" id="ptime">${fmt(player.left)}</div><button class="howbtn" onclick="howTo('${s.ex}')">❓ ¿Cómo se hace?</button>`;
  else main = `<div class="p-label">Ronda ${s.round+1}/${rounds}</div><div class="p-ex">${EXERCISES[s.ex].e} ${EXERCISES[s.ex].n}</div>
      <button class="rep-tap" onclick="player.reps++;beep(700,40);vibe(20);renderPlayer()"><b>${player.reps}</b><small>de ${s.val} reps · toca para contar</small></button>
      ${demoSVG(s.ex,'sm')}<button class="howbtn" onclick="howTo('${s.ex}')">❓ ¿Cómo se hace?</button>`;
  $app.innerHTML = `
  <section class="player ${s.kind}" style="--c:${r.color}">
    <div class="p-top"><button class="icon" onclick="quitWorkout()">✕</button><b>${r.emoji} ${r.name}</b><span>Nv ${player.lv}</span></div>
    <div class="bar"><i style="width:${pct}%"></i></div>
    <div class="p-pet"><span class="bounce">${petEmoji()}</span><div class="bubble sm">${esc(player.line)}</div></div>
    <div class="p-main">${main}</div>
    <div class="p-ctrl">
      <button class="icon" onclick="prevStep()">⏮</button>
      ${s.kind==='reps' ? `<button class="btn primary" onclick="nextStep()">Hecho ✓</button>` :
        `<button class="btn primary" onclick="togglePause()">${player.paused?'▶ Seguir':'⏸ Pausa'}</button>`}
      <button class="icon" onclick="nextStep()">⏭</button>
    </div>
    <h3>Checklist</h3>
    <ul class="check">${r.items.map(([ex,type,vals],i)=>`
      <li class="${s.idx===i&&s.ex?'cur':''}"><span>${EXERCISES[ex].e} ${EXERCISES[ex].n} <small class="muted">${type==='time'?vals[player.lv-1]+'s':vals[player.lv-1]+' reps'}</small></span>
      <span class="row"><button class="qbtn" onclick="howTo('${ex}')">?</button><span class="dots">${[...Array(rounds)].map((_,rd)=>`<i class="${player.done[rd+'-'+i]?'on':''}"></i>`).join('')}</span></span></li>`).join('')}
    </ul>
  </section>`;
}
function updatePlayerTime(){
  const el = document.getElementById('ptime'); if (!el) return;
  el.textContent = cur().kind==='ready' ? player.left : fmt(player.left);
}
function finishWorkout(){
  clearInterval(player.t); keepAwake(false);
  const min = Math.max(1, Math.round((Date.now()-player.started)/60000));
  const first = !isDone(today());
  day(today()).w.push({id:player.r.id, lv:player.lv, min});
  const gained = 50 + (first?0:-25) + player.lv*10;
  const up = addXP(gained);
  const before = new Set(S.ach||[]);
  S.ach = ACHIEVEMENTS.filter(a=>a.t(stats())).map(a=>a.id); save();
  const newAch = ACHIEVEMENTS.filter(a=>S.ach.includes(a.id) && !before.has(a.id));
  const r = player.r; player = null; syncPush();
  beep(784,150); setTimeout(()=>beep(1047,300),160); vibe([100,50,100,50,300]);
  document.body.classList.remove('in-player');
  $app.innerHTML = `
  <section class="finish">
    <div class="confetti">🎉</div>
    <div class="big-emoji bounce">${petEmoji()}</div>
    <h1>¡Entreno completado!</h1>
    <p>${r.emoji} ${r.name} · ${min} min</p>
    <div class="streak-card center"><div class="flame on">🔥</div><div><div class="streak-n">${streak()} ${streak()===1?"día":"días"}</div><div class="muted">de racha</div></div></div>
    <p class="xp">+${gained} XP ${up?`· <b>¡Subiste a nivel ${level()}!</b>`:''}</p>
    ${newAch.map(a=>`<div class="card ach-new">${a.e} <b>Logro desbloqueado:</b> ${a.n}</div>`).join('')}
    <button class="btn primary block" onclick="tab='home';render()">Volver al inicio</button>
  </section>`;
}

/* ========== Contadores ========== */
let tool = {sw:0, swOn:false, cd:60, cdLeft:60, cdOn:false, reps:0, iv:{work:40, rest:20, rounds:8}, ivState:null};
function stopTool(){ clearInterval(toolTimer); toolTimer=null; tool.swOn=false; tool.cdOn=false; tool.ivState=null; keepAwake(false); }
function renderTools(){
  const iv = tool.ivState;
  $app.innerHTML = `
  <header class="top"><h1>Contadores ⏱️</h1></header>
  <div class="card tool">
    <h3>🔢 Contador de repeticiones</h3>
    <button class="rep-tap" onclick="tool.reps++;beep(700,40);vibe(20);renderTools()"><b>${tool.reps}</b><small>toca para sumar</small></button>
    <div class="row gap"><button class="btn ghost" onclick="tool.reps=Math.max(0,tool.reps-1);renderTools()">−1</button><button class="btn ghost" onclick="tool.reps=0;renderTools()">Reiniciar</button></div>
  </div>
  <div class="card tool">
    <h3>⏲️ Temporizador</h3>
    <div class="t-big">${fmt(tool.cdLeft)}</div>
    <div class="chips sel">${[30,45,60,90,120,300].map(s=>`<button class="${tool.cd===s?'on':''}" onclick="setCd(${s})">${s<60?s+'s':s/60+'m'}</button>`).join('')}</div>
    <div class="row gap"><button class="btn primary" onclick="toggleCd()">${tool.cdOn?'⏸ Pausa':'▶ Iniciar'}</button><button class="btn ghost" onclick="setCd(tool.cd)">Reiniciar</button></div>
  </div>
  <div class="card tool">
    <h3>⏱️ Cronómetro</h3>
    <div class="t-big">${fmt(Math.floor(tool.sw))}</div>
    <div class="row gap"><button class="btn primary" onclick="toggleSw()">${tool.swOn?'⏸ Pausa':'▶ Iniciar'}</button><button class="btn ghost" onclick="tool.sw=0;renderTools()">Reiniciar</button></div>
  </div>
  <div class="card tool">
    <h3>🔁 Intervalos (tipo Tabata)</h3>
    ${iv ? `<div class="p-label ${iv.phase==='rest'?'rest':''}">${iv.phase==='work'?'¡TRABAJA!':'Descansa'} · ${iv.round}/${tool.iv.rounds}</div><div class="t-big">${fmt(iv.left)}</div>
       <button class="btn ghost block" onclick="stopTool();renderTools()">Detener</button>` : `
    <div class="iv-grid">
      ${['work','rest','rounds'].map(f=>`<label>${{work:'Trabajo (s)',rest:'Descanso (s)',rounds:'Rondas'}[f]}
        <div class="stepper"><button onclick="tool.iv.${f}=Math.max(1,tool.iv.${f}-${f==='rounds'?1:5});renderTools()">−</button><b>${tool.iv[f]}</b><button onclick="tool.iv.${f}+=${f==='rounds'?1:5};renderTools()">+</button></div></label>`).join('')}
    </div>
    <button class="btn primary block" onclick="startIv()">▶ Iniciar intervalos</button>`}
  </div>`;
}
function setCd(s){ clearInterval(toolTimer); tool.cdOn=false; tool.cd=s; tool.cdLeft=s; renderTools(); }
function toggleCd(){
  if (tool.cdOn){ clearInterval(toolTimer); tool.cdOn=false; return renderTools(); }
  stopTool(); tool.cdOn = true; if (tool.cdLeft<=0) tool.cdLeft = tool.cd;
  toolTimer = setInterval(()=>{ tool.cdLeft--; if (tool.cdLeft<=3&&tool.cdLeft>0) beep(880,90);
    if (tool.cdLeft<=0){ stopTool(); beep(1040,500); vibe([300,100,300]); } if (tab==='tools') renderTools(); },1000);
  renderTools();
}
function toggleSw(){
  if (tool.swOn){ clearInterval(toolTimer); tool.swOn=false; return renderTools(); }
  stopTool(); tool.swOn = true; const base = Date.now() - tool.sw*1000;
  toolTimer = setInterval(()=>{ tool.sw=(Date.now()-base)/1000; if (tab==='tools') renderTools(); },250);
  renderTools();
}
function startIv(){
  stopTool(); keepAwake(true);
  tool.ivState = {phase:'work', round:1, left:tool.iv.work}; beep(1040,300);
  toolTimer = setInterval(()=>{ const s = tool.ivState; s.left--;
    if (s.left<=3&&s.left>0) beep(880,90);
    if (s.left<=0){
      if (s.phase==='work'){ if (s.round>=tool.iv.rounds){ stopTool(); beep(1047,600); vibe([200,100,200,100,400]); return renderTools(); }
        s.phase='rest'; s.left=tool.iv.rest; beep(520,300); vibe(150); }
      else { s.phase='work'; s.round++; s.left=tool.iv.work; beep(1040,300); vibe([200,80,200]); }
    }
    if (tab==='tools') renderTools(); },1000);
  renderTools();
}

/* ========== Alimentación ========== */
function renderFood(){
  const d = day(today());
  const m = [...S.measures].sort((a,b)=>a.d<b.d?-1:1);
  $app.innerHTML = `
  <header class="top"><h1>Alimentación 🥗</h1><div class="lvl-pill">${habitsDone(d)}/${HABITS.length}</div></header>
  <p class="muted small">Cada hábito cumplido da +5 XP. No contamos calorías: solo buenos hábitos.</p>
  <ul class="habits">${HABITS.map(h=> h.count ? `
    <li class="${(d.habits[h.id]||0)>=h.goal?'on':''}"><span>${h.e} ${h.n}</span>
      <div class="stepper"><button onclick="habitCount('${h.id}',-1)">−</button><b>${d.habits[h.id]||0}/${h.goal}</b><button onclick="habitCount('${h.id}',1)">+</button></div></li>` : `
    <li class="${d.habits[h.id]?'on':''}" onclick="habitToggle('${h.id}')"><span>${h.e} ${h.n}</span><span class="tick">${d.habits[h.id]?'✓':''}</span></li>`).join('')}
  </ul>
  <h2>Medidas semanales</h2>
  <p class="muted small">Mídete 1 vez por semana, en ayunas. La cintura es el mejor indicador de grasa corporal.</p>
  <div class="card">
    <div class="iv-grid two">
      <label>Peso (kg)<input id="mw" type="number" inputmode="decimal" step="0.1"></label>
      <label>Cintura (cm)<input id="mc" type="number" inputmode="decimal" step="0.5"></label>
    </div>
    <button class="btn primary block" onclick="addMeasure()">Guardar medida</button>
  </div>
  ${m.length ? `
    <div class="card"><h3>⚖️ Peso</h3>${chart(m.filter(x=>x.weight).map(x=>[x.d,x.weight]),'kg')}</div>
    <div class="card"><h3>📏 Cintura</h3>${chart(m.filter(x=>x.waist).map(x=>[x.d,x.waist]),'cm')}</div>
    <div class="card list">${m.slice().reverse().map(x=>`<div class="row"><span>${x.d}</span><span>${x.weight?x.weight+' kg':''} ${x.waist?'· '+x.waist+' cm':''}</span><button class="icon sm" onclick="delMeasure('${x.d}')">🗑</button></div>`).join('')}</div>` : ''}`;
}
function habitToggle(id){ const d=day(today()); d.habits[id]=!d.habits[id]; addXP(d.habits[id]?5:-5); renderFood(); }
function habitCount(id,n){ const d=day(today()), h=HABITS.find(x=>x.id===id); const was=(d.habits[id]||0)>=h.goal;
  d.habits[id]=Math.max(0,(d.habits[id]||0)+n); const now=d.habits[id]>=h.goal; if(now!==was) addXP(now?5:-5); else save(); renderFood(); }
function addMeasure(){
  const w = parseFloat(document.getElementById('mw').value), c = parseFloat(document.getElementById('mc').value);
  if (!w && !c) return alert('Escribe tu peso o tu cintura.');
  S.measures = S.measures.filter(x=>x.d!==today());
  S.measures.push({d:today(), weight:w||null, waist:c||null}); save(); renderFood();
}
function delMeasure(d){ S.measures = S.measures.filter(x=>x.d!==d); save(); renderFood(); }
function chart(pts, unit){
  if (pts.length < 2) return `<p class="muted small">${pts.length? `Actual: <b>${pts[0][1]} ${unit}</b>. `:''}Agrega 2+ medidas para ver la gráfica.</p>`;
  const W=320,H=120,P=8, v=pts.map(p=>p[1]), mn=Math.min(...v), mx=Math.max(...v), rg=(mx-mn)||1;
  const xy = pts.map((p,i)=>[P+i*(W-2*P)/(pts.length-1), H-P-(p[1]-mn)/rg*(H-2*P)]);
  const diff = (v.at(-1)-v[0]).toFixed(1);
  return `<svg viewBox="0 0 ${W} ${H}" class="chart"><polyline fill="none" stroke="var(--accent)" stroke-width="3" stroke-linejoin="round" points="${xy.map(p=>p.join(',')).join(' ')}"/>
    ${xy.map(p=>`<circle cx="${p[0]}" cy="${p[1]}" r="4" fill="var(--accent)"/>`).join('')}</svg>
    <p class="small">Actual <b>${v.at(-1)} ${unit}</b> · Cambio total <b class="${diff<=0?'good':'bad'}">${diff>0?'+':''}${diff} ${unit}</b></p>`;
}

/* ========== Progreso ========== */
function renderProgress(){
  const st = stats(); streak();
  const start = addDays(weekStart(), -7*15);
  const cells = [...Array(16*7)].map((_,i)=>{ const d=addDays(start,i), k=keyOf(d), f=d>new Date();
    const n = S.days[k]?.w?.length||0; return `<i class="${f?'fut':n>1?'l2':n?'l1':S.days[k]?.freeze?'frz':''}" title="${k}"></i>`; }).join('');
  const nextStage = [3,6,10][petStage()];
  $app.innerHTML = `
  <header class="top"><h1>Progreso 📈</h1></header>
  <div class="card lvl">
    <div class="row"><b>Nivel ${level()}</b><span class="muted">${xpInLevel()}/200 XP</span></div>
    <div class="bar"><i style="width:${xpInLevel()/2}%"></i></div>
  </div>
  <div class="stats">
    <div><b>${streak()}</b><small>Racha 🔥</small></div><div><b>${S.best||0}</b><small>Mejor racha</small></div>
    <div><b>${st.total}</b><small>Entrenos</small></div><div><b>${st.minutes}</b><small>Minutos</small></div>
  </div>
  <h2>Calendario</h2>
  <div class="card"><div class="heat">${cells}</div><p class="muted small">Últimas 16 semanas · naranja = entrenaste · azul = comodín</p></div>
  <h2>Tu compañero</h2>
  <div class="card pet-info">
    <div class="evo">${PETS[S.pet.type].stages.map((e,i)=>`<div class="${i<=petStage()?'':'locked'}"><span>${i<=petStage()?petArt(i,'happy'):'❔'}</span><small>${STAGE_NAMES[i]}</small></div>`).join('<b>→</b>')}</div>
    <p class="small">${nextStage?`${esc(S.pet.name)} evoluciona al llegar a <b>nivel ${nextStage}</b>.`:`¡${esc(S.pet.name)} alcanzó su forma épica! 👑`}</p>
    <button class="btn ghost" onclick="renamePet()">✏️ Cambiar nombre</button>
  </div>
  <h2>Logros</h2>
  <div class="ach">${ACHIEVEMENTS.map(a=>{const ok=a.t(st);return `<div class="${ok?'on':''}"><span>${ok?a.e:'🔒'}</span><b>${a.n}</b><small>${a.d}</small></div>`}).join('')}</div>
  ${notifCard()}
  <h2>Respaldo</h2>
  <p class="muted small">Tus datos se guardan solo en este celular. Descarga un respaldo de vez en cuando.</p>
  <div class="row gap"><button class="btn ghost" onclick="exportData()">⬇️ Exportar</button>
    <label class="btn ghost">⬆️ Importar<input type="file" accept="application/json" hidden onchange="importData(this)"></label></div>
  <button class="btn danger block" onclick="resetAll()">Borrar todo y empezar de cero</button>`;
}
function renamePet(){ const n = prompt('Nuevo nombre:', S.pet.name); if (n&&n.trim()){ S.pet.name=n.trim().slice(0,16); save(); syncPush(); render(); } }
function exportData(){
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(S)],{type:'application/json'}));
  a.download = `personalfit-${today()}.json`; a.click();
}
function importData(inp){
  const f = inp.files[0]; if (!f) return;
  f.text().then(t=>{ const d = JSON.parse(t); if (!d.pet||!d.days) throw 0; S=d; save(); render(); alert('¡Respaldo restaurado!'); })
   .catch(()=>alert('Archivo no válido.'));
}
function resetAll(){ if (confirm('¿Seguro? Se borrará todo tu progreso.') && confirm('Última confirmación: ¿borrar todo?')) { localStorage.removeItem(KEY); S=null; tab='home'; render(); } }

/* ========== Inicio de la app ========== */
document.addEventListener('visibilitychange', ()=>{ if (!document.hidden && player) keepAwake(true); });
if ('serviceWorker' in navigator) window.addEventListener('load', ()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
render();

/* ========== Demostración y "¿Cómo se hace?" ========== */
function demoSVG(id, size=''){
  const [A,B,prop] = DEMOS[id] || [STAND_F, STAND_F];
  const vals = idx => { const a = idx.map(i=>A[i].join(',')).join(' '), b = idx.map(i=>B[i].join(',')).join(' '); return `${a};${b};${a}`; };
  const anim = (attr, v) => `<animate attributeName="${attr}" values="${v}" dur="1.8s" repeatCount="indefinite" calcMode="spline" keyTimes="0;.5;1" keySplines=".45 0 .55 1;.45 0 .55 1"/>`;
  const line = idx => `<polyline points="${idx.map(i=>A[i].join(',')).join(' ')}">${anim('points', vals(idx))}</polyline>`;
  const props = prop==='chair' ? '<path d="M18 58h22M22 58v37M36 58v37" class="prop"/>' : prop==='wall' ? '<path d="M28 5v90" class="prop"/>' : '';
  return `<svg viewBox="0 0 100 100" class="demo ${size}" aria-label="Demostración">
    <path d="M2 95.5h96" class="floor"/>${props}
    <g class="fig">${line([2,1])}${line([2,3,4])}${line([2,5,6])}${line([1,7,8])}${line([1,9,10])}
    <circle r="7" cx="${A[0][0]}" cy="${A[0][1]}">${anim('cx',`${A[0][0]};${B[0][0]};${A[0][0]}`)}${anim('cy',`${A[0][1]};${B[0][1]};${A[0][1]}`)}</circle></g></svg>`;
}
function howTo(id){
  const x = EXERCISES[id];
  const wasRunning = player && !player.paused;
  if (wasRunning) player.paused = true;
  const m = document.createElement('div');
  m.className = 'modal';
  m.innerHTML = `<div class="sheet"><div class="grab"></div>
    <h2>${x.e} ${x.n}</h2>${demoSVG(id,'lg')}
    <h3>¿Cómo se hace?</h3><p>${x.d}</p>
    <button class="btn primary block">Entendido${wasRunning?' · seguir':''}</button></div>`;
  const close = () => { m.remove(); if (wasRunning && player){ player.paused = false; renderPlayer(); } };
  m.addEventListener('click', e => { if (e.target===m || e.target.closest('.btn')) close(); });
  document.body.appendChild(m);
  if (player) renderPlayer();
}

/* ========== Gatita calicó dibujada (SVG animado) ========== */
var catUid = 0;
function catSVG(stage=0, mood='happy'){
  const u = 'c'+(++catUid);
  const sc = [0.8,0.88,0.95,1][stage];
  const W='#fbf7f2', O='#e9964a', K='#4a3b33', L='#6b5a4e', LINE='#3a2c25';
  const stripes = (x,y,n,dx,len,rot=0) => [...Array(n)].map((_,i)=>`<path d="M${x+i*dx} ${y}q2 ${len/2} 0 ${len}" stroke="${K}" stroke-width="2.6" fill="none" stroke-linecap="round" transform="rotate(${rot} ${x} ${y})"/>`).join('');
  let eyes;
  if (mood==='done') eyes = `<path d="M43 58q6-6 12 0M65 58q6-6 12 0" stroke="${LINE}" stroke-width="2.8" fill="none" stroke-linecap="round"/>`;
  else if (mood==='sad') eyes = `<path d="M43 57q6 4 12 1M65 58q6 3 12-1" stroke="${LINE}" stroke-width="2.8" fill="none" stroke-linecap="round"/>
     <path d="M45 61q-1.5 5 .5 8" stroke="#7cc8ff" stroke-width="2.6" fill="none" stroke-linecap="round"><animate attributeName="opacity" values="0;1;1;0" dur="2.6s" repeatCount="indefinite"/></path>`;
  else eyes = `<g class="blink">
     <ellipse cx="49" cy="57" rx="6" ry="7" fill="#7bb661"/><ellipse cx="71" cy="57" rx="6" ry="7" fill="#7bb661"/>
     <ellipse cx="49" cy="57.5" rx="2.6" ry="5.6" fill="${LINE}"/><ellipse cx="71" cy="57.5" rx="2.6" ry="5.6" fill="${LINE}"/>
     <circle cx="51" cy="54.5" r="1.9" fill="#fff"/><circle cx="73" cy="54.5" r="1.9" fill="#fff"/></g>`;
  const mouth = mood==='sad' ? `<path d="M56 72q4-3 8 0" stroke="${LINE}" stroke-width="2" fill="none" stroke-linecap="round"/>`
                             : `<path d="M60 67v2.5M55.5 69.5q2.2 3 4.5 0q2.3 3 4.5 0" stroke="${LINE}" stroke-width="2" fill="none" stroke-linecap="round"/>`;
  const droop = mood==='sad' ? 16 : 0;
  const acc = [
    '',
    `<path d="M41 83q19 7 38 0" stroke="#ff7aa2" stroke-width="5" fill="none" stroke-linecap="round"/><circle cx="60" cy="88" r="3.6" fill="#ffd166" stroke="#d9a400"/>`,
    `<path d="M41 83q19 7 38 0" stroke="#5aa9ff" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M72 30l9-6 1 10zM72 30l-2 11 9-2z" fill="#ff7aa2"/><circle cx="74" cy="32" r="2.4" fill="#ff4d85"/>`,
    `<path d="M41 83q19 7 38 0" stroke="#a66bff" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M47 30l4-11 5 7 4-10 4 10 5-7 4 11z" fill="#ffd166" stroke="#d9a400" stroke-width="1.4" stroke-linejoin="round"/><circle cx="60" cy="22" r="2" fill="#ff4d85"/>`,
  ][stage];
  return `<svg class="cat" viewBox="0 0 120 120" width="1em" height="1em" aria-label="Gatita">
  <defs>
    <clipPath id="${u}h"><path d="M30 58q0-28 30-29q30 1 30 29q2 8-4 14l4 3-8 1q-8 9-22 9t-22-9l-8-1 4-3q-6-6-4-14z"/></clipPath>
    <clipPath id="${u}b"><path d="M28 104q-4-30 32-32q36 2 32 32q0 9-32 9t-32-9z"/></clipPath>
  </defs>
  <g transform="translate(60 116) scale(${sc}) translate(-60 -116)">
   <g class="tail"><path d="M88 104q24 2 24-18q0-12 8-16" stroke="${W}" stroke-width="12" fill="none" stroke-linecap="round"/>
     <path d="M100 98q8-3 11-12M110 82q1-6 5-10" stroke="${K}" stroke-width="12" fill="none" stroke-linecap="round" opacity=".9"/>
     <path d="M104 96l5 3M110 88l5 1M112 79l4-1" stroke="${O}" stroke-width="3" stroke-linecap="round"/></g>
   <g class="breathe">
    <path d="M28 104q-4-30 32-32q36 2 32 32q0 9-32 9t-32-9z" fill="${W}"/>
    <g clip-path="url(#${u}b)">
      <path d="M62 70q30-2 32 22q-12 4-20-6q-8-8-12-16z" fill="${O}"/>
      <path d="M80 86q14 0 16 18l-10 6q-6-12-6-24z" fill="${L}"/>${stripes(82,90,3,4,10,-10)}
      <path d="M24 92q8-10 16-6q-4 12-14 16z" fill="${L}"/>${stripes(27,92,2,5,8,20)}
    </g>
    <ellipse cx="46" cy="111" rx="8" ry="4.5" fill="${W}" stroke="#e8ddd2"/><ellipse cx="74" cy="111" rx="8" ry="4.5" fill="${W}" stroke="#e8ddd2"/>
   </g>
   <g transform="rotate(${-droop} 42 44)"><path d="M31 52l1-36 26 18z" fill="${O}"/><path d="M36 44l1-20 14 11z" fill="#f7b6b0"/><path d="M37 30l-4-5M41 33l-3-6" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/></g>
   <g transform="rotate(${droop} 78 44)"><g class="ear-r"><path d="M89 52l-1-36-26 18z" fill="${K}"/><path d="M84 44l-1-20-14 11z" fill="#f7b6b0"/><path d="M83 30l4-5M79 33l3-6" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/></g></g>
   <path d="M30 58q0-28 30-29q30 1 30 29q2 8-4 14l4 3-8 1q-8 9-22 9t-22-9l-8-1 4-3q-6-6-4-14z" fill="${W}"/>
   <g clip-path="url(#${u}h)">
     <path d="M26 26h34v12q-4 10-12 12q-8 1-10 10l-12 2z" fill="${O}"/>
     <path d="M62 26h34v40q-8 0-12-6q-4-8-14-10q-6-6-8-24z" fill="${L}"/>
     ${stripes(66,30,4,5,12,8)}${stripes(84,52,2,4,8,-30)}
     <path d="M80 60q8 2 12 8l-6 6q-4-6-6-14z" fill="${O}"/>
   </g>
   <path d="M38 64q-2 4 0 8M82 64q2 4 0 8" stroke="#fff" stroke-width="1.5" opacity=".7"/>
   ${eyes}
   <ellipse cx="42" cy="66" rx="4.5" ry="2.6" fill="#ff9fb0" opacity=".55"/><ellipse cx="78" cy="66" rx="4.5" ry="2.6" fill="#ff9fb0" opacity=".55"/>
   <path d="M57.5 63.5h5l-2.5 3z" fill="#f08a9a"/>
   ${mouth}
   <path d="M44 66l-14-2M44 69l-13 3M76 66l14-2M76 69l13 3" stroke="#b9aca0" stroke-width="1" stroke-linecap="round"/>
   ${acc}
  </g></svg>`;
}
function petArt(stage=petStage(), mood=petMood(), type=S?.pet?.type){
  return type==='cat' ? catSVG(stage, mood) : PETS[type].stages[stage];
}

/* ========== Notificaciones (Supabase + Web Push) ========== */
const PUSH_URL = 'https://oqkprxynywejxhkftcjw.supabase.co/functions/v1/sync';
const VAPID_PUBLIC = 'BMUVMgrQx4LfNUg1dLZAjpY6loGokj_h1hFaA4K23pusWT6toC-1S5UTY7mpfPN1VvE_1QU3tzWNkcOZlRh94YA';
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
function deviceId(){ if (!S.deviceId){ S.deviceId = crypto.randomUUID(); save(); } return S.deviceId; }
function lastWorkoutDate(){ for (let i=0;i<400;i++){ const k=keyOf(addDays(new Date(),-i)); if (isDone(k)) return k; } return null; }
function pushState(){
  return { device_id: deviceId(), remind_hour: S.notif?.hour ?? 19, tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    last_workout: lastWorkoutDate(), skip_date: S.days[today()]?.freeze ? today() : null,
    streak: streak(), pet_name: S.pet.name, enabled: !!S.notif?.on };
}
async function postPush(body){
  const r = await fetch(PUSH_URL, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)});
  if (!r.ok) throw new Error('HTTP '+r.status);
  return r.json();
}
function syncPush(){ if (S?.notif?.on) postPush(pushState()).catch(()=>{}); }
function b64ToBytes(b){ const p='='.repeat((4-b.length%4)%4); const r=atob((b+p).replace(/-/g,'+').replace(/_/g,'/')); return Uint8Array.from(r,c=>c.charCodeAt(0)); }
async function enableNotifs(){
  if (!pushSupported() || !isStandalone()) {
    return alert('Para recibir notificaciones en iPhone:\n\n1. Abre la app en Safari\n2. Toca Compartir (□↑)\n3. "Agregar a pantalla de inicio"\n4. Abre la app desde ese ícono y activa aquí las notificaciones.\n\n(Necesitas iOS 16.4 o más nuevo)');
  }
  try {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return alert('No diste permiso. Puedes activarlo en Ajustes → Notificaciones → PersonalFit.');
    const reg = await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({userVisibleOnly:true, applicationServerKey:b64ToBytes(VAPID_PUBLIC)});
    S.notif = {on:true, hour:S.notif?.hour ?? 19}; save();
    await postPush({...pushState(), subscription: sub.toJSON()});
    render(); alert('¡Listo! 🔔 Te avisaré a las '+S.notif.hour+':00 si no has entrenado.');
  } catch (e) { alert('No se pudo activar: '+e.message); }
}
async function disableNotifs(){
  S.notif = {...S.notif, on:false}; save();
  postPush({device_id:deviceId(), enabled:false}).catch(()=>{}); render();
}
function setNotifHour(h){ S.notif = {...(S.notif||{}), hour:+h}; save(); syncPush(); }
async function testNotif(){
  try { const r = await postPush({...pushState(), test:true}); alert(r.ok ? 'Enviada 📨 Revisa tus notificaciones.' : 'Tu suscripción expiró, desactiva y vuelve a activar.'); }
  catch(e){ alert('Error: '+e.message); }
}
function notifCard(){
  const on = !!S.notif?.on, h = S.notif?.hour ?? 19;
  return `<h2>Notificaciones 🔔</h2>
  <div class="card">
    <p class="small muted" style="margin-top:0">${esc(S.pet.name)} te avisa a tu hora si aún no entrenaste (no los domingos ni con comodín).</p>
    <label class="field">Hora del recordatorio
      <select onchange="setNotifHour(this.value)">${[...Array(24)].map((_,i)=>`<option value="${i}" ${i===h?'selected':''}>${pad(i)}:00</option>`).join('')}</select></label>
    ${on ? `<div class="row gap"><button class="btn ghost" onclick="testNotif()">📨 Probar</button><button class="btn ghost" onclick="disableNotifs()">🔕 Desactivar</button></div>`
         : `<button class="btn primary block" onclick="enableNotifs()">🔔 Activar notificaciones</button>`}
  </div>`;
}
if (S) syncPush(); // al abrir la app, actualiza racha/último entreno en el servidor
