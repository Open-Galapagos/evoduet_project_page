#!/usr/bin/env python3
"""Play the recorded Swap Reduction run on the overview and Method figures and encode GIFs.

Each unchanged figure PDF is exported to SVG (one element per glyph, path and image) and
animated in headless Chromium by scripts/figure_motion/engine.js plus the figure's scene
script; every frame is a screenshot. The overview follows the outer loop through iterations
5, 64 and 66: gates, inner-loop searches, kept documents, and the code of each kept child.
The Method figure runs one outer iteration (t = 5) through its components while the zoom-in
insets fill in. Each loop opens and closes on the published figure: the first and last
frames are checked against a render of the untouched SVG. Timing is illustrative.

Requires PyMuPDF, Pillow, NumPy and Playwright for Python with a Chromium build
(`playwright install chromium`, or pass --chromium).
"""

import argparse
import base64
import hashlib
import io
import json
import os
from pathlib import Path

import numpy as np
import pymupdf
from PIL import Image
from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
MOTION = ROOT / "scripts/figure_motion"
# Faces for text the stories add, matching each figure: Figtree (overview) and the unmodified
# Liberation Sans Regular and Italic the Method figure is set in (SIL OFL 1.1, licenses alongside).
FONTS = [("Figtree", "400", "normal", "figtree-latin-400-normal.woff2", "font/woff2"),
         ("Figtree", "400", "italic", "figtree-latin-400-italic.woff2", "font/woff2"),
         ("Figtree", "500", "normal", "figtree-latin-500-normal.woff2", "font/woff2"),
         ("Liberation Sans", "400", "normal", "LiberationSans-Regular.ttf", "font/ttf"),
         ("Liberation Sans", "400", "italic", "LiberationSans-Italic.ttf", "font/ttf")]
# Accents: colors the story adds or that occupy few pixels (carets, the search sweep, chips,
# traffic lights), which area-based quantization could otherwise drop.
FIGURES = {
    "teaser": {
        "source": "static/figures/teaser.pdf",
        "sha256": "f9445268af976b083d8d3b828d339b419435f9ebe2643620350f70f9f23982ee",
        "scenes": "teaser.js",
        "gif": "static/images/teaser-motion.gif",
        "accents": ["#1a1a1a", "#e6edf3", "#6b6b6b", "#4f86cf", "#3f78c0", "#7a5fc4", "#d9a95a", "#ffef8a",
                    "#03a874", "#1d3b28", "#3d1d20", "#7ee787", "#ff7b72", "#ffffff"],
        "note": "The recorded Swap Reduction run, played step by step on the unchanged figure; "
                "added text is recorded run data. Timing is illustrative.",
    },
    "method": {
        "source": "static/figures/method.pdf",
        "sha256": "c0c7fb540fe7b416c97f594b875a746ca5b0f421ac345292eb5a6e993c238b10",
        "scenes": "method.js",
        "data": "method-rounds.json",
        "gif": "static/images/method-motion.gif",
        "accents": ["#f7c887", "#b8720f", "#e8b92e", "#1db36b", "#8c8c8c", "#d0bfff", "#79c0ff", "#9da7b3",
                    "#7ee787", "#ff5f57", "#febc2e", "#28c840", "#64727f", "#03a874", "#4f86cf", "#7a5fc4",
                    "#3f78c0", "#d9a95a", "#9c87d6", "#6e98cf", "#161b22", "#1d3b28", "#e6edf3", "#ffffff"],
        "note": "Iteration 5 of the recorded Swap Reduction run, played through the unchanged figure; "
                "added text is recorded run data (method-rounds.json): the round 1 and 2 knowledge "
                "states, query intents and queries, and the local database's counts and scores. "
                "Timing is illustrative.",
    },
}


