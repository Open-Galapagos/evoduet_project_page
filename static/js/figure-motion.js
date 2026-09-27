(() => {
  'use strict';
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const printMedia = window.matchMedia('print');
  const saveData = Boolean(navigator.connection?.saveData);
  const states = [...document.querySelectorAll('.animated-figure')].map(figure => {
    const img = figure.querySelector('[data-animation-src]');
    return {
      figure, img, button: figure.querySelector('.figure-motion-toggle'),
      still: img.getAttribute('src'), animation: img.dataset.animationSrc,
      enabled: !reducedMotion.matches && !saveData, visible: false,
      userChoice: null, failed: false
    };
  });

  function update(state) {
    const running = state.enabled && state.visible && !document.hidden && !printMedia.matches && !state.failed;
    const source = running ? state.animation : state.still;
    if (state.img.getAttribute('src') !== source) state.img.src = source;
    state.figure.dataset.animationEnabled = String(state.enabled);
    state.figure.dataset.animationPlaying = String(running);
    state.button.querySelector('span').textContent = state.enabled ? 'Pause' : 'Play';
    state.button.setAttribute('aria-label', `${state.enabled ? 'Pause' : 'Play'} ${state.figure.dataset.animationName} animation`);
    state.button.title = state.enabled ? 'Show still figure' : 'Play flow animation';
    state.button.hidden = state.failed;
  }

  for (const state of states) {
    state.button.addEventListener('click', () => {
      state.enabled = !state.enabled;
      state.userChoice = state.enabled;
      update(state);
    });
    state.img.addEventListener('error', () => {
      if (state.img.getAttribute('src') !== state.animation) return;
      state.failed = true;
      state.enabled = false;
      update(state);
    });
    update(state);
  }

  // Static images are the no-JS, reduced-motion, print and data-saver defaults.
  // GIFs are only requested near the viewport, and leave it when off screen.
  if ('IntersectionObserver' in window) {
    const byFigure = new Map(states.map(state => [state.figure, state]));
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const state = byFigure.get(entry.target);
        state.visible = entry.isIntersecting;
        update(state);
      }
    }, {rootMargin: '80px 0px'});
    states.forEach(state => observer.observe(state.figure));
  } else {
    states.forEach(state => { state.visible = true; update(state); });
  }

  reducedMotion.addEventListener('change', () => {
    for (const state of states) {
      if (reducedMotion.matches) {
        state.enabled = false;
        state.userChoice = null;
      } else {
        state.enabled = state.userChoice ?? !saveData;
      }
      update(state);
    }
  });
  printMedia.addEventListener('change', () => states.forEach(update));
  document.addEventListener('visibilitychange', () => states.forEach(update));
})();
