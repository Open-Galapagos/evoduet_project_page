"""Export selected checkpoint evidence, without prompts or private run paths.

python3 scripts/enrich_trajectories.py --runs SKYDISCOVER --paper MANUSCRIPT
The browser reads only the resulting public, frozen JSON files.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]


def read(path, default=None):
    return json.loads(path.read_text()) if path.exists() else default


def public_url(value):
    return value if value and urlsplit(value).scheme in ('http', 'https') else ''


def clean(value):
    text = str(value or '')
    text = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f]', '', text)
    return text.strip()


def number(value):
    return value if isinstance(value, (int, float)) and math.isfinite(value) else None


def document(raw, ref):
    url = public_url(raw.get('url') or raw.get('id'))
    if not url:
        return None
    text = clean(raw.get('content') or raw.get('raw_content'))
    # These are short extracts of the saved retrieval, not a copy of each page.
    words = text.split()
    excerpt = ' '.join(words[:120])
    return dict(ref=ref, url=url, title=clean(raw.get('title')) or urlsplit(url).hostname,
                domain=urlsplit(url).hostname, excerpt=excerpt,
                excerpt_truncated=len(words) > 120, captured_word_count=len(words),
                rank=raw.get('rank'), relevance=number(raw.get('relevance_score')),
                provider=raw.get('source') or 'recorded retrieval',
                published_date=raw.get('published_date'),
                content_sha256=hashlib.sha256(text.encode()).hexdigest(),
                rounds=[], predictions=[], kept_rounds=[], for_solver=False)


def enrich_record(record, run):
    for step in record['steps']:
        checkpoint = run / f"world_knowledge/checkpoint_{step['iteration']}"
        gate = read(checkpoint / 'gate_decision.json', {})
        query = read(checkpoint / 'query_optimization.json', {})
        evolution = read(checkpoint / 'query_evolution.json', {})
        documents, rounds = {}, []
        for raw in query.get('rounds', []):
            n = raw['round']
            refs = raw.get('document_evidence_refs', [])
            retrieved = raw.get('documents', [])
            assert len(refs) == len(retrieved), (record['slug'], step['iteration'], n)
            for ref, source in zip(refs, retrieved):
                doc = document(source, ref)
                if not doc:
                    continue
                documents.setdefault(ref, doc)
                if n not in documents[ref]['rounds']:
                    documents[ref]['rounds'].append(n)
            predictions = []
            for prediction in raw.get('document_predictions', []):
                ref = prediction['evidence_ref']
                score = number(prediction.get('estimated_child_score'))
                if ref in documents:
                    documents[ref]['predictions'].append(dict(round=n, score=score))
                    predictions.append(dict(ref=ref, score=score))
            for ref in raw.get('selected_evidence_refs', []):
                if ref in documents:
                    documents[ref]['kept_rounds'].append(n)
            samples = []
            for sample in raw.get('query_samples', []):
                constructed = sample.get('constructed_query') or {}
                try:
                    response = json.loads(sample.get('response') or '{}')
                except (json.JSONDecodeError, TypeError):
                    response = {}
                if not isinstance(response, dict):
                    response = {}
                samples.append(dict(query=clean(sample.get('query') or constructed.get('query')),
                                    intent=clean(constructed.get('query_type') or response.get('query_intent')),
                                    rationale=clean(response.get('rationale')),
                                    keywords=constructed.get('keywords') or [],
                                    resources=constructed.get('resources') or []))
            kept = raw.get('selected_evidence_refs', [])
            kept_scores = [p['score'] for p in predictions if p['ref'] in kept and p['score'] is not None]
            rounds.append(dict(round=n, queries=samples, retrieved_refs=refs,
                               candidate_refs=raw.get('candidate_evidence_refs', refs),
                               kept_refs=kept, predictions=predictions,
                               kept_mean=sum(kept_scores) / len(kept_scores) if kept_scores else None,
                               assessment=clean(raw.get('knowledge_state_analysis')),
                               status=raw.get('assessment_status') or '',
                               new_documents=len(raw.get('new_document_refs', []))))
        # Look-Up documents were saved directly with the gate's reuse operation.
        for operation in evolution.get('steps', []):
            if operation.get('kind') != 'look-up':
                continue
            for i, source in enumerate(operation.get('documents', [])):
                ref = f'stored_{i + 1}'
                doc = document(source, ref)
                if doc:
                    doc['for_solver'] = True
                    documents[ref] = doc
        committed = set(evolution.get('committed_doc_ids', []))
        selected = set(query.get('selected_evidence_refs', []))
        for ref, doc in documents.items():
            if selected:
                doc['for_solver'] = ref in selected
            elif committed:
                doc['for_solver'] = doc['url'] in committed
        # Preserve source metadata when a checkpoint lacks the saved body.
        for source in step['sources']:
            if not any(d['url'] == source['url'] and d['for_solver'] for d in documents.values()):
                ref = f'source_{len(documents) + 1}'
                doc = document(source, ref)
                if doc:
                    doc['for_solver'] = True
                    documents[ref] = doc
        step['evidence'] = dict(
            gate=dict(knowledge=clean(gate.get('knowledge_state_analysis')) or step['knowledge_state'],
                      reason=clean(gate.get('reasoning')) or step['reasoning'],
                      population=clean(gate.get('population_state_analysis'))),
            rounds=rounds, documents=list(documents.values()),
            final_knowledge=clean(query.get('knowledge_state_analysis')),
            stop_reason=query.get('stop_reason') or '',
            search_attempts=query.get('search_attempts', len(rounds)),
            status=query.get('status') or '',
            generation_condition=query.get('generation_condition') or '',
            predicted_score=number(query.get('estimated_child_score')),
            excerpt_note='Excerpts from the saved retrieval, up to 120 words per document. Scores are model predictions before evaluation.',
            checkpoint_available=bool(gate or query or evolution))
    return record


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--runs', type=Path, required=True)
    parser.add_argument('--paper', type=Path, required=True)
    args = parser.parse_args()
    curated = read(args.runs / 'new_analysis/results/behavior_analysis_20260921/trajectories.json')
    for path in sorted((ROOT / 'static/data/research/trajectories').glob('*.json')):
        record = read(path)
        if record['key'] == 'rosetta':
            run_path = read(args.paper / 'figures/supp_figures/trajectory_records/rosetta.json')['run']['path']
        else:
            run_path = curated[record['key']]['dir']
        assert hashlib.sha256(run_path.encode()).hexdigest() == record['run_fingerprint']
        enrich_record(record, args.runs / run_path)
        path.write_text(json.dumps(record, ensure_ascii=False, indent=2, allow_nan=False) + '\n')
        docs = sum(len(s['evidence']['documents']) for s in record['steps'])
        rounds = sum(len(s['evidence']['rounds']) for s in record['steps'])
        print(f"{record['slug']}: {rounds} search rounds, {docs} saved documents")


if __name__ == '__main__':
    main()
