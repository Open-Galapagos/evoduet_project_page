#!/usr/bin/env python3
"""Render slow vector highlights over the unchanged paper PDFs, then encode GIFs.

Requires PyMuPDF and Pillow. No inferred scores, text replacements, or generated
artwork: the dots follow arrows already present in the source figures. The
timing is illustrative, not elapsed experiment time. Coordinates use a 2048-wide
view of each PDF. Source hashes guard against applying paths to a revised figure.
"""

import argparse
import hashlib
import json
import math
from pathlib import Path

import pymupdf
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
BLUE = (0.204, 0.482, 0.784)
PURPLE = (0.49, 0.32, 0.74)
GOLD = (0.76, 0.49, 0.12)
WHITE = (1, 1, 1)
SOURCES = {
    "teaser": ("f9445268af976b083d8d3b828d339b419435f9ebe2643620350f70f9f23982ee", 20),
    "method": ("c0c7fb540fe7b416c97f594b875a746ca5b0f421ac345292eb5a6e993c238b10", 29),
}


def smooth(value):
    value = min(1, max(0, value))
    return value * value * (3 - 2 * value)


def envelope(time, start, end, fade=0.4):
    return smooth((time - start) / fade) * smooth((end - time) / fade)


def bezier(points, count=60):
    return [tuple(sum(
        math.comb(3, i) * (1 - t) ** (3 - i) * t ** i * points[i][axis]
        for i in range(4)
    ) for axis in (0, 1)) for t in (i / count for i in range(count + 1))]


class Painter:
    def __init__(self, page, name):
        self.page = page
        self.scale = page.rect.width / 2048
        # Some original badges overlap their panel edges. Keep highlights behind
        # those badges by leaving the corresponding border segments untouched.
        self.badges = ([(730, 820, 1195, 888), (1530, 820, 1997, 888),
                        (1750, 424, 1986, 482)] if name == "teaser" else
                       [(x - 34, y - 34, x + 34, y + 34) for x, y in
                        [(481, 356), (962, 356), (1144, 356), (1505, 356), (1985, 356),
                         (481, 618), (962, 618), (1144, 618), (1505, 618), (1985, 618)]])

    def point(self, point):
        return pymupdf.Point(point[0] * self.scale, point[1] * self.scale)

    def box(self, box, color, opacity, radius=16):
        if opacity < 0.01:
            return
        x0, y0, x1, y1 = box
        radius = min(radius, (x1 - x0) / 2, (y1 - y0) / 2)
        outline = []
        for cx, cy, angle in [(x1 - radius, y0 + radius, -90),
                              (x1 - radius, y1 - radius, 0),
                              (x0 + radius, y1 - radius, 90),
                              (x0 + radius, y0 + radius, 180)]:
            outline.extend((cx + radius * math.cos(math.radians(angle + i * 9)),
                            cy + radius * math.sin(math.radians(angle + i * 9)))
                           for i in range(11))
        outline.append(outline[0])
        samples = []
        for a, b in zip(outline, outline[1:]):
            count = max(1, math.ceil(math.dist(a, b) / 4))
            samples.extend(tuple(x + (y - x) * i / count for x, y in zip(a, b))
                           for i in range(count))
        samples.append(outline[-1])
        segments, segment = [], []
        for point in samples:
            hidden = any(a <= point[0] <= c and b <= point[1] <= d
                         for a, b, c, d in self.badges)
            if hidden:
                if len(segment) > 1:
                    segments.append(segment)
                segment = []
            else:
                segment.append(self.point(point))
        if len(segment) > 1:
            segments.append(segment)
        for width, alpha in ((13, 0.1), (4.5, 0.85)):
            for segment in segments:
                self.page.draw_polyline(segment, color=color, lineCap=1, lineJoin=1,
                                        width=width * self.scale, stroke_opacity=alpha * opacity)

    def halo(self, center, radius, color, opacity):
        if opacity < 0.01:
            return
        for extra, width, alpha in ((3, 14, 0.10), (0, 4, 0.85)):
            self.page.draw_circle(self.point(center), (radius + extra) * self.scale,
                                  color=color, width=width * self.scale,
                                  stroke_opacity=alpha * opacity)

    def travel(self, points, progress, color, blocked=()):
        """A short trail and a white-centered dot; never obscure arrow labels."""
        if not 0 < progress < 1:
            return
        distances = [0]
        for a, b in zip(points, points[1:]):
            distances.append(distances[-1] + math.dist(a, b))
        length = distances[-1]
        head = length * smooth(progress)

        def at(distance):
            for i in range(1, len(points)):
                if distance <= distances[i]:
                    t = (distance - distances[i - 1]) / (distances[i] - distances[i - 1])
                    return tuple(a + (b - a) * t for a, b in zip(points[i - 1], points[i]))
            return points[-1]

        def hidden(point):
            return any(x0 <= point[0] <= x1 and y0 <= point[1] <= y1
                       for x0, y0, x1, y1 in blocked)

        alpha = smooth(progress / 0.12) * smooth((1 - progress) / 0.12)
        tail = min(48, head)
        for i in range(12):
            a, b = at(head - tail + tail * i / 12), at(head - tail + tail * (i + 1) / 12)
            if not hidden(a) and not hidden(b):
                self.page.draw_line(self.point(a), self.point(b), color=color,
                                    width=5 * self.scale, lineCap=1,
                                    stroke_opacity=alpha * (0.15 + i / 16))
        center = at(head)
        if not hidden(center):
            self.page.draw_circle(self.point(center), 12 * self.scale,
                                  color=None, fill=color, fill_opacity=0.14 * alpha)
            self.page.draw_circle(self.point(center), 5.5 * self.scale,
                                  color=color, fill=WHITE, width=2.8 * self.scale,
                                  stroke_opacity=alpha, fill_opacity=alpha)


