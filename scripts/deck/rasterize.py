"""
Rasterise a PDF deck into PNG slides, one folder per width.

    python scripts/deck/rasterize.py <deck.pdf> <out-dir> <width>[,<width>...]

Prints one JSON line describing what it wrote. Called by seal.mjs; the PNGs are
an intermediate and never leave the temporary folder they are written to.

MuPDF, because it draws Canva's exports exactly - the fonts, the gradients and
the embedded photographs - where pdf.js under Node does not.
Needs PyMuPDF: pip install pymupdf
"""
import json
import os
import sys

import pymupdf


def main() -> None:
    src, out = sys.argv[1], sys.argv[2]
    widths = [int(w) for w in sys.argv[3].split(",")]

    doc = pymupdf.open(src)
    sizes = []
    for w in widths:
        os.makedirs(os.path.join(out, str(w)), exist_ok=True)

    for i, page in enumerate(doc):
        rect = page.rect
        sizes.append([round(rect.width, 2), round(rect.height, 2)])
        for w in widths:
            zoom = w / rect.width
            pix = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), alpha=False)
            pix.save(os.path.join(out, str(w), f"{i + 1:02d}.png"))

    print(json.dumps({"pages": doc.page_count, "sizes": sizes, "widths": widths}))


if __name__ == "__main__":
    main()
