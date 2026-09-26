/* The motion clock is illustrative; queries, diffs and plotted scores are recorded. */
(() => {
  'use strict';
  const player = document.querySelector('[data-teaser-player]');
  if (!player) return;
  const figure = player.closest('figure');
  const fallback = figure.querySelector('[data-teaser-fallback]');
  const toggle = figure.querySelector('[data-teaser-toggle]');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const mobile = matchMedia('(max-width: 700px)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const $ = name => player.querySelector(`[data-teaser-${name}]`);
  const clamp = (value, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, value));
  const ease = value => { const t = clamp(value); return t * t * (3 - 2 * t); };
  const format = (value, digits = 0) => Number(value).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const phases = [
    { start: 0, duration: 12, mode: 'search', episode: 0, label: 'Retrieve · 5', caption: 'Queries refine over three rounds.' },
    { start: 12, duration: 8, mode: 'evaluate', episode: 0, label: 'Evaluate · 5', caption: 'Depth weighting enters the router.' },
    { start: 20, duration: 10, mode: 'lookup', episode: 0, label: 'Look-Up · 64', caption: '3 stored documents. 0 new searches. No new best.' },
    { start: 30, duration: 12, mode: 'search', episode: 1, label: 'Retrieve · 66', caption: 'A new search targets decay and scoring.' },
    { start: 42, duration: 8, mode: 'evaluate', episode: 1, label: 'Evaluate · 66', caption: 'A reversal penalty and weight changes are evaluated.' },
    { start: 50, duration: 14, mode: 'final', episode: 1, label: 'Best · 78', caption: 'Further revisions reach the final archived program.' }
  ];
  const total = 64;
  const SVG = 'http://www.w3.org/2000/svg';
  const svgNode = (tag, attrs = {}, text) => {
    const node = document.createElementNS(SVG, tag);
    Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, String(value)));
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const element = (tag, text, attrs = {}) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
    return node;
  };
  const setText = (node, value) => { if (node.textContent !== String(value)) node.textContent = value; };

  fetch(new URL('../data/teaser.json', document.currentScript.src))
    .then(response => { if (!response.ok) throw new Error('Replay unavailable'); return response.json(); })
    .then(init)
    .catch(() => { /* The original paper figure remains visible on a failed load. */ });

  function init(data) {
    if (!Array.isArray(data.history) || data.history.length < 2 || data.episodes?.length !== 2 || !data.history.every(p => Number.isFinite(p.iteration) && Number.isFinite(p.score))) return;
    const nodes = [...player.querySelectorAll('[data-teaser-node]')];
    const tabs = [...player.querySelectorAll('[data-teaser-panel]')];
    const chapterButtons = [...player.querySelectorAll('[data-teaser-chapter]')];
    const roundNodes = [...player.querySelectorAll('[data-teaser-round]')];
    const wires = [...player.querySelectorAll('[data-teaser-wire]')];
    const packets = [...player.querySelectorAll('[data-teaser-packet]')];
    const detail = figure.querySelector('.teaser-detail');
    const detailBody = detail.querySelector('[data-teaser-detail-body]');
    const detailLink = detail.querySelector('[data-teaser-detail-link]');
    let time = reduced.matches ? total : 0;
    let playing = !reduced.matches;
    let visible = false;
    let inStatic = false;
    let speed = 1;
    let frame = null;
    let lastFrame = null;
    let current = -1;
    let selectedPanel = -1;
    let manualPanel = false;
    let codeLines = [];
    let lastScore = '';
    let graph = null;
    let wireLengths = [];

    fallback.hidden = true;
    player.hidden = false;
    toggle.hidden = false;
    figure.querySelector('[data-teaser-replay-note]').hidden = false;

    function phaseAt(value) {
      let index = phases.findIndex(p => value < p.start + p.duration);
      if (index < 0) index = phases.length - 1;
      return { index, phase: phases[index], p: clamp((value - phases[index].start) / phases[index].duration) };
    }
    function setPanel(index) {
      if (selectedPanel === index) return;
      selectedPanel = index;
      nodes.forEach((node, i) => { node.dataset.mobileActive = String(i === index); });
      tabs.forEach((tab, i) => tab.setAttribute('aria-pressed', String(i === index)));
    }
    function replaceCode(lines) {
      const code = $('code');
      code.replaceChildren();
      codeLines = lines.map(line => {
        const text = line.startsWith('+') || line.startsWith('-') ? line[0] + ' ' + line.slice(1).trimStart() : line.trimStart();
        const span = element('span', text, { class: 'teaser-patch-line' + (line.startsWith('-') ? ' is-deletion' : '') });
        code.append(span);
        return span;
      });
    }
    function scene(index) {
      current = index;
      const phase = phases[index], episode = data.episodes[phase.episode];
      const lookup = phase.mode === 'lookup', final = phase.mode === 'final';
      player.dataset.mode = phase.mode;
      player.dataset.chapter = String(index);
      setText($('iteration'), `Iteration ${lookup ? 64 : final ? data.final.iteration : episode.iteration}`);
      setText($('gap'), lookup ? 'Front-layer scaling from stored evidence' : final ? 'Evidence retained across revisions' : episode.gap);
      setText($('phase-badge'), phase.label);
      setText($('scene-caption'), phase.caption);
      setText($('gate'), lookup ? 'Look-Up' : final ? '100 iterations' : 'Retrieve');
      setText($('memory'), lookup ? '3 reused · 0 new' : final ? 'retained' : '+ evidence');
      setText($('document'), lookup ? 'Qiskit + LightSABRE' : phase.episode === 0 ? 'dSABRE' : 'SabreSwap · IBM Quantum');
      $('document').href = lookup ? data.lookup.sources[0].url : episode.featured_source.url;
      setText($('domain'), lookup ? 'Search database' : new URL(episode.featured_source.url).hostname);
      setText($('idea'), lookup ? 'Reuse stored guidance on front-layer scaling.' : episode.idea);
      setText($('prediction'), format(episode.featured_source.predicted_score));
      player.querySelector('.teaser-doc-score').style.visibility = lookup || final ? 'hidden' : 'visible';
      player.querySelector('.teaser-inner-score').style.visibility = lookup || final ? 'hidden' : 'visible';
      setText(player.querySelector('.teaser-doc-stamp'), lookup ? 'REUSED' : 'KEPT');
      setText($('patch-title'), lookup ? 'Incumbent preserved' : final ? 'Final source · excerpt' : episode.title);
      setText($('added'), lookup || final ? '' : `+${episode.additions}`);
      setText($('removed'), lookup || final ? '' : `−${episode.deletions}`);
      replaceCode(lookup ? ['Stored documents → candidate → evaluator', 'Best score unchanged: 17,201.4'] : final ? data.final.preview_code : episode.preview_diff);
      setText($('before'), format(lookup ? data.episodes[1].native_before : final ? data.final.reference : episode.native_before));
      setText($('native-label'), lookup ? 'incumbent' : final ? 'final best' : 'selected child');
      $('final-link').hidden = !final;
      $('final-gain').hidden = !final;
      manualPanel = false;
      chapterButtons.forEach((button, i) => button.setAttribute('aria-pressed', String(i === index)));
    }
    function number(value) {
      const text = value === null ? '—' : format(value);
      if (text === lastScore) return;
      lastScore = text;
      const output = $('after');
      output.replaceChildren();
      output.setAttribute('aria-label', value === null ? 'Awaiting evaluation' : `${text} Q20 SWAPs`);
      [...text].forEach((char, i) => {
        const span = element('span', char, { class: 'teaser-digit', 'aria-hidden': 'true' });
        span.style.setProperty('--digit', i);
        output.append(span);
      });
    }
    function iterationAt(index, p) {
      if (index === 0) return 4 * ease(p / .2);
      if (index === 1) return 4 + ease((p - .52) / .24);
      if (index === 2) return 5 + 59 * ease(p / .32);
      if (index === 3) return 64 + ease(p / .15);
      if (index === 4) return 65 + ease((p - .52) / .24);
      return 66 + 34 * ease(p / .65);
    }
    function render() {
      const { index, phase, p } = phaseAt(time);
      if (index !== current) scene(index);
      const episode = data.episodes[phase.episode];
      const searching = phase.mode === 'search', evaluating = phase.mode === 'evaluate';
      const lookup = phase.mode === 'lookup', final = phase.mode === 'final';
      const search = searching ? clamp(p * 1.13) : 1;
      const round = searching ? Math.min(2, Math.floor(p * 3)) : 2;
      const localRound = searching ? clamp(p * 3 - round) : 1;
      const evidence = searching ? ease((p - .12) / .24) : 1;
      const edit = evaluating ? ease(p / .5) : searching ? 0 : 1;
      const evaluation = evaluating ? ease((p - .3) / .45) : searching ? 0 : 1;
      const highlight = searching ? ease((p - .25) / .5) : 1;
      player.style.setProperty('--search', search.toFixed(3));
      player.style.setProperty('--evidence', evidence.toFixed(3));
      player.style.setProperty('--highlight', highlight.toFixed(3));
      player.style.setProperty('--edit', edit.toFixed(3));
      player.style.setProperty('--evaluation', evaluation.toFixed(3));
      const query = lookup ? 'Look-Up: retrieve committed documents from the search database.' : final ? 'Depth weighting persists in every later best program.' : episode.queries[round].query;
      const characters = searching && !reduced.matches ? Math.max(0, Math.ceil(query.length * ease(localRound / .72))) : query.length;
      setText($('query'), query.slice(0, characters));
      roundNodes.forEach((node, i) => {
        node.classList.toggle('is-current', i === round && !lookup && !final);
        node.classList.toggle('is-done', i < round && !lookup && !final);
      });
      setText($('mean'), format(episode.kept_mean_prediction[round], 1));
      codeLines.forEach((line, i) => line.style.setProperty('--line-progress', ease((edit - i * .14) / .52).toFixed(3)));
      const iteration = iterationAt(index, p);
      const evaluated = evaluating && p >= .76;
      number(lookup ? data.episodes[1].native_before : final ? iteration >= data.final.iteration ? data.final.native_score : null : evaluated ? episode.native_after : null);
      setText($('eval-status'), lookup ? 'No new best' : final ? 'SimpleTES → EvoDuet' : evaluated ? 'New run best' : evaluating ? 'Evaluating candidate…' : 'Candidate pending');
      nodes.forEach((node, i) => node.classList.toggle('is-active', lookup ? i < 2 : searching ? i === (p < .35 ? 0 : 1) : i === 2));
      if (!manualPanel) setPanel(lookup ? 1 : searching ? p < .44 ? 0 : 1 : 2);
      for (let i = 0; i < 2; i++) {
        if (!wireLengths[i]) continue;
        const active = i === 0 ? searching || lookup : evaluating;
        const offset = ((time / (lookup ? 4.5 : 3.6) + i * .25) % 1);
        const point = wires[i].getPointAtLength((lookup ? 1 - offset : offset) * wireLengths[i]);
        packets[i].setAttribute('cx', point.x);
        packets[i].setAttribute('cy', point.y);
        packets[i].style.opacity = active && !reduced.matches ? String(Math.sin(offset * Math.PI) * .85) : '0';
        if (lookup) wires[i].style.stroke = '#ceac6b';
        else wires[i].style.stroke = '';
      }
      drawProgress(iteration);
      const displayedTime = Math.min(time, total);
      $('seek').value = String(Math.round(displayedTime / total * 1000));
      $('seek').setAttribute('aria-valuetext', `${phase.label}, ${Math.floor(displayedTime)} seconds of ${total}`);
      setText($('time'), `${Math.floor(displayedTime / 60)}:${String(Math.floor(displayedTime % 60)).padStart(2, '0')} / 1:04`);
      chapterButtons.forEach((button, i) => button.style.setProperty('--chapter-progress', String(i < index ? 1 : i === index ? p : 0)));
    }
    function rebuildGraph() {
      const svg = $('history');
      const width = Math.max(240, svg.getBoundingClientRect().width), height = 102;
      const left = 41, right = 11, top = 12, bottom = 21;
      const low = data.history[0].score, high = Math.max(...data.history.map(p => p.score));
      const x = value => left + value / 100 * (width - left - right);
      const y = value => top + (high - value) / (high - low) * (height - top - bottom);
      svg.replaceChildren();
      svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
      const defs = svgNode('defs'), clip = svgNode('clipPath', { id: 'teaser-history-clip' });
      const rect = svgNode('rect', { x: 0, y: 0, width: 0, height });
      clip.append(rect);defs.append(clip);
      const gradient = svgNode('linearGradient', { id: 'teaser-history-area', x1: '0', y1: '0', x2: '0', y2: '1' });
      gradient.append(svgNode('stop', { offset: 0, 'stop-color': '#8b70bd', 'stop-opacity': .14 }),svgNode('stop', { offset: 1, 'stop-color': '#8b70bd', 'stop-opacity': .01 }));defs.append(gradient);svg.append(defs);
      for (const score of width < 500 ? [low, high] : [low, (low + high) / 2, high]) {
        svg.append(svgNode('line', { x1: left, x2: width - right, y1: y(score), y2: y(score), stroke: '#ece7f4', 'stroke-width': 1, 'stroke-dasharray': '2 4' }),svgNode('text', { x: left - 7, y: y(score) + 3, 'text-anchor': 'end' }, format(score)));
      }
      for (const tick of [0, 25, 50, 75, 100]) svg.append(svgNode('text', { x: x(tick), y: height - 5, 'text-anchor': 'middle' }, tick));
      let d = `M${x(0)},${y(low)}`;
      for (const point of data.history.slice(1)) d += `H${x(point.iteration)}V${y(point.score)}`;
      svg.append(svgNode('path', { d, stroke: '#dcd3e9', 'stroke-width': 1.3, fill: 'none' }));
      const group = svgNode('g', { 'clip-path': 'url(#teaser-history-clip)' });
      group.append(svgNode('path', { d: d + `L${x(100)},${height - bottom}H${left}Z`, fill: 'url(#teaser-history-area)', stroke: 'none' }),svgNode('path', { d, fill: 'none', stroke: '#8264b8', 'stroke-width': 2.6, 'stroke-linejoin': 'round' }));
      svg.append(group);
      const guide = svgNode('line', { y1: top - 2, y2: height - bottom, stroke: '#c9bbde', 'stroke-width': 1, 'stroke-dasharray': '2 4' });
      svg.append(guide);
      for (const [iteration, chapter] of [[5, 1], [64, 2], [66, 4], [78, 5]]) {
        const point = data.history.find(p => p.iteration === iteration);
        const link = svgNode('a', { href: `#teaser-chapter-${chapter}`, 'aria-label': `Replay iteration ${iteration}`, 'data-teaser-graph-chapter': chapter });
        link.append(svgNode('circle', { cx: x(iteration), cy: y(point.score), r: 3.7, class: 'teaser-event-dot' }));
        link.addEventListener('click', event => { event.preventDefault(); jump(chapter); });
        svg.append(link);
      }
      const halo = svgNode('circle', { r: 7, class: 'teaser-history-halo', 'pointer-events': 'none' });
      const dot = svgNode('circle', { r: 4, class: 'teaser-history-dot', 'pointer-events': 'none' });
      svg.append(halo, dot);
      graph = { x, y, rect, guide, dot, halo };
    }
    function drawProgress(iteration) {
      if (!graph) return;
      let point = data.history[0];
      for (const recorded of data.history) {
        if (recorded.iteration > iteration + 1e-6) break;
        point = recorded;
      }
      const x = graph.x(iteration), y = graph.y(point.score);
      graph.rect.setAttribute('width', x + 1);
      graph.guide.setAttribute('x1', x);graph.guide.setAttribute('x2', x);
      for (const node of [graph.dot, graph.halo]) { node.setAttribute('cx', x);node.setAttribute('cy', y); }
      graph.halo.setAttribute('r', playing && !reduced.matches ? 7 + Math.sin(time * 1.5) * 1.5 : 7);
      setText($('score'), format(point.score, 1));
      player.dataset.recordedIteration = String(point.iteration);
    }
    function layout() {
      rebuildGraph();
      const flow = $('flow'), base = flow.getBoundingClientRect();
      $('flow').querySelector('svg').setAttribute('viewBox', `0 0 ${Math.max(1, base.width)} ${Math.max(1, base.height)}`);
      if (!mobile.matches) {
        wires.forEach((wire, i) => {
          const a = nodes[i].getBoundingClientRect(), b = nodes[i + 1].getBoundingClientRect();
          const x1 = a.right - base.left + 1, x2 = b.left - base.left - 1;
          const y1 = a.top - base.top + a.height * .46, y2 = b.top - base.top + b.height * .52;
          wire.setAttribute('d', `M${x1} ${y1}C${(x1 + x2) / 2} ${y1},${(x1 + x2) / 2} ${y2},${x2} ${y2}`);
          wireLengths[i] = wire.getTotalLength();
        });
      } else wireLengths = [];
      render();
    }
    function tick(now) {
      frame = null;
      if (!canRun()) return;
      if (lastFrame !== null) time += Math.min((now - lastFrame) / 1000, .12) * speed;
      lastFrame = now;
      if (time > total + 1.4) time = 0;
      render();
      frame = requestAnimationFrame(tick);
    }
    function canRun() { return playing && visible && !document.hidden && !inStatic && !detail.open; }
    function syncPlayback() {
      const run = canRun();
      player.classList.toggle('is-running', run);
      $('play').setAttribute('aria-label', playing ? 'Pause replay' : time >= total ? 'Replay animation' : 'Play replay');
      $('play').setAttribute('title', playing ? 'Pause' : 'Play');
      if (run && frame === null) { lastFrame = null; frame = requestAnimationFrame(tick); }
      if (!run) { if (frame !== null) cancelAnimationFrame(frame);frame = null;lastFrame = null; }
    }
    function pause() { playing = false;syncPlayback(); }
    function seek(value) { pause();time = clamp(value, 0, total);manualPanel = false;render(); }
    function jump(index) {
      const phase = phases[index];
      seek(phase.start + phase.duration * (index === 5 ? .85 : .83));
      setText($('announcement'), `${phase.label}. ${phase.caption}`);
    }
    $('play').addEventListener('click', () => {
      if (playing) pause();
      else { if (time >= total) time = 0;playing = true;manualPanel = false;syncPlayback();render(); }
    });
    $('restart').addEventListener('click', () => { time = 0;playing = true;manualPanel = false;render();syncPlayback(); });
    $('speed').addEventListener('change', () => { speed = Number($('speed').value) || 1; });
    $('seek').addEventListener('input', () => seek(Number($('seek').value) / 1000 * total));
    $('seek').addEventListener('pointerdown', pause);
    chapterButtons.forEach((button, i) => { button.id = `teaser-chapter-${i}`;button.addEventListener('click', () => jump(i)); });
    tabs.forEach((button, i) => button.addEventListener('click', () => { pause();manualPanel = true;setPanel(i); }));
    player.addEventListener('focusin', event => {
      if (event.target.closest('.teaser-node')) pause();
    });
    toggle.addEventListener('click', () => {
      inStatic = !inStatic;
      fallback.hidden = !inStatic;player.hidden = inStatic;
      setText(toggle, inStatic ? 'Interactive replay' : 'Static figure');
      if (inStatic) pause();
      else { layout();syncPlayback(); }
    });
    function inspect(kind) {
      pause();
      const { phase } = phaseAt(time), episode = data.episodes[phase.episode];
      const lookup = phase.mode === 'lookup', final = phase.mode === 'final';
      const iteration = lookup ? 64 : final ? data.final.iteration : episode.iteration;
      const titles = { search: 'Queries', evidence: 'Sources', program: final ? 'Final program' : 'Code diff' };
      figure.querySelector('#teaser-detail-title').textContent = `${titles[kind]} · iteration ${iteration}`;
      detailBody.replaceChildren();
      detailLink.href = final ? 'programs/swap-reduction.html' : `trajectories/swap-reduction.html${lookup ? '' : '#iteration-' + episode.iteration}`;
      detailLink.textContent = final ? 'Best program ↗' : 'Full record ↗';
      if (kind === 'search') {
        if (lookup) detailBody.append(element('p', 'The Look-Up gate reuses three stored documents. No new query was issued at iteration 64.'));
        else if (final) detailBody.append(element('p', 'The archived best program comes from iteration 78. The replay shows the selected retrieval episodes at iterations 5 and 66.'));
        else {
          const list = element('ol');
          episode.queries.forEach(query => { const item = element('li', query.query);item.append(element('small', query.intent));list.append(item); });
          detailBody.append(list, element('h3', 'Recorded knowledge state'), element('p', episode.knowledge_state));
        }
      } else if (kind === 'evidence') {
        const list = element('ol');
        (lookup ? data.lookup.sources : episode.sources).forEach(source => {
          const item = element('li');
          item.append(element('a', source.title, { href: source.url, target: '_blank', rel: 'noopener' }));
          if (Number.isFinite(source.predicted_score)) item.append(element('small', `Predicted score: ${format(source.predicted_score, 1)} · model estimate before evaluation`));
          list.append(item);
        });
        detailBody.append(list);
      } else if (lookup) {
        detailBody.append(element('p', 'The candidate did not replace the incumbent. Best-so-far evaluator score: 17,201.4.'));
      } else if (final) {
        detailBody.append(element('p', `Q20: ${format(data.final.native_score)} SWAPs; released SimpleTES reference: ${format(data.final.reference)}.`), element('pre', data.final.preview_code.join('\n')), element('a', 'Download original Rust source ↓', { href: data.final.source, download: '' }));
      } else {
        detailBody.append(element('p', `Parent → selected child: ${format(episode.parent_score, 1)} → ${format(episode.child_score, 1)} evaluator score.`), element('pre', episode.diff.join('\n')), element('small', `Selected diff excerpts. Full revision: +${episode.additions} −${episode.deletions}.`));
      }
      if (typeof detail.showModal === 'function') { detail.showModal();document.body.classList.add('dialog-open'); }
      else location.href = detailLink.href;
    }
    player.querySelectorAll('[data-teaser-inspect]').forEach(button => button.addEventListener('click', () => inspect(button.dataset.teaserInspect)));
    $('document').addEventListener('click', event => { if (phaseAt(time).phase.mode === 'lookup') { event.preventDefault();inspect('evidence'); } });
    detail.querySelectorAll('[data-teaser-close]').forEach(button => button.addEventListener('click', () => detail.close()));
    detail.addEventListener('close', () => { document.body.classList.remove('dialog-open');syncPlayback(); });
    detail.addEventListener('click', event => {
      if (event.target !== detail) return;
      const rect = detail.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) detail.close();
    });
    nodes.forEach(node => {
      node.addEventListener('pointermove', event => {
        if (!finePointer.matches || reduced.matches || mobile.matches) return;
        const r = node.getBoundingClientRect(), x = clamp((event.clientX - r.left) / r.width), y = clamp((event.clientY - r.top) / r.height);
        node.style.setProperty('--pointer-x', `${x * 100}%`);node.style.setProperty('--pointer-y', `${y * 100}%`);
        node.style.setProperty('--tilt-x', `${(.5 - y) * 1.4}deg`);node.style.setProperty('--tilt-y', `${(x - .5) * 1.4}deg`);
      });
      node.addEventListener('pointerleave', () => { node.style.setProperty('--tilt-x', '0deg');node.style.setProperty('--tilt-y', '0deg'); });
    });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(entries => { visible = entries[0].isIntersecting;syncPlayback(); }, { threshold: .12 }).observe(player);
    } else visible = true;
    document.addEventListener('visibilitychange', syncPlayback);
    window.addEventListener('pagehide', () => { visible = false;syncPlayback(); });
    window.addEventListener('pageshow', event => {
      if (!event.persisted) return;
      const bounds = player.getBoundingClientRect();
      visible = bounds.bottom > 0 && bounds.top < innerHeight;
      syncPlayback();
    });
    reduced.addEventListener('change', () => { if (reduced.matches) seek(total); });
    mobile.addEventListener('change', layout);
    if ('ResizeObserver' in window) {
      let previousWidth = 0;
      new ResizeObserver(entries => {
        const width = entries[0].contentRect.width;
        if (Math.abs(width - previousWidth) > 1) { previousWidth = width; layout(); }
      }).observe(player);
    } else window.addEventListener('resize', layout);
    layout();syncPlayback();
  }
})();
