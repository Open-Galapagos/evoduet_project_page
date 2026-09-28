// Method motion: one outer iteration (t = 5) of the recorded Swap Reduction run, played through
// the unchanged Method figure (static/figures/method.pdf). Runs on engine.js.
//
// The diagram stays in place: the working component is outlined, a dot carries each hand-off
// along its arrow, a loop arrow turns once per pass of its loop, and each zoom-in inset fills in
// as its step executes. Every inner round runs Query Construction -> Web Search -> Evidence
// Evaluation -> Local Search Database in order. The Query Construction inset builds each
// round's query; the search and its scoring run in the left panel's round 1 and round 3
// blocks, and round 2, which the panel does not detail, searches in the Web Search box only.
// The only added text is the recorded round 1 and 2 queries (FIGURE_DATA, from
// method-rounds.json) and the Round pill's digit, set in the figure's own Liberation Sans;
// everything else is the figure's own glyphs. What existed before iteration 5 (doc 01 in the
// Search DB, the population rows 690e7bf1 and ee6d0860) shows from// the start.
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
    boxes, glyph, range, center, isGlyph, smooth, back, prog, pulses, carets, xf, make, after, appear, pop, type, draw,
    motion, orbit, pulse, shimmer, textAt, TEXT_SCALE, token, glow, bump, spin, unveil, START, beat, finish,
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

  // ---------------------------------------------------------------- the inner loop, round by round
  // The Query Construction inset (bottom left) builds each round's query from the knowledge
  // state the round starts with: the model states what to look for (the bubble) and writes the
  // query. Rounds 1 and 2 show the recorded texts (excerpts: verbatim fragments joined with
  // "...", as the figure's own cards are); round 3 is the figure's own.
  const ROUNDS = FIGURE_DATA.rounds;
  const LIBERATION = {'font-family': 'Liberation Sans'};
  const top = after(1671, make('g'));  // above the inset's own content, below the next inset
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

  // Where the figure sets text in a box: left edge, size, line pitch, middle and line count.
  function layoutOf(first, last, right) {
    const glyphs = range(first, last).filter(isGlyph);
    const baselines = [...new Set(glyphs.map(i => glyph[i].y.toFixed(1)))].map(Number).sort((a, b) => a - b);
    const x = Math.min(...glyphs.map(i => glyph[i].x)), n = baselines.length;
    return {x, size: glyph[glyphs[0]].size, width: right - x, lines: n, middle: (baselines[0] + baselines[n - 1]) / 2,
      gap: (baselines[n - 1] - baselines[0]) / (n - 1)};
  }
  const KNOWLEDGE = layoutOf(1353, 1489, boxes[1352][2] - 6);
  const INTENT = layoutOf(1523, 1568, boxes[1522][2] - 6);
  const QUERY = layoutOf(1575, 1671, boxes[1572][2] - 10);
  function excerpt({text, excerpt: parts}) {
    for (const part of parts) if (!text.includes(part)) throw new Error(`not in the record: ${part}`);
    return (text.startsWith(parts[0]) ? '' : '... ') + parts.join(' ... ') + (text.endsWith(parts[parts.length - 1]) ? '' : ' ...');
  }

  // Recorded text typed into a box, set like the figure's own text there; hidden at `until.at`.
  function typedText(text, where, t0, cps, until) {
    const block = textAt(top, where.x, 0, where.size, Object.assign({fill: '#1a1a1a'}, LIBERATION));
    const lines = wrap(block, text, where.width);
    if (lines.length > where.lines) throw new Error(`"${text}" needs ${lines.length} lines, the box holds ${where.lines}`);
    if (lines.some(line => measure(block, line) > where.width)) throw new Error(`"${text}" is wider than its box`);
    const spans = lines.map((_, j) => block.line(where.middle + (j - (lines.length - 1) / 2) * where.gap));
    const t1 = t0 + text.length / cps;
    const shown = t => (t < t0 ? 0 : Math.min(text.length, Math.floor((t - t0) * cps) + 1));
    pulses.push(t => {
      fill(spans, lines, shown(t));
      block.g.setAttribute('display', t >= t0 && t < until.at ? 'inline' : 'none');
    });
    carets.push({t0, t1, color: '#1a1a1a', at: t => {
      let left = shown(t), j = 0;
      for (; j < lines.length - 1 && left > lines[j].length; j++) left -= lines[j].length + 1;
      return {x: where.x + block.width(spans[j]) + 0.6, y: Number(spans[j].getAttribute('y')) / TEXT_SCALE, size: where.size};
    }});
    return t1;
  }

  // A short recorded label in place of a figure text while the story runs: `schedule` holds
  // [from, to, text]; each new text pops in. `at` is the left end, or the center when centered.
  function swapText(parent, at, schedule, attributes, centered = false) {
    const block = textAt(parent, 0, 0, at.size, Object.assign({}, LIBERATION, attributes));
    const line = block.line(at.y);
    pulses.push(t => {
      const shown = schedule.find(([a, b]) => t >= a && t < b);
      block.g.setAttribute('display', shown ? 'inline' : 'none');
      if (!shown) return;
      line.textContent = shown[2];
      const x = centered ? at.x - block.width(line) / 2 : at.x;
      block.g.setAttribute('transform', `${xf([at.x, at.y - at.size * 0.35], 0.6 + 0.4 * back(prog(t, shown[0], 0.35)))} ` +
        `translate(${x} 0) scale(${1 / TEXT_SCALE})`);
    });
  }
  const glyphAt = i => ({x: glyph[i].x, y: glyph[i].y, size: glyph[i].size});

  // The left panel's blocks for rounds 1 and 3, where the search and its scoring run: the query
  // issued, the returned documents, Evidence Evaluation's scores and checks, and the knowledge
  // state after the round.
  const PANEL = [
    {head: [605, 642], magnifier: 643, query: [644, 701], webBadge: [702, 705], evalBadge: [706, 709],
      card: [710, 712], docs: [[[713], [714, 733]], [[743], [744, 760]]], dots: [770, 772],
      scores: [[734, 739], [761, 766]], checks: [[740, 742], [767, 769]], knowledge: [[773], [863, 880]],
      knowledgeText: [774, 862]},
    null,
    {head: [881, 920], magnifier: 921, query: [922, 987], webBadge: [988, 991], evalBadge: [992, 995],
      card: [996, 998], docs: [[[999], [1000, 1016]], [[1026], [1027, 1041]]], dots: [1048, 1050],
      scores: [[1017, 1022], [1042, 1047]], checks: [[1023, 1025]], knowledge: [[1051], [1124, 1141]],
      knowledgeText: [1052, 1123]},
  ];
  // Mean predicted score of the documents kept after each round (the Kept docs plot).
  function plotPoint(k, t) {
    if (k === 0) return pop([[579, 582], [591, 597]], t);
    draw(k === 1 ? 576 : 577, t - 0.3, 0.3, {linear: true, toward: center([k === 1 ? 583 : 587])});
    pop(k === 1 ? [583, 586] : [[578], [587, 590], [598, 604]], t);
  }

  // ---------------------------------------------------------------- the zoom-in insets
  // Each inset pops out of the diagram the first time its step runs: its wedge grows from the
  // diagram toward it, and the inset springs out of the wedge's diagram-side end. `side` is the
  // wedge's diagram side; `parts` are the inset's frame and what it shows from the start.
  const INSETS = {
    population: {wedge: 9, side: 'top', parts: [[19, 20], [2341, 2360], [2373, 2399], [2426, 2482]]},
    gate: {wedge: 11, side: 'top', parts: [[23, 24], [1873, 1896]]},
    query: {wedge: 6, side: 'top', parts: [[15, 16], [1325, 1343]]},
    rounds: {wedge: 7, side: 'right', parts: [[12], [535, 575]]},
    local: {wedge: 5, side: 'bottom', parts: [[13, 14], [1195, 1216]]},
    searchdb: {wedge: 10, side: 'bottom', parts: [[21, 22], [1672, 1742]]},
    prompt: {wedge: 8, side: 'bottom', parts: [[17, 18]]},
  };
  function popOut(name, t) {
    const {wedge, side, parts} = INSETS[name], [x0, y0, x1, y1] = boxes[wedge];
    unveil(wedge, t, 0.35, side);
    const origin = {top: [(x0 + x1) / 2, y0], bottom: [(x0 + x1) / 2, y1], right: [x1, (y0 + y1) / 2]}[side];
    pop(parts, t + 0.15, {from: 0.7, dur: 0.45, origin});
    beat(t + 0.3, `${name} inset pops out`);
    return t + 0.55;
  }

  let c = START;

  // The outer loop picks the parent from the solution database and hands it to the gate.
  work('soldb', c, c + 1.9);
  outerTurns.push([c, c + 1.9]);
  popOut('population', c);
  glow([995, 574.5, 1208, 602.5], 2449, VIOLET, [[c + 0.7, c + 1.8]]);
  beat(c + 1.2, 'select parent');
  c = flow('parent', c + 1.4, 0.6);

  // The gate reads its knowledge state and decides to retrieve.
  const gate = c;
  c = popOut('gate', c);
  work('gating', gate, c + 3.3);
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
  const digits = [];  // [from, to, text]: the Round pill's digit while rounds 1-2 run
  const labels = [];  // the knowledge state card's label (initial, after R1)
  const counts = [], scores = [];  // the Local Search Database's count and dSABRE's score
  const searchBox = [];  // when the Web Search box itself searches (round 2)
  let cleared = null;
  ROUNDS.forEach((round, k) => {
    const last = k === ROUNDS.length - 1, qc = c;
    if (cleared) cleared.at = qc;
    if (k === 0) {
      c = popOut('query', c);
      pop([1344, 1350], c + 0.05);                       // the Round pill
      appear([[1352], [1490, 1507]], c + 0.1, {dy: 4});  // the knowledge state card
      c += 0.3;
    }
    if (!last) {
      digits.push([k ? qc : qc + 0.05, Infinity, String(round.round)]);
      if (k) digits[k - 1][1] = qc;
      labels.push([k ? qc : qc + 0.2, Infinity, round.knowledge_state_before.label]);
      if (k) labels[k - 1][1] = qc;
      cleared = {at: Infinity};
      c = typedText(excerpt(round.knowledge_state_before), KNOWLEDGE, c + 0.15, 130, cleared) + 0.1;
      if (k === 0) {
        c = draw(1516, c, 0.15, {linear: true});
        pop([1517], c - 0.05, {dur: 0.2});
        pop([1518, 1520], c);
        appear([1521, 1522], c + 0.3, {dx: -6});
      }
      pulse(center([1520]), c + 0.05, BLUE, 17);
      c = typedText(excerpt(round.query_intent), INTENT, c + 0.45, 80, cleared) + 0.1;
      if (k === 0) {
        pop([1569, 1570], c, {dur: 0.25});
        appear([1571, 1574], c + 0.1, {dy: 3});
        c += 0.1;
      }
      c = typedText(round.query, QUERY, c + 0.2, 75, cleared) + 0.25;
    } else {
      // Round 3: the figure's own card (after R2), bubble and query.
      digits[k - 1][1] = labels[k - 1][1] = qc;
      appear([1351], qc, {dur: 0.12});
      appear([1508, 1515], qc, {dur: 0.12});
      c = type([1353, 1489], c + 0.15, 130) + 0.1;
      pulse(center([1520]), c + 0.05, BLUE, 17);
      c = type([1523, 1568], c + 0.45, 80) + 0.1;
      c = type([1575, 1671], c + 0.2, 90) + 0.25;
    }
    work('query', qc, c);
    beat(c - 0.3, `round ${round.round} query`);

    // Web Search: in the left panel's block for rounds 1 and 3, in the Web Search box for round 2.
    c = flow('query', c, 0.5);
    const web = c, panel = PANEL[k];
    if (panel) {
      const searching = [];
      if (k === 0) c = popOut('rounds', c);
      appear(panel.head, c, {dx: -6});
      motion(panel.magnifier, c, orbit(panel.magnifier, searching));
      c = type(panel.query, c + 0.2, 160) + 0.1;
      pop(panel.webBadge, c);
      appear(panel.card, c + 0.1, {dy: 4});
      searching.push([c + 0.2, c + 1.0]);
      shimmer(panel.card[0] + 1, searching);
      c += 1.05;
      panel.docs.forEach((doc, j) => appear(doc, c + 0.15 * j, {dx: -6}));
      appear(panel.dots, c + 0.3);
      c += 0.5;
    } else {
      searchBox.push([c + 0.1, c + 1.3]);
      c += 1.4;
    }
    work('web', web - 0.1, c);
    beat(c - 0.3, `round ${round.round} web search`);

    // Evidence Evaluation predicts each document's child score; the round keeps the best.
    c = flow('webDoc', c, 0.5);
    const evaluation = c;
    if (panel) {
      pop(panel.evalBadge, c);
      panel.scores.forEach((score, j) => pop(score, c + 0.15 * (j + 1)));
      panel.checks.forEach((check, j) => pop(check, c + 0.55 + 0.15 * j));
      c += 1.0;
    } else {
      c += 0.8;
    }
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
    beat(c - 0.3, `round ${round.round} evidence`);

    // The Local Search Database keeps the top documents; the panel records what the round learned.
    c = flow('score', c, 0.5);
    const local = c;
    // Its list shows the top kept documents; the count of scored documents grows each round.
    // The doc ids come later, from the Search DB.
    if (k === 0) {
      c = popOut('local', c);
      appear([1235, 1272], c + 0.05, {dx: -8});  // Structured Scaling ..., 6,968
      appear([1281, 1310], c + 0.2, {dx: -8});   // dSABRE ..., whose score follows the rounds
      appear([1316, 1324], c + 0.35);
      pop([1217], c + 0.3, {dur: 0.3});          // the count pill
    }
    const kept = round.kept_after_round[1].predicted_child_score, update = c + 0.3;
    if (k) counts[k - 1][1] = update;
    if (!last) {
      counts.push([update + 0.15, Infinity, `${round.scored_so_far} scored`]);
      if (!k) scores.push([update, Infinity, Math.round(kept).toLocaleString('en-US')]);
    } else {
      if (Math.round(kept) !== 6963) throw new Error('the figure shows dSABRE at 6,963 after round 3');
      scores[0][1] = update;
      pop([1311, 1315], update, {dur: 0.3});
      pop([1218, 1226], update + 0.15, {dur: 0.3});
    }
    beat(update + 0.4, `round ${round.round} local database`);
    c += 0.6;
    if (panel) {
      appear(panel.knowledge, c + 0.1, {dy: 4});
      c = type(panel.knowledgeText, c + 0.3, 130) + 0.1;
    }
    plotPoint(k, c + 0.3);
    c += 0.75;
    work('local', local - 0.1, c);
    beat(c - 0.3, `round ${round.round} kept`);
    if (!last) {
      innerTurns.push([c + 0.05, c + 1.25]);
      c = flow('topK', c + 0.1, 0.5);
    }
  });
  shimmer(46, searchBox, 46);  // round 2's search, on the Web Search box under its label
  swapText(top, glyphAt(1508), labels, {fill: '#6b6b6b', 'font-style': 'italic'});
  const listTop = after(1324, make('g'));
  swapText(listTop, {x: center([1217])[0], y: glyph[1218].y, size: glyph[1218].size}, counts, {fill: '#ffffff'}, true);
  swapText(listTop, glyphAt(1311), scores, {fill: '#2f5f9e'});
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
  const added = c;
  c = popOut('searchdb', c);
  work('searchdb', added - 0.1, c + 1.5);
  pop([[1227, 1234], [1273, 1280], [1151, 1158]], c + 0.6, {dur: 0.35});  // their Search DB ids
  appear([1743, 1763], c + 0.1);
  appear([1782, 1828], c + 0.35, {dx: -8});
  appear([1829, 1872], c + 0.5, {dx: -8});
  beat(c + 0.9, 'documents added');
  c += 1.1;

  // ... retrieved for the prompt, with the selected solutions.
  flow('selected', c, 0.6);
  c = flow('retrieved', c, 0.6);
  const prompted = c;
  c = popOut('prompt', c);
  work('prompt', prompted - 0.1, c + 1.9);
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
