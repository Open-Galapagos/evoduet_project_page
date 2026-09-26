"""Static, inspectable evidence views for the recorded trajectory pages."""
import html
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
icons_path = ROOT / 'static/images/favicons/manifest.json'
ICONS = json.loads(icons_path.read_text()) if icons_path.exists() else {}
e = lambda value: html.escape(str(value), quote=True)
GATES = {'retrieve': 'Retrieve', 'lookup': 'Look-Up', 'noop': 'No-Op', 'unrecorded': 'Not recorded'}


def stage_icon(stage):
    paths = {
        'gate': '<path d="M4 5h12M4 15h12M8 2v6M13 12v6"/>',
        'search': '<circle cx="8.5" cy="8.5" r="5.5"/><path d="m13 13 4 4"/>',
        'sources': '<path d="M5 2h7l4 4v12H5zM12 2v4h4M8 10h5M8 13h5"/>',
        'result': '<path d="m2 6 4 4-4 4M9 15h8M10 4l3 3 5-5"/>',
    }
    return f'<svg viewBox="0 0 20 20" aria-hidden="true">{paths[stage]}</svg>'


def stage_link(stage, n, label, value, index):
    return f'<a class="flow-stop flow-{stage}" href="#{stage}-{n}" data-stage-target="{stage}"><span class="flow-icon">{stage_icon(stage)}</span><span class="flow-copy"><small>{index:02d} · {label}</small><strong>{e(value)}</strong></span><span class="flow-arrow" aria-hidden="true">↗</span></a>'


def fmt(value):
    if value is None:
        return 'Not recorded'
    return f'{value:,.5f}'.rstrip('0').rstrip('.')


def prose(value):
    text = e(value)
    text = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', text)
    return ''.join(f'<p>{p.replace(chr(10), "<br>")}</p>' for p in text.split('\n\n') if p.strip())


def short(value, limit=220):
    text = re.sub(r'\s+', ' ', str(value or '')).replace('**', '')
    return text if len(text) <= limit else text[:limit].rsplit(' ', 1)[0] + '…'


def icon(domain):
    if domain in ICONS:
        return f'<img class="source-favicon" src="../{e(ICONS[domain]["path"])}" alt="" width="20" height="20" loading="lazy">'
    return f'<span class="source-favicon source-initial" aria-hidden="true">{e(domain.removeprefix("www.")[:1].upper())}</span>'


def gallery_sources(record):
    domains = list(dict.fromkeys(d['domain'] for s in record['steps'] for d in s.get('evidence', {}).get('documents', []) if d['for_solver']))
    return '<div class="card-evidence"><span class="favicon-group" aria-hidden="true">' + ''.join(icon(d) for d in domains[:5]) + f'</span><span>{len(domains)} source domains</span></div>'


def gate_rail(record):
    selected = {s['iteration'] for s in record['steps']}
    points = [p for p in record['history']['points'] if p['iteration'] > 0]
    out = '<div class="gate-rail-heading"><span>Gate decisions</span><span>Iterations 1–100 · outlined steps have detailed records</span></div><div class="gate-rail" aria-label="Recorded gate decisions over all iterations">'
    for p in points:
        n, gate = p['iteration'], p['gate']
        title = f'Iteration {n} · {GATES[gate]} · best {fmt(p["best_score"])}'
        if n in selected:
            out += f'<a class="gate-tick {gate} is-recorded" href="#iteration-{n}" data-step-link="{n}" title="{e(title)}" aria-label="{e(title)}"></a>'
        else:
            out += f'<span class="gate-tick {gate}" title="{e(title)}"></span>'
    return out + '</div>'


def log_detail(title, text, *, preview=True):
    if not text:
        return ''
    snippet = f'<span>{e(short(text))}</span>' if preview else ''
    return f'<details class="evidence-log"><summary><strong>{e(title)}</strong>{snippet}</summary><div class="log-body">{prose(text)}</div></details>'


