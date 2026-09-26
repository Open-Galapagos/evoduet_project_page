(() => {
  'use strict';
  document.documentElement.classList.add('js');

  // Public links are configured in one place. Never link to a private code repo.
  const config = window.EVODUET_CONFIG || {};
  for (const [resource, url] of [['paper', config.paperUrl], ['code', config.codeUrl]]) {
    if (!url) continue;
    let parsed;
    try { parsed = new URL(url); } catch { continue; }
    if (parsed.protocol !== 'https:') continue;
    const placeholder = document.querySelector(`[data-resource="${resource}"]`);
    if (!placeholder) continue;
    const link = document.createElement('a');
    link.className = 'resource resource-active';
    link.href = parsed.href;
    link.target = '_blank';
    link.rel = 'noopener';
    link.setAttribute('aria-label', resource === 'paper' ? 'Read the paper' : 'View the research code');
    for (const node of [...placeholder.childNodes]) {
      if (node.nodeType === Node.ELEMENT_NODE && node.classList.contains('resource-status')) continue;
      link.append(node.cloneNode(true));
    }
    placeholder.replaceWith(link);
  }

  // Navigation remains visible without JavaScript; the small-screen menu is progressive.
  const navToggle = document.querySelector('.nav-toggle');
  const navLinks = document.getElementById('nav-links');
  navToggle.hidden = false;
  function closeNavigation(returnFocus = false) {
    navLinks.classList.remove('open');
    navToggle.setAttribute('aria-expanded', 'false');
    navToggle.setAttribute('aria-label', 'Open navigation');
    if (returnFocus) navToggle.focus();
  }
  navToggle.addEventListener('click', () => {
    const open = navToggle.getAttribute('aria-expanded') !== 'true';
    navLinks.classList.toggle('open', open);
    navToggle.setAttribute('aria-expanded', String(open));
    navToggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
  });
  navLinks.addEventListener('click', event => {
    if (event.target.closest('a')) closeNavigation();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && navLinks.classList.contains('open')) closeNavigation(true);
  });
  document.addEventListener('click', event => {
    if (!event.target.closest('.navbar')) closeNavigation();
  });

  const progress = document.querySelector('.reading-progress');
  let scrollPending = false;
  function updateProgress() {
    const root = document.documentElement;
    const fraction = root.scrollTop / Math.max(1, root.scrollHeight - root.clientHeight);
    progress.style.transform = `scaleX(${Math.max(0, Math.min(1, fraction))})`;
    scrollPending = false;
  }
  window.addEventListener('scroll', () => {
    if (!scrollPending) { scrollPending = true; requestAnimationFrame(updateProgress); }
  }, { passive: true });
  window.addEventListener('resize', updateProgress);
  updateProgress();
  if ('IntersectionObserver' in window && document.querySelector('.nav-links a[href^="#"]')) {
    const sectionObserver = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        navLinks.querySelectorAll('a').forEach(link => {
          if (link.hash === `#${entry.target.id}`) link.setAttribute('aria-current', 'location');
          else link.removeAttribute('aria-current');
        });
      }
    }, { rootMargin: '-15% 0px -65% 0px', threshold: 0 });
    document.querySelectorAll('main section[id]').forEach(section => sectionObserver.observe(section));
  }

  const gateDescriptions = {
    retrieve: ['Find new evidence.', 'A knowledge gap remains unresolved. The inner loop searches the web and refines its queries; the outer loop generates candidates from the retained documents.'],
    lookup: ['Reuse what the run has learned.', 'The missing knowledge is already in the search database. Selected documents return to the solution prompt, with no new web search.'],
    noop: ['Keep evolving with existing knowledge.', 'The model judges that its current knowledge is sufficient. It skips retrieval and generates one candidate without web documents.']
  };
  const gateDescription = document.getElementById('gate-description');
  if (gateDescription) {
  document.querySelector('[data-gate-explorer]').hidden = false;
  document.querySelectorAll('[data-gate]').forEach(button => {
    button.addEventListener('click', () => {
      document.querySelectorAll('[data-gate]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
      const [title, description] = gateDescriptions[button.dataset.gate];
      const strong = document.createElement('strong');
      strong.textContent = title;
      gateDescription.replaceChildren(strong, document.createTextNode(` ${description}`));
      gateDescription.dataset.state = button.dataset.gate;
    });
  });
  }

  // Static N=1 results and the complete HTML table remain available if loading fails.
  const budgetControls = document.querySelector('.budget-controls');
  if (budgetControls) fetch('static/data/results.json')
    .then(response => {
      if (!response.ok) throw new Error('Chart data unavailable');
      return response.json();
    })
    .then(data => {
      const models = [...document.querySelectorAll('[data-model]')].map(row => row.dataset.model);
      for (const budget of [1, 8]) {
        for (const model of models) {
          const row = data.columns.find(item => item.model === model && item.budget === budget);
          if (!row || !['base_mean', 'ours_mean', 'overall_delta'].every(key => Number.isFinite(row[key]))) {
            throw new Error('Incomplete chart data');
          }
        }
      }
      const setBudget = budget => {
        document.querySelectorAll('[data-model]').forEach(element => {
          const row = data.columns.find(item => item.model === element.dataset.model && item.budget === budget);
          element.querySelector('.baseline').style.width = `${row.base_mean}%`;
          element.querySelector('.ours').style.width = `${row.ours_mean}%`;
          element.querySelector('.base-value').textContent = `${row.base_mean.toFixed(1)}%`;
          element.querySelector('.ours-value').textContent = `${row.ours_mean.toFixed(1)}%`;
          const delta = element.querySelector('.delta');
          delta.textContent = `${row.overall_delta >= 0 ? '+' : '−'}${Math.abs(row.overall_delta).toFixed(1)} pp`;
          delta.classList.toggle('negative', row.overall_delta < 0);
        });
        document.querySelectorAll('[data-budget]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.budget) === budget)));
        document.getElementById('budget-note').textContent = budget === 1
          ? 'N = 1: one candidate is generated at each iteration in both methods.'
          : 'N = 8: OpenEvolve generates eight candidates at every iteration. EvoDuet generates eight for Retrieve / Look-Up and one for No-Op; these are not equal-cost runs.';
      };
      budgetControls.hidden = false;
      budgetControls.querySelectorAll('button').forEach(button => button.addEventListener('click', () => setBudget(Number(button.dataset.budget))));
      setBudget(1);
    })
    .catch(() => { /* Keep the complete static results; never replace them with an empty chart. */ });

  // Native dialog supplies keyboard trapping, Escape dismissal, and focus restoration.
  const dialog = document.querySelector('.figure-dialog');
  if (dialog && typeof dialog.showModal === 'function') {
    document.querySelectorAll('.figure-zoom').forEach(link => {
      link.addEventListener('click', event => {
        if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        const source = link.querySelector('img');
        const expanded = dialog.querySelector('img');
        expanded.src = link.href;
        expanded.alt = source.alt;
        dialog.querySelector('.dialog-caption').textContent = link.closest('figure').querySelector('figcaption')?.textContent || source.alt;
        document.body.classList.add('dialog-open');
        dialog.showModal();
      });
    });
    dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
    });
    dialog.addEventListener('close', () => document.body.classList.remove('dialog-open'));
  }

  const copyButton = document.getElementById('copy-bibtex');
  const copyStatus = document.querySelector('.copy-status');
  if (copyButton) {
  copyButton.hidden = false;
  copyButton.addEventListener('click', async () => {
    const text = document.getElementById('bibtex-code').textContent;
    let copied = false;
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
    } catch {
      const field = document.createElement('textarea');
      field.value = text;
      field.style.cssText = 'position:fixed;left:-9999px;top:0;';
      document.body.append(field);
      field.select();
      try { copied = document.execCommand('copy'); } catch { copied = false; }
      field.remove();
      copyButton.focus();
    }
    if (copied) {
      copyButton.textContent = 'Copied ✓';
      copyStatus.textContent = 'Citation copied to clipboard.';
      setTimeout(() => { copyButton.textContent = 'Copy citation ⧉'; }, 2000);
    } else {
      copyButton.textContent = 'Select to copy';
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(document.getElementById('bibtex-code'));
      selection.removeAllRanges();
      selection.addRange(range);
      copyStatus.textContent = 'Automatic copying is unavailable. The citation is selected; copy it or use Download .bib.';
    }
  });
  }
})();
