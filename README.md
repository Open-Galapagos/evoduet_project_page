# EvoDuet — project page

**EvoDuet: Bilevel Co-Evolution of Web Searching and Task Solving for Scientific Discovery**

Live site: **https://open-galapagos.github.io/evoduet_project_page/**

A responsive, static research page for GitHub Pages. Plain HTML, CSS, and
JavaScript; no deployment build step or runtime dependencies. Includes the paper
figures, interactive N=1/N=8 aggregate results, personal links for all eight
authors, an accessible figure viewer, and a downloadable/copyable BibTeX citation.
The main page leads with aggregate discovery results, three illustrated best
programs, and the findings behind the search design. Accessible tabs group the
search-method, retrieval-gate, and cross-optimizer comparisons; document use and
Denoising cost complete the experimental story. Detailed protocols and complete
program records are linked from the main page.

- [Trajectory gallery](https://open-galapagos.github.io/evoduet_project_page/trajectories/):
  seven recorded runs, with full score histories and 25 selected moments. Each
  moment connects gate reasoning, query intent, captured web content, and measured
  code results. The evidence reader covers 60 search rounds and 279 document
  records, including rejected candidates and reused sources. Switch rounds to
  inspect the corresponding candidate pool, kept documents, and predicted child
  scores. All 100 gate decisions appear beside the measured score history.
  Source favicons are cached locally. Gallery filters and iteration links are
  shareable; mobile has separate query/source views in the same reader. Desktop
  keeps the iteration list beside the reader. Gate, Search, Evidence, and Result
  shortcuts move to the relevant section and switch the mobile view as needed.
- [Best-program gallery](https://open-galapagos.github.io/evoduet_project_page/programs/):
  eleven scientific results with the figure and source side by side on desktop,
  original source downloads, and expandable convergence curves. Interactive views include circle inspection, matrix/overlap views,
  and a Rosetta tour with a date slider and comparison to the previous best.
  Nine programs use the current manuscript's blue/purple discovered-object
  figures, with complete task panels, click-to-enlarge views, and small gallery
  thumbnails. Rosetta offers Encounters, Δv comparison, and interactive Orbit views.

## Preview locally

```sh
python3 -m http.server 8000
```

Open http://localhost:8000. Use an HTTP server so the result-budget selector can
load its JSON; opening `index.html` directly still shows the static N=1 chart.
Without JavaScript, all three search-design comparisons remain visible.

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
block in `index.html`. Add the real `eprint`, `archivePrefix`,
and `primaryClass` fields as appropriate. No arXiv identifier or venue is assumed.
For links that also work without JavaScript, replace the corresponding
`[data-resource]` spans in `index.html` with anchors when the URLs are final.

## Deployment

GitHub Pages serves **`main` → `/ (root)`**. `.nojekyll` makes this a direct static
deployment. Push changes to `main` to publish updates. All site assets use relative
paths so they work under the `/evoduet_project_page/` project prefix.

## Structure

```text
index.html                 Main findings, default chart, and comparison tables
CITATION.bib               Downloadable citation (kept in sync with the HTML)
static/css/style.css       Responsive blue/purple theme from the paper
static/css/home.css        Main-page findings, comparison tabs, and featured programs
static/js/site-config.js   Public paper/code URLs
static/js/main.js          Navigation, budget selector, figure viewer, citation copy
static/data/results.json   Aggregate chart values, stripped of private run metadata
static/images/             Web-optimized paper figures, logo, and social preview
static/figures/             Original figure PDFs
static/fonts/              Self-hosted fonts and their licenses
trajectories/              Gallery and seven recorded-run detail pages
programs/                  Gallery and eleven best-program detail pages
static/css/research.css    Gallery, record viewer, and source-code styles
static/css/trajectory.css  Gate timeline, round controls, and evidence reader
static/css/theme.css       Shared blue–violet gradients and compact visual hierarchy
static/js/research.js      Filtering, iteration navigation, artifact interactions
static/data/research/      Public score histories and selected records
static/images/favicons/    Cached source icons and origin manifest
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

This rebuild only reads the files in this repository. Shared styling lives in
`static/css/research.css`, with the final visual theme in `static/css/theme.css`.
Browser behavior lives in `static/js/research.js`.

To refresh program images from the figures currently included in the manuscript:

```sh
python3 -m pip install PyMuPDF Pillow
python3 scripts/sync_program_figures.py --paper /path/to/manuscript
python3 scripts/build_research_pages.py
```

The sync verifies program identity and score against the frozen figure records,
then extracts complete panels from the five `figures/supp_figures/sota_objects_*.pdf`
files. It records source PDF hashes and crop coordinates in each view's public
metadata. Full source PDFs remain available. Histories, objective values, code,
and interactive orbit/circle coordinates are preserved. `export_research.py`
also applies this sync, so a full export uses the same current figures.

`scripts/research_evidence.py` builds the detailed trajectory panels. To refresh
their structured evidence from the frozen archive without rebuilding figures:

```sh
python3 scripts/enrich_trajectories.py --runs /path/to/skydiscover --paper /path/to/manuscript
python3 scripts/build_research_pages.py
```

The export checks each run fingerprint and preserves the measured histories. It
adds query intent/rationale, gate and population analysis, round-specific pools
and predictions, and bounded excerpts of saved web content. A document may occur
in multiple rounds; 279 refers to recorded document entries, not unique URLs.
The same exporter runs when `export_research.py` refreshes the full dataset.

`scripts/cache_source_icons.py` optionally refreshes favicon files using Python 3
and Pillow. It reads the recorded public domains, stores images under
`static/images/favicons/`, and uses a letter icon when no favicon is available.
Visitors do not contact a third-party icon service.

## Typography

All live site text, including code and SVG labels, uses the Avenir font stack.
The CSS resolves installed Avenir Book/Medium/Heavy or Avenir Next. No Avenir
webfont file was supplied; browsers without either installed family use the
bundled Inter fallback. To guarantee Avenir on those devices, add licensed WOFF2
files to `static/fonts/` and update the `@font-face` sources in `style.css`.
The original paper figures and PDFs retain their original typography.

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
- Search-method scores: `tables/main_tables/deepevolve_comparison.tex`
  (2026-09-26 snapshot). Molecule, Burgers, and circle packing use native
  objectives; the circle-packing tie is preserved at displayed precision.
- Retrieval-gate NDG and cross-optimizer gains: `tables/main_tables/ablation_row.tex`.
  The main page distinguishes native scores, NDG percentages, and gains in pp.
- Selected best-program results: `tables/main_tables/new_sota_result.tex`.
  These runs are distinct from the fixed 100-iteration aggregate comparison.
- Interpretation and case studies: `sections/main_sections/01_introduction.tex`,
  `sections/main_sections/04_experiment.tex`, and the trajectory appendix.
- `teaser.webp` / `teaser.pdf`: `evoduet_teaser_intro.pdf`.
- `method.webp` / `method.pdf`: `evoduet_method_overview.pdf`.
- `document-use.webp` / `document-use.pdf`: `behavior_behaviors.pdf`.
- `cost-efficiency.webp` / `cost-efficiency.pdf`: `cost_pareto_denoising.pdf`.
- Logo: `evoduet_logo_teaser_palette_crop.png` from the manuscript assets.
- Paper and Code button icons: inline arXiv and GitHub SVGs from
  [Simple Icons](https://github.com/simple-icons/simple-icons) (CC0).
- Trajectories: six selected cases from the frozen behavior-analysis records,
  plus the Rosetta record used in the appendix. Full score histories come from
  their original `evolution_trace.json` files. Missing iterations are not filled
  with synthetic measurements. Checkpoint evidence includes saved retrieval
  excerpts of up to 120 words per document, with source links and content hashes.
  Raw prompts, private paths, request metadata, and complete third-party pages
  are excluded. Predictions are preserved per round, rather than replaced by
  the document's later estimate.
- Best programs: the manuscript's `programs/best_programs/manifest.json` and
  archived source files. Public source downloads are byte-for-byte identical;
  `static/programs/manifest.json` records their SHA-256 checksums.
- Mathematical artifacts: the selected-program outputs in
  `sota_objects_math_data.json`. Circle layouts are explicitly labeled replays
  with boundary/non-overlap checks and score agreement at displayed precision.
- Other scientific artifacts: frozen case-study outputs whose source hashes
  match the selected programs. Rosetta animation uses recorded propagated
  coordinates in the ecliptic projection, rather than an illustrative orbit.
- Program paper figures: the 2026-09-26 `sota_objects_{quantum,astro,denoising,ai,math}`
  PDFs included by `sections/supp_sections/supp_best_program.tex`. Quantum shows
  the matched `alu-v0_27` circuit replay; its 2 → 1 SWAP comparison is distinct
  from the full-Q20 headline. Denoising shows 24 genes and all 1,087 PBMC cells
  with training-only ordering and a shared scale, rather than the previous
  small expression window. The displayed mathematical objects match the
  selected program IDs, including the current 509-element Sums/Diffs set.

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
