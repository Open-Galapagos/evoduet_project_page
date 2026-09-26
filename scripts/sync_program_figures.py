"""Sync best-program views from the PDFs actually included in the manuscript.

python scripts/sync_program_figures.py --paper /path/to/manuscript
Requires PyMuPDF and Pillow. Does not rerun programs or modify paper figures.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import shutil
from pathlib import Path

import pymupdf
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'static/data/research'
IMAGES = ROOT / 'static/images/programs'
PDFS = ROOT / 'static/figures/programs'

# Clip rectangles are PDF points, measured on the current paper figures.
# Whole panels retain their labels, legends, units, and comparison methods.
PANELS = {
    'swap-reduction': [('quantum', 'swap-reduction-circuit', None, 'Routed circuits',
        'Matched replay of alu-v0_27 on Q20: SimpleTES inserts two SWAPs; EvoDuet inserts one. The headline score covers the full Q20 benchmark.')],
    'rosetta': [('astro', 'rosetta-encounters', (0, 0, 280, 110), 'Encounters',
        'Rosetta encounter sequence and deep-space maneuvers. EvoDuet adds a Mars flyby. Planet images: NASA (public domain).'),
        ('astro', 'mission-delta-v', (282, 0, 396, 216), 'Δv comparison',
        'Total Δv for Rosetta and Voyager 2, including maneuvers and launch or arrival.')],
    'voyager-2': [('astro', 'voyager-2-encounters', (0, 114, 280, 216), 'Encounters',
        'Both Voyager 2 constructions follow the same encounter sequence. EvoDuet places arrival at the end of the allowed window. Planet images: NASA (public domain).'),
        ('astro', 'mission-delta-v', (282, 0, 396, 216), 'Δv comparison',
        'Total Δv for Rosetta and Voyager 2. The Voyager 2 improvement is approximately 0.0002%.')],
    'denoising': [('denoising', 'denoising-expression', None, 'Gene expression',
        'PBMC: 24 genes × 1,087 cells, with the same training-only ordering and color scale in all four panels. Held-out counts are still noisy. The headline mean also includes Tabula.')],
    'parallel-scaling': [('ai', 'parallel-scaling-comparison', (0, 0, 396, 119.3), 'Scaling laws',
        'Observed loss on Pile and Stack. The dashed P = 8 row is held out; EvoDuet predicts 7 of its 12 cells more closely.'),
        ('ai', 'scaling-held-out-error', (241, 119.4, 396, 246), 'Held-out error',
        'SimpleTES (purple) and EvoDuet (blue): held-out 1 − R² on a log scale for both scaling benchmarks. Lower is better.')],
    'domain-mixture': [('ai', 'domain-mixture-comparison', (0, 119, 233, 267.84), 'Predictions',
        'Predicted versus actual held-out loss for 24 mixtures × 5 domains, with the discovered laws and both methods’ held-out R².'),
        ('ai', 'scaling-held-out-error', (241, 119.4, 396, 246), 'Held-out error',
        'SimpleTES (purple) and EvoDuet (blue): held-out 1 − R² on a log scale for both scaling benchmarks. Lower is better.')],
    'erdos': [('math', 'erdos-comparison', (0, 0, 202, 115.6), 'Witness comparison',
        'The published 512-step witness located and polished by EvoDuet, compared with the SimpleTES construction. The full-shift overlap is available in the second view.')],
    'hadamard': [('math', 'hadamard-comparison', (211, 0, 396, 115), 'Matrix comparison',
        'Both order-29 matrices attain the same determinant. Purple is SimpleTES; blue is EvoDuet.')],
    'sums-diffs': [('math', 'sums-diffs-comparison', (0, 116, 396, 172.8), 'Set comparison',
        'The first 120 shifted integers are shown. The table reports full-set counts: EvoDuet has 509 elements, 3,575 sums, and 2,793 differences.')],
}


def read(path):
    return json.loads(Path(path).read_text())


def write(path, value):
    Path(path).write_text(json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + '\n')


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def verify_program(paper, record):
    """Confirm the figure and page refer to the very same archived program."""
    slug = record['slug']
    if slug not in PANELS:
        return
    archive = read(paper / 'programs/best_programs/manifest.json')
    selected = next(p for p in archive['programs'] if p['id'] == record['program_id'])
    assert sha(paper / selected['file']) == selected['program_sha256'] == record['source_sha256'], slug
    assert selected['score'] == record['score'], slug
    figures = paper / 'figures/supp_figures'
    score = None
    if slug in ('rosetta', 'voyager-2'):
        d = read(figures / 'sota_objects_astro_data.json')['missions'][slug.replace('-', '_')]['evoduet']
        assert d['program_id'] == record['program_id'], slug
        score = d['totals_km_s']['total']
    elif slug in ('parallel-scaling', 'domain-mixture'):
        key = {'parallel-scaling': 'parallel_scaling_law', 'domain-mixture': 'domain_mixture_scaling_law'}[slug]
        d = read(figures / 'sota_objects_ai_data.json')[key]['programs']['evoduet']
        assert d['sha256'] == record['source_sha256'], slug
        score = d['recomputed_test_r2']
    elif slug == 'denoising':
        d = read(figures / 'sota_objects_denoising_data.json')
        assert d['source_programs']['evoduet']['sha256'] == record['source_sha256'], slug
        assert d['snapshot_sha256'] == sha(figures / 'sota_objects_denoising_data.npz'), slug
        assert d['display_shape_genes_cells'] == [24, 1087], slug
    elif slug == 'swap-reduction':
        d = read(figures / 'sota_objects_quantum_circuit_data.json')['programs']['evoduet']
        assert d['program_sha256'] == record['source_sha256'] and d['swap_count'] == 1, slug
    else:
        d = read(figures / 'sota_objects_math_data.json')[slug.replace('-', '_')]['evoduet']
        assert d['program_id'] == record['program_id'], slug
        key = {'erdos': 'c5_metric', 'hadamard': 'det_ratio', 'sums-diffs': 'c_value'}[slug]
        score = d[key]
    if score is not None:
        assert math.isclose(score, record['score'], rel_tol=1e-12, abs_tol=1e-12), slug


def export_panel(paper, group, stem, clip):
    source = paper / f'figures/supp_figures/sota_objects_{group}.pdf'
    included = (paper / 'sections/supp_sections/supp_best_program.tex').read_text()
    assert str(source.relative_to(paper)) in included, f'Figure is no longer included: {source.name}'
    source_hash = sha(source)
    full_pdf = PDFS / f'paper-{group}.pdf'
    shutil.copyfile(source, full_pdf)
    target_pdf = PDFS / f'{stem}.pdf'
    with pymupdf.open(source) as original:
        assert len(original) == 1, source.name
        page = original[0]
        rect = (pymupdf.Rect(clip) & page.rect) if clip else page.rect
        if clip:
            assert rect.width > 0 and rect.height > 0
            tolerance = pymupdf.Rect(rect.x0 - .1, rect.y0 - .1, rect.x1 + .1, rect.y1 + .1)
            for block in page.get_text('dict')['blocks']:
                for line in block.get('lines', []):
                    for span in line['spans']:
                        box = pymupdf.Rect(span['bbox'])
                        if (box & rect).get_area() > .1:
                            assert tolerance.contains(box), f'{stem} clips text: {span["text"]!r}'
            with pymupdf.open() as document:
                output = document.new_page(width=rect.width + 6, height=rect.height + 6)
                frame = pymupdf.Rect(3, 3, rect.width + 3, rect.height + 3)
                output.show_pdf_page(frame, original, 0, clip=rect)
                document.save(target_pdf, garbage=4, deflate=True, no_new_id=True)
        else:
            shutil.copyfile(source, target_pdf)
    with pymupdf.open(target_pdf) as document:
        page = document[0]
        scale = min(2400 / page.rect.width, 2400 / page.rect.height)
        pixmap = page.get_pixmap(matrix=pymupdf.Matrix(scale, scale), alpha=False)
        image = Image.frombytes('RGB', (pixmap.width, pixmap.height), pixmap.samples)
        target_image = IMAGES / f'{stem}.webp'
        image.save(target_image, quality=95, method=6)
        image.thumbnail((900, 900), Image.Resampling.LANCZOS)
        thumbnail = IMAGES / f'{stem}-thumb.webp'
        image.save(thumbnail, quality=92, method=6)
    return dict(image=str(target_image.relative_to(ROOT)), thumbnail=str(thumbnail.relative_to(ROOT)),
                pdf=str(target_pdf.relative_to(ROOT)), paper_pdf=str(full_pdf.relative_to(ROOT)),
                provenance=dict(source=str(source.relative_to(paper)), source_sha256=source_hash,
                                clip_points=list(rect), cropped=bool(clip), pdf_sha256=sha(target_pdf),
                                image_sha256=sha(target_image), thumbnail_sha256=sha(thumbnail)))


def sync_record(paper, record):
    if record['slug'] not in PANELS:
        return
    verify_program(paper, record)
    views = []
    for group, stem, clip, label, caption in PANELS[record['slug']]:
        view = export_panel(paper, group, stem, clip)
        view.update(label=label, caption=caption)
        views.append(view)
    # Retain the useful task-specific analytical view alongside the paper panel.
    suffix = {'erdos': 'erdos-overlap.svg', 'hadamard': 'hadamard-gram.svg'}.get(record['slug'])
    if suffix:
        views += [view for view in record['artifact']['views'] if view['image'].endswith(suffix)]
    record['artifact']['views'] = views


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--paper', type=Path, required=True)
    args = parser.parse_args()
    index = read(DATA / 'index.json')
    records = [read(DATA / 'programs' / f'{row["slug"]}.json') for row in index['programs']]
    # Verify every match before writing any public record.
    for record in records:
        verify_program(args.paper, record)
    for record, row in zip(records, index['programs']):
        if record['slug'] not in PANELS:
            continue
        sync_record(args.paper, record)
        write(DATA / 'programs' / f'{record["slug"]}.json', record)
        row['preview'] = record['artifact']['views'][0]['thumbnail']
        print('Synced', record['slug'], flush=True)
    write(DATA / 'index.json', index)


if __name__ == '__main__':
    main()
