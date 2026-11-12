export const filler = Array.from({ length: 60 }, (_, i) => 'Paragraph ' + (i + 1) + ' of the long morning: the frost held on the rope, the gulls kept off the tower, and nobody below had lit a fire yet.').join('\n\n');
// What the page reports: the page's box, the bars that stay at its top, and every lit box.
export const MEASURE = `(() => {
  const page = document.querySelector('.writer-page');
  const bb = page.getBoundingClientRect();
  let from = bb.top, to = bb.bottom;
  for (const c of page.children) {
    if (getComputedStyle(c).position !== 'sticky') continue;
    const q = c.getBoundingClientRect();
    if (q.height < 1 || q.height > bb.height / 2) continue;
    if (q.top <= bb.top + 16) from = Math.max(from, q.bottom); else if (q.bottom >= bb.bottom - 16) to = Math.min(to, q.top);
  }
  // The lit words as they are painted: each line's box, cut to the part of it that is really on top at its middle.
  const lit = [];
  for (const el of document.querySelectorAll('.writer-page .lit-shown')) for (const q of el.getClientRects()) {
    if (q.width < 1) continue;
    let a = null, z = null;
    for (let y = q.top + 0.5; y < q.bottom; y += 1) {
      const hit = y >= 0 && y < window.innerHeight ? document.elementFromPoint(q.left + q.width / 2, y) : null;
      if (hit && hit.closest('.lit-shown')) { if (a == null) a = y - 0.5; z = y + 0.5; }
    }
    if (a != null) lit.push([Math.round(a * 10) / 10, Math.round(z * 10) / 10]);
  }
  return { from, to, top: bb.top, lit, scroll: page.scrollTop, max: page.scrollHeight - page.clientHeight };
})()`;
export const outside = (m) => m.lit.filter(([t, b]) => t < m.from - 0.6 || b > m.to + 0.6);