class Palette:
    """Map frames onto one shared palette, each color to its exactly nearest entry.

    Pillow's conversion to a given palette looks colors up through a coarse cache, which
    turned the white background into (252, 252, 252) against the page's pure white. Here a
    lookup table over all 24-bit colors is filled as new colors appear, frame by frame.
    """

    def __init__(self, colors):
        self.colors = np.array(colors, dtype=np.int32)
        self.flat = [value for color in colors for value in color] + [0] * (768 - 3 * len(colors))
        self.lookup = np.full(1 << 24, -1, dtype=np.int16)

    def image(self, frame):
        rgb = np.asarray(frame, dtype=np.int32)
        key = (rgb[..., 0] << 16) | (rgb[..., 1] << 8) | rgb[..., 2]
        new = np.unique(key[self.lookup[key] < 0])
        for part in np.array_split(new, len(new) // 20000 + 1):
            channels = np.stack([(part >> 16) & 255, (part >> 8) & 255, part & 255], axis=1)
            distance = ((channels[:, None, :] - self.colors[None, :, :]) ** 2).sum(axis=2)
            self.lookup[part] = distance.argmin(axis=1)
        image = Image.fromarray(self.lookup[key].astype(np.uint8), "P")
        image.putpalette(self.flat)
        return image


def page_html(svg, width, height, script):
    fonts = ",".join(
        f"new FontFace('{family}', 'url(data:{mime};base64,"
        f"{base64.b64encode((MOTION / 'fonts' / name).read_bytes()).decode()})', "
        f"{{weight: '{weight}', style: '{style}'}})" for family, weight, style, name, mime in FONTS)
    return f"""<!doctype html><html><head><meta charset="utf-8">
<style>html,body{{margin:0;background:#fff}}#figure{{width:{width}px;height:{height}px;overflow:hidden}}</style>
</head><body><div id="figure">{svg}</div><script>
const errors = [];  // a failing story reports at once instead of timing out
window.addEventListener('error', event => errors.push(String(event.message)));
Promise.all([{fonts}].map(face => face.load())).then(faces => {{
  faces.forEach(face => document.fonts.add(face));
  const script = document.createElement('script');
  script.textContent = {json.dumps(script)};
  document.body.appendChild(script);
}});
</script></body></html>"""


def build(name, args):
    figure = FIGURES[name]
    source = (ROOT / figure["source"]).read_bytes()
    if hashlib.sha256(source).hexdigest() != figure["sha256"]:
        raise ValueError(f"{figure['source']} changed; review the scene indices in {figure['scenes']} first.")
    with pymupdf.open(stream=source, filetype="pdf") as document:
        page = document[0]
        width, height = page.rect.width, page.rect.height
        svg = page.get_svg_image(text_as_path=True)
        text_colors = {span["color"] for block in page.get_text("dict")["blocks"] if "lines" in block
                       for line in block["lines"] for span in line["spans"]}
    # Recorded data the scenes add, if any, goes between the engine and the scenes.
    data = (f"const FIGURE_DATA = {(MOTION / figure['data']).read_text()};\n" if figure.get("data") else "")
    story = (MOTION / "engine.js").read_text() + data + (MOTION / figure["scenes"]).read_text()
    # Chromium snaps screenshot clips to whole CSS pixels; the extra sliver is white page.
    scale = args.width / width
    clip = {"x": 0, "y": 0, "width": round(width), "height": round(height + 0.5)}
    errors = []

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path=args.chromium)

        def open_page(script):
            page = browser.new_page(viewport={"width": clip["width"], "height": clip["height"]},
                                    device_scale_factor=scale)
            page.on("pageerror", lambda error: errors.append(str(error)))
            page.set_content(page_html(svg, width, height, script))
            page.wait_for_function("(window.figureMotion && window.figureMotion.ready) || errors.length",
                                   timeout=60000)
            if errors:
                raise RuntimeError("; ".join(errors))
            return page

        def shot(page):
            return Image.open(io.BytesIO(page.screenshot(clip=clip, type="png"))).convert("RGB")

        reference = np.asarray(shot(open_page("window.figureMotion = {ready: true};")), dtype=np.int16)
        page = open_page(story)
        duration = page.evaluate("figureMotion.duration")
        hold = page.evaluate("figureMotion.hold")

        def frame(time):
            page.evaluate("t => figureMotion.setTime(t)", time)
            return shot(page)

        # The loop must open and close on the published figure. Soft shadows and antialiased
        # edges may shift by a few levels; a missing or moved element changes far more.
        for time in (0, duration - hold / 2):
            changed = int((np.abs(np.asarray(frame(time), dtype=np.int16) - reference).max(axis=2) > 64).sum())
            if changed > 40:
                raise AssertionError(f"{name}: frame at {time:.2f}s differs from the figure in {changed} pixels")

        if args.previews:
            args.previews.mkdir(parents=True, exist_ok=True)
            for time in page.evaluate("figureMotion.keyTimes") + list(args.at or []):
                frame(time).save(args.previews / f"{name}-{time:05.2f}.png")
            print("\n".join(f"{t:6.2f}s  {beat}" for t, beat in page.evaluate("figureMotion.beats")))
        if args.skip_gif:
            print(f"{name}: duration {duration:.2f}s; previews only")
            return None

        # One palette for the whole loop: the finished figure plus mid-story frames, and the
        # accents. One entry stays free for the encoder's transparency.
        samples = [frame(duration - 0.05)] + [frame(duration * f) for f in (0.2, 0.33, 0.47, 0.6, 0.75)]
        mosaic = Image.new("RGB", (samples[0].width, samples[0].height * len(samples)))
        for k, image in enumerate(samples):
            mosaic.paste(image, (0, k * image.height))
        accents = {(color >> 16, (color >> 8) & 255, color & 255) for color in text_colors}
        accents.update(tuple(int(color[i:i + 2], 16) for i in (1, 3, 5)) for color in figure["accents"])
        adaptive = min(240, 255 - len(accents))
        quantized = mosaic.quantize(colors=adaptive, method=Image.Quantize.MEDIANCUT).getpalette()[:adaptive * 3]
        colors = list(dict.fromkeys([tuple(quantized[i:i + 3]) for i in range(0, len(quantized), 3)] + sorted(accents)))
        palette = Palette(colors[:255])

        count = round(duration * 1000 / args.frame_ms)
        frames, durations, previous = [], [], None
        for k in range(count):
            image = palette.image(frame(k * args.frame_ms / 1000))
            data = image.tobytes()
            if data == previous:
                durations[-1] += args.frame_ms
            else:
                frames.append(image)
                durations.append(args.frame_ms)
                previous = data
            if k % 100 == 0:
                print(f"{name}: frame {k + 1}/{count}", flush=True)
        browser.close()

    output = ROOT / figure["gif"]
    frames[0].save(output, save_all=True, append_images=frames[1:], duration=durations,
                   loop=0, disposal=1, optimize=True)
    with Image.open(output) as gif:
        total = 0
        for k in range(gif.n_frames):
            gif.seek(k)
            total += gif.info["duration"]
        assert gif.n_frames > 1 and total == count * args.frame_ms, (gif.n_frames, total)
        record = {"note": figure["note"], "source": figure["source"], "source_sha256": figure["sha256"],
                  "gif": figure["gif"], "builder": "scripts/build_figure_motion.py", "width": gif.width,
                  "height": gif.height, "frames": gif.n_frames, "duration_ms": total,
                  "bytes": output.stat().st_size, "loop": gif.info["loop"]}
    print(json.dumps(record), flush=True)
    return record


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("figures", nargs="*", help=f"figures to build: {', '.join(FIGURES)} (default: all)")
    parser.add_argument("--width", type=int, default=1800)
    parser.add_argument("--frame-ms", type=int, default=50)
    parser.add_argument("--chromium", default=os.environ.get("FIGURE_CHROMIUM"),
                        help="Chromium or chrome-headless-shell executable (default: Playwright's own)")
    parser.add_argument("--previews", type=Path, help="also export one PNG per story beat here")
    parser.add_argument("--at", type=float, nargs="*", help="extra preview times in seconds")
    parser.add_argument("--skip-gif", action="store_true", help="export previews only")
    args = parser.parse_args()
    if args.frame_ms < 20 or args.frame_ms % 10:
        parser.error("GIF frame durations must be multiples of 10 ms, at least 20 ms.")
    if unknown := set(args.figures) - set(FIGURES):
        parser.error(f"unknown figure: {', '.join(sorted(unknown))}")
    path = ROOT / "static/data/figure-motion.json"
    for name in args.figures or list(FIGURES):
        record = build(name, args)
        if record:
            data = json.loads(path.read_text())
            data["figures"][name] = record
            path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")


if __name__ == "__main__":
    main()