def teaser(painter, time):
    # Iterations 5, 64 and 66, and the final result already printed in the PDF.
    boxes = [
        ((131, 16, 936, 491), BLUE, 2.6, 5.8),
        ((512, 621, 1202, 847), PURPLE, 6.0, 8.5),
        ((960, 16, 1736, 491), BLUE, 10.7, 13.8),
        ((1218, 621, 2001, 847), PURPLE, 13.8, 16.0),
        ((1741, 249, 1997, 454), PURPLE, 15.9, 18.7),
    ]
    for box, color, start, end in boxes:
        painter.box(box, color, envelope(time, start, end))
    for center, radius, color, start, end in [
        ((368, 838), 30, BLUE, 2.0, 3.4),
        ((368, 717), 22, PURPLE, 5.6, 6.9),
        ((1298, 552), 27, GOLD, 8.9, 10.4),
        ((1375, 552), 30, BLUE, 10.1, 11.6),
        ((1421, 540), 22, PURPLE, 13.4, 14.8),
        ((1874, 525), 35, PURPLE, 15.8, 18.7),
    ]:
        painter.halo(center, radius, color, envelope(time, start, end))

    first_search = (
        bezier([(358, 821), (274, 790), (383, 771), (320, 730)]) +
        bezier([(320, 730), (251, 687), (346, 651), (328, 612)])[1:] +
        bezier([(328, 612), (309, 573), (276, 553), (293, 543)])[1:] +
        bezier([(293, 543), (329, 536), (292, 509), (281, 495)])[1:]
    )
    second_search = bezier([(1369, 526), (1328, 516), (1415, 522), (1344, 495)])
    paths = [
        (0.8, 2.3, PURPLE, [(147, 854), (187, 854), (193, 849), (236, 849),
                           (244, 846), (282, 846), (286, 838), (344, 838)]),
        (2.7, 4.3, BLUE, first_search),
        (4.0, 5.1, BLUE, [(385, 447), (451, 447), (518, 424)]),
        (5.1, 6.1, BLUE, [(418, 495), (413, 548), (399, 614), (377, 690)]),
        (6.2, 7.7, PURPLE, [(389, 717), (430, 717), (430, 609), (459, 609),
                           (461, 603), (480, 603), (481, 597), (530, 597),
                           (530, 562), (571, 562), (572, 552)]),
        (7.6, 9.3, PURPLE, [(573, 552), (1271, 552)]),
        (10.0, 10.9, PURPLE, [(1325, 552), (1345, 552)]),
        (10.9, 12.0, BLUE, second_search),
        (12.0, 13.1, BLUE, [(1215, 447), (1260, 447), (1327, 424)]),
        (13.1, 13.9, BLUE, [(1398, 496), (1395, 526)]),
        (14.1, 16.1, PURPLE, [(1443, 540), (1488, 540), (1488, 534),
                             (1550, 534), (1550, 531), (1598, 531),
                             (1598, 525), (1838, 525)]),
    ]
    for start, end, color, points in paths:
        painter.travel(points, (time - start) / (end - start), color)


