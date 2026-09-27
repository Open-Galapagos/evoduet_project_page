#!/usr/bin/env python3
"""Play the recorded Swap Reduction run on the overview figure and encode it as a GIF.

The unchanged static/figures/teaser.pdf is exported to SVG (one element per glyph, path and
image) and animated in headless Chromium by scripts/teaser_motion/teaser-motion.js; every
frame is a screenshot. The outer loop reaches a gate, the inner loop types and searches its
queries, reads and highlights the kept document, and the outer loop writes and evaluates the
kept child. The loop opens and closes on the published figure: the first and last frames are
checked against a render of the untouched SVG. Timing is illustrative, not experiment time.

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
MOTION = ROOT / "scripts/teaser_motion"
SOURCE = "static/figures/teaser.pdf"
SOURCE_SHA256 = "f9445268af976b083d8d3b828d339b419435f9ebe2643620350f70f9f23982ee"
OUTPUT = "static/images/teaser-motion.gif"
FONTS = [("400", "normal", "figtree-latin-400-normal.woff2"),
         ("400", "italic", "figtree-latin-400-italic.woff2"),
         ("500", "normal", "figtree-latin-500-normal.woff2")]
# Colors the story adds or that occupy few pixels (carets, the search sweep, small accents).
ACCENTS = ["#1a1a1a", "#e6edf3", "#6b6b6b", "#4f86cf", "#3f78c0", "#7a5fc4", "#d9a95a", "#ffef8a",
           "#03a874", "#1d3b28", "#3d1d20", "#7ee787", "#ff7b72", "#ffffff"]


def page_html(svg, width, height, animate):
    fonts = ",".join(
        f"new FontFace('Figtree', 'url(data:font/woff2;base64,"
        f"{base64.b64encode((MOTION / 'fonts' / name).read_bytes()).decode()})', "
        f"{{weight: '{weight}', style: '{style}'}})" for weight, style, name in FONTS)
    script = (MOTION / "teaser-motion.js").read_text() if animate else "window.teaserMotion = {ready: true};"
    return f"""<!doctype html><html><head><meta charset="utf-8">
