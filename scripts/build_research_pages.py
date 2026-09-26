"""Build dependency-free research pages from the public frozen JSON exports.

Run with Python + Pygments after export_research.py. No private files are needed.
"""
from __future__ import annotations
import html
import json
import math
from pathlib import Path
from urllib.parse import urlsplit

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
<link rel="icon" type="image/png" href="../static/images/favicon.png"><link rel="stylesheet" href="../static/css/style.css"><link rel="stylesheet" href="../static/css/research.css">
<script src="../static/js/main.js" defer></script><script src="../static/js/research.js" defer></script></head><body class="research-page">
<a class="skip-link" href="#main">Skip to content</a><div class="reading-progress" aria-hidden="true"></div>'''

def nav(active):
    return f'''<nav class="navbar" aria-label="Main navigation"><div class="nav-inner container"><a class="brand" href="../index.html"><img src="../static/images/evoduet.webp" width="48" height="37" alt=""><span>Evo<span class="purple-text">Duet</span></span></a><button class="nav-toggle" type="button" aria-label="Open navigation" aria-expanded="false" aria-controls="nav-links" hidden><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg></button><div class="nav-links" id="nav-links"><a href="../index.html">Overview</a><a href="../trajectories/" {'aria-current="page"' if active=='trajectories' else ''}>Trajectories</a><a href="../programs/" {'aria-current="page"' if active=='programs' else ''}>Best programs</a><a href="../index.html#bibtex">Cite EvoDuet ↗</a></div></div></nav>'''

def footer():
    return '''<footer><div class="container footer-inner"><a class="brand" href="../index.html"><img src="../static/images/evoduet.webp" width="48" height="37" alt=""><span>Evo<span class="purple-text">Duet</span></span></a><p>Searching and solving, together.</p><div class="footer-links"><a href="../trajectories/">Trajectory gallery</a><a href="../programs/">Best programs</a><a href="https://github.com/Open-Galapagos/evoduet_project_page">Page source ↗</a></div></div></footer>
