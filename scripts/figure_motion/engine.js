// Shared machinery for the figure animations (teaser.js, method.js), which
// build_figure_motion.py plays in headless Chromium over the unchanged figure PDFs.
//
// MuPDF writes one SVG element per glyph, path and image in the PDF's paint order, so scenes
// address elements ("units") by index; the `text` and `paint` checks pin those indices to the
// figure before anything runs. Each unit gets its own wrapper <g>, so opacity and transforms
// never change paint order. setTime(t) is a pure function of t, so frames can be captured in
// any order; the first `hold0` and the last `hold` seconds show the figure exactly as published.
'use strict';

function createFigureMotion({count, text = [], paint = [], hold0 = 0.8, fade = 0.3}) {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.querySelector('#figure svg');
  // Units are the children of each clipped layer; a layer holding one element is one unit.
  const layers = [...svg.querySelectorAll(':scope > g > g')];
  const units = layers.flatMap(layer => (layer.children.length > 1 ? [...layer.children] : [layer]));
  const top = layers[layers.length - 1];
  const n = units.length;

  // ---------------------------------------------------------------- figure checks and geometry
  if (n !== count) throw new Error(`expected ${count} figure elements, found ${n}`);
  const textOf = (a, b) => units.slice(a, b + 1).filter(u => u.tagName === 'use')
    .map(u => u.getAttribute('data-text') || '').join('');
  for (const [a, b, expected] of text) {
    if (textOf(a, b) !== expected) throw new Error(`elements ${a}-${b}: "${textOf(a, b)}" is not "${expected}"`);
  }
  for (const [i, attribute, value] of paint) {
    const element = units[i].tagName === 'path' ? units[i] : units[i].querySelector('path');
    if (element?.getAttribute(attribute) !== value) throw new Error(`element ${i}: ${attribute} is not ${value}`);
  }

  const wraps = units.map(unit => {
    const g = document.createElementNS(NS, 'g');
    unit.parentNode.insertBefore(g, unit);
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
  const flat = (...parts) => parts.flatMap(p => (Array.isArray(p) ? (p.length === 2 && p[1] >= p[0] &&
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
  const persistent = new Uint8Array(n);  // always visible, so the opening fade leaves them alone
  const rules = [];
  const claim = (ids, keep = false) => {
    for (const i of ids) {
      if (claimed[i]) throw new Error(`element ${i} is animated twice`);
      claimed[i] = 1;
      persistent[i] = keep ? 1 : 0;
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
  const after = (i, element) => { wraps[i].parentNode.insertBefore(element, wraps[i].nextSibling); return element; };
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
    const reverse = o.toward ? nearStart(i, o.toward) : o.reverse;
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
        target.style.strokeDashoffset = reverse ? `${length - total}` : '0';
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

  // ---------------------------------------------------------------- flows between components
  // A path's points in figure coordinates (MuPDF paths carry a y-flip transform).
  function pathPoints(i) {
    const path = pathOf(i), matrix = path.getCTM(), total = path.getTotalLength();
    return {total, at: length => { const p = path.getPointAtLength(length).matrixTransform(matrix); return [p.x, p.y]; }};
  }
  const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  // Whether the path starts nearer `point` than it ends (then it runs away from the point).
  function nearStart(i, point) {
    const {total, at} = pathPoints(i);
    return distance(at(0), point) < distance(at(total), point);
  }

  // A dot that runs along an arrow toward its head. It is drawn right after the head, so labels
  // and decision chips painted later cover it, as they cover the arrow.
  function token(pathIndex, headIndex, t0, duration, color) {
    const {total, at} = pathPoints(pathIndex), forward = !nearStart(pathIndex, center([headIndex]));
    const g = after(headIndex, make('g', {'pointer-events': 'none'}));
    make('circle', {r: 9, fill: color, 'fill-opacity': 0.22}, g);
    make('circle', {r: 4.2, fill: '#ffffff', stroke: color, 'stroke-width': 2}, g);
    pulses.push(t => {
      const p = prog(t, t0, duration), moving = p > 0 && p < 1;
      g.setAttribute('display', moving ? 'inline' : 'none');
      if (!moving) return;
      const [x, y] = at(total * (forward ? smooth(p) : 1 - smooth(p)));
      g.setAttribute('transform', `translate(${x} ${y})`);
      g.setAttribute('opacity', smooth(p / 0.15) * smooth((1 - p) / 0.15));
    });
    return t0 + duration;
  }

  // Outline a component (its own box path) or a rectangle while it works, during any of
  // `windows` (the array may grow later). Drawn after `afterIndex`, below later badges.
  function glow(shape, afterIndex, color, windows) {
    const g = after(afterIndex, make('g', {'pointer-events': 'none', fill: 'none', stroke: color,
      'stroke-linejoin': 'round'}));
    for (const [width, alpha] of [[8, 0.2], [2.4, 0.9]]) {
      if (Array.isArray(shape)) {
        make('rect', {x: shape[0], y: shape[1], width: shape[2] - shape[0], height: shape[3] - shape[1], rx: 5,
          'stroke-width': width, 'stroke-opacity': alpha}, g);
      } else {
        const box = pathOf(shape);
        make('path', {d: box.getAttribute('d'), transform: box.getAttribute('transform'), 'stroke-width': width,
          'stroke-opacity': alpha}, g);
      }
    }
    pulses.push(t => {
      const w = windows.find(([a, b]) => t > a - 0.2 && t < b + 0.3);
      g.setAttribute('display', w ? 'inline' : 'none');
      if (w) g.setAttribute('opacity', smooth(prog(t, w[0] - 0.2, 0.2)) * (1 - smooth(prog(t, w[1], 0.3))));
    });
    return windows;
  }

  // A brief scale pulse of a group that stays visible (icon badges, decision chips) at each of
  // `times` (the array may grow later).
  function bump(ids, times, amount = 0.2) {
    ids = claim(flat(ids), true);
    const c = center(ids);
    rules.push(t => {
      let scale = 1;
      for (const t0 of times) {
        const p = prog(t, t0, 0.5);
        if (p > 0 && p < 1) scale = 1 + amount * Math.sin(Math.PI * p);
      }
      const transform = xf(c, scale);
      for (const i of ids) { op[i] = 1; tf[i] = transform; }
    });
    return times;
  }

  // Turn a cycle arrow clockwise while its loop runs: whole turns at a steady speed with short
  // ramps, so it comes to rest where it started.
  function spin(i, windows, period = 1.8, ramp = 0.5) {
    claim([i], true);
    const c = center([i]);
    rules.push(t => {
      op[i] = 1;
      tf[i] = '';
      const w = windows.find(([a, b]) => t > a && t < b);
      if (!w) return;
      const span = w[1] - w[0], turns = Math.max(1, Math.round(span / period)), v = 360 * turns / (span - ramp);
      const s = t - w[0], left = w[1] - t;
      const angle = s < ramp ? v * s * s / (2 * ramp) : left < ramp ? 360 * turns - v * left * left / (2 * ramp)
        : v * (s - ramp / 2);
      tf[i] = xf(c, 1, 0, 0, angle);
    });
  }

  // Text that is not in the figure, set in the figure's own face (Figtree by default) at its
  // sizes. It is laid out 20x larger and scaled down: at 10 px Chromium rounds glyph advances.
  // overlayText paints right after a figure element; textAt inside a group of the story's own.
  const TEXT_SCALE = 20;
  function scaledText(g, size, attributes) {
    const text = make('text', Object.assign({'font-family': 'Figtree', 'font-size': size * TEXT_SCALE}, attributes), g);
    return {
      g, text,
      line: dy => make('tspan', {x: 0, y: dy * TEXT_SCALE}, text),
      width: element => (element.textContent.length ? element.getComputedTextLength() / TEXT_SCALE : 0),
    };
  }
  const placed = (x, y) => make('g', {transform: `translate(${x} ${y}) scale(${1 / TEXT_SCALE})`});
  const overlayText = (anchorIndex, x, y, size, attributes) =>
    scaledText(after(anchorIndex, placed(x, y)), size, attributes);
  const textAt = (parent, x, y, size, attributes) => {
    const g = placed(x, y);
    parent.appendChild(g);
    return scaledText(g, size, attributes);
  };

  // ---------------------------------------------------------------- story beats and playback
  const START = hold0 + fade + 0.2;
  const beats = [];  // [time, name]: one review frame per story beat
  const beat = (t, name) => beats.push([+t.toFixed(2), name]);

  // Publish window.figureMotion once the story ends at `end`; the still then holds for `hold`.
  function finish(end, hold, overlays = []) {
    const duration = Math.round((end + hold) * 20) / 20;
    top.appendChild(rings);
    for (const overlay of overlays) top.appendChild(overlay);
    const caret = make('rect', {width: 0.9, 'pointer-events': 'none'}, top);
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
      const dim = intro ? 1 - smooth(prog(time, hold0, fade)) : 1;
      for (const i of animated) {
        const alpha = op[i] * (persistent[i] ? 1 : dim), w = wraps[i];
        w.setAttribute('display', alpha > 0.002 ? 'inline' : 'none');
        if (alpha < 0.999) w.setAttribute('opacity', alpha.toFixed(3)); else w.removeAttribute('opacity');
        if (tf[i]) w.setAttribute('transform', tf[i]); else w.removeAttribute('transform');
      }
    }

    // Frames for review, one per beat.
    beats.sort((a, b) => a[0] - b[0]);
    const keyTimes = [0, START + 0.6, ...beats.map(([t]) => t), duration - 0.1];
    window.figureMotion = {duration, setTime, keyTimes, beats, hold, ready: true};
    setTime(0);
  }

  return {
    units, wraps, boxes, glyph, range, flat, bounds, center, isGlyph, pathOf,
    clamp, smooth, easeOut, back, prog, op, tf, claim, rules, pulses, carets, xf, make, defs, toggle, after,
    appear, pop, type, draw, sweep, motion, orbit, pulse, shimmer, overlayText, textAt, TEXT_SCALE, START, beat, finish,
    pathPoints, token, glow, bump, spin,
  };
}
