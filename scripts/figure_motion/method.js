// Method motion: one outer iteration (t = 5) of the recorded Swap Reduction run, played through
// the unchanged Method figure (static/figures/method.pdf). Runs on engine.js.
//
// The diagram stays in place: the working component is outlined, a dot carries each hand-off
// along its arrow, a loop arrow turns once per pass of its loop, and each zoom-in inset fills in
// as its step executes. Every inner round runs Query Construction -> Web Search -> Evidence
// Evaluation -> Local Search Database in order. The bottom-left inset types the round's query
// and then shows its five web search results with their raw content verbatim, scored one by
// one. That added text is recorded run data (FIGURE_DATA, from method-rounds.json) set in the
// figure's own Liberation Sans; everything else is the figure's own glyphs. What existed before
// iteration 5 (doc 01 in the Search DB, the population rows 690e7bf1 and ee6d0860) shows from
// the start.
//
// Scene lists nest freely and any [first, last] pair of indices means an inclusive range, so
// scattered single elements are written [[a], [b]].
(() => {
  'use strict';
  const SCENE_TEXT = [
    [27, 44, 'Query Construction'], [47, 56, 'Web Search'], [106, 126, 'Local Search Database'],
    [129, 147, 'Evidence Evaluation'], [150, 165, 'Retrieval Gating'], [168, 176, 'Search DB'],
    [179, 197, 'Solution Evaluation'], [200, 216, 'Solution Database'], [277, 295, 'Solution Generation'],
    [298, 316, 'Prompt Construction'], [338, 344, 'Look-Up'], [349, 356, 'Retrieve'], [419, 423, 'No-Op'],
    [607, 613, 'Round 1'], [714, 733, 'Structured Scaling …'], [883, 889, 'Round 3'],
    [1000, 1016, 'dSABRE: A SABRE-…'], [1153, 1158, 'doc 08'], [1218, 1226, '15 scored'],
    [1345, 1351, 'Round 3'], [1508, 1515, 'after R2'], [1744, 1763, 'Newly added (iter 5)'],
    [1764, 1781, '6,957.0 → 11,325.6'], [2101, 2108, 'Retrieve'], [2126, 2131, 'Prompt'],
    [2211, 2222, 'GPT-5.6-Luna'], [2250, 2275, '+ fn weighted_score_delta('], [2362, 2372, '6 solutions'],
    [2403, 2410, 'c302e9b5'], [2418, 2425, '11,325.6'], [2535, 2546, 'C0  11,325.6'],
    [2550, 2581, 'best of 8 valid children is kept'],
  ];
  const SCENE_PAINT = [
    [26, 'fill', '#b5d3f3'], [58, 'stroke', '#000000'], [128, 'fill', '#b5d3f3'], [149, 'fill', '#f7c887'],
    [297, 'fill', '#d3c4f6'], [711, 'fill', '#ffffff'], [1743, 'fill', '#e4effb'], [2125, 'fill', '#f2f2f2'],
    [2400, 'fill', '#f1ecff'],
  ];
  const {
    boxes, glyph, range, center, isGlyph, pathOf, smooth, back, prog, pulses, carets, xf, make, defs, after, appear, pop,
    type, draw, pulse, textAt, TEXT_SCALE, token, glow, bump, spin, START, beat, finish,
  } = createFigureMotion({count: 2626, text: SCENE_TEXT, paint: SCENE_PAINT, fade: 0.05});

  const BLUE = '#3f78c0', AMBER = '#b8720f', VIOLET = '#7a5fc4', GREEN = '#1db36b';
  // Components of the main diagram: box path, last glyph of the label (the outline is drawn
  // right after it, under the corner badge), badge, and zone color.
  const NODE = {
    query: {box: 26, label: 44, badge: [2598, 2601], color: BLUE},
    web: {box: 46, label: 56, badge: [2594, 2597], color: BLUE},
    local: {box: 105, label: 126, badge: [2590, 2593], color: BLUE},
    evidence: {box: 128, label: 147, badge: [2586, 2589], color: BLUE},
    gating: {box: 149, label: 165, badge: [2606, 2609], color: AMBER},
    searchdb: {box: 167, label: 176, badge: [2602, 2605], color: AMBER},
    evaluation: {box: 178, label: 197, badge: [2622, 2625], color: VIOLET},
    soldb: {box: 199, label: 216, badge: [2618, 2621], color: VIOLET},
    generation: {box: 276, label: 295, badge: [2614, 2617], color: VIOLET},
    prompt: {box: 297, label: 316, badge: [2610, 2613], color: VIOLET},
  };
  // Arrows: path, head, and the color of what travels on them.
  const ARROW = {
    score: [58, 59, BLUE], topK: [65, 66, BLUE], query: [81, 82, BLUE], webDoc: [88, 89, BLUE],
    prompt: [218, 219, VIOLET], solution: [226, 227, VIOLET], scored: [236, 237, VIOLET],
    selected: [253, 254, VIOLET], retrieve: [317, 318, BLUE], parent: [345, 346, VIOLET],
    retrieved: [357, 358, BLUE], added: [359, 360, BLUE],
  };
  const windows = {}, badges = {};
  for (const [name, node] of Object.entries(NODE)) {
    windows[name] = glow(node.box, node.label, node.color, []);
    badges[name] = bump(node.badge, []);
  }
  const work = (name, t0, t1) => { windows[name].push([t0, t1]); badges[name].push(t0); };
  const flow = (name, t0, duration = 0.5) => token(...ARROW[name].slice(0, 2), t0, duration, ARROW[name][2]);
  const innerTurns = [], outerTurns = [];
  spin(57, innerTurns, 1.6);
  spin(217, outerTurns, 1.6);
  const retrieveChip = bump([347, 356], []);  // the chip on the gate's Retrieve arrow

  // ---------------------------------------------------------------- the inner loop's live inset
  // The bottom-left inset zooms into the lower row (Query Construction, Web Search). Rounds 1
  // and 2 type their recorded query into its field; round 3 is the figure's own. During Web
  // Search a panel over the inset lists the round's five results: title and raw_content,
  // verbatim (whitespace collapsed, clipped at the box edge, never edited). Evidence Evaluation
  // then adds each predicted child score, and the documents kept after the round get a check.
  const ROUNDS = FIGURE_DATA.rounds;
  const LIBERATION = {'font-family': 'Liberation Sans'};
  const top = after(1671, make('g'));  // above the inset's own content, below the next inset
  const queryGlyphs = range(1575, 1671).filter(isGlyph), querySize = glyph[1575].size;
  const baselines = [...new Set(queryGlyphs.map(i => glyph[i].y.toFixed(1)))].map(Number).sort((a, b) => a - b);
  const queryX = Math.min(...queryGlyphs.map(i => glyph[i].x)), queryWidth = boxes[1572][2] - 10 - queryX;
  const lineGap = (baselines[baselines.length - 1] - baselines[0]) / (baselines.length - 1);

  function measure(block, text) {
    const probe = block.line(0);
    probe.textContent = text;
    const width = block.width(probe);
    probe.remove();
    return width;
  }
  function wrap(block, text, width) {
    const lines = [''];
    for (const word of text.split(' ')) {
      const candidate = lines[lines.length - 1] ? `${lines[lines.length - 1]} ${word}` : word;
      if (lines[lines.length - 1] && measure(block, candidate) > width) lines.push(word);
      else lines[lines.length - 1] = candidate;
    }
    return lines;
  }
  // Fill `spans` with the first `count` characters of `lines` (a space between lines counts).
  function fill(spans, lines, count) {
    lines.forEach((line, j) => {
      spans[j].textContent = line.slice(0, Math.max(0, Math.min(line.length, count)));
      count -= line.length + 1;
    });
  }

  // A recorded query typed into the inset's field; hidden again when `until.at` comes.
  function typedQuery(query, t0, until) {
    const block = textAt(top, queryX, 0, querySize, Object.assign({fill: '#1a1a1a'}, LIBERATION));
    const lines = wrap(block, query, queryWidth), middle = (baselines[0] + baselines[baselines.length - 1]) / 2;
    const spans = lines.map((_, j) => block.line(middle + (j - (lines.length - 1) / 2) * lineGap));
    const cps = 75, t1 = t0 + query.length / cps;
    const shown = t => (t < t0 ? 0 : Math.min(query.length, Math.floor((t - t0) * cps) + 1));
    pulses.push(t => {
      fill(spans, lines, shown(t));
      block.g.setAttribute('display', t >= t0 && t < until.at ? 'inline' : 'none');
    });
    carets.push({t0, t1, color: '#1a1a1a', at: t => {
      let left = shown(t), j = 0;
      for (; j < lines.length - 1 && left > lines[j].length; j++) left -= lines[j].length + 1;
      return {x: queryX + block.width(spans[j]) + 0.6, y: Number(spans[j].getAttribute('y')) / TEXT_SCALE, size: querySize};
    }});
    return t1;
  }

  const clip = (id, x0, y0, x1, y1) => {
    const element = make('clipPath', {id, clipPathUnits: 'userSpaceOnUse'}, defs);
    make('rect', {x: x0, y: y0, width: x1 - x0, height: y1 - y0}, element);
    return `url(#${id})`;
  };
  const inset = pathOf(15), insetClip = make('clipPath', {id: 'inset', clipPathUnits: 'userSpaceOnUse'}, defs);
  make('path', {d: inset.getAttribute('d'), transform: inset.getAttribute('transform')}, insetClip);
  const fade = make('linearGradient', {id: 'fade-right'}, defs);
  [[0, 0], [1, 1]].forEach(([offset, alpha]) => make('stop', {offset, 'stop-color': '#ffffff', 'stop-opacity': alpha}, fade));
  const ROW = {x: 311, right: 668, top: 506, height: 30.1, chip: 606, check: 661};
  const title = {x: glyph[1325].x, y: glyph[1325].y, size: glyph[1325].size};

  // The round's search results over the inset; `times` gives when each part happens.
  function resultsPanel(round, times) {
    const g = make('g', {'clip-path': 'url(#inset)'}, top);
    make('rect', {x: 299, y: 503, width: 380, height: 160, fill: '#ffffff'}, g);
    make('rect', {x: 306, y: 480, width: 128, height: 22.5, fill: '#ffffff'}, g);  // over the inset's title
    const heading = textAt(g, title.x, 0, title.size, Object.assign({fill: '#3f78c0'}, LIBERATION));
    const headingLine = heading.line(title.y);
    headingLine.textContent = 'Web Search';  // the component this panel zooms into
    make('path', {d: `M${title.x} 497.9H${title.x + heading.width(headingLine)}`, stroke: '#3f78c0',
      'stroke-width': 0.709}, g);
    const band = make('rect', {y: 503, height: 155, width: 70, fill: 'url(#shimmer)'}, g);
    const rows = round.results.map((doc, k) => {
      const y = ROW.top + k * ROW.height, row = make('g', {}, g);
      if (k) make('path', {d: `M${ROW.x} ${y - 1.8}H${ROW.right}`, stroke: '#e3e6ea', 'stroke-width': 0.6}, row);
      const name = textAt(make('g', {'clip-path': clip(`result-title-${round.round}-${k}`, ROW.x, y - 2, ROW.chip - 5, y + 11)}, row),
        ROW.x, 0, 9.5, Object.assign({fill: '#1f5fbf'}, LIBERATION));
      name.line(y + 8.4).textContent = doc.title;
      if (measure(name, doc.title) > ROW.chip - 5 - ROW.x) {  // a long title fades out before the score
        make('rect', {x: ROW.chip - 33, y: y - 1, width: 28, height: 11.5, fill: 'url(#fade-right)'}, row);
      }
      const body = textAt(make('g', {'clip-path': clip(`result-body-${round.round}-${k}`, ROW.x, y + 10, ROW.right, y + 30)}, row),
        ROW.x, 0, 8, Object.assign({fill: '#333333'}, LIBERATION));
      const all = wrap(body, doc.raw_content.replace(/\s+/g, ' ').trim(), ROW.right - ROW.x), lines = all.slice(0, 2);
      const spans = lines.map((_, j) => body.line(y + 18.3 + 9.2 * j));
      const total = lines.join(' ').length;
      if (all.length > 2) {  // the text goes on: fade the end of the second line
        make('rect', {x: ROW.right - 38, y: y + 20.4, width: 38, height: 9.5, fill: 'url(#fade-right)'}, row);
      }
      const chip = make('g', {}, row);
      make('rect', {x: ROW.chip, y: y + 0.3, width: 44, height: 11, rx: 5.5, fill: '#cfe2f8'}, chip);
      const score = textAt(chip, 0, 0, 8.3, Object.assign({fill: '#2f5f9e'}, LIBERATION)), scoreLine = score.line(y + 8.6);
      scoreLine.textContent = Math.round(doc.predicted_child_score).toLocaleString('en-US');
      score.g.setAttribute('transform', `translate(${ROW.chip + 22 - score.width(scoreLine) / 2} 0) scale(${1 / TEXT_SCALE})`);
      const check = make('g', {}, row);
      if (doc.kept) {
        make('circle', {cx: ROW.check, cy: y + 5.8, r: 5.6, fill: '#1db36b'}, check);
        make('path', {d: `M${ROW.check - 2.6} ${y + 5.9}l1.8 1.9 3.5 -3.9`, fill: 'none', stroke: '#ffffff',
          'stroke-width': 1.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round'}, check);
      }
      return {row, name, chip, check, spans, lines, total, kept: doc.kept, chipAt: [ROW.chip + 22, y + 5.8],
        checkAt: [ROW.check, y + 5.8]};
    });
    pulses.push(t => {
      const on = t >= times.in && t < times.out + 0.1;  // a dense panel: cut, not a long fade
      g.setAttribute('display', on ? 'inline' : 'none');
      if (!on) return;
      g.setAttribute('opacity', smooth(prog(t, times.in, 0.25)) * (1 - smooth(prog(t, times.out, 0.1))));
      const searching = t > times.search[0] && t < times.search[1];
      band.setAttribute('display', searching ? 'inline' : 'none');
      band.setAttribute('x', 299 - 70 + 450 * prog(t, times.search[0], times.search[1] - times.search[0]));
      rows.forEach((r, k) => {
        const at = times.rows[k];
        r.name.g.setAttribute('opacity', smooth(prog(t, at, 0.15)));
        fill(r.spans, r.lines, Math.floor(r.total * prog(t, at + 0.1, 0.4)));
        const c = prog(t, times.chips[k], 0.3);
        r.chip.setAttribute('display', c > 0 ? 'inline' : 'none');
        r.chip.setAttribute('opacity', smooth(c / 0.5));
        r.chip.setAttribute('transform', xf(r.chipAt, 0.5 + 0.5 * back(c)));
        const v = prog(t, times.verdict, 0.3);
        r.check.setAttribute('display', v > 0 ? 'inline' : 'none');
        r.check.setAttribute('transform', xf(r.checkAt, 0.35 + 0.65 * back(v)));
        r.row.setAttribute('opacity', r.kept ? 1 : 1 - 0.55 * smooth(prog(t, times.verdict, 0.15)));
      });
    });
  }

  // The left panel logs rounds 1 and 3 once they are scored: query, results, scores, kept.
  function logRound(log, t) {
    appear(log.head, t, {dx: -6});
    appear(log.query, t + 0.1);
    appear(log.card, t + 0.25, {dx: -6});
    appear(log.docs, t + 0.35, {dx: -6});
    log.scores.forEach((score, k) => pop(score, t + 0.5 + 0.12 * k));
    appear(log.knowledge, t + 0.8, {dy: 4});
    return type(log.knowledgeText, t + 1.0, 160) + 0.1;
  }
  const LOGS = [
    {head: [605, 643], query: [644, 701], card: [702, 712], docs: [[713, 733], [743, 760], [770, 772]],
      scores: [[734, 742], [761, 769]], knowledge: [[773], [863, 880]], knowledgeText: [774, 862]},
    null,
    {head: [881, 921], query: [922, 987], card: [988, 998], docs: [[999, 1016], [1026, 1041], [1048, 1050]],
      scores: [[1017, 1025], [1042, 1047]], knowledge: [[1051], [1124, 1141]], knowledgeText: [1052, 1123]},
  ];
  // Mean predicted score of the documents kept after each round (the Kept docs plot).
  function plotPoint(k, t) {
    if (k === 0) return pop([[579, 582], [591, 597]], t);
    draw(k === 1 ? 576 : 577, t - 0.3, 0.3, {linear: true, toward: center([k === 1 ? 583 : 587])});
    pop(k === 1 ? [583, 586] : [[578], [587, 590], [598, 604]], t);
  }

  let c = START;

  // The outer loop picks the parent from the solution database and hands it to the gate.
  work('soldb', c, c + 1.5);
  outerTurns.push([c, c + 1.5]);
  glow([995, 574.5, 1208, 602.5], 2449, VIOLET, [[c + 0.3, c + 1.4]]);
  beat(c + 0.8, 'select parent');
  c = flow('parent', c + 1.0, 0.6);

  // The gate reads its knowledge state and decides to retrieve.
  work('gating', c, c + 3.3);
  appear([[1897], [1982, 1999]], c + 0.1, {dy: 4});
  c = type([1898, 1981], c + 0.35, 100) + 0.1;
  appear([[2000], [2087, 2098]], c, {dy: 4});
  c = type([2001, 2086], c + 0.25, 100) + 0.15;
  appear([2109, 2124], c, {dur: 0.35});
  pop([2099, 2108], c + 0.3);
  pulse(center([2100]), c + 0.45, BLUE, 26);
  beat(c + 0.5, 'gate retrieves');
  retrieveChip.push(c + 0.6);
  c = flow('retrieve', c + 0.65, 0.6);

  // Inner loop: three rounds, each Query Construction -> Web Search -> Evidence Evaluation ->
  // Local Search Database, then the top-K evidence goes back to Query Construction.
  const digits = [];  // [from, to, label]: the Round pill's digit while rounds 1-2 run
  let cleared = null;
  ROUNDS.forEach((round, k) => {
    const last = k === ROUNDS.length - 1, qc = c;
    if (cleared) cleared.at = qc;
    if (k === 0) {
      pop([1344, 1350], c + 0.05);
      pop([1518, 1520], c + 0.15);
      appear([1571, 1574], c + 0.25, {dy: 3});
      c += 0.35;
    }
    if (!last) {
      digits.push([k ? qc : qc + 0.05, Infinity, String(round.round)]);
      if (k) digits[k - 1][1] = qc;
      pulse(center([1520]), c + 0.1, BLUE, 17);
      cleared = {at: Infinity};
      c = typedQuery(round.query, c + 0.3, cleared) + 0.25;
    } else {
      // Round 3's query comes from the knowledge state after round 2, as the inset records.
      digits[k - 1][1] = qc;
      appear([1351], qc, {dur: 0.12});
      appear([[1352], [1490, 1515]], c + 0.1, {dy: 4});
      c = type([1353, 1489], c + 0.35, 130) + 0.1;
      c = draw(1516, c, 0.15, {linear: true});
      pop([1517], c - 0.05, {dur: 0.2});
      pulse(center([1520]), c + 0.05, BLUE, 17);
      appear([1521, 1522], c + 0.3, {dx: -6});
      c = type([1523, 1568], c + 0.45, 80) + 0.1;
      pop([1569, 1570], c, {dur: 0.25});
      c = type([1575, 1671], c + 0.2, 90) + 0.25;
    }
    work('query', qc, c);
    beat(c - 0.3, `round ${round.round} query`);

    // Web Search returns five documents, whose content streams into the inset.
    c = flow('query', c, 0.5);
    const times = {in: c, search: [c + 0.15, c + 0.8], rows: [], chips: []};
    const web = c;
    c += 0.85;
    round.results.forEach((_, j) => times.rows.push(c + 0.3 * j));
    c += 0.3 * round.results.length + 0.4;
    work('web', web - 0.1, c);
    beat(c - 0.2, `round ${round.round} web search`);

    // Evidence Evaluation predicts a child score for each; the round keeps the best.
    c = flow('webDoc', c, 0.5);
    const evaluation = c;
    round.results.forEach((_, j) => times.chips.push(c + 0.15 + 0.15 * j));
    times.verdict = c + 0.3 + 0.15 * round.results.length;
    c = times.verdict + 0.8;
    beat(times.verdict + 0.35, `round ${round.round} evidence`);
    if (last) {
      // The evidence evaluation inset: the scored dSABRE document.
      appear([1142, 1150], c - 0.2, {dy: 6});
      appear([1159, 1183], c + 0.05);
      pop([1184, 1189], c + 0.35);
      pop([1190, 1192], c + 0.6);
      c = draw(1193, c + 0.9, 0.15, {linear: true});
      pop([1194], c - 0.05, {dur: 0.2});
    }
    work('evidence', evaluation - 0.1, c);

    // The Local Search Database keeps the top documents; the left panel logs the round.
    c = flow('score', c, 0.5);
    times.out = c;
    resultsPanel(round, times);
    const local = c;
    if (last) {
      appear([1227, 1272], c + 0.05, {dx: -8});
      appear([1273, 1315], c + 0.2, {dx: -8});
      appear([1316, 1324], c + 0.35);
      pop([1151, 1158], c + 0.35);
      pop([1217, 1226], c + 0.5);
      c += 0.6;
    }
    if (LOGS[k]) c = logRound(LOGS[k], c + 0.1);
    plotPoint(k, c + 0.3);
    c += 0.75;
    work('local', local - 0.1, c);
    beat(c - 0.3, `round ${round.round} kept`);
    if (!last) {
      innerTurns.push([c + 0.05, c + 1.25]);
      c = flow('topK', c + 0.1, 0.5);
    }
  });
  const digit = glyph[1351];
  const digitText = textAt(after(1351, make('g')), digit.x, 0, digit.size, Object.assign({fill: '#ffffff'}, LIBERATION));
  const digitLine = digitText.line(digit.y);
  pulses.push(t => {
    const shown = digits.find(([a, b]) => t >= a && t < b);
    digitText.g.setAttribute('display', shown ? 'inline' : 'none');
    if (shown) digitLine.textContent = shown[2];
    digitText.g.setAttribute('opacity', smooth(prog(t, digits[0][0], 0.3)));
  });
  c += 0.3;

  // The top-K documents are added to the search database ...
  c = flow('added', c, 0.6);
  work('searchdb', c - 0.1, c + 1.5);
  appear([1743, 1763], c + 0.1);
  appear([1782, 1828], c + 0.35, {dx: -8});
  appear([1829, 1872], c + 0.5, {dx: -8});
  beat(c + 0.9, 'documents added');
  c += 1.1;

  // ... retrieved for the prompt, with the selected solutions.
  flow('selected', c, 0.6);
  c = flow('retrieved', c, 0.6);
  work('prompt', c - 0.1, c + 1.9);
  appear([2125, 2131], c + 0.05, {dy: 4});
  c = c + 0.3;
  for (const row of [[2132, 2156], [2157, 2173], [2174, 2193], [2194, 2199]]) c = type(row, c, 110) + 0.05;
  pop([2200, 2202], c + 0.1);
  pop([2203, 2205], c + 0.25);
  beat(c + 0.5, 'prompt');
  c += 0.6;

  // Eight candidates are generated in parallel (C0, C4 and C7 shown).
  c = flow('prompt', c, 0.5);
  work('generation', c - 0.1, c + 2.3);
  c = draw(2206, c, 0.15, {linear: true});
  pop([2207], c - 0.05, {dur: 0.2});
  pop([2208, 2210], c);
  pulse(center([2210]), c + 0.2, VIOLET, 17);
  appear([2211, 2237], c + 0.25);
  c += 0.5;
  draw(2238, c, 0.12, {linear: true, toward: [1187.3, 125.3]});
  appear([2239], c + 0.1, {dur: 0.15});
  pop([[2240, 2241], [2276, 2277], [2310, 2311]], c + 0.2, {dur: 0.25});
  c += 0.3;
  const windowsAt = c;
  for (const [k, [frame, row]] of [[[2242, 2248], 2249], [[2278, 2284], 2285], [[2312, 2318], 2319]].entries()) {
    appear(frame, windowsAt + 0.1 * k, {dx: -8});
    appear([row], windowsAt + 0.3 + 0.1 * k, {dur: 0.15});
  }
  const code = [[2250, 2275], [2286, 2309], [2320, 2340]];
  c = Math.max(...code.map((lines, k) => type(lines, windowsAt + 0.45, 40, {caret: k === 0 ? '#e6edf3' : false})));
  beat(c - 0.2, 'parallel generation');
  c += 0.2;

  // Each candidate is evaluated; the best of the eight valid children is kept ...
  c = flow('solution', c, 0.5);
  work('evaluation', c - 0.1, c + 1.9);
  appear([2483, 2501], c + 0.1, {dx: 8});
  appear([2505, 2523], c + 0.25, {dx: 8});
  appear([2527, 2546], c + 0.4, {dx: 8});
  pop([2502, 2504], c + 0.8);
  pop([2524, 2526], c + 0.95);
  pop([2547, 2549], c + 1.1);
  pulse(center([2548]), c + 1.25, GREEN, 13);
  beat(c + 1.3, 'evaluation');
  c = type([2550, 2581], c + 1.3, 70, {caret: false}) + 0.2;

  // ... and joins the population, while the search database records what the documents did.
  c = flow('scored', c, 0.5);
  work('soldb', c - 0.1, c + 1.9);
  draw(2582, c, 0.1, {linear: true, toward: [1218.2, 593.3]});
  draw(2583, c + 0.1, 0.2, {linear: true, toward: [1218.2, 551.5]});
  draw(2584, c + 0.3, 0.08, {linear: true, toward: center([2585])});
  pop([2585], c + 0.35, {dur: 0.2});
  appear([2400, 2425], c + 0.45, {dx: 10});
  pop([2361, 2372], c + 0.8);
  c = type([1764, 1781], c + 1.1, 40, {caret: false}) + 0.3;
  beat(c - 0.2, 'new child kept');
  outerTurns.push([c - 1.9, c - 0.3]);
  finish(c, 3);
})();
