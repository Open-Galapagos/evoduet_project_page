"""Build the teaser replay from public run records and the paper's teaser annotations."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
run = json.loads((ROOT / 'static/data/research/trajectories/swap-reduction.json').read_text())
program = json.loads((ROOT / 'static/data/research/programs/swap-reduction.json').read_text())
steps = {s['iteration']: s for s in run['steps']}
assert run['run_fingerprint'] == program['run_fingerprint']
assert program['score'] == 14835 and program['reference'] == 15186

def episode(iteration, source_index, title, idea, gap, native_before, native_after, means, lines):
    step = steps[iteration]
    source = step['sources'][source_index]
    assert all(any(line in raw for raw in step['diff']) for line in lines)
    return dict(iteration=iteration, title=title, idea=idea, gap=gap,
        queries=step['queries'], sources=step['sources'], featured_source=source,
        knowledge_state=step['knowledge_state'], reasoning=step['reasoning'],
        diff=step['diff'], preview_diff=lines, additions=step['additions'], deletions=step['deletions'],
        parent_score=step['parent_score'], child_score=step['child_score'],
        native_before=native_before, native_after=native_after, kept_mean_prediction=means)

data = dict(
    task='Swap Reduction', model=run['model'], budget=run['budget'],
    score_label='Best-so-far evaluator score ↑',
    history=[dict(iteration=p['iteration'], score=p['best_score']) for p in run['history']['points']],
    episodes=[
        episode(5, 1, 'Depth-weighted lookahead', 'Weight nearer lookahead gates more.',
            'Rust APIs for depth-aware routing', 19953, 18030, [6965.0, 6965.0, 6965.5],
            ['+    fn weighted_score_delta(', '+            let weight = gamma.powi(index.min(32) as i32);']),
        episode(66, 1, 'Reversal penalty', 'Raise the cost of recently used SWAPs.',
            'Decay and front-layer scaling', 16181, 15457, [17211.4, 17211.4, 17214.1],
            ['+        if let Some((last_a, last_b)) = ctx.last_applied_swap() {',
             '+                    if ctx.swaps_since_progress() < 4 {', '+                        *score += 0.20;']),
    ],
    lookup=dict(iteration=64, gate='Look-Up', new_searches=0, best_score=17201.400000000038,
        sources=[
            dict(title='Qiskit 2.1 release notes', url='https://qiskit.qotlabs.org/docs/api/qiskit/release-notes/2.1'),
            dict(title='SabreSwap implementation', url='https://github.com/Qiskit/qiskit/blob/main/qiskit/transpiler/passes/routing/sabre_swap.py'),
            dict(title='LightSABRE', url='https://arxiv.org/html/2409.08368v1')
        ]),
    final=dict(iteration=program['best_iteration'], native_score=program['score'], reference=program['reference'],
        preview_code=[line.strip() for line in (ROOT / program['source']).read_text().splitlines()
                      if 'let gamma = ' in line or 'lookahead_weight * extended_set.weighted_score_delta' in line],
        source=program['source'], source_sha256=program['source_sha256']),
    provenance=dict(history='research/trajectories/swap-reduction.json',
        history_sha256=run['history']['trace_sha256'],
        annotations='Paper teaser: per-episode Q20 scores and mean predicted scores of kept documents.',
        timing='Replay pacing is illustrative. Iterations 6–63 and 67–100 are advanced between selected episodes; the score curve uses every recorded iteration.',
        lookup='Checkpoint 64: three committed document IDs, Look-Up, no query-optimization rounds.')
)
(ROOT / 'static/data/teaser.json').write_text(json.dumps(data,ensure_ascii=False,indent=2,allow_nan=False)+'\n')
print('Built teaser replay: 101 measured score points, 2 retrieval episodes, 1 recorded look-up.')