NODES = {
    "query": ((772, 526, 968, 628), BLUE),
    "web": ((476, 526, 671, 628), BLUE),
    "evidence": ((476, 351, 671, 453), BLUE),
    "local": ((772, 351, 968, 453), BLUE),
    "gate": ((1138, 526, 1334, 628), GOLD),
    "search": ((1138, 351, 1334, 453), GOLD),
    "prompt": ((1499, 351, 1694, 453), PURPLE),
    "generation": ((1796, 351, 1991, 453), PURPLE),
    "evaluation": ((1796, 526, 1991, 628), PURPLE),
    "solutions": ((1499, 526, 1694, 628), PURPLE),
}
ROUTES = {
    ("solutions", "gate"): [(1495, 576), (1337, 576)],
    ("gate", "query"): [(1135, 576), (972, 576)],
    ("query", "web"): [(769, 576), (675, 576)],
    ("web", "evidence"): [(573, 522), (573, 456)],
    ("evidence", "local"): [(675, 402), (769, 402)],
    ("local", "query"): [(870, 456), (870, 522)],
    ("local", "search"): [(972, 402), (1134, 402)],
    ("search", "prompt"): [(1338, 402), (1495, 402)],
    ("prompt", "generation"): [(1698, 402), (1792, 402)],
    ("generation", "evaluation"): [(1893, 456), (1893, 522)],
    ("evaluation", "solutions"): [(1792, 576), (1698, 576)],
    ("gate", "search"): [(1236, 522), (1236, 456)],
    ("gate", "prompt"): [(1333, 529), (1495, 448)],
    ("solutions", "prompt"): [(1597, 522), (1597, 456)],
}
# Retrieve with two query rounds, followed by Look-Up and No-Op examples.
STEPS = [
    "solutions", "gate", "query", "web", "evidence", "local", "query",
    "web", "evidence", "local", "search", "prompt", "generation",
    "evaluation", "solutions", "gate", "search", "prompt", "generation",
    "evaluation", "solutions", "gate", "prompt", "generation", "evaluation",
    "solutions", "prompt",
]


def method(painter, time):
    for i, (source, target) in enumerate(zip(STEPS, STEPS[1:])):
        start, end = 0.8 + i, 1.8 + i
        active = envelope(time, start - 0.35, end + 0.45, 0.4)
        box, color = NODES[source]
        painter.box(box, color, active)
        target_box, target_color = NODES[target]
        painter.box(target_box, target_color, envelope(time, end - 0.3, end + 0.6))
        blocked = ()
        if (source, target) == ("gate", "query"):
            blocked = ((990, 558, 1116, 591),)
            painter.box((993, 561, 1112, 587), BLUE, active, radius=13)
            color = BLUE
        elif (source, target) == ("gate", "search"):
            blocked = ((1172, 476, 1301, 510),)
            painter.box((1177, 481, 1297, 506), GOLD, active, radius=12)
        elif (source, target) == ("gate", "prompt"):
            blocked = ((1357, 456, 1476, 527),)
            color = PURPLE
        elif source == "search":
            color = PURPLE
        painter.travel(ROUTES[source, target], (time - start) / (end - start), color, blocked)


