# EvoDuet — project page

**EvoDuet: Bilevel Co-Evolution of Web Searching and Task Solving for Scientific Discovery**

Live site: **https://open-galapagos.github.io/evoduet_project_page/**

A responsive, static research page for GitHub Pages. Plain HTML, CSS, and
JavaScript; no deployment build step or runtime dependencies. Includes the paper
figures, interactive N=1/N=8 aggregate results, personal links for all eight
authors, an accessible figure viewer, and a downloadable/copyable BibTeX citation.

- [Trajectory gallery](https://open-galapagos.github.io/evoduet_project_page/trajectories/):
  seven recorded runs, with full score histories and 25 selected moments. Each
  moment shows the gate decision, queries, source links, evaluator scores, and
  selected code changes. Gallery filters and iteration links are shareable.
- [Best-program gallery](https://open-galapagos.github.io/evoduet_project_page/programs/):
  eleven scientific results with original source downloads and convergence
  curves. Interactive views include circle inspection, matrix/overlap views,
  and a Rosetta tour with a date slider and comparison to the previous best.

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
trajectories/              Gallery and seven recorded-run detail pages
programs/                  Gallery and eleven best-program detail pages
static/css/research.css    Gallery, record viewer, and source-code styles
static/js/research.js      Filtering, iteration navigation, artifact interactions
static/data/research/      Public score histories and selected records
static/programs/           Unchanged source files, checksum manifest, and ZIP
scripts/                   Optional data export and HTML generation
```

## Update the research galleries

Generated HTML and all public data are checked in. To change a gallery or detail
page, edit `scripts/build_research_pages.py` and rebuild with Python 3 and Pygments:

```sh
python3 -m pip install Pygments
python3 scripts/build_research_pages.py
```

This rebuild only reads the files in this repository. Shared styling and browser
behavior live in `static/css/research.css` and `static/js/research.js`.

`scripts/export_research.py` is an optional maintainer tool for refreshing the
data from the original manuscript and frozen run archive. It requires `ijson`,
`numpy`, `matplotlib`, `Pillow`, and `PyMuPDF`, plus `--paper`, `--runs`, and
`--circle-replays` paths. The last path holds `circles-26.json` and
`circles-32.json` from replaying the selected archived programs. The currently
published replay records are also preserved in each circle program JSON under
`artifact.data`. The export checks selected scores and figure/source identity;
it does not run an LLM or start a new search.

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
- Trajectories: six selected cases from the frozen behavior-analysis records,
  plus the Rosetta record used in the appendix. Full score histories come from
  their original `evolution_trace.json` files. Missing iterations are not filled
  with synthetic measurements. Only selected fields are exported; raw prompts,
  private paths, and third-party document bodies are excluded.
- Best programs: the manuscript's `programs/best_programs/manifest.json` and
  archived source files. Public source downloads are byte-for-byte identical;
  `static/programs/manifest.json` records their SHA-256 checksums.
- Mathematical artifacts: the selected-program outputs in
  `sota_objects_math_data.json`. Circle layouts are explicitly labeled replays
  with boundary/non-overlap checks and score agreement at displayed precision.
- Other scientific artifacts: frozen case-study outputs whose source hashes
  match the selected programs. Rosetta animation uses recorded propagated
  coordinates in the ecliptic projection, rather than an illustrative orbit.

Overview images are rendered from the existing PDFs. New scientific plots use
the recorded data or the labeled circle replays. The
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
- Search-time evaluator scores and final native objectives are labeled
  separately. Predicted document scores are distinguished from measurements.
  Task links explicitly identify whether a trajectory and best program share
  the same run; failed retrievals and regressing candidates remain visible.
- The 6.9× cost claim is specific to Denoising and uses estimated API-equivalent
  SimpleTES cost, as reported in the manuscript.

The page is readable without JavaScript, supports keyboard navigation, respects
reduced-motion preferences, and hosts its assets locally.
