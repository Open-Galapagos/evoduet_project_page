#!/usr/bin/env python3
"""Render the homepage's native charts from frozen public data. No plot images."""
import html
import json
import math
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def e(value):
    return html.escape(str(value), quote=True)


def pct(value):
    return f'{value:.6f}%'


def tooltip(key, title, metrics, detail):
    label = f'{title}. {metrics}. {detail}'
    return (f'data-chart-item="{e(key)}" data-tip-title="{e(title)}" '
            f'data-tip-metrics="{e(metrics)}" data-tip-detail="{e(detail)}" '
            f'aria-label="{e(label)}" title="{e(label)}"')


def toolbar(key, label):
    return (f'<div class="native-chart-toolbar"><span>{e(label)}</span>'
            f'<button class="chart-expand" data-expand-chart="{key}" type="button" '
            f'aria-label="Expand {"document use chart" if key == "documents" else "Denoising cost chart"}" hidden>'
            '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M20 4l-7 7M10 20H4v-6M4 20l7-7"/></svg>'
            '<span>Expand</span></button></div>')


def documents(data):
    total = data['runs']
    assert total > 0
    out = ['<figure class="native-figure" data-native-figure="documents">',
           toolbar('documents', 'Runs with behavior (%)'),
           '<div class="native-plot behavior-chart" id="documents-chart" data-native-plot="documents" '
           'data-chart-title="Methods from the literature" role="group" '
           f'aria-label="Document use across {total} {e(data["model"])} runs. Categories can overlap.">',
           '<div class="behavior-key"><span><i></i>Evidence-based</span>'
           '<span><i class="reuse-key"></i>Reuse / over-reach</span></div>']
    for row in data['categories']:
        assert isinstance(row['count'], int) and 0 <= row['count'] <= total
        share = 100 * row['count'] / total
        metrics = f'{row["count"]} / {total} runs · {share:.1f}%'
        attrs = tooltip(row['id'], row['label'], metrics, row['description'])
        separator = ' behavior-separator' if row['id'] == 'over-reach' else ''
        out.append(f'<button class="behavior-row {row["group"]}{separator}" type="button" {attrs}>'
                   f'<span class="behavior-label">{e(row["label"])}</span>'
                   f'<span class="behavior-track" aria-hidden="true"><span class="behavior-fill" '
                   f'style="width:{pct(share)}"></span></span>'
                   f'<span class="behavior-count">{row["count"]}<small>/{total}</small></span></button>')
    out.append('<div class="behavior-axis" aria-hidden="true"><div>')
    out.extend(f'<span style="left:{tick}%">{tick}</span>' for tick in [0, 25, 50, 75, 100])
    counts = {row['id']: row['count'] for row in data['categories']}
    out.append(f'</div></div></div><figcaption><strong>{counts["method-transfer"]} of {total} runs</strong> transfer methods; '
               f'{counts["artifact-reuse"]} reuse published solutions. Behaviors can overlap.</figcaption></figure>')
    return '\n'.join(out)


def symbol(key):
    shapes = {
        'luna': '<circle cx="12" cy="12" r="6"/>',
        'gemini': '<path d="M12 3 21 12 12 21 3 12Z"/>',
        'evoduet': '<path d="m12 2 2.9 6.1 6.7 1-4.8 4.7 1.1 6.7-5.9-3.2-5.9 3.2 1.1-6.7-4.8-4.7 6.7-1Z"/>',
        'simpletes': '<rect x="5" y="5" width="14" height="14" rx="2"/>',
    }
    return f'<svg class="cost-symbol {key}-symbol" viewBox="0 0 24 24" aria-hidden="true">{shapes[key]}</svg>'


