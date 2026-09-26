"""Cache source favicons locally. Optional refresh: Python 3 + Pillow."""
import concurrent.futures
import hashlib
import html
import io
import json
from pathlib import Path
from urllib.request import Request, urlopen
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'static/images/favicons'
OUT.mkdir(parents=True, exist_ok=True)
domains = sorted({d['domain'] for p in (ROOT / 'static/data/research/trajectories').glob('*.json')
                  for s in json.loads(p.read_text())['steps'] for d in s.get('evidence', {}).get('documents', [])})


def cache(domain):
    filename = hashlib.sha256(domain.encode()).hexdigest()[:16]
    for url in [f'https://www.google.com/s2/favicons?domain={domain}&sz=64',
                f'https://icons.duckduckgo.com/ip3/{domain}.ico']:
        try:
            with urlopen(Request(url, headers={'User-Agent': 'Mozilla/5.0'}), timeout=12) as response:
                payload = response.read(250000)
            icon = Image.open(io.BytesIO(payload)).convert('RGBA')
            icon.thumbnail((48, 48))
            icon.save(OUT / f'{filename}.png', optimize=True)
            return domain, dict(path=f'static/images/favicons/{filename}.png', source=url, fallback=False)
        except Exception:
            continue
    letter = domain.removeprefix('www.')[0].upper()
    (OUT / f'{filename}.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#edf2f8"/><text x="16" y="22" text-anchor="middle" font-family="Avenir,Avenir Next,sans-serif" font-size="20" fill="#536c91">{html.escape(letter)}</text></svg>')
    return domain, dict(path=f'static/images/favicons/{filename}.svg', source=None, fallback=True)


with concurrent.futures.ThreadPoolExecutor(max_workers=10) as pool:
    manifest = dict(pool.map(cache, domains))
(OUT / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(f"Cached {len(manifest)} domains; {sum(v['fallback'] for v in manifest.values())} letter fallbacks.")