<style>html,body{{margin:0;background:#fff}}#figure{{width:{width}px;height:{height}px;overflow:hidden}}</style>
</head><body><div id="figure">{svg}</div><script>
Promise.all([{fonts}].map(face => face.load())).then(faces => {{
  faces.forEach(face => document.fonts.add(face));
  const script = document.createElement('script');
  script.textContent = {json.dumps(script)};
  document.body.appendChild(script);
}});
</script></body></html>"""


def build(args):
    source = (ROOT / SOURCE).read_bytes()
    if hashlib.sha256(source).hexdigest() != SOURCE_SHA256:
        raise ValueError("teaser.pdf changed; review the scene indices in teaser-motion.js first.")
    with pymupdf.open(stream=source, filetype="pdf") as document:
        page = document[0]
        width, height = page.rect.width, page.rect.height
        svg = page.get_svg_image(text_as_path=True)
        text_colors = {span["color"] for block in page.get_text("dict")["blocks"] if "lines" in block
                       for line in block["lines"] for span in line["spans"]}
    # Chromium snaps screenshot clips to whole CSS pixels; the extra sliver is white page.
    scale = args.width / width
    clip = {"x": 0, "y": 0, "width": round(width), "height": round(height + 0.5)}
    errors = []

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path=args.chromium)

        def open_page(animate):
            page = browser.new_page(viewport={"width": clip["width"], "height": clip["height"]},
                                    device_scale_factor=scale)
            page.on("pageerror", lambda error: errors.append(str(error)))
            page.set_content(page_html(svg, width, height, animate))
            page.wait_for_function("window.teaserMotion && window.teaserMotion.ready || false", timeout=60000)
            if errors:
                raise RuntimeError("; ".join(errors))
            return page

        def shot(page):
            return Image.open(io.BytesIO(page.screenshot(clip=clip, type="png"))).convert("RGB")

        reference = np.asarray(shot(open_page(False)), dtype=np.int16)
        page = open_page(True)
        duration = page.evaluate("teaserMotion.duration")
        hold = page.evaluate("teaserMotion.hold")

        def frame(time):
            page.evaluate("t => teaserMotion.setTime(t)", time)
            return shot(page)

        # The loop must open and close on the published figure (allowing antialiasing noise).
        for time in (0, duration - hold / 2):
            changed = int((np.abs(np.asarray(frame(time), dtype=np.int16) - reference).max(axis=2) > 8).sum())
            if changed > 40:
                raise AssertionError(f"frame at {time:.2f}s differs from the figure in {changed} pixels")

        if args.previews:
            args.previews.mkdir(parents=True, exist_ok=True)
            for time in page.evaluate("teaserMotion.keyTimes") + list(args.at or []):
                frame(time).save(args.previews / f"teaser-{time:05.2f}.png")
            print("\n".join(f"{t:6.2f}s  {name}" for t, name in page.evaluate("teaserMotion.beats")))
        if args.skip_gif:
            print(f"duration {duration:.2f}s; previews only")
            return None

        # One palette for the whole loop: the finished figure plus mid-story frames, and the
        # small accents (text colors, carets, the search sweep) that area-based
        # quantization could drop. One entry stays free for the encoder's transparency.
        samples = [frame(duration - 0.05)] + [frame(duration * f) for f in (0.2, 0.33, 0.47, 0.6, 0.75)]
        mosaic = Image.new("RGB", (samples[0].width, samples[0].height * len(samples)))
        for k, image in enumerate(samples):
            mosaic.paste(image, (0, k * image.height))
        accents = {(color >> 16, (color >> 8) & 255, color & 255) for color in text_colors}
        accents.update(tuple(int(color[i:i + 2], 16) for i in (1, 3, 5)) for color in ACCENTS)
        adaptive = min(240, 255 - len(accents))
        palette = mosaic.quantize(colors=adaptive, method=Image.Quantize.MEDIANCUT)
        colors = palette.getpalette()[:adaptive * 3]
        for color in sorted(accents):
            colors.extend(color)
        colors += [0] * (768 - len(colors))
        palette.putpalette(colors)

        count = round(duration * 1000 / args.frame_ms)
        frames, durations, previous = [], [], None
        for k in range(count):
            image = frame(k * args.frame_ms / 1000).quantize(palette=palette, dither=Image.Dither.NONE)
            data = image.tobytes()
            if data == previous:
                durations[-1] += args.frame_ms
            else:
                frames.append(image)
                durations.append(args.frame_ms)
                previous = data
            if k % 100 == 0:
                print(f"teaser: frame {k + 1}/{count}", flush=True)
        browser.close()

    output = ROOT / OUTPUT
    frames[0].save(output, save_all=True, append_images=frames[1:], duration=durations,
                   loop=0, disposal=1, optimize=True)
    with Image.open(output) as gif:
        total = 0
        for k in range(gif.n_frames):
            gif.seek(k)
            total += gif.info["duration"]
        assert gif.n_frames > 1 and total == count * args.frame_ms, (gif.n_frames, total)
        record = {"note": "The recorded Swap Reduction run, played step by step on the unchanged figure; "
                          "added text is recorded run data. Timing is illustrative.",
                  "source": SOURCE, "source_sha256": SOURCE_SHA256, "gif": OUTPUT,
                  "builder": "scripts/build_teaser_motion.py", "width": gif.width, "height": gif.height,
                  "frames": gif.n_frames, "duration_ms": total, "bytes": output.stat().st_size,
                  "loop": gif.info["loop"]}
    print(json.dumps(record), flush=True)
    return record


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--width", type=int, default=1800)
    parser.add_argument("--frame-ms", type=int, default=50)
    parser.add_argument("--chromium", default=os.environ.get("TEASER_CHROMIUM"),
                        help="Chromium or chrome-headless-shell executable (default: Playwright's own)")
    parser.add_argument("--previews", type=Path, help="also export one PNG per story beat here")
    parser.add_argument("--at", type=float, nargs="*", help="extra preview times in seconds")
    parser.add_argument("--skip-gif", action="store_true", help="export previews only")
    args = parser.parse_args()
    if args.frame_ms < 20 or args.frame_ms % 10:
        parser.error("GIF frame durations must be multiples of 10 ms, at least 20 ms.")
    record = build(args)
    if record:
        path = ROOT / "static/data/figure-motion.json"
        data = json.loads(path.read_text())
        data["figures"]["teaser"] = record
        path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")


if __name__ == "__main__":
    main()
