"""Cut Peanut out of the blue studio photo into a transparent sprite.

Usage:
    python3 tools/make_peanut_sprite.py path/to/photo.jpg [assets/peanut.png]

The photo has a flat blue backdrop (about #0053DD). Pixels are keyed by colour distance
from that blue, edge pixels are despilled so no blue fringe remains, and the result is
cropped and scaled to a 560px-tall PNG.
"""
import argparse
import sys

import numpy as np
from PIL import Image

BACKDROP = np.array([0.0, 83.0, 221.0])  # sampled from the photo's border
KEY_LO, KEY_HI = 35.0, 95.0              # colour-distance ramp: transparent below LO, opaque above HI
TARGET_HEIGHT = 560


def cut_out(rgb):
    dist = np.sqrt(((rgb - BACKDROP) ** 2).sum(axis=2))
    alpha = np.clip((dist - KEY_LO) / (KEY_HI - KEY_LO), 0.0, 1.0)

    # Despill: remove the backdrop colour that bleeds into partially transparent pixels.
    a = alpha[..., None]
    clean = np.clip((rgb - (1.0 - a) * BACKDROP) / np.maximum(a, 1e-3), 0, 255)
    out = np.where(a > 0.05, clean, rgb)

    # On the edge band, blue may only dominate where the key is partial, so cap it at mean(R, G).
    edge = (alpha > 0.02) & (alpha < 0.98)
    capped_b = np.minimum(out[..., 2], (out[..., 0] + out[..., 1]) / 2.0)
    out[..., 2] = np.where(edge, capped_b, out[..., 2])

    return np.dstack([out, alpha * 255]).astype(np.uint8)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("photo")
    parser.add_argument("out", nargs="?", default="assets/peanut.png")
    args = parser.parse_args()

    rgb = np.asarray(Image.open(args.photo).convert("RGB")).astype(np.float64)
    img = Image.fromarray(cut_out(rgb), "RGBA")

    bbox = img.getchannel("A").point(lambda v: 255 if v > 5 else 0).getbbox()
    if bbox is None:
        sys.exit("no subject found: the backdrop key removed everything")
    pad = 6
    bbox = (max(bbox[0] - pad, 0), max(bbox[1] - pad, 0),
            min(bbox[2] + pad, img.width), min(bbox[3] + pad, img.height))
    img = img.crop(bbox)

    scale = TARGET_HEIGHT / img.height
    img = img.resize((round(img.width * scale), TARGET_HEIGHT), Image.LANCZOS)
    img.save(args.out, optimize=True)
    print("saved", args.out, img.size)


if __name__ == "__main__":
    main()