def render(source, name, time, width):
    # Draw on the vector page before rasterization, preserving its text and art.
    with pymupdf.open(stream=source, filetype="pdf") as document:
        page = document[0]
        {"teaser": teaser, "method": method}[name](Painter(page, name), time)
        pixmap = page.get_pixmap(matrix=pymupdf.Matrix(width / page.rect.width,
                                                     width / page.rect.width), alpha=False)
        return Image.frombytes("RGB", (pixmap.width, pixmap.height), pixmap.samples)


def build(name, width, frame_ms, previews):
    digest, seconds = SOURCES[name]
    source = (ROOT / f"static/figures/{name}.pdf").read_bytes()
    if hashlib.sha256(source).hexdigest() != digest:
        raise ValueError(f"{name}.pdf changed; review motion coordinates before regenerating.")
    first = render(source, name, 0, width)
    if previews:
        previews.mkdir(parents=True, exist_ok=True)
        for time in ((0, 3.8, 6.8, 9.6, 12.5, 15.0, 17.0) if name == "teaser"
                     else (0, 2.1, 5.1, 10.1, 12.1, 16.1, 22.1)):
            render(source, name, time, width).save(previews / f"{name}-{time:g}.png")
    # One shared palette stabilizes the paper artwork across every frame. Reserve
    # an unused entry for the GIF encoder's transparent difference rectangles.
    # Explicitly retain small text accents (in particular red deletions and green
    # additions); area-based quantization alone can drop these infrequent colors.
    with pymupdf.open(stream=source, filetype="pdf") as document:
        text_colors = {span["color"] for block in document[0].get_text("dict")["blocks"]
                       if "lines" in block for line in block["lines"] for span in line["spans"]}
    accents = {(color >> 16, (color >> 8) & 255, color & 255) for color in text_colors}
    accents.update(tuple(round(c * 255) for c in color) for color in (BLUE, PURPLE, GOLD, WHITE))
    adaptive_count = min(240, 255 - len(accents))
    palette = first.quantize(colors=adaptive_count, method=Image.Quantize.MEDIANCUT)
    colors = palette.getpalette()[:adaptive_count * 3]
    for color in sorted(accents):
        colors.extend(color)
    colors += [0] * (768 - len(colors))
    palette.putpalette(colors)
    frames = []
    count = round(seconds * 1000 / frame_ms)
    for i in range(count):
        frame = first if i == 0 else render(source, name, i * frame_ms / 1000, width)
        frames.append(frame.quantize(palette=palette, dither=Image.Dither.NONE))
        if i % 50 == 0:
            print(f"{name}: frame {i + 1}/{count}", flush=True)
    output = ROOT / f"static/images/{name}-motion.gif"
    frames[0].save(output, save_all=True, append_images=frames[1:], duration=frame_ms,
                   loop=0, disposal=1, optimize=True)
    with Image.open(output) as gif:
        duration = 0
        for i in range(gif.n_frames):
            gif.seek(i)
            duration += gif.info["duration"]
        assert gif.size == first.size and gif.n_frames > 1 and duration == count * frame_ms
        result = {"source": f"static/figures/{name}.pdf", "source_sha256": digest,
                  "gif": f"static/images/{name}-motion.gif", "width": gif.width,
                  "height": gif.height, "frames": gif.n_frames, "duration_ms": duration,
                  "bytes": output.stat().st_size, "loop": gif.info["loop"]}
    print(json.dumps(result), flush=True)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--width", type=int, default=1800)
    parser.add_argument("--frame-ms", type=int, default=50)
    parser.add_argument("--previews", type=Path)
    args = parser.parse_args()
    if args.frame_ms < 20 or args.frame_ms % 10:
        parser.error("GIF frame durations must be multiples of 10 ms, at least 20 ms.")
    records = {name: build(name, args.width, args.frame_ms, args.previews) for name in SOURCES}
    (ROOT / "static/data/figure-motion.json").write_text(json.dumps({
        "note": "Illustrative flow highlights; original figure content and values are unchanged.",
        "figures": records,
    }, indent=2) + "\n")


if __name__ == "__main__":
    main()
