/* Progressive interactions for the inline HTML/SVG charts. Data stays in the DOM. */
(() => {
  'use strict';
  const plots = [...document.querySelectorAll('[data-native-plot]')];
  const controllers = new Map();

  plots.forEach(plot => {
    const items = [...plot.querySelectorAll('[data-chart-item]')];
    const tip = document.createElement('div');
    tip.className = 'native-chart-tooltip';
    tip.id = `${plot.id}-tooltip`;
    tip.setAttribute('role', 'tooltip');
    tip.hidden = true;
    const title = document.createElement('strong');
    const metrics = document.createElement('span');
    const detail = document.createElement('p');
    tip.append(title, metrics, detail);
    plot.append(tip);
    let pinned = null;
    let active = null;

    const paint = item => {
      active = item;
      items.forEach(node => {
        node.classList.toggle('is-highlighted', Boolean(item && node.dataset.chartItem === item.dataset.chartItem));
        node.setAttribute('aria-pressed', String(Boolean(pinned && node.dataset.chartItem === pinned.dataset.chartItem)));
        if (node === item) node.setAttribute('aria-describedby', tip.id);
        else node.removeAttribute('aria-describedby');
      });
      tip.hidden = !item;
      if (!item) return;
      title.textContent = item.dataset.tipTitle;
      metrics.textContent = item.dataset.tipMetrics;
      detail.textContent = item.dataset.tipDetail;
      const bounds = plot.getBoundingClientRect();
      const anchor = item.getBoundingClientRect();
      const width = tip.offsetWidth;
      const height = tip.offsetHeight;
      let left = anchor.left - bounds.left + anchor.width / 2 - width / 2;
      left = Math.max(0, Math.min(left, bounds.width - width));
      let top = anchor.top - bounds.top - height - 10;
      if (top < 0) top = anchor.bottom - bounds.top + 10;
      top = Math.max(0, Math.min(top, bounds.height - height));
      tip.style.left = `${left}px`;
      tip.style.top = `${top}px`;
    };
    const clear = () => { pinned = null; paint(null); };
    controllers.set(plot, {clear});

    items.forEach(item => {
      // Native title tooltips remain available when JavaScript is disabled.
      item.removeAttribute('title');
      item.setAttribute('aria-pressed', 'false');
      item.addEventListener('pointerenter', event => {
        if (event.pointerType !== 'touch') paint(item);
      });
      item.addEventListener('focus', () => paint(item));
      item.addEventListener('click', () => {
        pinned = pinned?.dataset.chartItem === item.dataset.chartItem ? null : item;
        paint(pinned);
      });
      item.addEventListener('keydown', event => {
        if (event.key === 'Escape' && !tip.hidden) {
          event.preventDefault();
          event.stopPropagation();
          clear();
        }
        const family = item.classList.contains('cost-legend-item') ? '.cost-legend-item' : item.classList.contains('cost-point') ? '.cost-point' : '.behavior-row';
        const peers = items.filter(node => node.matches(family));
        const index = peers.indexOf(item);
        const next = {ArrowRight:(index + 1) % peers.length, ArrowDown:(index + 1) % peers.length,
          ArrowLeft:(index + peers.length - 1) % peers.length, ArrowUp:(index + peers.length - 1) % peers.length,
          Home:0, End:peers.length - 1}[event.key];
        if (next !== undefined) {
          event.preventDefault();
          peers[next].focus();
        }
      });
    });
    plot.addEventListener('pointerleave', event => {
      if (!active) return;
      const focused = items.find(item => item === document.activeElement);
      paint(pinned || (event.pointerType !== 'touch' ? focused : null) || null);
    });
    plot.addEventListener('focusout', event => {
      if (!items.includes(event.relatedTarget)) paint(pinned);
    });
    plot.addEventListener('click', event => {
      if (!event.target.closest('[data-chart-item], .native-chart-tooltip')) clear();
    });
    document.addEventListener('pointerdown', event => {
      if (!plot.contains(event.target)) clear();
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !tip.hidden) {
        event.preventDefault();
        clear();
      }
    });
    window.addEventListener('resize', () => { if (active) paint(active); });
  });

  const dialog = document.querySelector('.native-chart-dialog');
  if (!dialog || typeof dialog.showModal !== 'function') return;
  const mount = dialog.querySelector('.native-dialog-body');
  let expanded = null;

  document.querySelectorAll('[data-expand-chart]').forEach(button => {
    const plot = plots.find(node => node.dataset.nativePlot === button.dataset.expandChart);
    if (!plot) return;
    button.hidden = false;
    button.addEventListener('click', () => {
      if (expanded) return;
      controllers.get(plot).clear();
      const placeholder = document.createElement('div');
      placeholder.style.height = `${plot.getBoundingClientRect().height}px`;
      placeholder.setAttribute('aria-hidden', 'true');
      plot.before(placeholder);
      const figure = plot.closest('figure');
      expanded = {plot, placeholder, button};
      dialog.querySelector('#native-chart-title').textContent = plot.dataset.chartTitle;
      dialog.querySelector('.native-dialog-units').textContent = figure.querySelector('.native-chart-toolbar>span').textContent;
      dialog.querySelector('.native-dialog-caption').textContent = figure.querySelector('figcaption').textContent;
      mount.append(plot);
      document.body.classList.add('dialog-open');
      dialog.showModal();
      dialog.querySelector('.native-chart-close').focus();
    });
  });
  dialog.querySelector('.native-chart-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  });
  dialog.addEventListener('cancel', event => {
    if (!expanded) return;
    const tip = expanded.plot.querySelector('.native-chart-tooltip');
    if (!tip.hidden) {
      event.preventDefault();
      controllers.get(expanded.plot).clear();
    }
  });
  dialog.addEventListener('close', () => {
    if (!expanded) return;
    const {plot, placeholder, button} = expanded;
    controllers.get(plot).clear();
    placeholder.replaceWith(plot);
    expanded = null;
    document.body.classList.remove('dialog-open');
    button.focus({preventScroll: true});
  });
})();
