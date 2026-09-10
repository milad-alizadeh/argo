/* PROTOTYPE — the rebuild control, as a drop-in. One <script src> and nothing else: the page
   has no idea this exists, and on a plain static server or a file:// URL it stays invisible.
   Optional by construction, exactly like the written layer the page already loads. */
(() => {
  const API = '_atlas/';

  /* The page is a classic script, so its top-level bindings live in the global lexical scope
     and an indirect eval is the only way in from here without editing the file. Only the
     page's own functions are reached this way — nothing here assigns to its state, because
     a second writer is a second adoption and the two drift. */
  const peek = n => { try { return (0, eval)(n); } catch { return undefined; } };

  /* The host page's own control skin — the segmented buttons in its sidebar — rather than
     the floating bar's, which the sidebar rewrite deleted along with #bar. */
  const CSS = `
  #regen { display: flex; flex-direction: column; gap: 8px; }
  #regen .row { display: flex; gap: 6px; }
  #regen .row button { flex: 1; padding: 4px 8px; border-radius: 6px;
                       font: var(--t-callout) var(--sans); color: var(--text-2);
                       background: rgba(126,214,240,.07);
                       border: 1px solid rgba(126,214,240,.2); }
  #regen .row button:hover:not([disabled]) { background: rgba(126,214,240,.16);
                                             color: var(--text-1); }
  #regen button.ghost { flex: 0 0 auto; color: var(--text-3);
                        background: rgba(126,214,240,.04); border-color: rgba(126,214,240,.14); }
  #regen button.ghost:hover { color: var(--text-1); }
  #regen button.armed { color: #f0c674; border-color: rgba(240,198,116,.5);
                        background: rgba(240,198,116,.12); }
  #regen button[disabled] { opacity: .45; cursor: default; }
  #regen .say { font: var(--t-footnote)/1.55 var(--sans); color: var(--text-3);
                overflow-wrap: anywhere; }
  #regen .say b { color: var(--text-2); font-weight: 600; }
  #regen .say.live { color: #7fe8ff; }
  #regen .say.bad { color: #f0a08c; }
  #regen .say i { font-style: normal; font-family: var(--mono); color: var(--text-off);
                  margin-left: 5px; }`;

  const el = (tag, cls, html) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  };

  let box, say, mapBtn, notesBtn, armed = 0;

  /* An empty, hidden section the host page provides by convention. Mounting by id is what
     keeps this a drop-in: a page that has never heard of this script has no slot, so the
     control is invisible and nothing here has to be told where to go. */
  function mount() {
    const slot = document.getElementById('regen-slot');
    if (!slot || document.getElementById('regen')) return false;
    document.head.append(el('style', null, CSS));
    box = el('div'); box.id = 'regen';
    const row = el('div', 'row');
    mapBtn = el('button', null, 'Rebuild map');
    mapBtn.title = 'Re-measure the repository. No model calls.';
    notesBtn = el('button', 'ghost', '+ notes');
    row.append(mapBtn, notesBtn);
    say = el('div', 'say');
    box.append(row, say);
    slot.append(box);
    /* the section stays hidden until there is something in it, so a static server shows no
       empty labelled group where a control never arrived */
    slot.hidden = false;
    return true;
  }

  const line = (text, cls) => { say.className = 'say' + (cls ? ' ' + cls : ''); say.innerHTML = text; };
  const esc = t => String(t).replace(/[&<>"]/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function describe(s) {
    if (!s.stale) return line('');
    const bits = s.reasons.map(r => `<b>${esc(r)}</b>`).join(' · ');
    line(`The city is out of date — ${bits}.`);
  }

  /* The notes run is the only thing here that spends money, so it takes two clicks and says
     how many calls it is about to make on the first one. */
  function armNotes(s) {
    const n = s.notesStale || 0;
    if (!armed) {
      armed = Date.now();
      notesBtn.classList.add('armed');
      notesBtn.textContent = n ? `Spend ${n}?` : 'Spend calls?';
      line(n ? `Rewrites the <b>${n}</b> note${n > 1 ? 's' : ''} whose file changed, one model call each. Click again.`
             : 'Rebuilds the map, then rewrites any note whose file changed. Click again.');
      setTimeout(disarm, 6000);
      return false;
    }
    return true;
  }

  function disarm() {
    armed = 0;
    if (notesBtn) { notesBtn.classList.remove('armed'); notesBtn.textContent = '+ notes'; }
  }

  /* The parsers are silent for a minute at a time, so the tick is the only proof of life the
     stream can offer between steps. */
  const TICKS = ['⠁', '⠂', '⠄', '⡀', '⢀', '⠠', '⠐', '⠈'];

  async function stream(mode) {
    mapBtn.disabled = notesBtn.disabled = true;
    disarm();
    let step = 'Starting', tick = 0, failed = null, done = null;
    const paint = () => line(`<b>${esc(step)}</b><i>${TICKS[tick % TICKS.length]}</i>`, 'live');
    paint();
    try {
      const res = await fetch(API + 'regen?mode=' + mode, { cache: 'no-store' });
      const reader = res.body.getReader(), dec = new TextDecoder();
      let buf = '';
      for (;;) {
        const { value, done: end } = await reader.read();
        if (end) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split('\n'); buf = parts.pop();
        for (const p of parts) {
          if (!p.trim()) continue;
          let m; try { m = JSON.parse(p); } catch { continue; }
          tick++;
          if (m.kind === 'step') step = m.text;
          if (m.kind === 'error') failed = m.text;
          if (m.kind === 'done') { try { done = JSON.parse(m.text); } catch { done = {}; } }
          if (!failed) paint();
        }
      }
    } catch (e) { failed = 'The server went away: ' + (e && e.message || e); }
    mapBtn.disabled = notesBtn.disabled = false;
    if (failed) { line(esc(failed), 'bad'); return; }
    line('<b>Redrawing</b>', 'live');
    const ok = await redraw();
    if (!ok) return reloadKeepingCamera();
    const n = done && done.notes;
    line(`Rebuilt in <b>${done && done.seconds}s</b>`
      + (done && done.files ? ` · <b>${done.files}</b> files` : '')
      + (n ? ` · <b>${n.written}</b> note${n.written === 1 ? '' : 's'} rewritten, ${n.kept} kept` : ''));
    refresh(true);
  }

  const fresh = (file, soft) => fetch(file + '?t=' + Date.now(), { cache: 'no-store' })
    .then(r => r.ok ? r.json() : null).catch(() => null)
    .then(j => j || (soft ? null : Promise.reject(new Error(file))));

  /* Redrawn in place, because a page reload throws away the camera and the map's whole point
     is where you had got to in it. Every one of the three files the rebuild writes is refetched
     and handed to the page's own `adopt`, which is the same call its boot makes — the numbers
     after this button and the numbers after a reload are then the same numbers by construction.
     A page without those two functions is somebody else's copy, and it reloads instead. */
  async function redraw() {
    const adopt = peek('adopt'), reseat = peek('reseat'), notes = peek('loadNotes');
    if (typeof adopt !== 'function' || typeof reseat !== 'function' || !peek('state')) return false;
    let j, co;
    try {
      [j, co] = await Promise.all([fresh('atlas-cc.json'), fresh('atlas-cochange.json', true)]);
      if (typeof notes === 'function') await notes();
    } catch { return false; }
    try { adopt(j, co); reseat(); } catch (e) { console.error('atlas: redraw failed', e); return false; }
    return true;
  }

  /* The fallback still keeps the camera: the channels and the angles are already in the URL,
     and the pan and zoom go through the session so this same script can put them back. */
  function reloadKeepingCamera() {
    const cam = peek('cam');
    if (cam) sessionStorage.setItem('atlasCam', JSON.stringify(cam));
    location.reload();
  }

  function restoreCamera() {
    const saved = sessionStorage.getItem('atlasCam');
    if (!saved) return;
    sessionStorage.removeItem('atlasCam');
    const t = setInterval(() => {
      const cam = peek('cam'), rebuild = peek('rebuild');
      if (!peek('state') || typeof rebuild !== 'function') return;
      clearInterval(t);
      Object.assign(cam, JSON.parse(saved));
      rebuild();
    }, 60);
    setTimeout(() => clearInterval(t), 8000);
  }

  async function refresh(keepLine) {
    let s;
    try {
      const r = await fetch(API + 'status', { cache: 'no-store' });
      if (!r.ok) return null;
      s = await r.json();
    } catch { return null; }
    if (!s || !s.ok) return null;
    if (!box && !mount()) return null;
    mapBtn.onclick = () => stream('map');
    notesBtn.onclick = () => { if (armNotes(s)) stream('notes'); };
    if (s.tools && s.tools.map.length) {
      mapBtn.disabled = true;
      line(`Cannot rebuild — <b>${esc(s.tools.map.join(', '))}</b> not installed.`, 'bad');
    } else if (!keepLine) {
      describe(s);
    }
    return s;
  }

  /* A missing endpoint is the ordinary case, not a fault: static server, file://, someone
     else's copy of the page. It must cost nothing and say nothing. */
  const start = () => { restoreCamera(); refresh(); };
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', start);
  else start();
})();
