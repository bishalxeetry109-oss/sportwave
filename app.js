const DAMITV_API = 'https://dami-tv.pro/papi/api/streams';
const params = new URLSearchParams(location.search);

let cache = null;
async function fetchMatches() {
  if (cache) return cache;
  const res = await fetch(DAMITV_API);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const data = await res.json();
  const categories = Array.isArray(data) ? data
    : Array.isArray(data.streams) ? data.streams
    : Array.isArray(data.data) ? data.data : [];

  const matches = [];
  categories.forEach((cat, ci) => {
    const catName = cat.category || cat.name || cat.title || '';
    const sport = detectSport(catName);
    const list = cat.streams || cat.events || cat.matches || [];
    if (list.length) {
      list.forEach((m, i) => {
        const url = pickUrl(m);
        if (!url) return;
        matches.push({
          id: String(m.id || m.idEvent || ci + '-' + i),
          name: pickName(m, catName || 'Live Match'),
          url, sport, category: catName
        });
      });
    } else {
      const url = pickUrl(cat);
      if (url) matches.push({
        id: String(cat.id || 'cat-' + ci),
        name: pickName(cat, catName || 'Live Match'),
        url, sport, category: catName
      });
    }
  });
  cache = matches;
  return matches;
}

function detectSport(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('football') || n.includes('soccer')) return 'football';
  if (n.includes('basketball') || n.includes('nba')) return 'basketball';
  if (n.includes('cricket') || n.includes('ipl') || n.includes('t20')) return 'cricket';
  return 'other';
}
function pickName(x, fb) { return x.name || x.title || x.match || fb; }
function pickUrl(x) { return x.embed || x.embed_url || x.url || x.stream_url || x.streamUrl || ''; }

function cardHTML(m) {
  const icons = { cricket: '🏏', football: '⚽', basketball: '🏀', other: '🎯' };
  const labels = { cricket: 'Cricket', football: 'Football', basketball: 'Basketball', other: 'Sport' };
  const href = 'stream.html?name=' + encodeURIComponent(m.name) + '&url=' + encodeURIComponent(m.url);
  return `<a href="${href}" class="card">
    <div class="card-icon ${m.sport}">${icons[m.sport]}</div>
    <div class="card-body">
      <div class="card-meta"><span class="live-dot"></span> ${labels[m.sport]} • Live</div>
      <div class="card-title">${escapeHTML(m.name)}</div>
      ${m.category ? '<div class="card-sub">' + escapeHTML(m.category) + '</div>' : ''}
    </div>
    <span class="card-arrow">Watch →</span>
  </a>`;
}
function escapeHTML(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function emptyHTML(msg) { return `<div class="empty">${msg}</div>`; }

async function loadHome() {
  try {
    const all = await fetchMatches();
    ['cricket','football','basketball'].forEach(s => {
      const list = all.filter(m => m.sport === s).slice(0, 6);
      const el = document.getElementById('home' + s.charAt(0).toUpperCase() + s.slice(1));
      if (el) el.innerHTML = list.length ? list.map(cardHTML).join('') : emptyHTML('No live ' + s + ' matches right now.');
    });
  } catch (e) {
    console.error(e);
    ['homeCricket','homeFootball','homeBasketball'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = emptyHTML('Unable to load matches.');
    });
  }
}

async function loadSportPage() {
  const grid = document.getElementById('sportGrid');
  if (!grid) return;
  const sport = grid.dataset.sport;
  try {
    const all = await fetchMatches();
    const list = all.filter(m => m.sport === sport);
    grid.innerHTML = list.length ? list.map(cardHTML).join('') : emptyHTML('No live matches.');
    const count = document.getElementById('sportCount');
    if (count) count.textContent = list.length + ' live ' + (list.length === 1 ? 'match' : 'matches');
  } catch (e) {
    grid.innerHTML = emptyHTML('Unable to load matches.');
  }
}

async function loadAllMatches() {
  const wrap = document.getElementById('allMatches');
  if (!wrap) return;
  const filter = (params.get('sport') || 'all').toLowerCase();
  document.querySelectorAll('.filter').forEach(b => {
    b.classList.toggle('active', b.dataset.filter === filter);
    b.addEventListener('click', () => { location.search = '?sport=' + b.dataset.filter; });
  });
  try {
    const all = await fetchMatches();
    const list = filter === 'all' ? all.filter(m => m.sport !== 'other') : all.filter(m => m.sport === filter);
    wrap.innerHTML = list.length ? list.map(cardHTML).join('') : emptyHTML('No matches found.');
    const title = document.getElementById('allTitle');
    if (title) title.textContent = filter === 'all' ? 'All Live Matches' : 'Live ' + filter.charAt(0).toUpperCase() + filter.slice(1);
    const count = document.getElementById('allCount');
    if (count) count.textContent = list.length + ' live';
  } catch (e) {
    wrap.innerHTML = emptyHTML('Unable to load matches.');
  }
}

function loadStreamPage() {
  const frame = document.getElementById('streamFrame');
  if (!frame) return;
  const name = params.get('name') || 'Live Stream';
  const url = params.get('url') || '';
  document.getElementById('streamTitle').textContent = name;
  document.title = name + ' — SportWave';
  const openBtn = document.getElementById('openTab');
  const fb = document.getElementById('streamFallback');
  if (url) {
    openBtn.href = url;
    frame.src = url;
    frame.addEventListener('load', () => { fb.style.display = 'none'; }, { once: true });
    setTimeout(() => {
      if (fb.style.display !== 'none') {
        fb.innerHTML = '<div><p style="margin-bottom:8px">Stream may be blocked from embedding.</p><p style="font-size:13px">Try the "Open ↗" button to view in a new tab.</p></div>';
      }
    }, 6000);
  } else {
    fb.innerHTML = '<div><p>No stream URL provided.</p></div>';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('homeCricket')) loadHome();
  if (document.getElementById('sportGrid')) loadSportPage();
  if (document.getElementById('allMatches')) loadAllMatches();
  if (document.getElementById('streamFrame')) loadStreamPage();
});
