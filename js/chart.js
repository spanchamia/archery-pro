// Small dependency-free SVG line chart with a hover/tap tooltip. Used for
// average arrow score per session, and per end within a session.

const SVG_NS = 'http://www.w3.org/2000/svg';

function el(name, attrs = {}, parent) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (parent) parent.appendChild(node);
  return node;
}

function niceRange(values) {
  let lo = Math.floor(Math.min(...values) - 0.25);
  let hi = Math.ceil(Math.max(...values) + 0.25);
  lo = Math.max(0, lo);
  hi = Math.min(10, Math.max(hi, lo + 1));
  return [lo, hi];
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function shortDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// points: [{ date: 'YYYY-MM-DD', value: Number, label: String }]
// options:
//   xLabel(point, i)  axis / tooltip text for a point (default: short date)
//   unit              text after the value in the tooltip
//   reference         { value, label } dashed horizontal guide line
//   ariaLabel, emptyText
export function renderLineChart(container, points, options = {}) {
  const {
    xLabel = (p) => shortDate(p.date),
    unit = 'avg/arrow',
    reference = null,
    ariaLabel = 'Average arrow score per session',
    emptyText = 'Finish a session to see your progress here.',
  } = options;

  container.innerHTML = '';
  if (!points.length) {
    container.innerHTML = `<p class="empty">${emptyText}</p>`;
    return;
  }

  const width = Math.max(container.clientWidth, 280);
  const height = 240;
  const m = { top: 20, right: 44, bottom: 30, left: 36 };
  const w = width - m.left - m.right;
  const h = height - m.top - m.bottom;

  const [lo, hi] = niceRange([...points.map((p) => p.value), ...(reference ? [reference.value] : [])]);
  const x = (i) => m.left + (points.length === 1 ? w / 2 : (i / (points.length - 1)) * w);
  const y = (v) => m.top + h - ((v - lo) / (hi - lo)) * h;

  const svg = el('svg', {
    viewBox: `0 0 ${width} ${height}`,
    width,
    height,
    role: 'img',
    'aria-label': ariaLabel,
  });

  // Horizontal gridlines and y labels.
  const step = hi - lo > 4 ? 2 : hi - lo > 2 ? 1 : 0.5;
  for (let v = lo; v <= hi + 1e-9; v += step) {
    el('line', { x1: m.left, x2: m.left + w, y1: y(v), y2: y(v), class: 'grid' }, svg);
    const t = el('text', { x: m.left - 8, y: y(v) + 4, class: 'axis', 'text-anchor': 'end' }, svg);
    t.textContent = Number.isInteger(v) ? v : v.toFixed(1);
  }

  // X labels: first, last, and a few in between.
  const maxLabels = Math.max(2, Math.floor(w / 70));
  const every = Math.ceil(points.length / maxLabels);
  points.forEach((p, i) => {
    if (i % every !== 0 && i !== points.length - 1) return;
    if (i !== points.length - 1 && points.length - 1 - i < every) return;
    const t = el('text', { x: x(i), y: height - 8, class: 'axis', 'text-anchor': 'middle' }, svg);
    t.textContent = xLabel(p, i);
  });

  // Optional reference line, e.g. the session average.
  if (reference) {
    el('line', { x1: m.left, x2: m.left + w, y1: y(reference.value), y2: y(reference.value), class: 'reference' }, svg);
    const t = el('text', { x: m.left + 4, y: y(reference.value) - 6, class: 'reference-label' }, svg);
    t.textContent = reference.label;
  }

  // Line and dots.
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.value)}`).join(' ');
  el('path', { d, class: 'series-line' }, svg);
  const dots = points.map((p, i) => el('circle', { cx: x(i), cy: y(p.value), r: 4, class: 'series-dot' }, svg));

  // Direct label on the latest point.
  const last = points[points.length - 1];
  const lastLabel = el('text', { x: x(points.length - 1) + 8, y: y(last.value) + 4, class: 'value-label' }, svg);
  lastLabel.textContent = last.value.toFixed(2);

  // Hover layer.
  const crosshair = el('line', { y1: m.top, y2: m.top + h, class: 'crosshair', visibility: 'hidden' }, svg);
  const tooltip = document.createElement('div');
  tooltip.className = 'tooltip';
  tooltip.hidden = true;

  const overlay = el('rect', { x: m.left - 10, y: 0, width: w + 20, height, fill: 'transparent' }, svg);
  const show = (evt) => {
    const rect = svg.getBoundingClientRect();
    const px = ((evt.clientX - rect.left) / rect.width) * width;
    let best = 0;
    points.forEach((_, i) => {
      if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i;
    });
    const p = points[best];
    crosshair.setAttribute('x1', x(best));
    crosshair.setAttribute('x2', x(best));
    crosshair.setAttribute('visibility', 'visible');
    dots.forEach((dot, i) => dot.setAttribute('r', i === best ? 6 : 4));
    tooltip.innerHTML = `<strong>${p.value.toFixed(2)}</strong> ${unit}<br>${xLabel(p, best)}${p.label ? ` · ${escapeHtml(p.label)}` : ''}`;
    tooltip.hidden = false;
    const left = (x(best) / width) * rect.width;
    tooltip.style.left = `${Math.min(Math.max(left, 70), rect.width - 70)}px`;
    tooltip.style.top = `${(y(p.value) / height) * rect.height}px`;
  };
  const hide = () => {
    crosshair.setAttribute('visibility', 'hidden');
    dots.forEach((dot) => dot.setAttribute('r', 4));
    tooltip.hidden = true;
  };
  overlay.addEventListener('pointermove', show);
  overlay.addEventListener('pointerdown', show);
  overlay.addEventListener('pointerleave', hide);

  container.appendChild(svg);
  container.appendChild(tooltip);
}
