// Overview motion: the recorded Swap Reduction story, played step by step on the unchanged
// teaser figure (static/figures/teaser.pdf, built by build_teaser_v5.js).
//
// build_teaser_motion.py embeds the PDF as SVG. MuPDF writes one element per glyph, path and
// image in the PDF's paint order (the PptxGenJS shape order), so scenes address elements by
// index; SCENE_TEXT checks every text range against the figure before anything runs. Each
// element gets its own wrapper <g>, so opacity and transforms never change paint order.
// setTime(t) is a pure function of t: frames can be captured in any order. The last HOLD
// seconds, and the first HOLD0, show the figure exactly as published.
//
// Added text is limited to recorded run data (trajectories/swap-reduction.html): the round 1
// and round 2 queries of iteration 5 (abridged with "…", as in the figure) and "5 returned ·
// 3 kept" per round. Iteration 66 types only round 1, the round the figure shows; its rounds
// 2 and 3 appear, as in the still, as the kept-document points.
(() => {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.querySelector('#figure svg');
  const layer = svg.querySelector(':scope > g > g');
  const units = [...layer.children];
  const n = units.length;

  const QUERY_R1 = '“SABRE” adaptive lookahead decay swap scoring weighted interaction …';
  const QUERY_R2 = '“SwapSelectionContext” Rust “front_layer” executable gate can_apply …';
  const ROUND_STATUS = '5 returned · 3 kept';

  const SCENE_TEXT = [
    [6, 20, 'initial program'], [24, 55, '38 iterations without a new best'],
    [61, 67, 'Look-Up'], [68, 105, 'iter 64  3 stored docs, 0 new searches'],
    [107, 116, 'inner loop'], [119, 128, 'Top-K docs'], [133, 138, 'iter 5'], [140, 147, 'Retrieve'],
    [154, 176, 'Inner Loop: Iteration 5'], [285, 299, 'Knowledge State'], [301, 307, 'Round 3'],
    [375, 385, 'Pred. 6,963'], [387, 409, 'dSABRE: A SABRE-Style …'], [413, 432, 'Kept docs:mean pred.'],
    [433, 439, '6,965.0'], [454, 460, '6,965.5'], [488, 496, 'arxiv.org'], [685, 690, 'doc 08'],
    [698, 734, 'Outer Loop: kept child of iteration 5'], [735, 740, '+53 −1'],
    [841, 887, '+ …extended_set.weighted_score_delta(*swap, …);'],
    [889, 936, '+ let weight = gamma.powi(index.min(32) as i32);'],
    [939, 965, 'Q20 SWAPs↓  19,953 → 18,030'], [971, 977, 'iter 66'], [979, 986, 'Retrieve'],
    [992, 1001, 'Top-K docs'], [1005, 1028, 'Inner Loop: Iteration 66'], [1143, 1149, 'Round 1'],
    [1212, 1223, 'Pred. 17,210'], [1225, 1247, 'SabreSwap | IBM Quantum'], [1271, 1278, '17,211.4'],
    [1293, 1300, '17,214.1'], [1330, 1350, 'quantum.cloud.ibm.com'], [1543, 1548, 'doc 05'],
    [1556, 1593, 'Outer Loop: kept child of iteration 66'], [1594, 1599, '+26 −9'],
    [1727, 1751, '+         *score += 0.20;'], [1806, 1832, 'Q20 SWAPs↓  16,181 → 15,457'],
    [1834, 1840, 'EvoDuet'], [1863, 1868, '14,835'], [1878, 1883, '15,186'], [1886, 1900, 'New SOTA on Q20'],
    [2064, 2073, 'Final best'],
  ];
  const SCENE_PAINT = [
    [3, 'stroke', '#7a5fc4'], [106, 'stroke', '#4f86cf'], [117, 'stroke', '#4f86cf'], [151, 'fill', '#eaf2fc'],
    [308, 'fill', '#ffffff'], [693, 'stroke', '#9c87d6'], [695, 'fill', '#f4f0fd'], [787, 'fill', '#161b22'],
    [966, 'stroke', '#4f86cf'], [990, 'stroke', '#4f86cf'], [1002, 'fill', '#eaf2fc'], [1150, 'fill', '#ffffff'],
    [1551, 'stroke', '#9c87d6'], [1665, 'fill', '#161b22'], [1842, 'fill', '#ffffff'], [1901, 'stroke', '#9c87d6'],
  ];

  // ---------------------------------------------------------------- figure checks and geometry
  if (n !== 2074) throw new Error(`expected 2074 figure elements, found ${n}`);
  const textOf = (a, b) => units.slice(a, b + 1).filter(u => u.tagName === 'use')
    .map(u => u.getAttribute('data-text') || '').join('');
  for (const [a, b, expected] of SCENE_TEXT) {
    if (textOf(a, b) !== expected) throw new Error(`elements ${a}-${b}: "${textOf(a, b)}" is not "${expected}"`);
  }
  for (const [i, attribute, value] of SCENE_PAINT) {
    const element = units[i].tagName === 'path' ? units[i] : units[i].querySelector('path');
    if (element?.getAttribute(attribute) !== value) throw new Error(`element ${i}: ${attribute} is not ${value}`);
  }

  const wraps = units.map(unit => {
    const g = document.createElementNS(NS, 'g');
    layer.insertBefore(g, unit);
    g.appendChild(unit);
    return g;
  });
  // The page is laid out at 1 CSS px per PDF point, so client rects are in figure coordinates.
  const boxes = units.map(unit => {
    const r = unit.getBoundingClientRect();
    return [r.left, r.top, r.right, r.bottom];
  });
  const glyph = units.map(unit => {
    if (unit.tagName !== 'use') return null;
    const m = unit.getAttribute('transform').match(/matrix\(([^)]+)\)/)[1].split(/[ ,]+/).map(Number);
    return {size: m[0], x: m[4], y: m[5]};
  });

  const range = (a, b) => Array.from({length: b - a + 1}, (_, k) => a + k);
  // Scene lists nest freely; any [first, last] pair of indices means the inclusive range.
  const flat =(...parts) => parts.flatMap(p => (Array.isArray(p) ? (p.length === 2 && p[1] >= p[0] &&
    typeof p[0] === 'number' ? range(p[0], p[1]) : flat(...p)) : [p]));
  const bounds = ids => ids.reduce((b, i) => [Math.min(b[0], boxes[i][0]), Math.min(b[1], boxes[i][1]),
    Math.max(b[2], boxes[i][2]), Math.max(b[3], boxes[i][3])], [Infinity, Infinity, -Infinity, -Infinity]);
  const center = ids => { const b = bounds(ids); return [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2]; };
  const isGlyph = i => units[i].tagName === 'use';
  const pathOf = i => (units[i].tagName === 'path' ? units[i] : units[i].querySelector('path'));

  // ---------------------------------------------------------------- easing
  const clamp = v => Math.min(1, Math.max(0, v));
  const smooth = v => { v = clamp(v); return v * v * (3 - 2 * v); };
  const easeOut = v => 1 - (1 - clamp(v)) ** 3;
  const back = v => { v = clamp(v) - 1; return 1 + 2.4 * v ** 3 + 1.4 * v ** 2; };
  const prog = (t, t0, duration) => clamp((t - t0) / duration);

  // ---------------------------------------------------------------- per-frame state and rules
  const op = new Float64Array(n);
  const tf = new Array(n).fill('');
  const claimed = new Uint8Array(n);
  const rules = [];
  const claim = ids => {
    for (const i of ids) {
      if (claimed[i]) throw new Error(`element ${i} is animated twice`);
      claimed[i] = 1;
    }
    return ids;
  };
  const xf = (c, s, dx = 0, dy = 0, rotate = 0) => (s === 1 && !dx && !dy && !rotate ? '' :
    `translate(${c[0] + dx} ${c[1] + dy}) rotate(${rotate}) scale(${s}) translate(${-c[0]} ${-c[1]})`);

  function make(tag, attributes = {}, parent = null) {
    const element = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attributes)) element.setAttribute(k, v);
    if (parent) parent.appendChild(element);
    return element;
  }
  const defs = make('defs', {}, svg);
  const toggle = (element, name, value) => (value ? element.setAttribute(name, value) : element.removeAttribute(name));
  const after = (i, element) => { layer.insertBefore(element, wraps[i].nextSibling); return element; };
  let uid = 0;

  // Fade (with optional slide or pop) a group in at t0, and optionally out again at `until`.
  function appear(ids, t0, o = {}) {
    ids = claim(flat(ids));
    const duration = o.dur ?? 0.3, origin = o.origin ?? center(ids);
    rules.push(t => {
      const p = prog(t, t0, duration);
      let alpha = o.from !== undefined ? smooth(p / 0.45) : smooth(p);
      if (o.until !== undefined) alpha *= 1 - smooth(prog(t, o.until, o.outDur ?? 0.2));
      const scale = o.from !== undefined ? o.from + (1 - o.from) * (o.soft ? easeOut(p) : back(p)) : 1;
      const transform = xf(origin, scale, (o.dx ?? 0) * (1 - easeOut(p)), (o.dy ?? 0) * (1 - easeOut(p)));
      for (const i of ids) { op[i] = alpha; tf[i] = transform; }
    });
  }
  const pop = (ids, t0, o = {}) => appear(ids, t0, Object.assign({from: 0.35, dur: 0.38}, o));

  // Reveal glyphs one at a time; any non-glyph element in `ids` appears at t0. Returns the end.
  const carets = [];
  function type(ids, t0, cps, o = {}) {
    ids = claim(flat(ids));
    const glyphs = ids.filter(isGlyph), others = ids.filter(i => !isGlyph(i));
    const t1 = t0 + glyphs.length / cps;
    rules.push(t => {
      const shown = t < t0 ? 0 : Math.min(glyphs.length, Math.floor((t - t0) * cps) + 1);
      glyphs.forEach((i, k) => { op[i] = k < shown ? 1 : 0; tf[i] = ''; });
      for (const i of others) { op[i] = t >= t0 ? 1 : 0; tf[i] = ''; }
    });
    if (o.caret !== false) carets.push({t0, t1, color: o.caret ?? '#1a1a1a', at: t => glyphCaret(glyphs, t0, cps, t)});
    return t1;
  }
  function glyphCaret(glyphs, t0, cps, t) {
    const shown = Math.min(glyphs.length, Math.floor((t - t0) * cps) + 1);
    const last = glyph[glyphs[Math.max(0, shown - 1)]], next = glyph[glyphs[shown]];
    let x;
    if (shown === 0) x = glyph[glyphs[0]].x - 0.6;
    else if (next && Math.abs(next.y - last.y) < last.size * 0.5) x = next.x;
    else x = Math.max(boxes[glyphs[shown - 1]][2], last.x) + 0.6;
    return {x, y: last.y, size: last.size};
  }

  // Draw a stroked path from its start (or its end, with reverse) over [t0, t0 + duration].
  // Dashed paths are revealed through a mask so their own dash pattern is kept.
  function draw(i, t0, duration, o = {}) {
    claim([i]);
    const path = pathOf(i), total = path.getTotalLength();
    const dashed = path.hasAttribute('stroke-dasharray');
    let target = path;
    if (dashed) {
      const mask = make('mask', {id: `reveal${uid++}`, maskUnits: 'userSpaceOnUse', x: -10, y: -10, width: 980, height: 480}, defs);
      target = make('path', {d: path.getAttribute('d'), transform: path.getAttribute('transform'),
        fill: 'none', stroke: '#fff', 'stroke-width': 9}, mask);
      wraps[i].dataset.mask = mask.id;
    }
    rules.push(t => {
      const p = prog(t, t0, duration), length = total * (o.linear ? p : smooth(p));
      op[i] = t >= t0 ? 1 : 0;
      tf[i] = '';
      if (dashed) toggle(wraps[i], 'mask', p > 0 && p < 1 && `url(#${wraps[i].dataset.mask})`);
      if (p > 0 && p < 1) {
        target.style.strokeDasharray = `${length} ${total + 2}`;
        target.style.strokeDashoffset = o.reverse ? `${length - total}` : '0';
      } else {
        target.style.strokeDasharray = '';
        target.style.strokeDashoffset = '';
      }
    });
    return t0 + duration;
  }

  // Sweep a highlight rectangle in from the left, like a marker.
  function sweep(i, t0, duration) {
    claim([i]);
    const [x0, y0, x1, y1] = boxes[i];
    const clip = make('clipPath', {id: `sweep${uid++}`, clipPathUnits: 'userSpaceOnUse'}, defs);
    const rect = make('rect', {x: x0 - 1, y: y0 - 1, height: y1 - y0 + 2, width: 0}, clip);
    rules.push(t => {
      const p = prog(t, t0, duration);
      op[i] = t >= t0 ? 1 : 0;
      tf[i] = '';
      rect.setAttribute('width', (x1 - x0 + 2) * easeOut(p));
      toggle(wraps[i], 'clip-path', p > 0 && p < 1 && `url(#${clip.id})`);
    });
    return t0 + duration;
  }

  // An element that appears with its group at t0 and moves on its own (search jitter, wobble).
  function motion(i, t0, transformAt) {
    claim([i]);
    rules.push(t => { op[i] = smooth(prog(t, t0, 0.3)); tf[i] = transformAt(t); });
  }
  const orbit = (i, windows) => t => {
    for (const [a, b] of windows) {
      if (t > a && t < b) {
        const k = smooth(prog(t, a, 0.15)) * (1 - smooth(prog(t, b - 0.15, 0.15))), phase = (t - a) * Math.PI * 2 / 0.55;
        return `translate(${1.5 * k * Math.cos(phase)} ${1.5 * k * Math.sin(phase)})`;
      }
    }
    return '';
  };

  // Pulsing ring (the gate deciding, a new best arriving) drawn above the figure.
  const rings = make('g', {'pointer-events': 'none'});
  const pulses = [];
  function pulse(c, t0, color, radius) {
    const ring = make('circle', {cx: c[0], cy: c[1], fill: 'none', stroke: color}, rings);
    pulses.push(t => {
      const p = prog(t, t0, 0.7);
      ring.setAttribute('display', p > 0 && p < 1 ? 'inline' : 'none');
      ring.setAttribute('r', radius * (0.7 + 0.8 * easeOut(p)));
      ring.setAttribute('stroke-width', 2.4 * (1 - p) + 0.4);
      ring.setAttribute('stroke-opacity', 0.75 * (1 - p));
    });
  }

  // Indeterminate "searching" sweep inside a rounded field, clipped to the field's own outline.
  const gradient = make('linearGradient', {id: 'shimmer'}, defs);
  [[0, 0], [0.5, 0.26], [1, 0]].forEach(([offset, alpha]) =>
    make('stop', {offset, 'stop-color': '#4f86cf', 'stop-opacity': alpha}, gradient));
  function shimmer(fieldIndex, windows) {
    const field = pathOf(fieldIndex), [x0, y0, x1, y1] = boxes[fieldIndex];
    const clip = make('clipPath', {id: `field${uid++}`, clipPathUnits: 'userSpaceOnUse'}, defs);
    make('path', {d: field.getAttribute('d'), transform: field.getAttribute('transform')}, clip);
    const g = after(fieldIndex + 1, make('g', {'clip-path': `url(#${clip.id})`}));
    const band = make('rect', {y: y0, height: y1 - y0, width: 52, fill: 'url(#shimmer)'}, g);
    pulses.push(t => {
      const w = windows.find(([a, b]) => t > a && t < b);
      g.setAttribute('display', w ? 'inline' : 'none');
      if (!w) return;
      const period = 0.8, p = ((t - w[0]) % period) / period;
      band.setAttribute('x', x0 - 52 + (x1 - x0 + 52) * smooth(p));
      g.setAttribute('opacity', smooth(prog(t, w[0], 0.12)) * (1 - smooth(prog(t, w[1] - 0.12, 0.12))));
    });
  }

  // Text that is not in the figure, set in the figure's own face (Figtree) at its sizes. It is
  // laid out 20x larger and scaled down: at 10 px Chromium rounds each glyph advance.
  const TEXT_SCALE = 20;
  function overlayText(anchorIndex, x, y, size, attributes) {
    const g = after(anchorIndex, make('g', {transform: `translate(${x} ${y}) scale(${1 / TEXT_SCALE})`}));
    const text = make('text', Object.assign({'font-family': 'Figtree', 'font-size': size * TEXT_SCALE}, attributes), g);
    return {
      g, text,
      line: dy => make('tspan', {x: 0, y: dy * TEXT_SCALE}, text),
      width: element => (element.textContent.length ? element.getComputedTextLength() / TEXT_SCALE : 0),
    };
  }

  // ---------------------------------------------------------------- best-so-far curve
  const curve = [pathOf(2), pathOf(3)];
  const vertices = [];
  for (const [, command, args] of curve[1].getAttribute('d').matchAll(/([MHV])\s*([-\d.\s]+)/g)) {
    const values = args.trim().split(/\s+/).map(Number);
    const last = vertices[vertices.length - 1];
    if (command === 'M') vertices.push([values[0], 453.6 - values[1]]);
    else if (command === 'H') vertices.push([values[0], last[1]]);
    else vertices.push([last[0], 453.6 - values[0]]);
  }
  const cumulative = [0];
  for (let k = 1; k < vertices.length; k++) cumulative.push(cumulative[k - 1] + Math.hypot(
    vertices[k][0] - vertices[k - 1][0], vertices[k][1] - vertices[k - 1][1]));
  const curveLength = cumulative[cumulative.length - 1];
  // Length along the curve where it reaches x; at a step, before or after the rise.
  function lengthAt(x, side = 'after') {
    for (let k = 1; k < vertices.length; k++) {
      const [ax, ay] = vertices[k - 1], [bx, by] = vertices[k];
      if (Math.abs(ax - bx) < 0.01 && Math.abs(ax - x) < 0.6 && Math.abs(ay - by) > 0.01) {
        return side === 'before' ? cumulative[k - 1] : cumulative[k];
      }
      if (Math.abs(ay - by) < 0.01 && x >= ax - 0.01 && x <= bx + 0.01) return cumulative[k - 1] + (x - ax);
    }
    throw new Error(`curve does not reach x=${x}`);
  }
  function pointAt(length) {
    for (let k = 1; k < vertices.length; k++) {
      if (length <= cumulative[k] || k === vertices.length - 1) {
        const f = clamp((length - cumulative[k - 1]) / Math.max(cumulative[k] - cumulative[k - 1], 1e-9));
        return [vertices[k - 1][0] + (vertices[k][0] - vertices[k - 1][0]) * f,
          vertices[k - 1][1] + (vertices[k][1] - vertices[k - 1][1]) * f];
      }
    }
  }
  const moves = [];  // [t0, t1, from, to]
  function curveTo(t0, duration, length) {
    const from = moves.length ? moves[moves.length - 1][3] : 0;
    moves.push([t0, t0 + duration, from, length]);
    return t0 + duration;
  }
  const moveEase = p => (p < 0.5 ? 2 * p * p : 1 - 2 * (1 - p) ** 2);
  function curveLengthAt(t) {
    let length = 0;
    for (const [t0, t1, from, to] of moves) {
      if (t >= t0) length = from + (to - from) * moveEase(prog(t, t0, t1 - t0));
    }
    return length;
  }
  // First time the head reaches `length` during a move (for events on the way).
  function timeAt(length) {
    for (const [t0, t1, from, to] of moves) {
      if (to >= length - 1e-6 && from <= length + 1e-6 && to > from) {
        let lo = t0, hi = t1;
        for (let k = 0; k < 40; k++) {
          const mid = (lo + hi) / 2;
          if (curveLengthAt(mid) < length) lo = mid; else hi = mid;
        }
        return hi;
      }
    }
    throw new Error(`the curve never reaches length ${length}`);
  }
  claim([2, 3]);
  const head = make('g', {'pointer-events': 'none'});
  make('circle', {r: 6.2, fill: '#7a5fc4', 'fill-opacity': 0.16}, head);
  make('circle', {r: 2.7, fill: '#ffffff', stroke: '#7a5fc4', 'stroke-width': 1.4}, head);
  rules.push(t => {
    op[2] = op[3] = 1; tf[2] = tf[3] = '';
    const length = curveLengthAt(t), finished = length >= curveLength - 1e-6;
    for (const path of curve) path.style.strokeDasharray = finished ? '' : `${length} ${curveLength + 2}`;
    const moving = moves.find(([t0, t1]) => t > t0 && t < t1);
    head.setAttribute('display', moving ? 'inline' : 'none');
    if (moving) {
      const [x, y] = pointAt(length);
      head.setAttribute('transform', `translate(${x} ${y})`);
      head.setAttribute('opacity', smooth(prog(t, moving[0], 0.1)) * (1 - smooth(prog(t, moving[1] - 0.1, 0.1))));
    }
  });

  // ---------------------------------------------------------------- episodes
  const PT = inches => inches * 72;
  const beats = [];  // [time, name]: one review frame per story beat
  const beat = (t, name) => beats.push([+t.toFixed(2), name]);
  const EPISODES = [{
    name: 'iter 5', gate: [129, 132], gateIcon: 132, gateLabel: [133, 138], decision: [139, 147], x: PT(2.4),
    squiggle: 106, loopLabel: [107, 116], panel: [151, 152], panelOrigin: [PT(1.82), PT(3.2)], header: [153, 176],
    knowBox: [177, 178], knowText: [179, 281], knowPill: [282, 299],
    roundTag: [300, 306], roundDigit: 307, field: 308, fieldStroke: 309, magnifier: 310, query: [311, 373],
    predChip: [374, 385], docRow: [386, 409],
    plotBox: [[410, 411], [413, 432]], plotIcon: 412, plotLabels: [[433, 439], [454, 460]], segments: [440, 441],
    points: [[442, 443], [446, 447], [450, 451]], pointLabels: [[444, 445], [448, 449], [452, 453]],
    snapCard: [461, 463], snapHead: [464, 497], snapBody: [498, 682], docChip: [683, 690], arrow: [691, 692],
    topK: [117, 118, [119, 128]], best: [148, 150], connector: 693,
    card: [[694, 696]], cardIcon: 697, cardTitle: [698, 734], counts: [735, 740], caption: [741, 786],
    code: 787, lines: [[788, [789, 839]], [840, [841, 887]], [888, [889, 936]]], pill: [937, 938], pillText: [939, 965],
    rounds: [QUERY_R1, QUERY_R2, null],
  }, {
    name: 'iter 66', gate: [967, 970], gateIcon: 970, gateLabel: [971, 977], decision: [978, 986], x: PT(8.95),
    squiggle: 966, loopLabel: null, panel: [1002, 1003], panelOrigin: [PT(8.74), PT(3.2)], header: [1004, 1028],
    knowBox: [1029, 1030], knowText: [1031, 1123], knowPill: [1124, 1141],
    roundTag: [1142, 1149], roundDigit: null, field: 1150, fieldStroke: 1151, magnifier: 1152, query: [1153, 1210],
    predChip: [1211, 1223], docRow: [1224, 1247],
    plotBox: [[1248, 1249], [1251, 1270]], plotIcon: 1250, plotLabels: [[1271, 1278], [1293, 1300]], segments: [1279, 1280],
    points: [[1281, 1282], [1285, 1286], [1289, 1290]], pointLabels: [[1283, 1284], [1287, 1288], [1291, 1292]],
    snapCard: [1301, 1303], snapHead: [1304, 1351], snapBody: [1352, 1540], docChip: [1541, 1548], arrow: [1549, 1550],
    topK: [990, 991, [992, 1001]], best: [987, 989], connector: 1551,
    card: [[1552, 1554]], cardIcon: 1555, cardTitle: [1556, 1593], counts: [1594, 1599], caption: [1600, 1664],
    code: 1665, lines: [[1666, [1667, 1725]], [1726, [1727, 1751]], [null, [1752, 1803]]], pill: [1804, 1805],
    pillText: [1806, 1832], rounds: [null],
  }];

  const HOLD0 = 0.8, FADE = 0.3, START = HOLD0 + FADE + 0.2, HOLD = 3;
  const X28 = PT(4.6), X64 = PT(8.45), XSTAR = PT(12.2);
  let c = START;

  // One inner-loop episode: a new card opens, queries are typed and searched round by round,
  // the kept document is read and highlighted, and the top-K documents return to the gate.
  function inner(e, c) {
    const searches = [], plotSearches = [];
    c = draw(e.squiggle, c, 0.75) - 0.15;
    if (e.loopLabel) appear(e.loopLabel, c - 0.3, {dur: 0.35});
    appear(e.panel, c, {from: 0.9, soft: true, dur: 0.4, origin: e.panelOrigin});
    appear(e.header, c + 0.15, {dx: -6, dur: 0.35});
    c += 0.5;
    appear([e.knowBox, e.knowPill], c, {dy: 5, dur: 0.3});
    beat(c + 0.9, `${e.name}: knowledge state`);
    c = type(e.knowText, c + 0.3, 110) + 0.3;

    const tagAt = c;
    appear(e.roundTag, c, {dur: 0.3});
    appear([e.field, e.fieldStroke], c, {dy: 4, dur: 0.3});
    appear(e.plotBox, c + 0.1, {dy: 4, dur: 0.3});
    motion(e.magnifier, c, orbit(e.magnifier, searches));
    motion(e.plotIcon, c + 0.1, orbit(e.plotIcon, plotSearches));
    c += 0.45;

    // Rounds typed as overlay text (iteration 5, rounds 1-2) precede the round the figure shows.
    const queryGlyphs = flat(e.query).filter(isGlyph), querySize = glyph[queryGlyphs[0]].size;
    const baselines = [...new Set(queryGlyphs.map(i => glyph[i].y.toFixed(1)))].map(Number).sort((a, b) => a - b);
    const lineGap = (baselines[baselines.length - 1] - baselines[0]) / (baselines.length - 1);
    const middle = (baselines[0] + baselines[baselines.length - 1]) / 2;
    const textX = Math.min(...queryGlyphs.map(i => glyph[i].x)), textWidth = PT(1.84) - 1;
    const row = flat(e.docRow), rowBaseline = glyph[row.find(isGlyph)].y;
    const digits = [];  // [from, to, label] while an overlay round is shown
    e.rounds.forEach((query, r) => {
      if (query === null) {
        if (e.roundDigit !== null) appear([e.roundDigit], c - 0.05, {dur: 0.12});
        beat(c + 0.4, `${e.name}: query typed`);
        c = type(e.query, c, 75) + 0.1;
        searches.push([c, c + 0.75]);
        beat(c + 0.4, `${e.name}: searching`);
        c += 0.85;
        return;
      }
      const block = overlayText(e.query[1], textX, middle, querySize, {fill: '#1a1a1a'});
      const lines = [''], probe = block.line(0);
      for (const word of query.split(' ')) {
        const candidate = lines[lines.length - 1] ? `${lines[lines.length - 1]} ${word}` : word;
        probe.textContent = candidate;
        if (block.width(probe) > textWidth && lines[lines.length - 1]) lines.push(word);
        else lines[lines.length - 1] = candidate;
      }
      probe.remove();
      const spans = lines.map((line, k) => block.line((k - (lines.length - 1) / 2) * lineGap));
      const status = overlayText(row[row.length - 1], boxes[row[0]][0], rowBaseline, 9.5,
        {fill: '#6b6b6b', 'font-style': 'italic'});
      status.line(0).textContent = ROUND_STATUS;
      const [text, statusText] = [block.g, status.g];
      const cps = 75, t0 = c, t1 = t0 + query.length / cps, found = t1 + 0.8, clear = t1 + 1.55;
      const shownAt = t => (t < t0 ? 0 : Math.min(query.length, Math.floor((t - t0) * cps) + 1));
      pulses.push(t => {
        let left = shownAt(t);
        lines.forEach((line, k) => {
          spans[k].textContent = line.slice(0, Math.max(0, Math.min(line.length, left)));
          left -= line.length + 1;
        });
        const out = 1 - smooth(prog(t, clear, 0.2));
        text.setAttribute('display', t >= t0 && t < clear + 0.2 ? 'inline' : 'none');
        text.setAttribute('opacity', out);
        statusText.setAttribute('display', t >= found && t < clear + 0.2 ? 'inline' : 'none');
        statusText.setAttribute('opacity', smooth(prog(t, found, 0.25)) * out);
      });
      carets.push({t0, t1, color: '#1a1a1a', at: t => {
        let left = shownAt(t), k = 0;
        for (; k < lines.length - 1 && left > lines[k].length; k++) left -= lines[k].length + 1;
        return {x: textX + block.width(spans[k]) + 0.6, y: middle + Number(spans[k].getAttribute('y')) / TEXT_SCALE,
          size: querySize};
      }});
      searches.push([t1 + 0.1, found]);
      beat(t0 + 0.4, `${e.name}: round ${r + 1} query`);
      beat(found + 0.45, `${e.name}: round ${r + 1} results`);
      pointIn(e, r, found + 0.25);
      c = t1 + 1.8;
      digits.push([r ? t0 - 0.05 : tagAt, c - 0.05, String(r + 1)]);
    });
    if (digits.length) {
      const d = glyph[e.roundDigit];
      const digit = overlayText(e.roundDigit, d.x, d.y, d.size, {fill: '#ffffff', 'font-weight': 500});
      const label = digit.line(0);
      pulses.push(t => {
        const shown = digits.find(([a, b]) => t >= a && t < b);
        digit.g.setAttribute('display', shown ? 'inline' : 'none');
        digit.g.setAttribute('opacity', smooth(prog(t, tagAt, 0.3)));
        if (shown) label.textContent = shown[2];
      });
    }

    // The kept document of the round shown: row, arrow, snapshot, highlighted passage.
    appear(e.docRow, c, {dx: -8, dur: 0.35});
    pop(e.predChip, c + 0.25);
    c += 0.55;
    c = draw(e.arrow[0], c, 0.22, {linear: true});
    pop([e.arrow[1]], c - 0.05, {dur: 0.2});
    appear([e.snapCard, e.snapHead], c, {dx: -10, dur: 0.38});
    beat(c + 0.6, `${e.name}: kept document`);
    c += 0.4;
    const body = flat(e.snapBody), marks = body.filter(i => pathOf(i)?.getAttribute('fill') === '#ffef8a');
    c = type(body.filter(i => !marks.includes(i)), c, 240, {caret: false}) + 0.1;
    for (const i of marks) c = sweep(i, c, 0.06 + (boxes[i][2] - boxes[i][0]) / 600);
    beat(c - 0.2, `${e.name}: highlight`);
    pop(e.docChip, c + 0.05);
    c += 0.4;
    if (e.rounds.length === 3) {
      pointIn(e, 2, c);
      c += 0.6;
    } else {
      // Iteration 66 shows round 1; the plot records the kept documents of all three rounds.
      for (let r = 0; r < 3; r++) {
        if (r > 0) { plotSearches.push([c, c + 0.6]); c += 0.65; }
        pointIn(e, r, c);
        c += 0.35;
      }
      c += 0.2;
    }
    shimmer(e.field, searches);
    if (plotSearches.length) shimmer(e.plotBox[0][0], plotSearches);

    // The top-K documents return to the outer loop.
    const [topPath, topHead, topLabel] = e.topK;
    appear(topLabel, c + 0.15, {dur: 0.3});
    beat(c + 0.4, `${e.name}: top-K docs`);
    c = draw(topPath, c, 0.7);
    pop([topHead], c - 0.08, {dur: 0.22});
    return c + 0.15;
  }

  // Mean predicted score of the documents kept after round r.
  function pointIn(e, r, t0) {
    pop(e.points[r], t0, {dur: 0.35});
    appear(e.pointLabels[r], t0 + 0.05, {dur: 0.25});
    if (r > 0) draw(e.segments[r - 1], t0 - 0.25, 0.25, {linear: true});
    if (r === 0) appear(e.plotLabels[0], t0 + 0.1, {dur: 0.25});
    if (r === 2) appear(e.plotLabels[1], t0 + 0.15, {dx: -4, dur: 0.3});
  }

  // The outer loop writes the kept child, evaluates it, and records a new best.
  function outer(e, c) {
    const cardAt = c;
    appear([e.card, e.cardTitle], c, {dy: 8, dur: 0.38});
    c = type(e.caption, c + 0.35, 110) + 0.12;
    appear([e.code], c, {dur: 0.2});
    c += 0.2;
    for (const [bg, text] of e.lines) {
      if (bg !== null) appear([bg], c, {dur: 0.15});
      beat(c + 0.3, `${e.name}: code`);
      c = type(text, c + 0.05, 90, {caret: '#e6edf3'}) + 0.1;
    }
    pop(e.counts, c);
    c += 0.3;
    const icon = center([e.cardIcon]), wobble = [c, c + 0.7];
    motion(e.cardIcon, cardAt, t => {
      if (t <= wobble[0] || t >= wobble[1]) return '';
      const p = prog(t, wobble[0], wobble[1] - wobble[0]);
      return xf(icon, 1, 0, 0, 16 * Math.sin(p * Math.PI * 4) * (1 - p));
    });
    c += 0.45;
    const pillGlyphs = flat(e.pillText), arrowAt = pillGlyphs.findIndex(i => units[i].getAttribute('data-text') === '→');
    pop([e.pill, pillGlyphs.slice(0, arrowAt)], c, {from: 0.7, dur: 0.4});
    beat(c + 0.2, `${e.name}: evaluated`);
    c = type(pillGlyphs.slice(arrowAt), c + 0.55, 26, {caret: false}) + 0.35;
    return c;
  }

  // ---------------------------------------------------------------- the story
  // Outer loop runs to iteration 5; the gate decides to retrieve.
  const [ep1, ep2] = EPISODES;
  c = curveTo(c, 1.0, lengthAt(ep1.x, 'before'));
  pop(ep1.gate, c - 0.05);
  appear(ep1.gateLabel, c + 0.1, {dx: -5, dur: 0.3});
  pulse(center([ep1.gateIcon]), c + 0.25, '#d9a95a', 13);
  c += 0.75;
  pop(ep1.decision, c);
  beat(c + 0.2, 'iter 5: gate retrieves');
  c = inner(ep1, c + 0.35);
  c = outer(ep1, c);

  // The kept child is the new best: the curve rises, then keeps evolving to a plateau.
  c = draw(ep1.connector, c, 0.35, {reverse: true});
  beat(c + 0.2, 'iter 5: new best');
  pop(ep1.best, c - 0.05);
  pulse(center(ep1.best), c + 0.05, '#7a5fc4', 11);
  c = curveTo(c, 0.35, lengthAt(ep1.x, 'after'));
  c = curveTo(c, 1.1, lengthAt(X28, 'after'));
  const plateau = c;
  c = curveTo(c, 1.3, lengthAt(X64));
  draw(21, plateau, (c - plateau) * 1.1, {linear: true});
  appear([22], plateau, {dur: 0.2});
  appear([23], c + 0.1, {dur: 0.2});
  appear([24, 55], plateau + 0.55, {dur: 0.4});

  // Iteration 64 looks up stored documents: no new search, no new best.
  beat(c + 0.9, 'iter 64: look-up');
  pop([56, 59], c - 0.05);
  pulse(center([59]), c + 0.2, '#d9a95a', 12);
  pop([60, 67], c + 0.55);
  c = type([68, 105], c + 0.7, 90, {caret: false}) + 0.35;

  // Iteration 66 retrieves again.
  c = curveTo(c, 0.45, lengthAt(ep2.x, 'before'));
  pop(ep2.gate, c - 0.05);
  appear(ep2.gateLabel, c + 0.1, {dx: -5, dur: 0.3});
  pulse(center([ep2.gateIcon]), c + 0.25, '#d9a95a', 13);
  c += 0.75;
  pop(ep2.decision, c);
  c = inner(ep2, c + 0.35);
  c = outer(ep2, c);
  c = draw(ep2.connector, c, 0.35, {reverse: true});
  beat(c + 0.2, 'iter 66: new best');
  pop(ep2.best, c - 0.05);
  pulse(center(ep2.best), c + 0.05, '#7a5fc4', 11);
  c = curveTo(c, 0.3, lengthAt(ep2.x, 'after'));

  // Later incumbents; the final best passes the released SimpleTES program on Q20.
  c = curveTo(c, 1.7, curveLength);
  const star = timeAt(lengthAt(XSTAR));
  pop([1902, 1905], star - 0.05, {dur: 0.45});
  pulse(center([1903]), star + 0.1, '#7a5fc4', 15);
  c = Math.max(c, star + 0.45);
  c = draw(1901, c, 0.3, {reverse: true});
  appear([1841, 1854], c - 0.05, {dy: 6, dur: 0.38});
  c += 0.35;
  appear([1855, 1868], c, {dx: -6, dur: 0.3});
  appear([1869, 1883], c + 0.2, {dx: -6, dur: 0.3});
  pop([1884, 1900], c + 0.5, {dur: 0.45});
  beat(c + 0.3, 'final best');
  c += 1.0;
  const duration = Math.round((c + HOLD) * 20) / 20;

  // ---------------------------------------------------------------- caret and top overlays
  layer.appendChild(rings);
  layer.appendChild(head);
  const caret = make('rect', {width: 0.9, 'pointer-events': 'none'}, layer);
  const animated = [];
  for (let i = 0; i < n; i++) if (claimed[i]) animated.push(i);

  function setTime(time) {
    const intro = time < START;
    const t = intro ? Infinity : time;  // the published still, before the story starts
    for (const rule of rules) rule(t);
    for (const p of pulses) p(t);
    const typing = carets.filter(k => t >= k.t0 && t <= k.t1 + 0.35).at(-1);
    caret.setAttribute('display', typing ? 'inline' : 'none');
    if (typing) {
      const {x, y, size} = typing.at(Math.min(t, typing.t1));
      caret.setAttribute('x', x);
      caret.setAttribute('y', y - size * 0.8);
      caret.setAttribute('height', size * 1.0);
      caret.setAttribute('fill', typing.color);
      caret.setAttribute('opacity', t > typing.t1 ? (Math.floor((t - typing.t1) / 0.18) % 2 ? 0 : 1) : 1);
    }
    const fade = intro ? 1 - smooth(prog(time, HOLD0, FADE)) : 1;
    for (const i of animated) {
      const alpha = op[i] * fade, w = wraps[i];
      w.setAttribute('display', alpha > 0.002 ? 'inline' : 'none');
      if (alpha < 0.999) w.setAttribute('opacity', alpha.toFixed(3)); else w.removeAttribute('opacity');
      if (tf[i]) w.setAttribute('transform', tf[i]); else w.removeAttribute('transform');
    }
  }

  // Frames for review, one per beat.
  beats.sort((a, b) => a[0] - b[0]);
  const keyTimes = [0, START + 0.6, ...beats.map(([t]) => t), duration - 0.1];
  window.teaserMotion = {duration, setTime, keyTimes, beats, hold: HOLD, ready: true};
  setTime(0);
})();