<dialog class="figure-dialog" aria-label="Expanded scientific figure"><div class="dialog-toolbar"><span>Scientific visualization</span><button type="button" class="dialog-close" aria-label="Close expanded figure">Close <span aria-hidden="true">×</span></button></div><img alt=""><p class="dialog-caption"></p></dialog></body></html>'''

def crumbs(section,current=None):
    name='Trajectory gallery' if section=='trajectories' else 'Best programs'
    return f'<div class="breadcrumbs"><a href="../index.html">EvoDuet</a><span class="crumb-divider" aria-hidden="true">/</span><a href="../{section}/">{name}</a>'+ (f'<span class="crumb-divider" aria-hidden="true">/</span><span>{e(current)}</span>' if current else '')+'</div>'

def chart(record,small=False,events=None):
    points=record['history']['points'];slug=record['slug'];W,H=(560,215) if small else (1060,300)
    left,right,top,bottom=(34,18,32,28) if small else (78,26,25,51)
    values=[p['best_score'] for p in points];low=min(values);high=max(values);span=high-low
    if not span:span=max(abs(high)*.04,.01)
    ymin=low-span*.07;ymax=high+span*.12;last=max(p['iteration'] for p in points)
    px=lambda x:left+x/max(1,last)*(W-left-right)
    py=lambda y:top+(ymax-y)/(ymax-ymin)*(H-top-bottom)
    pieces=[f'<svg xmlns="http://www.w3.org/2000/svg" class="{"mini-chart" if small else "full-chart"}" viewBox="0 0 {W} {H}" role="img" aria-label="{e(record["task"])}: actual recorded best-so-far search score over {last} iterations"><title>{e(record["task"])} · recorded search-time scores</title><defs><linearGradient id="area-{slug}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3f78c0" stop-opacity=".18"/><stop offset="1" stop-color="#3f78c0" stop-opacity=".01"/></linearGradient></defs>']
    for i in range(4):
        value=low+(high-low)*i/3;y=py(value)
        pieces.append(f'<line x1="{left}" y1="{y:.2f}" x2="{W-right}" y2="{y:.2f}" stroke="#dce5f2" stroke-dasharray="3 5" stroke-width="1"/>')
        if not small:pieces.append(f'<text x="{left-13}" y="{y+4:.2f}" fill="#657185" stroke="none" font-size="11" text-anchor="end">{e(fmt(value))}</text>')
    path=f'M {px(points[0]["iteration"]):.2f} {py(values[0]):.2f}'
    for p in points[1:]:path+=f' H {px(p["iteration"]):.2f} V {py(p["best_score"]):.2f}'
    area=path+f' L {px(last):.2f} {H-bottom} L {px(points[0]["iteration"]):.2f} {H-bottom} Z'
    pieces.append(f'<path d="{area}" fill="url(#area-{slug})" stroke="none"/><path d="{path}" fill="none" stroke="#3f78c0" stroke-width="{3 if small else 2.7}" stroke-linecap="round" stroke-linejoin="round"/>')
    for t in [0,25,50,75,100]:
        if t>last:continue
        pieces.append(f'<text x="{px(t):.2f}" y="{H-bottom+20}" fill="#718099" stroke="none" font-size="{10 if small else 11}" text-anchor="middle">{t}</text>')
    if not small:pieces.append(f'<text x="{W/2}" y="{H-5}" fill="#657185" stroke="none" font-size="11" text-anchor="middle">Outer-loop iteration</text>')
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
    return '<div class="gallery-bar" hidden data-gallery-controls><div class="gallery-filters" role="group" aria-label="Filter by domain">'+''.join(f'<button class="filter-chip" type="button" data-filter="{e(d)}" aria-pressed="{str(i==0).lower()}">{e(d)}</button>' for i,d in enumerate(['All']+domains))+'</div><label class="gallery-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg><span class="sr-only">Search this collection</span><input type="search" data-gallery-search placeholder="Find a task or idea…"></label></div>'

def gallery(section,records):
    trajectory=section=='trajectories';title='Trajectory gallery' if trajectory else 'Best program collection'
    desc='Seven recorded case studies connecting search queries, evidence, code revisions, and evaluation.' if trajectory else 'Eleven complete best programs, with scientific visualizations and original source code.'
    text=head(title,desc,section+'/')+nav(section)
    headline='Every discovery<br>has a <span>trajectory.</span>' if trajectory else 'The programs<br>behind the <span>progress.</span>'
    subtitle='Follow seven real runs through the questions asked, the evidence found, and the code that changed. Each curve comes from the recorded experiment.' if trajectory else 'Explore eleven scientific constructions and their complete source code. Eight surpass the previous best score; three match it.'
    text+=f'<header class="gallery-hero"><div class="container">{crumbs(section)}<div class="gallery-title-row"><div><span class="eyebrow">EvoDuet / {"The discovery process" if trajectory else "Scientific artifacts"}</span><h1>{headline}</h1><p class="lede">{subtitle}</p></div><div class="collection-counter"><strong>{len(records):02d}</strong>{"recorded case studies" if trajectory else "archived best programs"}</div></div></div></header><main id="main" class="gallery-main" data-gallery><div class="container">'
    domains=list(dict.fromkeys(r['domain'] for r in records));text+=filters(domains)
    text+=f'<p class="gallery-count" role="status" data-gallery-count>{len(records)} {"trajectories" if trajectory else "programs"}</p><div class="gallery-grid {"" if trajectory else "program-grid"}">'
    for i,r in enumerate(records):
        featured=trajectory and i==0
        search=' '.join(str(r.get(k,'')) for k in ('task','title','domain','behavior','description','summary','model'))
        text+=f'<a class="research-card {"is-featured" if featured else ""}" href="{r["slug"]}.html" data-gallery-card data-domain="{e(r["domain"])}" data-search="{e(search)}">'
        if trajectory:
            text+=f'<div class="card-art"><span class="card-art-label">Recorded best-so-far · 100 iterations</span>{chart(r,True,r["steps"])}</div>'
        else:
            image=r['artifact']['views'][0]['image'];preview=image.replace('.svg','.webp')
            text+=f'<div class="card-art"><img src="../{preview}" alt="{e(r["task"])} scientific result" width="800" height="540" loading="lazy"></div>'
        text+=f'<div class="card-content"><div class="card-topline"><span class="domain-label">{e(r["domain"])}</span>'
        text+=f'<span>{len(r["steps"])} moments</span>' if trajectory else f'<span class="outcome-label {"matched" if r["outcome"]=="Matched" else ""}">{r["outcome"]}</span>'
        text+=f'</div><span class="card-task">{e(r["task"])}</span><h2>{e(r["title"])}</h2><p class="card-description">{e(r["summary"] if trajectory else r["description"])}</p>'
        if trajectory:text+=f'<span class="card-behavior">{e(r["behavior"])}</span>'
        else:text+=f'<div class="card-score"><span>{native(r,r["reference"])}</span><span aria-hidden="true">→</span><strong>{native(r,r["score"])}</strong><span class="unit">{e(r["unit"])}</span></div>'
        text+=f'<div class="card-footer"><span>{e(r["model"])} · N = {r["budget"]}</span><span class="card-arrow" aria-hidden="true">↗</span></div></div></a>'
    text+='</div><p class="empty-state" data-empty-state hidden>No matching records. Try another task, behavior, or domain.</p>'
    note='<strong>Selected moments, complete score histories.</strong> The seven cases follow the paper’s trajectory appendix. Curves show recorded search-time scores, while the selected moments expose the underlying decisions. Not every retrieval helps.' if trajectory else '<strong>Scientific outputs, original programs.</strong> Figures use frozen validated outputs or explicitly labeled replays of the selected source. The downloadable code requires its original benchmark environment. Matched scores do not establish global optimality.'
    text+=f'<div class="gallery-context"><span aria-hidden="true">↳</span><p>{note}</p></div>'
    if not trajectory:text+='<a class="small-button primary" href="../static/programs/evoduet-best-programs.zip" download>Download all 11 programs ↓</a>'
    return text+'</div></main>'+footer()

def convergence(r,events=None):
    legend='<div class="chart-key"><span><i></i>Retrieve</span><span><i class="lookup-key"></i>Look-Up</span><span><i class="noop-key"></i>No-Op</span></div>' if events else '<p>Actual recorded scores · higher is better</p>'
    return f'<section class="convergence-panel" aria-labelledby="convergence-heading"><div class="panel-title-row"><div><h2 id="convergence-heading">The run, at a glance.</h2><p>Best-so-far search-time evaluator score ↑</p></div>{legend}</div>{chart(r,False,events)}<p class="chart-caption">The line follows the best recorded score. {"Colored dots mark the selected moments below." if events else "The score is the benchmark’s search-time metric; the native final objective is reported separately above."} Scores are actual evaluator outputs, not document-score predictions.</p></section>'

def step_panel(s):
    new_best=s['best_after'] is not None and s['best_before'] is not None and s['best_after']>s['best_before']+1e-12
    regressed=s['child_score'] is not None and s['parent_score'] is not None and s['child_score']<s['parent_score']-1e-12
    result=f'''<article class="step-panel" id="iteration-{s['iteration']}" data-step-panel="{s['iteration']}" aria-labelledby="step-title-{s['iteration']}"><div class="step-header"><div class="step-heading-group"><h3 id="step-title-{s['iteration']}">Iteration {s['iteration']}</h3><span class="gate-badge {s['gate']}">{label(s['gate'])}</span></div><span class="step-outcome {'preserved' if not new_best else ''}">{'↗ New run best' if new_best else 'Incumbent preserved'}</span></div>
