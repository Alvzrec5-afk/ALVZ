"""Logo « ALVZ .STUDIO » dans le style pochoir du logo ALVZ.REC (ALVZ repris de l'original, STUDIO redessiné)."""
from PIL import Image, ImageDraw
import sys

ROOT = sys.argv[1]
OUT = sys.argv[2]
K = 4                      # dessin 4x plus grand, puis réduit (bords lisses)
H = 238 * K                # hauteur des lettres de la 2e ligne d'origine (.REC)
S = 54 * K                 # épaisseur d'un trait
G = 14 * K                 # entaille du pochoir
GAP = 30 * K               # espace entre lettres

def glyph(draw_fn, w):
    im = Image.new("L", (w, H), 0)
    draw_fn(ImageDraw.Draw(im), im, w)
    return im

def pill(d, x0, y0, x1, y1):
    d.rounded_rectangle((x0, y0, x1, y1), radius=min(x1 - x0, y1 - y0) // 2, fill=255)

BAR = 50 * K               # hauteur d'une barre (comme le E)
def S_(d, im, w):
    mid = (H - BAR) // 2
    pill(d, 0, 0, w, BAR)                     # haut
    pill(d, 0, mid, w, mid + BAR)             # milieu
    pill(d, 0, H - BAR, w, H)                 # bas
    d.rectangle((0, BAR // 2, S, mid + BAR // 2), fill=255)          # montant gauche (haut)
    d.rectangle((w - S, mid + BAR // 2, w, H - BAR // 2), fill=255)  # montant droit (bas)
    # entailles du pochoir entre barres et montants
    d.rectangle((S, BAR, S + G, mid), fill=0)
    d.rectangle((w - S - G, mid + BAR, w - S, H - BAR), fill=0)
    d.rectangle((0, BAR, S, BAR + G), fill=0)
    d.rectangle((w - S, mid + BAR, w, mid + BAR + G), fill=0)

def T_(d, im, w):
    pill(d, 0, 0, w, BAR)
    c = w // 2
    d.rectangle((c - S // 2, BAR + G, c + S // 2, H), fill=255)

def U_(d, im, w):
    # Deux montants + un fond en demi-anneau, séparés par l'entaille du pochoir.
    r = w // 2
    ring = Image.new("L", (w, w), 0)
    rd = ImageDraw.Draw(ring)
    rd.ellipse((0, 0, w - 1, w - 1), fill=255)
    rd.ellipse((S, S, w - 1 - S, w - 1 - S), fill=0)
    rd.rectangle((0, 0, w, r), fill=0)                     # on ne garde que le bas
    im.paste(255, (0, H - w), ring)
    d.rectangle((0, 0, S, H - r - G), fill=255)
    d.rectangle((w - S, 0, w, H - r - G), fill=255)

def D_(d, im, w):
    d.rectangle((0, 0, S, H), fill=255)                      # montant (comme le R)
    x = S + G
    bw = w - x
    d.rounded_rectangle((x, 0, w, H), radius=bw, fill=255)   # panse
    d.rounded_rectangle((x + 0, S, w - S, H - S), radius=max(1, bw - S), fill=0)
    d.rectangle((x, S, x + S // 3, H - S), fill=0)

def I_(d, im, w):
    d.rectangle((0, 0, w, H), fill=255)

def O_(d, im, w):
    d.ellipse((0, 0, w, H), fill=255)
    t = int(S * 1.05)
    d.ellipse((t, t, w - t, H - t), fill=0)
    c = w // 2
    d.rectangle((c - G // 2, 0, c + G // 2, t), fill=0)      # entailles haut et bas
    d.rectangle((c - G // 2, H - t, c + G // 2, H), fill=0)

letters = [(S_, 131 * K), (T_, 150 * K), (U_, 180 * K), (D_, 165 * K), (I_, S), (O_, H)]
DOT = 66 * K
width = DOT + 32 * K + sum(w for _, w in letters) + GAP * (len(letters) - 1)
row = Image.new("L", (width, H), 0)
d = ImageDraw.Draw(row)
x = DOT + 32 * K
for fn, w in letters:
    row.paste(255, (x, 0), glyph(fn, w))
    x += w + GAP

src = Image.open(f"{ROOT}/public/brand/logo-dark.png").convert("RGBA")
top = src.crop((6, 6, 794, 248))                   # « ALVZ » d'origine
alpha_top = top.getchannel("A")
W = top.width
scale = W / (width / K)
row_small = row.resize((W, max(1, round(H / K * scale))), Image.LANCZOS)
dot_d = round(66 * scale)
GAPY = 40
total_h = top.height + GAPY + row_small.height

def build(letter_rgb):
    out = Image.new("RGBA", (W, total_h), (0, 0, 0, 0))
    col = Image.new("RGBA", (W, top.height), letter_rgb + (255,))
    out.paste(col, (0, 0), alpha_top)
    col2 = Image.new("RGBA", row_small.size, letter_rgb + (255,))
    out.paste(col2, (0, top.height + GAPY), row_small)
    dot = Image.new("L", (dot_d * K, dot_d * K), 0)
    ImageDraw.Draw(dot).ellipse((0, 0, dot_d * K - 1, dot_d * K - 1), fill=255)
    dot = dot.resize((dot_d, dot_d), Image.LANCZOS)
    red = Image.new("RGBA", (dot_d, dot_d), (235, 60, 60, 255))
    out.paste(red, (0, total_h - dot_d), dot)
    return out

white = build((255, 255, 255))
dark = build((22, 21, 20))
white.save(f"{OUT}/studio-logo-white.png")
dark.save(f"{OUT}/studio-logo-dark.png")

def icon(size, pad):
    bg = Image.new("RGBA", (size, size), (14, 14, 13, 255))
    inner = size - 2 * pad
    lw = inner
    lh = round(white.height * lw / white.width)
    logo = white.resize((lw, lh), Image.LANCZOS)
    bg.alpha_composite(logo, (pad, (size - lh) // 2))
    return bg

icon(512, 84).save(f"{OUT}/studio-icon.png")
icon(180, 30).convert("RGB").save(f"{OUT}/studio-apple-icon.png")
icon(1024, 168).save(f"{OUT}/desktop-icon.png")
preview = Image.new("RGBA", (W + 80, total_h * 2 + 160), (255, 255, 255, 255))
preview.paste(Image.new("RGBA", (W + 80, total_h + 80), (14, 14, 13, 255)), (0, 0))
preview.alpha_composite(white, (40, 40))
preview.alpha_composite(dark, (40, total_h + 120))
preview.convert("RGB").save(f"{OUT}/preview.png")
print("ok", white.size)
