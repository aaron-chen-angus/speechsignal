/* ==========================================================================
   Hash-based router (works from file:// and GitHub Pages alike).
   Four routes: #/session #/record #/results #/method. Session state survives
   navigation because state.js is a singleton and views only read/write it.

   Each route module exports { title, render(rootEl) } and optionally
   teardown(). The router swaps the routed region, updates nav aria-current,
   moves focus to the new page heading, and announces the route to a live
   region for screen readers.
   ========================================================================== */
import { state } from './state.js';

const routes = {};        // name -> module
let current = null;       // { name, mod }
let mountEl = null;
let liveEl = null;

export function register(name, mod){ routes[name] = mod; }

export function announce(msg){
  if(!liveEl) return;
  liveEl.textContent = '';
  // rAF so repeated identical messages still fire
  requestAnimationFrame(() => { liveEl.textContent = msg; });
}

export function parseHash(){
  const h = (location.hash || '').replace(/^#/, '');
  const path = h.split('?')[0].replace(/^\/+/, '').replace(/\/+$/, '') || 'session';
  return path;
}

export function go(name){
  if(location.hash === '#/' + name){ handle(); }
  else location.hash = '#/' + name;
}

function updateNav(name){
  document.querySelectorAll('nav.routes a[data-route]').forEach(a => {
    const on = a.dataset.route === name;
    if(on) a.setAttribute('aria-current','page'); else a.removeAttribute('aria-current');
  });
}

async function handle(){
  let name = parseHash();
  if(!routes[name]) name = 'session';

  if(current && current.mod.teardown){
    try { current.mod.teardown(); } catch(e){ console.error(e); }
  }

  const mod = routes[name];
  mountEl.innerHTML = '';
  const page = document.createElement('div');
  page.className = 'page';
  page.setAttribute('role','region');
  page.setAttribute('aria-label', mod.title || name);
  mountEl.appendChild(page);

  try { await mod.render(page); }
  catch(e){
    console.error(e);
    page.innerHTML = '<div class="panel"><div class="ptitle">Error</div><p>' +
      'Something went wrong rendering this screen. Check the console.</p></div>';
  }

  current = { name, mod };
  updateNav(name);
  document.title = 'SMILE Speech Signal Lab — ' + (mod.title || name);

  // move focus to the page heading for keyboard + SR users
  const h = page.querySelector('h1, [tabindex="-1"]');
  if(h){ h.setAttribute('tabindex','-1'); h.focus({ preventScroll:false }); }
  announce((mod.title || name) + ' screen');
}

export function start(mount, live){
  mountEl = mount; liveEl = live;
  window.addEventListener('hashchange', handle);

  // Warn before unload if recordings are unexported (in-memory only).
  window.addEventListener('beforeunload', (e) => {
    if(!state.exported && Object.keys(state.audio).length){
      e.preventDefault();
      e.returnValue = 'Recordings have not been exported. They exist only in memory and will be lost.';
      return e.returnValue;
    }
  });

  if(!location.hash) location.hash = '#/session';
  handle();
}
