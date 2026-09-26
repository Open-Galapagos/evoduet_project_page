"""Build dependency-free research pages from the public frozen JSON exports.

Run with Python + Pygments after export_research.py. No private files are needed.
"""
from __future__ import annotations
import html
import json
import math
from pathlib import Path
from urllib.parse import urlsplit
from research_evidence import render_step, gallery_sources, gate_rail

from pygments import highlight
from pygments.lexers import PythonLexer, RustLexer
from pygments.formatters import HtmlFormatter

ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/'static/data/research'
BASE='https://open-galapagos.github.io/evoduet_project_page/'
e=lambda value:html.escape(str(value),quote=True)

def load(path):return json.loads(Path(path).read_text())
def fmt(value):
    if value is None:return 'Not recorded'
    if abs(value)>=1000:return f'{value:,.1f}'.rstrip('0').rstrip('.')
    return f'{value:.6f}'.rstrip('0').rstrip('.')
def native(p,value):return f'{value:,.0f}' if p['slug']=='swap-reduction' else f'{value:.6f}'
def label(g):return {'retrieve':'Retrieve','lookup':'Look-Up','noop':'No-Op','unrecorded':'Not recorded'}[g]

def head(title,desc,path):
    return f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#3f78c0">
<title>{e(title)} · EvoDuet</title><meta name="description" content="{e(desc)}"><link rel="canonical" href="{BASE+path}">
<meta property="og:type" content="website"><meta property="og:title" content="{e(title)} · EvoDuet"><meta property="og:description" content="{e(desc)}"><meta property="og:url" content="{BASE+path}"><meta property="og:image" content="{BASE}static/images/social-preview.png"><meta name="twitter:card" content="summary_large_image">
<link rel="icon" type="image/png" href="../static/images/favicon.png"><link rel="stylesheet" href="../static/css/style.css?v=20260926-duet"><link rel="stylesheet" href="../static/css/research.css?v=20260926-duet"><link rel="stylesheet" href="../static/css/trajectory.css?v=20260926-duet"><link rel="stylesheet" href="../static/css/theme.css?v=20260926-duet">
<script src="../static/js/main.js" defer></script><script src="../static/js/research.js?v=20260926-paper-figures" defer></script></head><body class="research-page collection-{path.split('/')[0]}">
<a class="skip-link" href="#main">Skip to content</a><div class="reading-progress" aria-hidden="true"></div>'''

def nav(active):
    return f'''<nav class="navbar" aria-label="Main navigation"><div class="nav-inner container"><a class="brand" href="../index.html"><img src="../static/images/evoduet.webp" width="48" height="37" alt=""><span>Evo<span class="purple-text">Duet</span></span></a><button class="nav-toggle" type="button" aria-label="Open navigation" aria-expanded="false" aria-controls="nav-links" hidden><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg></button><div class="nav-links" id="nav-links"><a href="../index.html">Overview</a><a href="../trajectories/" {'aria-current="page"' if active=='trajectories' else ''}>Trajectories</a><a href="../programs/" {'aria-current="page"' if active=='programs' else ''}>Best programs</a><a href="../index.html#bibtex">BibTeX</a></div></div></nav>'''

def footer():
    return '''<footer><div class="container footer-inner"><a class="brand" href="../index.html"><img src="../static/images/evoduet.webp" width="48" height="37" alt=""><span>Evo<span class="purple-text">Duet</span></span></a><div class="footer-links"><a href="https://github.com/Open-Galapagos/evoduet_project_page">Page source ↗</a></div></div></footer>
