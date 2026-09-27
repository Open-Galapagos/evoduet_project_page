// Method motion: one outer iteration (t = 5) of the recorded Swap Reduction run, played through
// the unchanged Method figure (static/figures/method.pdf). Runs on engine.js.
//
// The diagram stays in place: the working component is outlined, a dot carries each hand-off
// along its arrow, a loop arrow turns once per pass of its loop, and each zoom-in inset fills in
// as its step executes. No text is added; every glyph is the figure's own. What existed before
// iteration 5 (doc 01 in the Search DB, the population rows 690e7bf1 and ee6d0860) shows from
// the start. The figure details rounds 1 and 3, so round 2 is one quick lap of the loop.
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
    center, appear, pop, type, draw, motion, orbit, pulse, shimmer, token, glow, bump, spin, START, beat,
    finish,
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

  // One round of the left panel: search, returned documents, their scores and the kept ones.
  function roundResults(r, c) {
    c = flow('query', c, 0.5);
    work('web', c - 0.1, c + 1.2);
    pop(r.webBadge, c);
    appear(r.card, c + 0.1, {dy: 4});
    r.searching.push([c + 0.25, c + 1.0]);
    c += 1.05;
    r.docs.forEach((doc, k) => appear(doc, c + 0.15 * k, {dx: -6}));
    appear(r.dots, c + 0.3);
    c = flow('webDoc', c + 0.45, 0.5);
    work('evidence', c - 0.1, c + (r.evidenceHold ?? 1.0));
    pop(r.evalBadge, c);
    r.scores.forEach((score, k) => pop(score, c + 0.15 * (k + 1)));
    r.checks.forEach((check, k) => pop(check, c + 0.55 + 0.15 * k));
    return c;
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

  // Inner loop, round 1: the query, the web search, and the scored documents.
  const r1 = {webBadge: [702, 705], evalBadge: [706, 709], card: [710, 712], docs: [[[713], [714, 733]], [[743], [744, 760]]],
    dots: [770, 772], scores: [[734, 739], [761, 766]], checks: [[740, 742], [767, 769]], searching: []};
  work('query', c, c + 1.4);
  appear([605, 635], c + 0.05, {dx: -6});
  pop([636, 639], c + 0.2);
  appear([640, 642], c + 0.3, {dy: 3});
  motion(643, c + 0.3, orbit(643, r1.searching));
  c = type([644, 701], c + 0.45, 75) + 0.1;
  beat(c, 'round 1 query');
  c = roundResults(r1, c);
  beat(c + 0.5, 'round 1 scored');
  c = flow('score', c + 1.0, 0.5);
  work('local', c - 0.1, c + 1.5);
  appear([[773], [863, 880]], c + 0.1, {dy: 4});
  c = type([774, 862], c + 0.35, 110) + 0.1;
  pop([[579, 582], [591, 597]], c);
  innerTurns.push([c + 0.3, c + 1.5]);
  c = flow('topK', c + 0.4, 0.5);

  // Round 2: one lap of the loop, recorded as the second kept-docs point.
  const lap = c;
  for (const [node, arrow] of [['query', 'query'], ['web', 'webDoc'], ['evidence', 'score']]) {
    work(node, c, c + 0.55);
    c = flow(arrow, c + 0.2, 0.4);
  }
  work('local', c, c + 0.7);
  draw(576, c, 0.3, {linear: true, toward: center([583])});
  pop([583, 586], c + 0.25);
  beat(c + 0.4, 'round 2');
  innerTurns.push([lap + 0.6, c + 0.3], [c + 0.45, c + 1.5]);
  c = flow('topK', c + 0.6, 0.45);

  // Round 3: the query is constructed from the knowledge state after round 2 ...
  work('query', c, c + 4.2);
  pop([1344, 1351], c + 0.05);
  appear([[1352], [1490, 1515]], c + 0.15, {dy: 4});
  c = type([1353, 1489], c + 0.4, 130) + 0.1;
  c = draw(1516, c, 0.15, {linear: true});
  pop([1517], c - 0.05, {dur: 0.2});
  pop([1518, 1520], c);
  pulse(center([1520]), c + 0.2, BLUE, 17);
  appear([1521, 1522], c + 0.4, {dx: -6});
  c = type([1523, 1568], c + 0.55, 80) + 0.1;
  pop([1569, 1570], c, {dur: 0.25});
  appear([1571, 1573], c + 0.1, {dy: 3});
  const r3 = {webBadge: [988, 991], evalBadge: [992, 995], card: [996, 998], docs: [[[999], [1000, 1016]], [[1026], [1027, 1041]]],
    dots: [1048, 1050], scores: [[1017, 1022], [1042, 1047]], checks: [[1023, 1025]], searching: [], evidenceHold: 2.3};
  motion(1574, c + 0.1, orbit(1574, []));
  beat(c + 0.6, 'round 3 query construction');
  c = type([1575, 1671], c + 0.3, 110) + 0.2;
  // ... then searched, as in the left panel.
  appear([881, 913], c, {dx: -6});
  pop([914, 917], c + 0.15);
  appear([918, 920], c + 0.25, {dy: 3});
  motion(921, c + 0.25, orbit(921, r3.searching));
  c = type([922, 987], c + 0.4, 150) + 0.1;
  c = roundResults(r3, c);
  // The evidence evaluation inset: the scored dSABRE document.
  appear([1142, 1150], c + 0.3, {dy: 6});
  appear([1159, 1183], c + 0.55);
  pop([1184, 1189], c + 0.9);
  pop([1190, 1192], c + 1.15);
  beat(c + 1.3, 'round 3 scored');
  c = draw(1193, c + 1.5, 0.15, {linear: true});
  pop([1194], c - 0.05, {dur: 0.2});
  c = flow('score', c, 0.5);
  work('local', c - 0.1, c + 2.3);
  appear([1227, 1272], c + 0.05, {dx: -8});
  appear([1273, 1315], c + 0.2, {dx: -8});
  appear([1316, 1324], c + 0.35);
  pop([1151, 1158], c + 0.35);
  pop([1217, 1226], c + 0.5);
  appear([[1051], [1124, 1141]], c + 0.7, {dy: 4});
  c = type([1052, 1123], c + 0.95, 110) + 0.1;
  draw(577, c, 0.3, {linear: true, toward: center([587])});
  pop([[578], [587, 590], [598, 604]], c + 0.25);
  beat(c + 0.5, 'round 3 kept');
  c += 0.6;
  shimmer(711, r1.searching);
  shimmer(997, r3.searching);

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