def source_card(doc, n):
    predictions = {str(p['round']): p['score'] for p in doc['predictions']}
    final = doc['predictions'][-1]['score'] if doc['predictions'] else None
    label = 'Sent to solver' if doc['for_solver'] else 'Candidate'
    out = f'''<details class="evidence-source" data-source-ref="{e(doc['ref'])}" data-for-solver="{str(doc['for_solver']).lower()}" data-predictions="{e(json.dumps(predictions))}" data-kept-rounds="{e(json.dumps(doc['kept_rounds']))}">
<summary><span class="source-identity">{icon(doc['domain'])}<span><span class="source-domain">{e(doc['domain'])}</span><strong>{e(doc['title'])}</strong></span></span><span class="source-summary-meta"><span class="source-choice" data-source-choice>{label}</span><span class="source-score" title="Predicted child score"><small>pred.</small> <span data-document-score>{e(fmt(final))}</span></span></span><span class="source-expander" aria-hidden="true">+</span></summary>
<div class="source-reader"><div class="document-meta"><span>{e(doc['ref'].replace('evidence_', 'Doc '))} · {e(doc['provider'])}</span><a href="{e(doc['url'])}" target="_blank" rel="noopener">Open website ↗</a></div>
<div class="document-metrics"><span>Predicted child score <strong data-document-score>{e(fmt(final))}</strong></span>'''
    if doc['rank'] is not None:
        out += f'<span>Search rank <strong>#{e(doc["rank"])}</strong></span>'
    if doc['relevance'] is not None:
        out += f'<span>Search relevance <strong>{doc["relevance"]:.3f}</strong></span>'
    out += '</div>'
    if doc['excerpt']:
        out += f'<div class="web-content-heading"><span>Saved web content</span><small>{"Excerpt · " if doc["excerpt_truncated"] else ""}{doc["captured_word_count"]:,} words captured</small></div><blockquote class="web-excerpt">{e(doc["excerpt"])}{" …" if doc["excerpt_truncated"] else ""}</blockquote>'
    else:
        out += '<p class="record-empty">The source link is recorded; its text was not saved in this checkpoint.</p>'
    if doc['rounds']:
        out += '<div class="document-history"><span>Returned in ' + ', '.join(f'R{r}' for r in doc['rounds']) + '</span>'
        if doc['kept_rounds']:
            out += '<span>Kept after ' + ', '.join(f'R{r}' for r in doc['kept_rounds']) + '</span>'
        out += '</div>'
    return out + '</div></details>'


def round_view(round, n):
    r = round['round']
    out = f'<section class="search-round" data-round-panel="{r}" aria-labelledby="round-title-{n}-{r}"><h4 id="round-title-{n}-{r}">Query · round {r}</h4>'
    for query in round['queries']:
        out += f'<p class="recorded-query">{e(query["query"])}</p>'
        if query['intent']:
            out += f'<div class="query-purpose"><span>Search intent</span>{prose(query["intent"])}</div>'
        if query['keywords']:
            out += '<div class="query-keywords">' + ''.join(f'<span>{e(k)}</span>' for k in query['keywords']) + '</div>'
        out += log_detail('Query rationale', query['rationale'], preview=False)
    out += f'<div class="round-counts"><span><strong>{len(round["retrieved_refs"])}</strong> returned</span><span><strong>{len(round["candidate_refs"])}</strong> in pool</span><span><strong>{len(round["kept_refs"])}</strong> kept</span></div>'
    out += log_detail('What this round established', round['assessment'])
    if round['kept_mean'] is not None:
        out += f'<p class="round-mean">Kept-document mean prediction <strong>{fmt(round["kept_mean"])}</strong></p>'
    return out + '</section>'


