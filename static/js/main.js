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

  // The static N=1 chart remains available if loading fails.
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
        const budgetNote = document.getElementById('budget-note');
        budgetNote.textContent = budget === 8 ? 'Parallel generation is adaptive in EvoDuet; compute costs differ.' : '';
        budgetNote.hidden = budget !== 8;
      };
      budgetControls.hidden = false;
      budgetControls.querySelectorAll('button').forEach(button => button.addEventListener('click', () => setBudget(Number(button.dataset.budget))));
      setBudget(1);
    })
    .catch(() => { /* Keep the static results if the optional data request fails. */ });

  // All comparisons are readable in the HTML; enhance them into keyboard-accessible tabs.
  document.querySelectorAll('[data-finding-tabs]').forEach(group => {
    const controls = group.querySelector('[data-finding-controls]');
    const tabs = [...group.querySelectorAll('[data-finding-tab]')];
    const panels = [...group.querySelectorAll('[data-finding-panel]')];
    const select = (tab, focus = false) => {
      tabs.forEach(button => {
        const active = button === tab;
        button.setAttribute('aria-selected', String(active));
        button.tabIndex = active ? 0 : -1;
      });
      panels.forEach(panel => { panel.hidden = panel.dataset.findingPanel !== tab.dataset.findingTab; });
      if (focus) tab.focus();
    };
    controls.setAttribute('role', 'tablist');
    tabs.forEach((tab, index) => {
      const panel = panels.find(item => item.dataset.findingPanel === tab.dataset.findingTab);
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-controls', panel.id);
      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-labelledby', tab.id);
      panel.tabIndex = 0;
      tab.addEventListener('click', () => select(tab));
      tab.addEventListener('keydown', event => {
        const next = {ArrowRight:(index + 1) % tabs.length, ArrowLeft:(index + tabs.length - 1) % tabs.length, Home:0, End:tabs.length - 1}[event.key];
        if (next === undefined) return;
        event.preventDefault();
        select(tabs[next], true);
      });
    });
    select(tabs[0]);
    group.classList.add('has-finding-tabs');
    controls.hidden = false;
  });

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
