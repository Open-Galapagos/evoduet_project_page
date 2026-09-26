"""Export public, task-specific records from the manuscript and frozen experiment data.

Usage: python scripts/export_research.py --paper PATH --runs PATH --circle-replays PATH
Requires: ijson, numpy, matplotlib, Pillow, PyMuPDF. Does not call an LLM or rerun a search.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import math
import shutil
import zipfile
from pathlib import Path
from urllib.parse import urlsplit

import ijson
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Circle
from matplotlib.colors import ListedColormap, LinearSegmentedColormap
import pymupdf
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'static/data/research'
IMAGES = ROOT / 'static/images/programs'
BLUE, PURPLE, INK, GRAY = '#3f78c0', '#795bc0', '#202a3b', '#657185'
for p in (DATA/'trajectories', DATA/'programs', IMAGES, ROOT/'static/programs', ROOT/'static/figures/programs'):
    p.mkdir(parents=True, exist_ok=True)

CASES = [
 dict(key='swap', slug='swap-reduction', task='Swap Reduction', domain='Quantum compilation', behavior='Method transfer', title='A better router, one question at a time.', summary='Retrieved depth weighting becomes a lasting part of the router, even as later searches repeatedly miss the needed implementation.', takeaway='Exponential depth weighting introduced at iteration 5 remains in every later best program. At iteration 77, progress occurs despite a retrieval with no promising document.', program='swap-reduction'),
 dict(key='erdos', slug='erdos-cross-domain', task='Erdős minimum overlap', domain='Mathematics', behavior='Cross-domain transfer', title='From radar codes to a mathematical bound.', summary='A low-sidelobe radar codeword seeds later improvements to the minimum-overlap construction.', takeaway='The codeword is implemented at iteration 28 without a new best. Reusing the stored source at iteration 30 yields the first subsequent improvement.', program='erdos'),
 dict(key='voyager', slug='voyager-2', task='Voyager 2', domain='Astrodynamics', behavior='Documentation lookup', title='A useful lookup needs more than a citation.', summary='The agent consults Lambert-solver documentation, but the added keywords repeat defaults already supplied in the task prompt.', takeaway='The two documented revisions do not set a new run best. The record illustrates why retrieving relevant documentation alone does not establish a benefit.', program='voyager-2'),
 dict(key='cp26', slug='circle-packing-26', task='Circle packing · 26', domain='Mathematics', behavior='Target-informed reconstruction', title='A published target becomes a starting point.', summary='A generated solver combines constrained optimization and radius repair, eventually exceeding the value named in the first query.', takeaway='The first query names a published target, but the generated solver still needs numerical optimization and feasibility repair to reach a stronger construction.', program='circle-packing-26'),
 dict(key='artifact', slug='erdos-artifact-reuse', task='Erdős minimum overlap', domain='Mathematics', behavior='Public artifact reuse', title='Start from a witness. Then improve it.', summary='A second run downloads a published witness and uses it in a program that improves the run’s best score.', takeaway='This case explicitly reuses a public construction. Its improvement should be read as artifact reuse followed by optimization, with credit to the original witness.', program='erdos'),
 dict(key='galileo', slug='galileo', task='Galileo', domain='Astrodynamics', behavior='Evidence-inspired over-reach', title='Promising evidence. A worse candidate.', summary='A retrieval predicted to help precedes a regression. The evaluator preserves the stronger incumbent.', takeaway='At iteration 33, the generated child performs worse than its parent. Predicted document scores are hypotheses; the measured result determines what survives.', program=None),
 dict(key='rosetta', slug='rosetta', task='Rosetta', domain='Astrodynamics', behavior='Artifact reuse & method transfer', title='A published trajectory, a better final tour.', summary='Published seeds, stored implementation details, and further numerical refinement produce a lower-cost Rosetta trajectory.', takeaway='Fresh retrieval supplies the reference construction; a later Look-Up resolves its departure-frame convention. The final selected revision proceeds without new retrieval.', program='rosetta'),
]

PROGRAMS = {
 'Swap Reduction': dict(slug='swap-reduction', domain='Quantum compilation', title='Routing with fewer SWAPs.', description='A quantum circuit router that combines depth-weighted lookahead, topology-aware scoring, and penalties for reversing recent SWAPs.', metric='Added SWAPs on Q20', unit='SWAPs', note='The improvement is specific to Q20 under the shared evaluator. It is not a claim of superiority on every device topology.'),
 'Rosetta': dict(slug='rosetta', domain='Astrodynamics', title='Refining an interplanetary journey.', description='A multiple-gravity-assist optimizer that reuses a published Rosetta seed and refines the evaluator-specific trajectory.', metric='Total Δv', unit='km/s', note='Published trajectory reuse is part of this result. The orbital plot uses propagated trajectories from the frozen paper data.'),
 'Voyager 2': dict(slug='voyager-2', domain='Astrodynamics', title='A finely tuned outer-planet tour.', description='A trajectory search over encounter timing and transfer geometry for the Voyager 2 benchmark.', metric='Total Δv', unit='km/s', note='The numerical improvement is small. Both the saved score and reference are displayed at the paper’s precision.'),
 'Denoising': dict(slug='denoising', domain='Scientific algorithms', title='Recovering structure in single-cell counts.', description='A denoising program that combines library-size normalization, graph-based smoothing, and count-aware estimates.', metric='Held-out score', unit='', note='The headline is the recorded PBMC/Tabula held-out mean. The expression window is a visualization of a PBMC replay, not a new aggregate evaluation.'),
 'Domain Mixture Scaling': dict(slug='domain-mixture', domain='AI foundations', title='Predicting the effect of a data mixture.', description='A fitted scaling-law program that predicts held-out loss across training-domain mixtures.', metric='Held-out R²', unit='', note='The figure shows predictions on the frozen held-out data from the paper’s replay.'),
 'Parallel Scaling': dict(slug='parallel-scaling', domain='AI foundations', title='A law for parallel scaling.', description='A fitted scientific model of how loss changes with the benchmark’s parallelism and training variables.', metric='Held-out R²', unit='', note='The reported score belongs to the archived Gemini-3.8-Flash program at iteration 2.'),
 'Erdos': dict(slug='erdos', domain='Mathematics', title='A witness for minimum overlap.', description='A step-function construction that reuses published witness data and applies constrained numerical polishing.', metric='Minimum-overlap bound C₅', unit='', note='The witness comes from public artifacts. The selected program retrieves them at runtime before polishing; the visualization uses the frozen validated replay.'),
 'Hadamard': dict(slug='hadamard', domain='Mathematics', title='An order-29 sign matrix.', description='A search for a 29 × 29 matrix with entries in {−1, +1} and a large absolute determinant.', metric='Normalized determinant', unit='', note='The replay reproduces the recorded exact determinant. Matching the reference score is not proof of a global optimum.'),
 'Sums/Diffs': dict(slug='sums-diffs', domain='Mathematics', title='More sums, fewer differences.', description='An integer-set search using structured families, exact bitmask scoring, and local refinement.', metric='MSTD exponent C(A)', unit='', note='The displayed 509-element set is from the validated replay of this selected N=8 program; it is not the older N=16 construction.'),
 'CP (n=26)': dict(slug='circle-packing-26', domain='Mathematics', title='26 circles. One unit square.', description='A variable-radius packing optimized with linearized steps, local exploration, and nonlinear polishing.', metric='Sum of radii', unit='', note='Circle coordinates are a fresh replay of the archived source. Boundary and pairwise non-overlap constraints were checked.'),
 'CP (n=32)': dict(slug='circle-packing-32', domain='Mathematics', title='32 circles, fitted together.', description='A multistart constrained optimizer over staggered layouts, circle centers, and radii.', metric='Sum of radii', unit='', note='Circle coordinates are a fresh replay of the archived source. The replay agrees with the recorded score at displayed precision.'),
}

def read(path):
    return json.loads(Path(path).read_text())

def write(path, data):
    Path(path).write_text(json.dumps(data, ensure_ascii=False, indent=2, allow_nan=False)+'\n')

def sha(path):
    h=hashlib.sha256()
    with Path(path).open('rb') as f:
        for chunk in iter(lambda:f.read(1024*1024), b''):h.update(chunk)
    return h.hexdigest()

def finite(value):
    return isinstance(value, (int,float)) and math.isfinite(value)

def model(value):
    return {'gpt-5.6-luna-1.0':'GPT-5.6-Luna','gpt-5.6-sol-1.0':'GPT-5.6-Sol','gemini-3.8-flash-1.0':'Gemini-3.8-Flash'}[value]

def gate(value):
    return {'retrieve':'retrieve','look-up':'lookup','lookup':'lookup','no-op':'noop','noop':'noop','no_retrieval':'noop'}.get(value, 'unrecorded')

def public_url(value):
    return value if value and urlsplit(value).scheme in ('https','http') else None

HISTORY_CACHE={}
def history(run):
    key=str(run)
    if key in HISTORY_CACHE:return HISTORY_CACHE[key]
    path=run/'evolution_trace.json'
    records=[]
    # A trace can exceed 250 MB; stream one program at a time and export scores only.
    with path.open('rb') as handle:
        for p in ijson.items(handle,'programs.item',use_float=True):
            if (p.get('metadata') or {}).get('migrant'):continue
            score=(p.get('metrics') or {}).get('combined_score')
            if not finite(score):continue
            records.append((int(p.get('iteration_found') or 0),score))
    grouped={}
    for iteration,score in records:grouped[iteration]=max(score,grouped.get(iteration,-math.inf))
    result=[];best=-math.inf
    for iteration,score in sorted(grouped.items()):
        best=max(best,score)
        gpath=run/f'world_knowledge/checkpoint_{iteration}/gate_decision.json'
        decision=gate(read(gpath).get('decision')) if gpath.exists() else 'unrecorded'
        result.append(dict(iteration=iteration, candidate_score=score, best_score=best, gate=decision))
    res=dict(points=result, trace_sha256=sha(path), score_label='Search-time evaluator score ↑', note='Best-so-far envelope of recorded, non-migrant programs. If multiple programs share an iteration, the highest recorded score is used. Missing iterations are not invented.')
    HISTORY_CACHE[key]=res
    return res

def normalized_step(s, rosetta=False):
    g=s['gate']
    result=dict(iteration=s['iteration'], gate=gate(g.get('decision')), knowledge_state=g.get('knowledge_state_analysis' if rosetta else 'knowledge_state') or '', reasoning=g.get('reasoning') or '', queries=[dict(round=q['round'],query=q['query'],intent=q.get('query_type' if rosetta else 'intent') or '') for q in s.get('queries',[])], sources=[], parent_score=s.get('parent_score',s.get('parent_metrics',{}).get('combined_score')), child_score=s.get('result_score',s.get('child_metrics',{}).get('combined_score')), best_before=s.get('best_before'), best_after=s.get('best_after'), additions=s.get('diff_added' if rosetta else 'n_add',0), deletions=s.get('diff_removed' if rosetta else 'n_del',0), diff=[line['line'] for line in s.get('selected_diff',[])] if rosetta else s.get('diff',[]), changes=s.get('changes') or '', runtime_web_access=bool(s.get('runtime_web_access')))
    evidence=(s.get('retained_sources',[])+s.get('lookup_sources',[])) if rosetta else s.get('evidence',[])
    seen=set()
    for e in evidence:
        url=public_url(e.get('url') or e.get('id'))
        if not url or url in seen:continue
        seen.add(url)
        result['sources'].append(dict(title=e.get('title') or urlsplit(url).hostname, url=url, predicted_score=e.get('estimated_child_score') if rosetta else e.get('est')))
    for key in ('parent_score','child_score','best_before','best_after'):
        if not finite(result[key]):result[key]=None
    # Deliberately omit third-party page bodies, private run paths, and raw LLM prompts.
    return result

plt.rcParams.update({'font.family':'DejaVu Sans','font.size':10,'axes.spines.top':False,'axes.spines.right':False,'axes.edgecolor':'#d2dce9','axes.labelcolor':GRAY,'xtick.color':GRAY,'ytick.color':GRAY,'text.color':INK,'axes.titleweight':'bold','figure.facecolor':'white','axes.facecolor':'white','svg.fonttype':'none'})
def save_fig(fig, slug, suffix=''):
    stem=slug+suffix
    fig.savefig(IMAGES/f'{stem}.svg',bbox_inches='tight',metadata={'Date':None})
    fig.savefig(ROOT/'static/figures/programs'/f'{stem}.pdf',bbox_inches='tight',metadata={'CreationDate':None,'ModDate':None})
    tmp=IMAGES/f'{stem}.png';fig.savefig(tmp,dpi=180,bbox_inches='tight')
    with Image.open(tmp) as im:im.convert('RGB').save(IMAGES/f'{stem}.webp',quality=92,method=6)
    tmp.unlink();plt.close(fig)
    return f'static/images/programs/{stem}.svg'

def pdf_image(source, slug):
    doc=pymupdf.open(source);page=doc[0];pix=page.get_pixmap(matrix=pymupdf.Matrix(1800/page.rect.width,1800/page.rect.width),alpha=False)
    Image.frombytes('RGB',(pix.width,pix.height),pix.samples).save(IMAGES/f'{slug}.webp',quality=92,method=6)
    shutil.copy2(source,ROOT/'static/figures/programs'/f'{slug}.pdf')
    return f'static/images/programs/{slug}.webp'

def artifact(paper, record, circle_replays):
    slug=record['slug'];cases=paper/'figures/main_figures/sota_case_studies'
    math_data=read(paper/'figures/supp_figures/sota_objects_math_data.json')
    views=[];extra={}
    if slug.startswith('circle-packing'):
        n=int(slug.rsplit('-',1)[1]);d=read(circle_replays/f'circles-{n}.json');q=np.array(d['circles'])
        assert abs(d['replay_score']-record['score'])<1e-7
        fig,ax=plt.subplots(figsize=(7.1,5.4));ax.set_aspect('equal');ax.set(xlim=(0,1),ylim=(0,1),xlabel='x',ylabel='y')
        for i,(x,y,r) in enumerate(q):
            color=BLUE if i%2==0 else PURPLE
            ax.add_patch(Circle((x,y),r,facecolor=color+'22',edgecolor=color,lw=1.7));ax.text(x,y,str(i+1),ha='center',va='center',fontsize=7,color=color)
        ax.spines[['top','right']].set_visible(True);ax.set_title(f'{n} circles in a unit square',loc='left',pad=18)
        views=[dict(label='Circle packing',image=save_fig(fig,slug))];extra=dict(kind='circles',data=d)
    elif slug=='hadamard':
        d=math_data['hadamard']['evoduet'];assert d['program_id']==record['program_id']
        m=np.array(d['matrix']);gram=m@m.T
        for label,matrix,suffix in [('Sign matrix',m,''),('Gram matrix',gram,'-gram')]:
            fig,ax=plt.subplots(figsize=(7.1,5.4));im=ax.imshow(matrix,cmap=ListedColormap(['#eaf0f8',BLUE]) if suffix=='' else 'PuBu',interpolation='nearest')
            ax.set(xlabel='Column',ylabel='Row',xticks=[0,7,14,21,28],xticklabels=[1,8,15,22,29],yticks=[0,7,14,21,28],yticklabels=[1,8,15,22,29]);ax.set_title('29 × 29 '+label.lower(),loc='left',pad=18)
            cb=fig.colorbar(im,ax=ax,shrink=.72,pad=.06);cb.set_label('Matrix entry' if suffix=='' else 'Row inner product')
            if suffix=='':cb.set_ticks([-1,1])
            views.append(dict(label=label,image=save_fig(fig,slug,suffix)))
        extra=dict(kind='views',data=dict(matrix=d['matrix'],exact_determinant=d['abs_det']))
    elif slug=='erdos':
        d=math_data['erdos']['evoduet'];assert d['program_id']==record['program_id'];h=np.array(d['h']);n=len(h);c=np.correlate(h,1-h,mode='full')*2/n
        fig,ax=plt.subplots(figsize=(7.1,4.8));x=np.linspace(0,2,n+1);ax.stairs(h,x,color=BLUE,fill=True,alpha=.28);ax.stairs(h,x,color=BLUE,lw=1);ax.set(xlabel='Position x',ylabel='h(x)',xlim=(0,2),ylim=(-.02,1.05));ax.set_title('A 512-step witness',loc='left',pad=18);views.append(dict(label='Witness h(x)',image=save_fig(fig,slug)))
        fig,ax=plt.subplots(figsize=(7.1,4.8));x=np.arange(-(n-1),n)*2/n;ax.plot(x,c,color=PURPLE,lw=1.8);ax.axhline(record['score'],color=BLUE,ls='--',lw=1,label=f'C₅ = {record["score"]:.6f}');ax.set(xlabel='Shift',ylabel='Overlap',xlim=(-2,2));ax.set_title('Full-shift overlap profile',loc='left',pad=18);ax.legend(frameon=False);views.append(dict(label='Overlap profile',image=save_fig(fig,slug,'-overlap')));extra=dict(kind='views',data=dict(h=h.tolist(),shift=x.tolist(),overlap=c.tolist()))
    elif slug=='sums-diffs':
        d=math_data['sums_diffs']['evoduet'];assert d['program_id']==record['program_id'];a=np.array(d['set']);s=sorted({int(i+j) for i in a for j in a});diff=sorted({int(i-j) for i in a for j in a})
        assert len(s)==3575 and len(diff)==2793 and len(a)==509
        fig,axes=plt.subplots(3,1,figsize=(8,5.4),gridspec_kw={'hspace':.85})
        for ax,vals,name,col in zip(axes,[a,s,diff],['A · 509 integers','A + A · 3,575 sums','A − A · 2,793 differences'],[BLUE,PURPLE,'#bd882c']):
            ax.vlines(vals,0,1,colors=col,linewidth=.5);ax.set(ylim=(-.05,1.05),yticks=[]);ax.set_title(name,loc='left',fontsize=10,pad=8)
        axes[-1].set_xlabel('Integer value');views=[dict(label='Set construction',image=save_fig(fig,slug))];extra=dict(kind='views',data=dict(set=a.tolist(),sumset=s,diffset=diff,exponent=d['c_value']))
    elif slug=='swap-reduction':
        fig,ax=plt.subplots(figsize=(7.1,4.8));vals=[20001,15186,14835];names=['Initial program','Previous best','EvoDuet'];bars=ax.barh(names,vals,color=['#d2dae6','#adbdd2',BLUE],height=.52);ax.invert_yaxis();ax.set(xlabel='Added SWAPs on Q20 · lower is better',xlim=(0,23000));ax.set_title('Circuit routing on Q20',loc='left',pad=22)
        for b,v in zip(bars,vals):ax.text(v+350,b.get_y()+b.get_height()/2,f'{v:,}',va='center',fontsize=11,color=INK)
        views=[dict(label='Q20 comparison',image=save_fig(fig,slug))];extra=dict(kind='views',data=dict(labels=names,added_swaps=vals))
    elif slug=='rosetta':
        d=read(cases/'data/rosetta.json');views=[dict(label='Orbital transfer',image=pdf_image(cases/'rosetta.pdf',slug))]
        extra=dict(kind='orbit',data={key:d[key] for key in ('earth_orbit','mars_orbit','ours','prev','projection','cost_definition')})
    else:
        stems={'voyager-2':'voyager_2','denoising':'rna_seq_denoising','domain-mixture':'domain_mix','parallel-scaling':'parallel_scaling'}
        stem=stems[slug]
        # Check the program behind each reused figure; use the current replay for all examples.
        replay_name={'voyager-2':'voyager_2_replay','denoising':'denoising_replay','domain-mixture':'domain_mixture_scaling_law_replay','parallel-scaling':'parallel_scaling_law_replay'}[slug]
        replay=read(cases/'data'/f'{replay_name}.json')
        source=replay.get('source_program')
        match=source and Path(source).exists() and sha(source)==record['source_sha256']
        if not match:
            print('FIGURE SOURCE CHECK:',slug,'requires current-snapshot rendering',flush=True)
        views=[dict(label='Scientific result',image=pdf_image(cases/f'{stem}.pdf',slug))]
        extra=dict(kind='views',data=dict(replay_score=replay.get('replay_score'),reported_score=replay.get('reported_score'),source_matches_selected=bool(match)))
        if not match:raise ValueError(f'Figure source differs from selected program: {slug}')
    return dict(views=views,**extra)

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--paper',type=Path,required=True);parser.add_argument('--runs',type=Path,required=True);parser.add_argument('--circle-replays',type=Path,required=True);args=parser.parse_args()
    archive=read(args.paper/'programs/best_programs/manifest.json')
    curated=read(args.runs/'new_analysis/results/behavior_analysis_20260921/trajectories.json')
    trajectories=[]
    for meta in CASES:
        if meta['key']=='rosetta':
            raw=read(args.paper/'figures/supp_figures/trajectory_records/rosetta.json');r=raw['run'];run=args.runs/r['path'];steps=[normalized_step(s,True) for s in raw['iterations']];backbone=model(r['model']);budget=r['candidates_per_iteration'];seed=r['seed'];edit='full rewrite'
        else:
            raw=curated[meta['key']];run=args.runs/raw['dir'];steps=[normalized_step(s) for s in raw['iterations']];backbone=model(raw['model']);budget=8;seed=int(raw['seed']);edit='diff edits' if raw['mode']=='diff' else 'full rewrite'
        h=history(run)
        for step in steps:
            point=next(p for p in h['points'] if p['iteration']==step['iteration'])
            if step['best_after'] is not None:assert math.isclose(step['best_after'],point['best_score'],rel_tol=1e-8,abs_tol=1e-8),(meta['key'],step['iteration'])
        record=dict(**meta,model=backbone,budget=budget,seed=seed,edit_mode=edit,steps=steps,history=h,run_fingerprint=hashlib.sha256(str(run.relative_to(args.runs)).encode()).hexdigest(),last_iteration=h['points'][-1]['iteration'])
        write(DATA/'trajectories'/f'{meta["slug"]}.json',record);trajectories.append(record)
        print('Exported trajectory',meta['slug'],len(h['points']),'points',flush=True)
    programs=[]
    for p in archive['programs']:
        meta=PROGRAMS[p['task']];source=args.paper/p['file'];slug=meta['slug'];source_hash=sha(source);assert source_hash==p['program_sha256']
        target=ROOT/'static/programs'/source.name;shutil.copy2(source,target)
        run=Path(p['program']).parent.parent
        record=dict(**meta,task=p['task'],score=p['score'],reference=p['reference'],direction=p['direction'],outcome='Improved' if p['verdict']=='improves_reference' else 'Matched',model=model(p['model']),budget=p['candidate_count'],seed=p['seed'],best_iteration=p['best_iteration'],last_iteration=p['last_iteration'],cost_usd=p['cost_usd'],program_id=p['id'],source_sha256=source_hash,source=f'static/programs/{source.name}',language='Rust' if source.suffix=='.rs' else 'Python',lines=p['lines'],history=history(run),run_fingerprint=hashlib.sha256(str(run.relative_to(args.runs)).encode()).hexdigest())
        record['artifact']=artifact(args.paper,record,args.circle_replays)
        record['related_trajectories']=[dict(slug=t['slug'],title=t['title'],same_run=t['run_fingerprint']==record['run_fingerprint']) for t in trajectories if t['program']==slug]
        write(DATA/'programs'/f'{slug}.json',record);programs.append(record)
        print('Exported program',slug,flush=True)
    # Gallery indices stay small; details and arrays are loaded per page.
    write(DATA/'index.json',dict(trajectories=[{k:v for k,v in t.items() if k not in ('steps','history')}|dict(step_count=len(t['steps']),first_score=t['history']['points'][0]['best_score'],final_score=t['history']['points'][-1]['best_score']) for t in trajectories],programs=[{k:v for k,v in p.items() if k not in ('history','artifact')}|dict(preview=p['artifact']['views'][0]['image']) for p in programs]))
    write(ROOT/'static/programs/manifest.json',[{k:p[k] for k in ('task','source','source_sha256','program_id','score','reference','model','budget','seed','best_iteration')} for p in programs])
    (ROOT/'static/programs/README.txt').write_text('EvoDuet: 11 archived best programs\n\nThese are the complete, unchanged candidate sources listed in the paper.\nThey require the original benchmark environments, dependencies, and data.\nThe web visualizations use frozen scientific outputs or explicitly labeled replays.\nSee manifest.json for scores, run identifiers, and source SHA-256 hashes.\nThe Erdos program retrieves published witnesses at runtime.\n')
    with zipfile.ZipFile(ROOT/'static/programs/evoduet-best-programs.zip','w',zipfile.ZIP_DEFLATED) as z:
        for path in sorted((ROOT/'static/programs').iterdir()):
            if path.suffix!='.zip':z.write(path,path.name)

if __name__=='__main__':main()