<dialog class="figure-dialog" aria-label="Expanded scientific figure"><div class="dialog-toolbar"><span>Scientific visualization</span><button type="button" class="dialog-close" aria-label="Close expanded figure">Close <span aria-hidden="true">×</span></button></div><img alt=""><p class="dialog-caption"></p></dialog></body></html>'''

def crumbs(section,current=None):
    name='Trajectory gallery' if section=='trajectories' else 'Best programs'
    return f'<div class="breadcrumbs"><a href="../index.html">EvoDuet</a><span class="crumb-divider" aria-hidden="true">/</span><a href="../{section}/">{name}</a>'+ (f'<span class="crumb-divider" aria-hidden="true">/</span><span>{e(current)}</span>' if current else '')+'</div>'

def chart(record,small=False,events=None):
    points=record['history']['points'];slug=record['slug'];W,H=(560,215) if small else (1060,225)
    left,right,top,bottom=(34,18,32,28) if small else (78,26,25,51)
    values=[p['best_score'] for p in points];low=min(values);high=max(values);span=high-low
    if not span:span=max(abs(high)*.04,.01)
    ymin=low-span*.07;ymax=high+span*.12;last=max(p['iteration'] for p in points)
    px=lambda x:left+x/max(1,last)*(W-left-right)
    py=lambda y:top+(ymax-y)/(ymax-ymin)*(H-top-bottom)
    pieces=[f'<svg xmlns="http://www.w3.org/2000/svg" class="{"mini-chart" if small else "full-chart"}" viewBox="0 0 {W} {H}" role="img" aria-label="{e(record["task"])}: actual recorded best-so-far search score over {last} iterations"><title>{e(record["task"])} · recorded search-time scores</title><defs><linearGradient id="area-{slug}" x1="0" y1="0" x2=".7" y2="1"><stop offset="0" stop-color="#3f78c0" stop-opacity=".2"/><stop offset="1" stop-color="#795bc0" stop-opacity=".025"/></linearGradient><linearGradient id="line-{slug}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#347bc8"/><stop offset="1" stop-color="#8555bd"/></linearGradient></defs>']
    for i in range(4):
        value=low+(high-low)*i/3;y=py(value)
        pieces.append(f'<line x1="{left}" y1="{y:.2f}" x2="{W-right}" y2="{y:.2f}" stroke="#dce5f2" stroke-dasharray="3 5" stroke-width="1"/>')
        if not small:pieces.append(f'<text x="{left-13}" y="{y+4:.2f}" fill="#657185" stroke="none" font-size="14" text-anchor="end">{e(fmt(value))}</text>')
    path=f'M {px(points[0]["iteration"]):.2f} {py(values[0]):.2f}'
    for p in points[1:]:path+=f' H {px(p["iteration"]):.2f} V {py(p["best_score"]):.2f}'
    area=path+f' L {px(last):.2f} {H-bottom} L {px(points[0]["iteration"]):.2f} {H-bottom} Z'
    pieces.append(f'<path d="{area}" fill="url(#area-{slug})" stroke="none"/><path d="{path}" fill="none" stroke="url(#line-{slug})" stroke-width="{4 if small else 3}" stroke-linecap="round" stroke-linejoin="round"/>')
    for t in [0,25,50,75,100]:
        if t>last:continue
        pieces.append(f'<text x="{px(t):.2f}" y="{H-bottom+20}" fill="#718099" stroke="none" font-size="{20 if small else 14}" text-anchor="middle">{t}</text>')
    if not small:pieces.append(f'<text x="{W/2}" y="{H-5}" fill="#657185" stroke="none" font-size="14" text-anchor="middle">Outer-loop iteration</text>')
    colors={'retrieve':'#3f78c0','lookup':'#c58d2c','noop':'#795bc0','unrecorded':'#8190a7'}
    for s in events or []:
        p=next((v for v in points if v['iteration']==s['iteration']),None)
        if not p:continue
        x,y=px(p['iteration']),py(p['best_score']);g=s['gate']
        mark=f'<circle class="chart-marker" data-iteration="{s["iteration"]}" cx="{x:.2f}" cy="{y:.2f}" r="{4 if small else 5.5}" fill="{colors[g]}" stroke="white" stroke-width="2"/>'
        pieces.append(mark if small else f'<a href="#iteration-{s["iteration"]}" data-step-link="{s["iteration"]}" aria-label="Show iteration {s["iteration"]}">{mark}</a>')
    if not small and events:pieces.append(f'<line class="chart-selected-line" x1="{px(events[0]["iteration"]):.2f}" x2="{px(events[0]["iteration"]):.2f}" y1="{top}" y2="{H-bottom}" stroke-width="1"/>')
    pieces.append('</svg>');return ''.join(pieces)

def filters(domains):
    return '<div class="gallery-bar" hidden data-gallery-controls><div class="gallery-filters" role="group" aria-label="Filter by domain">'+''.join(f'<button class="filter-chip" type="button" data-filter="{e(d)}" aria-pressed="{str(i==0).lower()}">{e(d)}</button>' for i,d in enumerate(['All']+domains))+'</div><label class="gallery-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg><span class="sr-only">Search this collection</span><input type="search" data-gallery-search placeholder="Search tasks…"></label></div>'

TASK_NAMES = {
    'circle-packing-26': 'Circle packing · 26', 'circle-packing-32': 'Circle packing · 32',
    'domain-mixture': 'Domain mixture scaling', 'parallel-scaling': 'Parallel scaling',
    'erdos': 'Erdős minimum overlap', 'erdos-cross-domain': 'Erdős minimum overlap',
    'erdos-artifact-reuse': 'Erdős minimum overlap',
}
CASE_SUMMARIES = {
    'swap-reduction': 'Depth weighting and reversal penalties reduce routing SWAPs on Q20.',
    'erdos-cross-domain': 'A radar codeword seeds improvements to a minimum-overlap construction.',
    'voyager-2': 'Lambert-solver lookups repeat defaults already supplied in the task prompt.',
    'circle-packing-26': 'A published target guides constrained optimization and feasibility repair.',
    'erdos-artifact-reuse': 'A published witness is downloaded, reused, and further optimized.',
    'galileo': 'A retrieval-backed revision regresses; the stronger incumbent is retained.',
    'rosetta': 'A published trajectory seed is refined through retrieval and numerical optimization.',
}

def task_name(r):
    return TASK_NAMES.get(r['slug'], r['task'])

def gallery(section, records):
    trajectory = section == 'trajectories'
    title = 'Trajectories' if trajectory else 'Best programs'
    desc = '7 recorded runs · 25 selected iterations' if trajectory else '11 programs · 8 improvements · 3 matches'
    text = head(title, desc, section + '/') + nav(section)
    action = '' if trajectory else '<a class="small-button" href="../static/programs/evoduet-best-programs.zip" download>Download all ↓</a>'
    text += f'<header class="gallery-hero"><div class="container"><div class="gallery-title-row"><h1>{title}</h1>{action}</div><p class="lede">{desc}</p></div></header>'
    text += '<main id="main" class="gallery-main" data-gallery><div class="container">'
    text += filters(list(dict.fromkeys(r['domain'] for r in records)))
    text += f'<p class="gallery-count sr-only" role="status" data-gallery-count>{len(records)} {title.lower()}</p><div class="gallery-grid {"trajectory-grid" if trajectory else "program-grid"}">'
    for r in records:
        search = ' '.join(str(r.get(k, '')) for k in ('task', 'domain', 'behavior', 'model')) + ' ' + task_name(r)
        text += f'<a class="research-card" href="{r["slug"]}.html" data-gallery-card data-domain="{e(r["domain"])}" data-search="{e(search)}">'
        if trajectory:
            first, last = r['history']['points'][0]['best_score'], r['history']['points'][-1]['best_score']
            text += f'<div class="card-art run-card-visual"><div class="run-card-score"><span>Best evaluator score ↑</span><strong>{e(fmt(last))}</strong><small>from {e(fmt(first))}</small></div>{chart(r, True, r["steps"])}</div>'
        else:
            primary = r['artifact']['views'][0]
            preview = primary.get('thumbnail', primary['image'].replace('.svg', '.webp'))
            text += f'<div class="card-art"><img src="../{preview}" alt="{e(task_name(r))} result" width="800" height="540" loading="lazy"></div>'
        text += '<div class="card-content">'
        if trajectory:
            text += f'<span class="card-domain">{e(r["domain"])}</span>'
        text += f'<div class="card-title-row"><h2>{e(task_name(r))}</h2>'
        if not trajectory:
            text += f'<span class="outcome-label {"matched" if r["outcome"] == "Matched" else ""}">{r["outcome"]}</span>'
        text += '</div>'
        if trajectory:
            text += f'<p class="card-detail">{e(r["behavior"])}</p>' + gallery_sources(r)
        else:
            text += f'<div class="card-score"><span>{native(r, r["reference"])}</span><span aria-hidden="true">→</span><strong>{native(r, r["score"])}</strong><span class="unit">{e(r["unit"])}</span></div>'
        count = f'{len(r["steps"])} steps' if trajectory else r['language']
        text += f'<div class="card-footer"><span>{e(r["model"])} · N={r["budget"]}</span><span class="card-open">{count} <b aria-hidden="true">↗</b></span></div></div></a>'
    text += '</div><p class="empty-state" data-empty-state hidden>No matching tasks.</p></div></main>'
    return text + footer()

def convergence(r, events=None):
    legend = '<div class="chart-key"><span><i></i>Retrieve</span><span><i class="lookup-key"></i>Look-Up</span><span><i class="noop-key"></i>No-Op</span></div>' if events else ''
    return f'<section class="convergence-panel" aria-labelledby="convergence-heading"><div class="panel-title-row"><div><h2 id="convergence-heading">Score history</h2><p>Best-so-far search-time score ↑</p></div>{legend}</div><div class="history-scroll">{chart(r, False, events)}</div>{gate_rail(r) if events else ""}</section>'

def trajectory_page(r, all_records):
    name = task_name(r)
    path = f'trajectories/{r["slug"]}.html'
    text = head(name + ' — ' + r['behavior'], CASE_SUMMARIES[r['slug']], path) + nav('trajectories')
    first, last = r['history']['points'][0]['best_score'], r['history']['points'][-1]['best_score']
    text += f'<header class="record-hero"><div class="container"><div class="record-topline"><a href="./">← Trajectories</a><a href="../static/data/research/trajectories/{r["slug"]}.json" download>Run data ↓</a></div><div class="run-intro"><div><div class="record-title-row"><h1>{e(name)}</h1><span class="card-behavior">{e(r["behavior"])}</span></div><p class="record-description">{e(CASE_SUMMARIES[r["slug"]])}</p><p class="run-meta">{e(r["model"])} <span>N={r["budget"]}</span><span>{r["last_iteration"]} iterations</span><span>Seed {r["seed"]} · {e(r["edit_mode"])}</span></p></div><div class="run-score-summary"><span>This run · best evaluator score ↑</span><div><span>{e(fmt(first))}</span><i aria-hidden="true">→</i><strong>{e(fmt(last))}</strong></div><small>Initial → final</small></div></div></div></header>'
    text += f'<main id="main" data-trajectory data-record-url="../static/data/research/trajectories/{r["slug"]}.json"><div class="container"><div class="record-main">'
    text += convergence(r, r['steps'])
    text += f'<section id="moments" aria-label="Selected iterations"><div class="moments-title"><h2>Inside the run</h2><span>{len(r["steps"])} selected iterations</span></div><div class="step-layout"><aside class="step-sidebar"><span class="sidebar-label">Iterations</span><nav class="step-navigation" aria-label="Selected iterations">'
    for step in r['steps']:
        best = step['best_after'] is not None and step['best_before'] is not None and step['best_after'] > step['best_before'] + 1e-12
        regressed = step['child_score'] is not None and step['parent_score'] is not None and step['child_score'] < step['parent_score'] - 1e-12
        state = 'New best' if best else 'Child regressed' if regressed else 'Best unchanged'
        text += f'<a class="step-link" href="#iteration-{step["iteration"]}" data-step-link="{step["iteration"]}"><span class="step-number"><small>ITER.</small><b>{step["iteration"]:02d}</b></span><span class="step-link-copy"><span><i class="step-dot {step["gate"]}"></i>{label(step["gate"])}</span><small class="step-state {"is-best" if best else "is-regressed" if regressed else ""}">{state}</small></span></a>'
    text += '</nav></aside><div class="step-viewer">' + ''.join(render_step(step) for step in r['steps'])
    text += '<div class="step-pager" hidden data-step-pager><button class="small-button" type="button" data-step-prev>← Previous</button><span class="step-position" aria-live="polite"></span><button class="small-button" type="button" data-step-next>Next →</button></div></div></div></section>'
    if r['program']:
        p = load(DATA / 'programs' / f'{r["program"]}.json')
        same = p['run_fingerprint'] == r['run_fingerprint']
        text += f'<p class="related-inline"><a href="../programs/{r["program"]}.html">{e(task_name(p))} best program →</a><span>{"Same run" if same else "Separate run"}</span></p>'
    text += '</div></div></main>'
    return text + footer()

def program_page(p):
    name = task_name(p)
    path = f'programs/{p["slug"]}.html'
    text = head(name + ' — Best program', p['description'], path) + nav('programs')
    text += f'<header class="record-hero"><div class="container"><div class="record-topline"><a href="./">← Best programs</a><a href="../static/data/research/programs/{p["slug"]}.json" download>Result data ↓</a></div><div class="record-title-row"><h1>{e(name)}</h1><span class="outcome-label {"matched" if p["outcome"] == "Matched" else ""}">{p["outcome"]} previous best</span></div><p class="run-meta">{p["model"]}<span>N={p["budget"]}</span><span>Best at iteration {p["best_iteration"]}</span><span>{p["language"]} · {p["lines"]} lines</span></p></div></header>'
    text += f'<main id="main" data-program data-record-url="../static/data/research/programs/{p["slug"]}.json"><div class="container">'
    text += f'<dl class="program-scores"><div><dt>Previous best</dt><dd>{native(p, p["reference"])}<span class="score-unit">{e(p["unit"])}</span></dd></div><div><dt>EvoDuet</dt><dd class="our-score">{native(p, p["score"])}<span class="score-unit">{e(p["unit"])}</span></dd></div><div><dt>Objective</dt><dd class="objective-name">{e(p["metric"])} {"↓" if p["direction"] == "min" else "↑"}</dd></div><div><dt>Run cost</dt><dd>${p["cost_usd"]:.2f}</dd></div></dl>'
    text += '<div class="program-workspace"><section class="artifact-panel" id="visualization" aria-labelledby="visualization-heading"><div class="artifact-toolbar"><h2 id="visualization-heading">Result</h2><div class="view-controls" role="group" aria-label="Visualization views" data-view-controls hidden>'
    for i, view in enumerate(p['artifact']['views']):
        text += f'<button class="view-button" data-artifact-view="{i}" type="button" aria-pressed="{str(i == 0).lower()}">{e(view["label"])}</button>'
    if p['artifact']['kind'] == 'orbit':
        text += '<button class="view-button" data-artifact-view="interactive" type="button" aria-pressed="false" hidden>Orbit</button>'
    text += '</div></div><div class="artifact-body"><div class="artifact-controls" data-artifact-controls hidden></div><div class="interactive-art" data-interactive-art hidden></div>'
    for i, view in enumerate(p['artifact']['views']):
        image = view['image']; stem = Path(image).stem
        pdf = view.get('pdf', f'static/figures/programs/{stem}.pdf')
        full = f' <a href="../{view["paper_pdf"]}" target="_blank" rel="noopener">Full paper figure ↗</a>' if view.get('paper_pdf') and view['provenance'].get('cropped') else ''
        text += f'<figure class="artifact-static" data-static-view="{i}"><a class="figure-zoom" href="../{image}" aria-label="Enlarge {e(name)}: {e(view["label"])}"><img src="../{image}" alt="{e(name)}: {e(view["label"])}" width="1000" height="720" loading="eager"></a><figcaption>{e(view.get("caption", p["note"]))} <a href="../{pdf}" target="_blank" rel="noopener">PDF ↗</a>{full}</figcaption></figure>'
    text += '</div></section>'
    code = (ROOT / p['source']).read_text()
    lexer = RustLexer(stripnl=False, ensurenl=False) if p['language'] == 'Rust' else PythonLexer(stripnl=False, ensurenl=False)
    colored = highlight(code, lexer, HtmlFormatter(nowrap=True))
    text += f'<section class="source-section" id="source" aria-labelledby="source-heading"><div class="panel-title-row"><h2 id="source-heading">Source</h2><p>{p["language"]}</p></div><div class="source-code-panel"><div class="source-toolbar"><span>{Path(p["source"]).name}</span><div><a class="small-button" href="../{p["source"]}" download>Download ↓</a><button class="small-button" type="button" data-copy-source="../{p["source"]}" hidden>Copy</button></div></div><pre class="source-pre" tabindex="0" aria-label="Complete {p["language"]} program"><code id="program-source">{colored}</code></pre><button class="code-expand" type="button" aria-expanded="false" aria-controls="program-source" hidden>Expand code ↓</button></div><p class="source-status" role="status" aria-live="polite"></p><p class="source-intro">Requires the original benchmark harness and dependencies.</p></section></div>'
    text += f'<details class="history-details"><summary>Score history <span>{p["last_iteration"]} iterations</span></summary>{convergence(p)}<p class="record-note">Search-time scores; the final native objective is reported above.</p></details>'
    text += f'<details class="provenance-details"><summary>Run details</summary><p>{e(p["description"])}</p><p>{e(p["note"])}</p><p>Recorded score: {p["score"]!r} · reference: {p["reference"]!r} · seed: {p["seed"]}.</p>'
    if p['artifact']['kind'] == 'circles':
        d = p['artifact']['data']
        text += f'<p>Replay sum of radii: {d["replay_score"]:.12f}. Positive radii, square boundaries, and pairwise non-overlap verified for all {d["n"]} circles.</p>'
    if p['slug'] == 'hadamard':
        text += f'<p>Exact absolute determinant: {p["artifact"]["data"]["exact_determinant"]}. The Gram view uses the same matrix.</p>'
    text += f'<p>Program ID: <code>{p["program_id"]}</code><br>Source SHA-256: <code>{p["source_sha256"]}</code><br>History SHA-256: <code>{p["history"]["trace_sha256"]}</code></p></details>'
    if p['related_trajectories']:
        text += '<div class="related-inline"><span>Trajectories</span>'
        for related in p['related_trajectories']:
            r = load(DATA / 'trajectories' / f'{related["slug"]}.json')
            text += f'<a href="../trajectories/{related["slug"]}.html">{e(r["behavior"])} ↗ <small>({"same run" if related["same_run"] else "separate run"})</small></a>'
        text += '</div>'
    text += '</div></main>'
    return text + footer()

def main():
    index = load(DATA / 'index.json')
    trajectories = [load(DATA / 'trajectories' / f'{r["slug"]}.json') for r in index['trajectories']]
    programs = [load(DATA / 'programs' / f'{r["slug"]}.json') for r in index['programs']]
    paths = ['', 'trajectories/', 'programs/']
    for section, records in [('trajectories', trajectories), ('programs', programs)]:
        directory = ROOT / section
        directory.mkdir(exist_ok=True)
        (directory / 'index.html').write_text(gallery(section, records))
        for record in records:
            page = trajectory_page(record, trajectories) if section == 'trajectories' else program_page(record)
            (directory / f'{record["slug"]}.html').write_text(page)
            paths.append(f'{section}/{record["slug"]}.html')
    (ROOT / 'sitemap.xml').write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + ''.join(f'  <url><loc>{BASE + path}</loc></url>\n' for path in paths) + '</urlset>\n')
    print(f'Built {len(trajectories)} trajectory pages, {len(programs)} program pages, and two galleries.')

if __name__ == '__main__':
    main()
