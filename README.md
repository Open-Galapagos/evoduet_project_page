# EvoDuet — project page

**EvoDuet: Bilevel Co-Evolution of Web Searching and Task Solving for Scientific Discovery**

Live site: **https://open-galapagos.github.io/evoduet_project_page/**

A responsive, static research page for GitHub Pages. Plain HTML, CSS, and
JavaScript; no build step or runtime dependencies. Includes the paper figures,
interactive N=1/N=8 aggregate results, all eleven selected best-program scores,
an accessible figure viewer, and a downloadable/copyable BibTeX citation.

## Preview locally

```sh
python3 -m http.server 8000
```

Open http://localhost:8000. Use an HTTP server so the result-budget selector can
load its JSON; opening `index.html` directly still shows the static N=1 chart and
the complete results table.

## Add the public paper and code links

Edit **`static/js/site-config.js`**:

```js
window.EVODUET_CONFIG = Object.freeze({
  paperUrl: "https://arxiv.org/abs/ACTUAL_ID",
  codeUrl: "https://github.com/Open-Galapagos/ACTUAL_PUBLIC_REPOSITORY"
});
```

Replace those examples with the actual public URLs. Until then, keep the values
`null`; the page shows non-clickable “Coming soon” labels. A private development
repository is deliberately not linked.

After arXiv publication, also update `CITATION.bib`, the matching `#bibtex-code`
block in `index.html`, and the citation note. Add the real `eprint`, `archivePrefix`,
and `primaryClass` fields as appropriate. No arXiv identifier or venue is assumed.
For links that also work without JavaScript, replace the corresponding
`[data-resource]` spans in `index.html` with anchors when the URLs are final.

## Deployment

GitHub Pages serves **`main` → `/ (root)`**. `.nojekyll` makes this a direct static
deployment. Push changes to `main` to publish updates. All site assets use relative
paths so they work under the `/evoduet_project_page/` project prefix.

## Structure

```text
index.html                 Page content, default chart, and complete result tables
CITATION.bib               Downloadable citation (kept in sync with the HTML)
static/css/style.css       Responsive blue/purple theme from the paper
static/js/site-config.js   Public paper/code URLs
static/js/main.js          Navigation, gate explorer, budget selector, figure viewer, citation copy
static/data/results.json   Aggregate chart values, stripped of private run metadata
static/images/             Web-optimized paper figures, logo, and social preview
static/figures/             Original figure PDFs
static/fonts/              Self-hosted fonts and their licenses
```

## Content provenance

Content follows the manuscript source as inspected on September 26, 2026:

- Title, author order, and affiliations: `iclr2027_conference.tex`. Contribution
  footnote markers are omitted because that draft contains ambiguous footnote
  commands; no contribution designation is inferred.
- Abstract and method: `sections/main_sections/00_abstract.tex` and
  `sections/main_sections/03_method.tex`.
- Aggregate results: `figures/main_figures/ndg_main_panels_data.json`,
  `figure_summary.columns`. The public JSON contains only the aggregate values
  and evaluation protocol, not source run paths or private metadata.
- Selected best-program results: `tables/main_tables/new_sota_result.tex`.
  These runs are distinct from the fixed 100-iteration aggregate comparison.
- Interpretation and case studies: `sections/main_sections/01_introduction.tex`,
  `sections/main_sections/04_experiment.tex`, and the trajectory appendix.
- `teaser.webp` / `teaser.pdf`: `evoduet_teaser_intro.pdf`.
- `method.webp` / `method.pdf`: `evoduet_method_overview.pdf`.
- `document-use.webp` / `document-use.pdf`: `behavior_behaviors.pdf`.
- `cost-efficiency.webp` / `cost-efficiency.pdf`: `cost_pareto_denoising.pdf`.
- Logo: `evoduet_logo_teaser_palette_crop.png` from the manuscript assets.

Images are rendered from the existing PDFs, not redrawn scientific data. The
visual identity follows the paper's blue/purple palette; the overall research-page
structure is inspired by [Evolution Fine-Tuning](https://open-galapagos.github.io/evolution_finetuning/).

## Reporting conventions

- NDG changes are percentage-point differences, not relative percentages.
- The aggregate chart averages per-task bests across 21 paired tasks, with up to
  four eligible runs per condition at iteration 100.
- At N=8, OpenEvolve generates eight candidates every iteration. EvoDuet generates
  eight for Retrieve/Look-Up and one for No-Op. This is not an equal-cost comparison.
- Qwen3.5-9B's negative results remain visible at both candidate budgets.
- Best-program scores use the paper table's native units and precision. Matches
  are not claims of proven global optima. Public artifact reuse is disclosed.
- The 6.9× cost claim is specific to Denoising and uses estimated API-equivalent
  SimpleTES cost, as reported in the manuscript.

The page is readable without JavaScript, supports keyboard navigation, respects
reduced-motion preferences, and hosts its assets locally.