def cost(data):
    points = data['points']
    xmin, xmax = data['x_domain']
    ymin, ymax = data['y_domain']
    x = lambda value: 100 * math.log(value / xmin) / math.log(xmax / xmin)
    y = lambda value: 100 * (ymax - value) / (ymax - ymin)
    for point in points:
        assert 0 < point['cost'] and ymin <= point['ndg'] <= ymax
        pareto = not any(q['cost'] <= point['cost'] and q['ndg'] >= point['ndg']
                         and (q['cost'] < point['cost'] or q['ndg'] > point['ndg']) for q in points)
        assert point['pareto'] == pareto
    front = sorted((p for p in points if p['pareto']), key=lambda p: p['cost'])
    frontier = f'M{x(front[0]["cost"]):.6f},100'
    for point in front:
        frontier += f'H{x(point["cost"]):.6f}V{y(point["ndg"]):.6f}'
    frontier += 'H100'
    region = 'M0,0H100V' + f'{y(front[-1]["ndg"]):.6f}'
    for i in range(len(front) - 1, -1, -1):
        region += f'H{x(front[i]["cost"]):.6f}V{y(front[i-1]["ndg"]) if i else 100:.6f}'
    region += 'H0Z'
    out = ['<figure class="native-figure" data-native-figure="cost">',
           toolbar('cost', 'Held-out NDG (%) ↑'),
           '<div class="native-plot cost-chart" id="cost-chart" data-native-plot="cost" '
           'data-chart-title="Denoising cost frontier" role="group" '
           'aria-label="Denoising performance versus cost. The cost axis is logarithmic.">',
           '<div class="cost-graph"><div class="cost-plane">',
           '<svg class="cost-geometry" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">',
           '<defs><linearGradient id="cost-region" x1="0" y1="0" x2="1" y2="1">'
           '<stop offset="0" stop-color="#347bc8" stop-opacity=".09"/>'
           '<stop offset="1" stop-color="#8654bd" stop-opacity=".12"/></linearGradient></defs>',
           f'<path class="frontier-region" d="{region}" fill="url(#cost-region)"/>']
    out.extend(f'<line class="cost-grid" x1="0" x2="100" y1="{y(tick):.6f}" y2="{y(tick):.6f}"/>'
               for tick in data['y_ticks'])
    out.append(f'<path class="frontier-line" d="{frontier}"/></svg>')
    out.extend(f'<span class="cost-y-tick" style="top:{pct(y(tick))}" aria-hidden="true">{tick}</span>'
               for tick in data['y_ticks'])
    out.extend(f'<span class="cost-x-tick" style="left:{pct(x(tick))}" aria-hidden="true">{tick:g}</span>'
               for tick in data['x_ticks'])
    lookup = {p['id']: p for p in points}
    ours, reference, baseline = lookup['evoduet'], lookup['simpletes'], lookup['luna']
    attrs = {}
    for point in points:
        key = point['id']
        title = f'{point["method"]} + {point["model"]}' if key in ('luna', 'gemini') else point['method']
        metrics = f'{point["ndg"]:.2f}% NDG · ${point["cost"]:.2f}' + (' estimated' if point['estimated'] else '')
        detail = ('On the observed Pareto frontier.' if point['pareto'] else 'Below the observed Pareto frontier.')
        if point['estimated']:
            detail = (f'Estimated API-equivalent cost. Workload sensitivity: ${point["cost_low"]:.2f}–'
                      f'${point["cost_high"]:.2f} (0.5–2×); this is not a confidence interval.')
            out.append(f'<span class="cost-sensitivity" aria-hidden="true" style="left:{pct(x(point["cost_low"]))};'
                       f'width:{pct(x(point["cost_high"])-x(point["cost_low"]))};top:{pct(y(point["ndg"]))}"></span>')
        attrs[key] = tooltip(key, title, metrics, detail)
        out.append(f'<button type="button" class="cost-point point-{key}" {attrs[key]} '
                   f'style="left:{pct(x(point["cost"]))};top:{pct(y(point["ndg"]))}">'
                   f'<span class="cost-point-badge">{symbol(key)}</span>'
                   f'<span class="cost-point-label"><strong>{point["ndg"]:.2f}%</strong>'
                   f'<small>${point["cost"]:.2f}</small></span></button>')
    ratio = reference['cost'] / ours['cost']
    gain = ours['ndg'] - baseline['ndg']
    out.append(f'<div class="cost-comparison" aria-hidden="true" style="left:{pct(x(ours["cost"]))};'
               f'width:{pct(x(reference["cost"])-x(ours["cost"]))}"><span>{ratio:.1f}× lower cost</span></div>')
    out.append(f'<div class="ndg-comparison" aria-hidden="true" style="left:{pct((x(baseline["cost"])+x(ours["cost"]))/2)};'
               f'top:{pct(y(ours["ndg"]))};height:{pct(y(baseline["ndg"])-y(ours["ndg"]))}">'
               f'<span>+{gain:.2f} pp</span></div>')
    out.append('</div><span class="cost-axis-label">Cost (USD) · log scale</span></div><div class="cost-legend">')
    for point in points:
        key = point['id']
        subtitle = f'<small>{e(point["model"])}</small>' if key in ('luna', 'gemini') else ''
        out.append(f'<button type="button" class="cost-legend-item point-{key}" {attrs[key]}>'
                   f'{symbol(key)}<span>{e(point["method"])}{subtitle}</span></button>')
    out.append('</div><div class="frontier-key"><i></i>Pareto frontier</div></div>'
               '<figcaption>Best observed results. SimpleTES cost is estimated; '
               'the bar shows 0.5–2× workload sensitivity.</figcaption></figure>')
    return '\n'.join(out)


def main():
    data = json.loads((ROOT / 'static/data/home-charts.json').read_text())
    path = ROOT / 'index.html'
    page = path.read_text()
    for key, content in [('DOCUMENTS', documents(data['document_use'])), ('COST', cost(data['cost']))]:
        pattern = rf'<!-- BEGIN {key} CHART -->.*?<!-- END {key} CHART -->'
        page, count = re.subn(pattern, lambda _: f'<!-- BEGIN {key} CHART -->\n{content}\n<!-- END {key} CHART -->', page, flags=re.S)
        assert count == 1, f'Missing {key} chart placeholder'
    path.write_text(page)
    print('Rendered six behavior bars and four cost points as native HTML and SVG.')


if __name__ == '__main__':
    main()