<div class="score-comparison"><div><span class="score-label">PARENT → SELECTED CHILD</span><div class="score-transition {'regressed' if regressed else ''}">{e(fmt(s['parent_score']))}<span aria-hidden="true">→</span><strong>{e(fmt(s['child_score']))}</strong></div></div><div><span class="score-label">RUN BEST · BEFORE → AFTER</span><div class="score-transition">{e(fmt(s['best_before']))}<span aria-hidden="true">→</span><strong>{e(fmt(s['best_after']))}</strong></div></div></div>
<div class="step-content"><span class="record-label">01 / The model’s recorded knowledge state</span><p class="knowledge-copy">{e(s['knowledge_state']) or 'No knowledge-state text was recorded for this iteration.'}</p>'''
    if s['reasoning']:result+=f'<details class="reasoning-details"><summary>Why this gate decision?</summary><p>{e(s["reasoning"])}</p></details>'
    result+='<div class="evidence-grid"><div><span class="record-label">02 / The search queries</span>'
    if s['queries']:
        result+='<ol class="query-list">'
        for q in s['queries']:result+=f'<li class="query-item"><span class="query-round">ROUND {q["round"]}</span><p class="query-text">{e(q["query"])}</p><p class="query-intent">{e(q["intent"])}</p></li>'
        result+='</ol>'
    else:result+='<p class="no-record">No new web search in this iteration. '+('The gate reuses stored evidence.' if s['gate']=='lookup' else 'The next revision proceeds from existing knowledge.')+'</p>'
    result+='</div><div><span class="record-label">03 / Retained evidence</span>'
    if s['sources']:
        result+='<div class="source-list">'
        for source in s['sources']:
            prediction=f'<span class="source-prediction">Predicted score: {e(fmt(source["predicted_score"]))}</span>' if source['predicted_score'] is not None else ''
            result+=f'<div class="source-item"><a href="{e(source["url"])}" target="_blank" rel="noopener">{e(source["title"])} ↗</a><div class="source-meta"><span>{e(urlsplit(source["url"]).hostname)}</span>{prediction}</div></div>'
        result+='</div><p class="record-note">Predicted scores express the model’s expectations before evaluation.</p>'
    else:result+='<p class="no-record">No document entries are attached to this selected record.</p>'
    result+='</div></div>'
    if s['diff']:
        lines=''.join(f'<span class="diff-line {"addition" if line.startswith("+") else "deletion" if line.startswith("-") else ""}">{e(line)}</span>' for line in s['diff'])
        result+=f'<div class="change-panel"><div class="change-heading"><span>04 / Selected code changes</span><div class="change-stats"><span class="added-count">+{s["additions"]}</span><span class="removed-count">−{s["deletions"]}</span></div></div><pre class="diff-code"><code>{lines}</code></pre></div><p class="record-note">Excerpts from the recorded parent-to-child diff. Counts refer to the full change; the lines shown are selected for the case study.</p>'
    result+='</div></article>'
    return result

def trajectory_page(r,all_records):
    path=f'trajectories/{r["slug"]}.html'
    text=head(r['task']+' — '+r['behavior'],r['summary'],path)+nav('trajectories')
    text+=f'<header class="record-hero"><div class="container">{crumbs("trajectories",r["task"])}<div class="record-kickers"><span class="domain-label">{e(r["domain"])}</span><span class="card-behavior">{e(r["behavior"])}</span></div><span class="record-task-name">{e(r["task"])}</span><h1>{e(r["title"])}</h1><p class="record-description">{e(r["summary"])}</p><div class="record-actions"><a class="small-button primary" href="#moments">Explore the recorded moments ↓</a><a class="small-button" href="../static/data/research/trajectories/{r["slug"]}.json" download>Download this record</a></div></div></header>'
    text+=f'<main id="main" data-trajectory data-record-url="../static/data/research/trajectories/{r["slug"]}.json"><div class="container"><dl class="run-metadata"><div><dt>Model</dt><dd>{r["model"]}</dd></div><div><dt>Candidate budget</dt><dd>N = {r["budget"]}</dd></div><div><dt>Run length</dt><dd>{r["last_iteration"]} iterations</dd></div><div><dt>Recorded setup</dt><dd>Seed {r["seed"]} · {r["edit_mode"]}</dd></div></dl><div class="record-main">'
    text+=convergence(r,r['steps'])
    text+='<section id="moments" aria-labelledby="moments-heading"><div class="step-toolbar"><h2 id="moments-heading">Inside the discovery loop.</h2><p>Select a moment to follow its evidence trail.</p></div><noscript><p class="noscript-note">All selected moments are shown below. Follow an iteration link to jump to it.</p></noscript><div class="step-layout"><aside class="step-sidebar"><nav class="step-navigation" aria-label="Recorded iterations">'
    for s in r['steps']:text+=f'<a class="step-link" href="#iteration-{s["iteration"]}" data-step-link="{s["iteration"]}"><span class="step-dot {s["gate"]}"></span><span>Iteration {s["iteration"]}<small>{label(s["gate"])}</small></span></a>'
    text+='</nav><p class="step-selection-note">These moments are selected from the paper’s case study. The curve above covers the full recorded run.</p></aside><div class="step-viewer">'
    text+=''.join(step_panel(s) for s in r['steps'])
    text+='<div class="step-pager" hidden data-step-pager><button class="small-button" type="button" data-step-prev>← Previous moment</button><span class="step-position" aria-live="polite"></span><button class="small-button" type="button" data-step-next>Next moment →</button></div></div></div></section>'
    text+=f'<div class="case-takeaway"><h2>What this run shows</h2><p>{e(r["takeaway"])}</p></div>'
    if r['program']:
        p=load(DATA/'programs'/f'{r["program"]}.json');same=p['run_fingerprint']==r['run_fingerprint']
        text+=f'<a class="related-link" href="../programs/{r["program"]}.html"><strong>Explore the {e(p["task"])} best program →</strong><small>{"This archived program comes from the same run." if same else "A separate best run for this task; it is not the program from this trajectory."} View the scientific output and complete source.</small></a>'
    others=[a for a in all_records if a['slug']!=r['slug']][:2]
    text+='<section class="related-section"><h2>Continue exploring.</h2><div class="related-links">'+''.join(f'<a class="related-link" href="{a["slug"]}.html"><strong>{e(a["title"])}</strong><small>{e(a["task"])} · {e(a["behavior"])}</small></a>' for a in others)+'</div></section>'
    text+='<div class="record-footer-nav"><a href="./">← All trajectories</a><a href="../programs/">Explore the best programs →</a></div></div></div></main>'
    return text+footer()

def program_page(p):
    path=f'programs/{p["slug"]}.html';text=head(p['task']+' — Best program',p['description'],path)+nav('programs')
    text+=f'<header class="record-hero"><div class="container">{crumbs("programs",p["task"])}<div class="record-kickers"><span class="domain-label">{e(p["domain"])}</span><span class="outcome-label {"matched" if p["outcome"]=="Matched" else ""}">{p["outcome"]} previous best</span></div><span class="record-task-name">{e(p["task"])}</span><h1>{e(p["title"])}</h1><p class="record-description">{e(p["description"])}</p><div class="record-actions"><a class="small-button primary" href="#visualization">Explore the result ↓</a><a class="small-button" href="#source">Read the program</a><a class="small-button" href="../{p["source"]}" download>Download {Path(p["source"]).suffix} ↓</a></div></div></header>'
    text+=f'<main id="main" data-program data-record-url="../static/data/research/programs/{p["slug"]}.json"><div class="container"><dl class="run-metadata"><div><dt>Model</dt><dd>{p["model"]}</dd></div><div><dt>Candidate budget</dt><dd>N = {p["budget"]}</dd></div><div><dt>Best program found</dt><dd>Iteration {p["best_iteration"]}</dd></div><div><dt>Source</dt><dd>{p["language"]} · {p["lines"]} lines</dd></div></dl>'
    text+=f'<dl class="program-scores"><div><dt>PREVIOUS BEST</dt><dd>{native(p,p["reference"])}<span class="score-unit">{e(p["unit"])}</span></dd></div><div><dt>EVODUET</dt><dd class="our-score">{native(p,p["score"])}<span class="score-unit">{e(p["unit"])}</span></dd></div><div><dt>OBJECTIVE</dt><dd style="font-size:17px">{e(p["metric"])} {"↓" if p["direction"]=="min" else "↑"}</dd></div><div><dt>REPORTED RUN COST</dt><dd>${p["cost_usd"]:.2f}</dd></div></dl>'
    text+=f'<section class="artifact-panel" id="visualization" aria-labelledby="visualization-heading"><div class="artifact-toolbar"><h2 id="visualization-heading">The scientific result.</h2><div class="view-controls" role="group" aria-label="Scientific visualization views" data-view-controls hidden>'
    for i,view in enumerate(p['artifact']['views']):text+=f'<button class="view-button" data-artifact-view="{i}" type="button" aria-pressed="{str(i==0).lower()}">{e(view["label"])}</button>'
    text+='</div></div><div class="artifact-body"><div class="artifact-controls" data-artifact-controls hidden></div><div class="interactive-art" data-interactive-art hidden></div>'
    for i,view in enumerate(p['artifact']['views']):
        image=view['image'];stem=Path(image).stem
        text+=f'<figure class="artifact-static" data-static-view="{i}"><a class="figure-zoom" href="../{image}" aria-label="Enlarge {e(p["task"])}: {e(view["label"])}"><img src="../{image}" alt="{e(p["task"])}: {e(view["label"])} from the selected program’s scientific output" width="1000" height="720" loading="eager"></a><figcaption>{e(p["note"])} <a href="../static/figures/programs/{stem}.pdf" target="_blank" rel="noopener">Figure PDF ↗</a></figcaption></figure>'
    text+=f'<p class="record-note" style="text-align:center"><a href="../static/data/research/programs/{p["slug"]}.json" download>Download the visualization data</a></p></div></section>'
    if p['artifact']['kind']=='circles':
        d=p['artifact']['data'];text+=f'<p class="record-note" style="margin-bottom:25px">Replay sum of radii: <strong>{d["replay_score"]:.12f}</strong>. The replay checks all {d["n"]} circle radii, unit-square boundaries, and pairwise non-overlap constraints. Recorded paper score: {p["score"]:.12f}.</p>'
    if p['slug']=='hadamard':text+=f'<p class="record-note" style="margin-bottom:25px">Validated exact absolute determinant: <strong>{p["artifact"]["data"]["exact_determinant"]}</strong>. The Gram view shows pairwise row inner products, computed from the same matrix.</p>'
    text+=convergence(p)
    code=(ROOT/p['source']).read_text();lexer=RustLexer(stripnl=False,ensurenl=False) if p['language']=='Rust' else PythonLexer(stripnl=False,ensurenl=False)
    colored=highlight(code,lexer,HtmlFormatter(nowrap=True))
    text+=f'<section class="source-section" id="source" aria-labelledby="source-heading"><div class="panel-title-row"><h2 id="source-heading">The complete program.</h2><p>{p["language"]} · {p["lines"]} source lines</p></div><p class="source-intro">The archived candidate, unchanged. Run it with the original task harness and dependencies; benchmark-provided interfaces and data are required.</p><div class="source-code-panel"><div class="source-toolbar"><span>{Path(p["source"]).name}</span><div><a class="small-button" href="../{p["source"]}" download>Download source ↓</a><button class="small-button" type="button" data-copy-source="../{p["source"]}" hidden>Copy code</button></div></div><pre class="source-pre" tabindex="0" aria-label="Complete {p["language"]} program"><code id="program-source">{colored}</code></pre><button class="code-expand" type="button" aria-expanded="false" aria-controls="program-source" hidden>Expand full program ↓</button></div><p class="source-status" role="status" aria-live="polite"></p></section>'
    text+=f'<details class="provenance-details"><summary>Program details and provenance</summary><p>{e(p["note"])}</p><p>Recorded score: {p["score"]!r} · reference: {p["reference"]!r} · seed: {p["seed"]} · final iteration: {p["last_iteration"]}.</p><p>Program ID: <code>{p["program_id"]}</code><br>Source SHA-256: <code>{p["source_sha256"]}</code><br>Score-history SHA-256: <code>{p["history"]["trace_sha256"]}</code></p><p>The source download is byte-for-byte identical to the paper archive. The interactive views operate on recorded outputs or the labeled replay, without executing the program in your browser.</p></details>'
    if p['related_trajectories']:
        text+='<section class="related-section"><h2>See the search behind this task.</h2><div class="related-links">'
        for t in p['related_trajectories']:text+=f'<a class="related-link" href="../trajectories/{t["slug"]}.html"><strong>{e(t["title"])} →</strong><small>{"The same run as this archived best program." if t["same_run"] else "A different recorded run on the same task."}</small></a>'
        text+='</div></section>'
    text+='<div class="record-footer-nav"><a href="./">← All best programs</a><a href="../trajectories/">Explore the trajectory gallery →</a></div></div></main>'
    return text+footer()

def main():
    index=load(DATA/'index.json')
    trajectories=[load(DATA/'trajectories'/f'{r["slug"]}.json') for r in index['trajectories']]
    programs=[load(DATA/'programs'/f'{r["slug"]}.json') for r in index['programs']]
    paths=['','trajectories/','programs/']
    for section,records in [('trajectories',trajectories),('programs',programs)]:
        directory=ROOT/section;directory.mkdir(exist_ok=True)
        (directory/'index.html').write_text(gallery(section,records))
        for record in records:
            page=trajectory_page(record,trajectories) if section=='trajectories' else program_page(record)
            (directory/f'{record["slug"]}.html').write_text(page)
            paths.append(f'{section}/{record["slug"]}.html')
    (ROOT/'sitemap.xml').write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+''.join(f'  <url><loc>{BASE+path}</loc></url>\n' for path in paths)+'</urlset>\n')
    print(f'Built {len(trajectories)} trajectory pages, {len(programs)} program pages, and two galleries.')

if __name__=='__main__':main()
