// Overview motion: the recorded Swap Reduction story, played step by step on the unchanged
// teaser figure (static/figures/teaser.pdf, built by build_teaser_v5.js). Runs on engine.js.
//
// Added text is limited to recorded run data (trajectories/swap-reduction.html): the round 1
// and round 2 queries of iteration 5 (abridged with "…", as in the figure) and "5 returned ·
// 3 kept" per round. Iteration 66 types only round 1, the round the figure shows; its rounds
// 2 and 3 appear, as in the still, as the kept-document points.
(() => {
  'use strict';
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
  const {
    units, boxes, glyph, flat, center, isGlyph, pathOf, clamp, smooth, easeOut, prog, op, tf, claim, rules, pulses,
    carets, xf, make, appear, pop, type, draw, sweep, motion, orbit, pulse, shimmer, overlayText, TEXT_SCALE, START,
    beat, finish,
  } = createFigureMotion({count: 2074, text: SCENE_TEXT, paint: SCENE_PAINT});

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

  const HOLD = 3;
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
  finish(c, HOLD, [head]);
})();
