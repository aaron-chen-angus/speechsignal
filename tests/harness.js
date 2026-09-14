/* ==========================================================================
   Tiny dependency-free test harness that runs identically in Node and the
   browser. Tests register with test(name, fn). run() executes them and
   returns a summary { passed, failed, results }.
   ========================================================================== */
const registry = [];
export function test(name, fn){ registry.push({ name, fn }); }

export function assert(cond, msg){ if(!cond) throw new Error(msg || 'assertion failed'); }
export function approx(actual, expected, tol, msg){
  if(!(Math.abs(actual-expected) <= tol))
    throw new Error((msg||'value') + `: expected ${expected} \u00b1 ${tol}, got ${actual}`);
}
export function within(actual, lo, hi, msg){
  if(!(actual >= lo && actual <= hi))
    throw new Error((msg||'value') + `: expected in [${lo}, ${hi}], got ${actual}`);
}
export function relApprox(actual, expected, relTol, msg){
  const tol = Math.abs(expected)*relTol;
  if(!(Math.abs(actual-expected) <= tol))
    throw new Error((msg||'value') + `: expected ${expected} \u00b1 ${(relTol*100).toFixed(1)}% (\u00b1${tol.toFixed(3)}), got ${actual}`);
}

export async function run(onResult){
  const results = [];
  let passed = 0, failed = 0;
  for(const t of registry){
    const start = (typeof performance!=='undefined'?performance.now():Date.now());
    let ok = true, err = null;
    try { await t.fn(); }
    catch(e){ ok = false; err = e; }
    const ms = (typeof performance!=='undefined'?performance.now():Date.now()) - start;
    if(ok) passed++; else failed++;
    const r = { name:t.name, ok, error: err ? (err.message||String(err)) : null, ms:Math.round(ms) };
    results.push(r);
    if(onResult) onResult(r);
  }
  return { passed, failed, total: registry.length, results };
}

export function count(){ return registry.length; }
