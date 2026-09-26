/* All scientific views use the frozen public record; no benchmark code runs here. */
(() => {
  'use strict';
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const normal = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  const gallery = document.querySelector('[data-gallery]');
  if (gallery) {
    const cards = [...gallery.querySelectorAll('[data-gallery-card]')];
    const filters = [...gallery.querySelectorAll('[data-filter]')];
    const input = gallery.querySelector('[data-gallery-search]');
    const count = gallery.querySelector('[data-gallery-count]');
    const params = new URLSearchParams(location.search);
    let domain = filters.some(button => button.dataset.filter === params.get('domain')) ? params.get('domain') : 'All';
    input.value = params.get('q') || '';
    gallery.querySelector('[data-gallery-controls]').hidden = false;
    const apply = (updateURL = true) => {
      const query = normal(input.value.trim());
      let visible = 0;
      cards.forEach(card => {
        const show = (domain === 'All' || card.dataset.domain === domain) && normal(card.dataset.search).includes(query);
        card.hidden = !show;
        visible += Number(show);
      });
      filters.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.filter === domain)));
      const noun = location.pathname.includes('/trajectories') ? (visible === 1 ? 'trajectory' : 'trajectories') : (visible === 1 ? 'program' : 'programs');
      count.textContent = `${visible} ${noun}${visible !== cards.length ? ` of ${cards.length}` : ''}`;
      gallery.querySelector('[data-empty-state]').hidden = visible !== 0;
      if (updateURL) {
        const url = new URL(location.href);
        domain === 'All' ? url.searchParams.delete('domain') : url.searchParams.set('domain', domain);
        input.value.trim() ? url.searchParams.set('q', input.value.trim()) : url.searchParams.delete('q');
        history.replaceState(null, '', url);
      }
    };
    filters.forEach(button => button.addEventListener('click', () => { domain = button.dataset.filter; apply(); }));
    input.addEventListener('input', () => apply());
    apply(false);
  }

  const trajectory = document.querySelector('[data-trajectory]');
  if (trajectory) {
    const panels = [...trajectory.querySelectorAll('[data-step-panel]')];
    function goToStage(panel, link) {
      const stage = link.dataset.stageTarget;
      const target = document.getElementById(link.hash.slice(1));
      if (!target) return;
      if (stage === 'search' || stage === 'sources') {
        panel.querySelector(`[data-evidence-view="${stage === 'search' ? 'query' : 'sources'}"]`)?.click();
      }
      if (stage === 'sources') target.scrollTop = 0;
      panel.querySelectorAll('[data-stage-target]').forEach(item => {
        item.classList.toggle('is-current', item === link);
        if (item === link) item.setAttribute('aria-current', 'location');
        else item.removeAttribute('aria-current');
      });
      target.focus({ preventScroll: true });
      target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
    }
    // Each round keeps its recorded candidate pool and predictions. No live search.
    panels.forEach(panel => {
      panel.querySelectorAll('[data-stage-target]').forEach(link => link.addEventListener('click', event => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        goToStage(panel, link);
      }));
      const rounds = [...panel.querySelectorAll('[data-search-round]')];
      if (!rounds.length) return;
      const documents = [...panel.querySelectorAll('[data-source-ref]')];
      const filters = [...panel.querySelectorAll('[data-source-filter]')];
      const readerPanels = [...panel.querySelectorAll('[data-round-panel]')];
      let active = rounds[0], filter = 'kept';
      panel.querySelector('[data-round-controls]').hidden = false;
      panel.querySelector('[data-source-controls]').hidden = false;
      panel.querySelector('[data-evidence-views]').hidden = false;
      const viewButtons = [...panel.querySelectorAll('[data-evidence-view]')];
      viewButtons.forEach(button => button.addEventListener('click', () => {
        panel.querySelector('.evidence-workspace').dataset.mobileView = button.dataset.evidenceView;
        viewButtons.forEach(tab => tab.setAttribute('aria-pressed', String(tab === button)));
      }));
      function updateEvidence(openFirst = true) {
        const key = active.dataset.searchRound;
        const candidates = JSON.parse(active.dataset.candidates);
        const kept = JSON.parse(active.dataset.kept);
        const allowed = filter === 'all' ? candidates : kept;
        let visible = 0;
        rounds.forEach(button => button.setAttribute('aria-pressed', String(button === active)));
        readerPanels.forEach(section => { section.hidden = section.dataset.roundPanel !== key; });
        filters.forEach(button => { button.setAttribute('aria-pressed', String(button.dataset.sourceFilter === filter)); });
        documents.forEach(doc => {
          const ref = doc.dataset.sourceRef;
          doc.hidden = !allowed.includes(ref);
          const retained = kept.includes(ref);
          doc.classList.toggle('is-kept', retained);
          doc.style.order = String(candidates.indexOf(ref));
          if (!doc.hidden) visible++;
          if (openFirst) doc.open = false;
          const badge = doc.querySelector('[data-source-choice]');
          badge.textContent = key === 'final' ? (panel.querySelector('.gate-badge').classList.contains('lookup') ? 'Reused' : 'To solver') : retained ? `Kept · R${key}` : 'Not kept';
          const values = JSON.parse(doc.dataset.predictions);
          const score = key === 'final' ? Object.values(values).at(-1) : values[key];
          doc.querySelectorAll('[data-document-score]').forEach(output => { output.textContent = Number.isFinite(score) ? score.toLocaleString('en-US', { maximumFractionDigits: 5 }) : 'Not scored'; });
        });
        panel.querySelector('[data-source-count]').textContent = `${visible} / ${candidates.length}`;
        panel.querySelector('[data-source-controls]').hidden = key === 'final';
        panel.querySelector('[data-sources-empty]').hidden = visible > 0;
        const first = documents.filter(doc => !doc.hidden).sort((a,b) => Number(a.style.order) - Number(b.style.order))[0];
        if (openFirst && first) first.open = true;
        if (openFirst) panel.querySelectorAll('.query-workspace,.source-workspace').forEach(workspace => { workspace.scrollTop = 0; });
      }
      rounds.forEach(button => button.addEventListener('click', () => { active = button; updateEvidence(); }));
      filters.forEach(button => button.addEventListener('click', () => { filter = button.dataset.sourceFilter; updateEvidence(false); }));
      updateEvidence();
    });
    const links = [...trajectory.querySelectorAll('[data-step-link]')];
    const previous = trajectory.querySelector('[data-step-prev]');
    const next = trajectory.querySelector('[data-step-next]');
    const position = trajectory.querySelector('.step-position');
    let current = 0;
    trajectory.querySelector('[data-step-pager]').hidden = false;
    const fromHash = () => {
      const target = document.getElementById(location.hash.slice(1));
      return panels.findIndex(panel => panel === target || panel.contains(target));
    };
    const stageFromHash = index => index >= 0 && [...panels[index].querySelectorAll('[data-stage-target]')].find(link => link.hash === location.hash);
    function select(index, { push = false, scroll = false } = {}) {
      current = Math.max(0, Math.min(panels.length - 1, index));
      const iteration = panels[current].dataset.stepPanel;
      panels.forEach((panel, i) => { panel.hidden = i !== current; });
      links.forEach(link => {
        const active = link.dataset.stepLink === iteration;
        if (active) link.setAttribute('aria-current', 'step');
        else link.removeAttribute('aria-current');
      });
      trajectory.querySelectorAll('.chart-marker').forEach(marker => marker.classList.toggle('is-active', marker.dataset.iteration === iteration));
      const marker = trajectory.querySelector(`.chart-marker[data-iteration="${iteration}"]`);
      const guide = trajectory.querySelector('.chart-selected-line');
      if (marker && guide) {
        guide.setAttribute('x1', marker.getAttribute('cx'));
        guide.setAttribute('x2', marker.getAttribute('cx'));
      }
      previous.disabled = current === 0;
      next.disabled = current === panels.length - 1;
      position.textContent = `${current + 1} / ${panels.length}`;
      if (push) history.pushState(null, '', `#iteration-${iteration}`);
      if (scroll) document.getElementById('moments').scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
    }
    links.forEach(link => link.addEventListener('click', event => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      select(panels.findIndex(panel => panel.dataset.stepPanel === link.dataset.stepLink), { push: true, scroll: true });
    }));
    previous.addEventListener('click', () => select(current - 1, { push: true, scroll: true }));
    next.addEventListener('click', () => select(current + 1, { push: true, scroll: true }));
    window.addEventListener('hashchange', () => {
      const index = fromHash(), stage = stageFromHash(index);
      if (index >= 0) select(index, { scroll: !stage });
      if (stage) goToStage(panels[index], stage);
    });
    window.addEventListener('popstate', () => {
      const index = fromHash(), stage = stageFromHash(index);
      select(index >= 0 ? index : 0);
      if (stage) goToStage(panels[index], stage);
    });
    const initial = fromHash();
    select(initial >= 0 ? initial : 0);
    if (initial >= 0) requestAnimationFrame(() => {
      const stage = stageFromHash(initial);
      if (stage) goToStage(panels[initial], stage);
      else document.getElementById('moments').scrollIntoView({ block: 'start' });
    });
  }

  const program = document.querySelector('[data-program]');
  if (!program) return;
  const views = [...program.querySelectorAll('[data-static-view]')];
  const viewButtons = [...program.querySelectorAll('[data-artifact-view]')];
  const mount = program.querySelector('[data-interactive-art]');
  const controls = program.querySelector('[data-artifact-controls]');
  const selectView = key => {
    const interactive = key === 'interactive';
    mount.hidden = !interactive;
    controls.hidden = !interactive;
    views.forEach((view, i) => { view.hidden = interactive || String(i) !== key; });
    viewButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.artifactView === key)));
    program.dispatchEvent(new CustomEvent('artifactviewchange', { detail: { view: key } }));
  };
  if (viewButtons.length > 1) {
    program.querySelector('[data-view-controls]').hidden = false;
    viewButtons.forEach(button => button.addEventListener('click', () => selectView(button.dataset.artifactView)));
    selectView('0');
  }

  const expand = program.querySelector('.code-expand');
  expand.hidden = false;
  expand.addEventListener('click', () => {
    const panel = expand.closest('.source-code-panel');
    const open = !panel.classList.contains('expanded');
    panel.classList.toggle('expanded', open);
    expand.setAttribute('aria-expanded', String(open));
    expand.textContent = open ? 'Collapse code ↑' : 'Expand code ↓';
    if (!open) document.getElementById('source').scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });
  });
  const copy = program.querySelector('[data-copy-source]');
  copy.hidden = false;
  copy.addEventListener('click', async () => {
    const status = program.querySelector('.source-status');
    let field;
    try {
      const response = await fetch(copy.dataset.copySource);
      if (!response.ok) throw new Error('Source unavailable');
      const text = await response.text();
      try { await navigator.clipboard.writeText(text); }
      catch {
        field = document.createElement('textarea');
        field.value = text;
        field.style.cssText = 'position:fixed;left:-9999px;top:0';
        document.body.append(field); field.select();
        if (!document.execCommand('copy')) throw new Error('Clipboard unavailable');
      }
      copy.textContent = 'Copied ✓';
      status.textContent = 'Source copied.';
      setTimeout(() => { copy.textContent = 'Copy'; }, 2000);
    } catch {
      status.textContent = 'Copy unavailable. Use Download.';
    } finally {
      if (field) { field.remove(); copy.focus(); }
    }
  });

  const SVG = 'http://www.w3.org/2000/svg';
  function svgNode(tag, attrs, text) {
    const node = document.createElementNS(SVG, tag);
    for (const [key, value] of Object.entries(attrs || {})) node.setAttribute(key, String(value));
    if (text !== undefined) node.textContent = text;
    return node;
  }
  const makeButton = (text, handler) => {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'view-button'; button.textContent = text;
    button.addEventListener('click', handler);
    return button;
  };
  function showInteractive() {
    const interactiveButton = program.querySelector('[data-artifact-view="interactive"]');
    if (interactiveButton) {
      interactiveButton.hidden = false;
      selectView('interactive');
      return;
    }
    // Keep the original caption underneath the live view.
    views[0].querySelector('.figure-zoom').hidden = true;
    mount.hidden = false;
    controls.hidden = false;
  }
  function renderPacking(record) {
    const points = record.artifact.data.circles;
    if (!points.length || !points.every(point => point.length === 3 && point.every(Number.isFinite))) return;
    const svg = svgNode('svg', { viewBox: '0 0 700 520', role: 'group', 'aria-label': `${points.length} circles from a replay of the archived best program` });
    const x = value => 124 + 448 * value;
    const y = value => 473 - 448 * value;
    svg.append(svgNode('rect', { x: 124, y: 25, width: 448, height: 448, fill: '#fcfdff', stroke: '#b5c7e0', 'stroke-width': 1.5 }));
    const text = document.createElement('p');
    text.className = 'packing-tooltip'; text.setAttribute('role', 'status');
    text.textContent = `${points.length} circles · unit square`;
    const labels = [];
    points.forEach(([cx, cy, radius], i) => {
      const info = `Circle ${i + 1} · x = ${cx.toFixed(6)} · y = ${cy.toFixed(6)} · r = ${radius.toFixed(6)}`;
      const circle = svgNode('circle', { cx: x(cx), cy: y(cy), r: radius * 448, class: 'packing-circle', tabindex: 0, role: 'img', 'aria-label': info });
      circle.addEventListener('pointerenter', () => {
        if (!document.activeElement?.classList.contains('packing-circle')) text.textContent = info;
      });
      circle.addEventListener('focus', () => { text.textContent = info; });
      svg.append(circle);
      labels.push(svgNode('text', { x: x(cx), y: y(cy) + 3, 'text-anchor': 'middle', class: 'circle-number', 'aria-hidden': 'true' }, i + 1));
    });
    for (let tick = 0; tick <= 1; tick += .25) {
      svg.append(svgNode('text', { x: x(tick), y: 495, 'text-anchor': 'middle' }, tick.toFixed(2)));
      svg.append(svgNode('text', { x: 108, y: y(tick) + 4, 'text-anchor': 'end' }, tick.toFixed(2)));
    }
    labels.forEach(node => svg.append(node));
    const toggle = makeButton('Circle labels', () => {
      const show = toggle.getAttribute('aria-pressed') !== 'true';
      toggle.setAttribute('aria-pressed', String(show));
      labels.forEach(node => { node.style.display = show ? '' : 'none'; });
    });
    toggle.dataset.toggleLabels = '';
    toggle.setAttribute('aria-pressed', 'true');
    const tip = document.createElement('p');tip.className = 'artifact-tip';tip.textContent = 'Select a circle for coordinates.';
    controls.append(toggle, tip);mount.append(svg, text);showInteractive();
  }

  function renderOrbit(record) {
    const data = record.artifact.data;
    const samples = key => data[key].legs.flatMap(leg => leg.times.map((time, i) => ({ time, xy: leg.xy[i] }))).sort((a, b) => a.time - b.time);
    const tours = { ours: samples('ours'), prev: samples('prev') };
    if (!tours.ours.length || !tours.prev.length) return;
    const all = [...tours.ours, ...tours.prev].flatMap(point => point.xy);
    if (!all.every(Number.isFinite)) return;
    const bound = Math.max(...all.map(Math.abs), 1.6) * 1.1;
    const scale = 217 / bound;
    const x = value => 415 + value * scale;
    const y = value => 237 - value * scale;
    const path = xy => xy.map((point, i) => `${i ? 'L' : 'M'}${x(point[0]).toFixed(3)} ${y(point[1]).toFixed(3)}`).join(' ');
    const frame = document.createElement('div');frame.className = 'orbit-frame';
    const svg = svgNode('svg', { viewBox: '0 0 830 500', role: 'img', 'aria-label': 'Rosetta trajectories in the ecliptic plane. Earth and Mars orbits, Sun, and a marker along the selected recorded transfer.' });
    svg.append(svgNode('line', { x1: x(-bound), x2: x(bound), y1: y(0), y2: y(0), stroke: '#dce5f2', 'stroke-width': 1 }));
    svg.append(svgNode('line', { x1: x(0), x2: x(0), y1: y(-bound), y2: y(bound), stroke: '#dce5f2', 'stroke-width': 1 }));
    for (let i = Math.ceil(-bound); i <= bound; i++) {
      if (i === 0) continue;
      svg.append(svgNode('text', { x: x(i), y: y(0) + 18, 'text-anchor': 'middle' }, i));
    }
    svg.append(svgNode('path', { d: path(data.earth_orbit), fill: 'none', stroke: '#81a5d4', 'stroke-width': 1.4, 'stroke-dasharray': '5 5' }));
    svg.append(svgNode('path', { d: path(data.mars_orbit), fill: 'none', stroke: '#c39474', 'stroke-width': 1.4, 'stroke-dasharray': '5 5' }));
    svg.append(svgNode('circle', { cx: x(0), cy: y(0), r: 5, fill: '#edb143', stroke: '#fff', 'stroke-width': 1 }));
    svg.append(svgNode('text', { x: x(0) + 9, y: y(0) - 9 }, 'Sun'));
    const transfer = svgNode('path', { fill: 'none', stroke: '#795bc0', 'stroke-width': 2.5 });svg.append(transfer);
    const marker = svgNode('circle', { r: 6, fill: '#795bc0', stroke: '#fff', 'stroke-width': 2.5 });svg.append(marker);
    svg.append(svgNode('text', { x: 790, y: 480, 'text-anchor': 'end' }, 'Ecliptic projection · AU'));
    frame.append(svg);mount.append(frame);
    const caption = document.createElement('p');caption.className = 'artifact-tip';
    const buttons = {};
    let selected = 'ours';
    let animation = null;
    let lastFrame = null;
    let fraction = 0;
    const row = document.createElement('div');row.className = 'orbit-controls';
    const slider = document.createElement('input');slider.type = 'range';slider.min = '0';slider.max = '1000';slider.value = '0';slider.id = 'orbit-time';slider.setAttribute('aria-label', 'Position along the recorded Rosetta transfer');
    const date = document.createElement('output');date.className = 'orbit-date';date.setAttribute('for', 'orbit-time');
    const play = makeButton('Play tour', () => { if (animation !== null) stop(); else start(); });
    play.dataset.orbitPlay = '';play.setAttribute('aria-pressed', 'false');
    row.append(play, slider, date);mount.append(row);
    const legend = document.createElement('div');legend.className = 'orbit-legend';
    for (const [name, cls] of [['Earth orbit', 'earth'], ['Mars orbit', 'mars'], ['Transfer', 'path']]) {
      const item = document.createElement('span');item.className = cls;item.textContent = name;legend.append(item);
    }
    mount.append(legend);
    const note = document.createElement('p');note.className = 'record-note';note.textContent = 'Position interpolated from recorded samples.';mount.append(note);
    function update() {
      const points = tours[selected];
      const time = points[0].time + fraction * (points.at(-1).time - points[0].time);
      let index = points.findIndex(point => point.time >= time);
      if (index < 0) index = points.length - 1;
      const b = points[index], a = points[Math.max(0, index - 1)];
      const mix = b.time === a.time ? 0 : (time - a.time) / (b.time - a.time);
      marker.setAttribute('cx', x(a.xy[0] + (b.xy[0] - a.xy[0]) * mix));
      marker.setAttribute('cy', y(a.xy[1] + (b.xy[1] - a.xy[1]) * mix));
      date.textContent = new Date((time - 40587) * 86400000).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
      slider.value = String(Math.round(fraction * 1000));
      slider.setAttribute('aria-valuetext', date.textContent);
    }
    function stop() {
      if (animation !== null) cancelAnimationFrame(animation);
      animation = null;lastFrame = null;play.textContent = 'Play tour';play.setAttribute('aria-pressed', 'false');
    }
    function animate(now) {
      if (lastFrame !== null) fraction = Math.min(1, fraction + (now - lastFrame) / 18000);
      lastFrame = now;update();
      if (fraction >= 1) stop();else animation = requestAnimationFrame(animate);
    }
    function start() {
      if (fraction >= 1) fraction = 0;
      play.textContent = 'Pause tour';play.setAttribute('aria-pressed', 'true');
      lastFrame = null;animation = requestAnimationFrame(animate);
    }
    function selectTour(key) {
      stop();selected = key;
      transfer.setAttribute('d', path(tours[key].map(point => point.xy)));
      const color = key === 'ours' ? '#3f78c0' : '#7a5fc4';
      transfer.setAttribute('stroke', color);
      marker.setAttribute('fill', color);
      legend.querySelector('.path').style.color = color;
      Object.entries(buttons).forEach(([id, button]) => button.setAttribute('aria-pressed', String(id === key)));
      caption.textContent = `${key === 'ours' ? 'EvoDuet' : 'Previous best'} · total Δv ${data[key].cost.total.toFixed(6)} km/s`;
      update();
    }
    const group = document.createElement('div');group.className = 'view-controls';group.setAttribute('role', 'group');group.setAttribute('aria-label', 'Rosetta trajectory comparison');
    for (const [key, name] of [['ours', 'EvoDuet'], ['prev', 'Previous best']]) {
      const button = makeButton(name, () => selectTour(key));button.dataset.orbitTour = key;buttons[key] = button;group.append(button);
    }
    controls.append(group, caption);
    slider.addEventListener('input', () => { stop();fraction = Number(slider.value) / 1000;update(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
    program.addEventListener('artifactviewchange', event => { if (event.detail.view !== 'interactive') stop(); });
    window.addEventListener('pagehide', stop);
    selectTour('ours');showInteractive();
  }

  fetch(program.dataset.recordUrl)
    .then(response => { if (!response.ok) throw new Error('Record unavailable');return response.json(); })
    .then(record => {
      if (record.artifact.kind === 'circles') renderPacking(record);
      else if (record.artifact.kind === 'orbit') renderOrbit(record);
    })
    .catch(() => { /* Static scientific figures and downloads remain available. */ });
})();
