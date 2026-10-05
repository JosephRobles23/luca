#!/usr/bin/env python3
"""Genera favicon, iconos y la imagen para redes sociales a partir de los logos de public/.

Uso (desde la raíz del repo): python3 apps/web/scripts/brand-assets.py
Requiere Pillow. Descarga Geist de jsDelivr (fontsource); sin red usa DejaVu.
Fuentes: public/Luca-favicon.png (isotipo) y public/luca-logo.webp (isotipo + wordmark).
"""
import os
import tempfile
import urllib.request

from PIL import Image, ImageDraw, ImageFont

WEB = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
PUBLIC = os.path.join(WEB, "public")
APP = os.path.join(WEB, "src", "app")

BG = (244, 239, 232, 255)      # --bg tema claro (#f4efe8)
TEXT = (29, 26, 23, 255)       # --text (#1d1a17)
MUTED = (122, 114, 104, 255)   # --muted (#7a7268)
ACCENT = (217, 98, 59, 255)    # --accent (#d9623b)


def font(weight, size):
    path = os.path.join(tempfile.gettempdir(), f"geist-{weight}.ttf")
    if not os.path.exists(path):
        url = f"https://cdn.jsdelivr.net/fontsource/fonts/geist-sans@latest/latin-{weight}-normal.ttf"
        try:
            urllib.request.urlretrieve(url, path)
        except OSError:
            bold = "-Bold" if weight >= 700 else ""
            return ImageFont.truetype(f"/usr/share/fonts/truetype/dejavu/DejaVuSans{bold}.ttf", size)
    return ImageFont.truetype(path, size)


def trimmed(path):
    im = Image.open(path).convert("RGBA")
    return im.crop(im.getbbox())


def fit(im, box):
    """Escala im para que quepa en un cuadrado box×box, centrado sobre transparente."""
    im = im.copy()
    im.thumbnail((box, box), Image.LANCZOS)
    out = Image.new("RGBA", (box, box), (0, 0, 0, 0))
    out.alpha_composite(im, ((box - im.width) // 2, (box - im.height) // 2))
    return out


def tile(mark, size, pad, radius):
    """Isotipo sobre cuadrado crema: el isotipo es negro y se perdería en pestañas de tema oscuro."""
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(out).rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=BG)
    inner = round(size * (1 - 2 * pad))
    out.alpha_composite(fit(mark, inner), ((size - inner) // 2, (size - inner) // 2))
    return out


def og_image(logo):
    W, H = 1200, 630
    im = Image.new("RGBA", (W, H), BG)
    d = ImageDraw.Draw(im)
    im.alpha_composite(fit(logo, 400), (90, (H - 400) // 2))

    x = 560
    h1 = font(800, 60)
    d.text((x, 168), "Tus gastos de", font=h1, fill=TEXT)
    d.text((x, 238), "BCP y Yape,", font=h1, fill=TEXT)
    d.text((x, 308), "ordenados.", font=h1, fill=TEXT)
    sub = font(400, 30)
    d.text((x, 404), "En ", font=sub, fill=MUTED)
    w_en = d.textlength("En ", font=sub)
    d.text((x + w_en, 404), "tu", font=font(800, 30), fill=ACCENT)
    w_tu = d.textlength("tu", font=font(800, 30))
    d.text((x + w_en + w_tu, 404), " Google. Gratis y sin base de datos.", font=sub, fill=MUTED)
    d.text((x, 470), "lucaa.lat", font=font(800, 28), fill=ACCENT)
    return im.convert("RGB")


def main():
    mark = trimmed(os.path.join(PUBLIC, "Luca-favicon.png"))
    logo = trimmed(os.path.join(PUBLIC, "luca-logo.webp"))

    tile(mark, 256, 0.12, 56).save(os.path.join(APP, "favicon.ico"), sizes=[(16, 16), (32, 32), (48, 48)])
    tile(mark, 512, 0.12, 112).save(os.path.join(APP, "icon.png"), optimize=True)
    # iOS redondea solo las esquinas y no admite transparencia: cuadrado lleno.
    tile(mark, 180, 0.14, 0).save(os.path.join(APP, "apple-icon.png"), optimize=True)
    for s in (192, 512):
        tile(mark, s, 0.12, round(s * 0.22)).save(os.path.join(PUBLIC, f"icon-{s}.png"), optimize=True)
    # Maskable: Android recorta a círculo/squircle; el contenido va dentro de la zona segura (80 %).
    tile(mark, 512, 0.22, 0).save(os.path.join(PUBLIC, "icon-maskable-512.png"), optimize=True)

    # X/Twitter usa og:image cuando no hay twitter:image, así que basta una sola imagen.
    og_image(logo).save(os.path.join(APP, "opengraph-image.png"), optimize=True)


if __name__ == "__main__":
    main()