def render_step(step):
    n, gate = step['iteration'], step['gate']
    rich = step['evidence']
    rounds, docs = rich['rounds'], rich['documents']
    used = [d for d in docs if d['for_solver']]
    new_best = step['best_after'] is not None and step['best_before'] is not None and step['best_after'] > step['best_before'] + 1e-12
    regressed = step['child_score'] is not None and step['parent_score'] is not None and step['child_score'] < step['parent_score'] - 1e-12
    outcome = 'New run best' if new_best else 'Incumbent retained'
    outcome_class = 'improved' if new_best else 'preserved'
    candidates = rich['generation_condition'].get('num_generations') if isinstance(rich['generation_condition'], dict) else None
    model_context = f'{candidates} candidate attempt{"s" if candidates != 1 else ""}' if candidates else 'Recorded candidate'
    flow_search = f'{len(rounds)} rounds' if rounds else 'No new search'
    flow_evidence = f'{len(used)} stored sources' if gate == 'lookup' else f'{len(used)} sources selected' if used else 'No sources attached'
    out = f'''<article class="step-panel rich-step" id="iteration-{n}" data-step-panel="{n}" aria-labelledby="step-title-{n}">
<header class="step-header"><div class="step-heading-group"><h3 id="step-title-{n}">Iteration {n}</h3><span class="gate-badge {gate}">{GATES[gate]}</span></div><span class="step-outcome {outcome_class}">{outcome}</span></header>
<nav class="iteration-flow" aria-label="Jump to a stage in iteration {n}">{stage_link('gate', n, 'Gate', GATES[gate], 1)}{stage_link('search', n, 'Search', flow_search, 2)}{stage_link('sources', n, 'Evidence', flow_evidence, 3)}{stage_link('result', n, 'Result', fmt(step['child_score']), 4)}</nav>
<div class="gate-context" id="gate-{n}" tabindex="-1"><div class="context-label"><span class="section-number">01</span><h4>Gate decision</h4><span class="gate-badge {gate}">{GATES[gate]}</span></div><div class="gate-logs">{log_detail('Reasoning', rich['gate']['reason'])}{log_detail('Knowledge before this step', rich['gate']['knowledge'])}{log_detail('Population analysis', rich['gate']['population'], preview=False)}</div></div>'''
    if docs or rounds:
        tabs = ''.join(f'<button type="button" data-search-round="{r["round"]}" aria-pressed="false" data-candidates="{e(json.dumps(r["candidate_refs"]))}" data-kept="{e(json.dumps(r["kept_refs"]))}">Round {r["round"]}<span>{len(r["retrieved_refs"])} results</span></button>' for r in rounds)
        selected_refs = [d['ref'] for d in used]
        tabs += f'<button type="button" data-search-round="final" aria-pressed="true" data-candidates="{e(json.dumps(selected_refs))}" data-kept="{e(json.dumps(selected_refs))}">{"Reused" if gate == "lookup" else "To solver"}<span>{len(used)} sources</span></button>'
        out += f'<div class="evidence-toolbar" id="search-{n}" tabindex="-1"><h4><span class="section-number">02–03</span>Search &amp; evidence</h4><div class="round-tabs" role="group" aria-label="Search rounds" hidden data-round-controls>{tabs}</div></div>'
        out += '<div class="evidence-view-switch" hidden data-evidence-views role="group" aria-label="Evidence reader"><button type="button" data-evidence-view="query" aria-pressed="true">Query &amp; rationale</button><button type="button" data-evidence-view="sources" aria-pressed="false">Web sources</button></div>'
        out += '<div class="evidence-workspace" data-mobile-view="query"><div class="query-workspace" tabindex="0" aria-label="Recorded query and analysis">' + ''.join(round_view(r, n) for r in rounds)
        final_text = rich['final_knowledge'] or ('Stored documents were reused without issuing a new web query.' if gate == 'lookup' else 'The selected documents were passed to the task solver.')
        out += f'<section class="search-round" data-round-panel="final"><h4>{"Reuse from memory" if gate == "lookup" else "Evidence sent to the solver"}</h4>'
        if rounds:
            out += '<div class="query-recap">'
            for r in rounds:
                for q in r['queries']:
                    out += f'<div><span>R{r["round"]}</span><p>{e(q["query"])}</p></div>'
            out += '</div>'
        out += log_detail('Knowledge after search' if rounds else 'Lookup context', final_text)
        if rich['stop_reason']:
            out += f'<p class="search-stop">Stop: {e(rich["stop_reason"].replace("_", " "))}</p>'
        out += f'</section></div><div class="source-workspace" id="sources-{n}" tabindex="0" aria-label="Saved web sources"><div class="source-workspace-heading"><h4>Web sources <span data-source-count></span></h4><div class="source-filters" hidden data-source-controls><button type="button" data-source-filter="kept" aria-pressed="true">Kept</button><button type="button" data-source-filter="all" aria-pressed="false">All candidates</button></div></div>'
        out += '<p class="source-help">Predictions are model estimates before evaluation.</p>'
        out += '<div class="evidence-source-list">' + ''.join(source_card(d, n) for d in docs) + '</div><p class="record-empty" hidden data-sources-empty>No recorded documents for this selection.</p></div></div>'
    else:
        out += f'<div class="no-search-state" id="search-{n}" tabindex="-1"><span id="sources-{n}" tabindex="-1" class="gate-badge noop">No-Op</span><p>The solver continues from its current program and evaluation feedback. No web search or document lookup is recorded.</p></div>'
    out += f'<section class="iteration-result" id="result-{n}" tabindex="-1"><div class="result-heading"><h4><span class="section-number">04</span>Code &amp; measured result</h4><span>{model_context}</span></div><div class="result-score-grid"><div><span>Parent → selected child</span><strong class="{"regressed" if regressed else ""}"><span class="score-from">{fmt(step["parent_score"])}</span> <i>→</i> <span class="score-to">{fmt(step["child_score"])}</span></strong><small>{"Child regressed; the incumbent survives." if regressed else "Search-time evaluator score ↑"}</small></div><div><span>Run best · before → after</span><strong><span class="score-from">{fmt(step["best_before"])}</span> <i>→</i> <span class="score-to">{fmt(step["best_after"])}</span></strong><small>{outcome}</small></div></div>'
    if step['changes']:
        out += f'<p class="recorded-change">{e(step["changes"])}</p>'
    if step['runtime_web_access']:
        out += '<p class="runtime-retrieval">This revision accesses a public artifact at runtime.</p>'
    if step['diff']:
        lines = ''.join(f'<span class="diff-line {"addition" if line.startswith("+") else "deletion" if line.startswith("-") else ""}">{e(line)}</span>' for line in step['diff'])
        out += f'<details class="change-panel" open><summary class="change-heading"><span>Code diff <small>recorded excerpt</small></span><span class="change-stats"><span class="added-count">+{step["additions"]}</span><span class="removed-count">−{step["deletions"]}</span></span></summary><pre class="diff-code" tabindex="0" aria-label="Recorded code changes"><code>{lines}</code></pre></details>'
    else:
        out += '<p class="record-empty">No code diff is included in the selected record.</p>'
    return out + '</section></article>'
