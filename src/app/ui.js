/* ==========================================================================
   Small shared UI helpers: DOM building, number formatting, toast.
   ========================================================================== */

export function el(tag, attrs, ...children){
  const node = document.createElement(tag);
  if(attrs){
    for(const [k,v] of Object.entries(attrs)){
      if(v==null||v===false) continue;
      if(k==='class') node.className = v;
      else if(k==='html') node.innerHTML = v;
      else if(k==='text') node.textContent = v;
      else if(k.startsWith('on') && typeof v==='function') node.addEventListener(k.slice(2).toLowerCase(), v);
      else if(k==='dataset') Object.assign(node.dataset, v);
      else if(v===true) node.setAttribute(k,'');
      else node.setAttribute(k, v);
    }
  }
  for(const c of children.flat()){
    if(c==null||c===false) continue;
    node.appendChild(typeof c==='string' ? document.createTextNode(c) : c);
  }
  return node;
}

/* number formatting — ported from the prototype's f() */
export const f = (v,d) => isFinite(v)
  ? (Math.abs(v)>=10000 ? Math.round(v).toLocaleString() : v.toFixed(d===undefined?2:d))
  : '—';

let toastTimer = null;
export function toast(msg, ms){
  let t = document.querySelector('.toast');
  if(!t){ t = el('div',{class:'toast',role:'status','aria-live':'polite'}); document.body.appendChild(t); }
  t.textContent = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>{ t.remove(); }, ms||3000);
}

/* CSS var read for canvas fonts */
export function cssVar(name){
  return getComputedStyle(document.body).getPropertyValue(name).trim();
}
