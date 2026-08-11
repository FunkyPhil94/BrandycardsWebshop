from __future__ import annotations

from pathlib import Path
from typing import Iterable

from reportlab.graphics import renderPDF
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing
from reportlab.lib import colors
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A5
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output" / "pdf"
PREVIEWS = ROOT / "output" / "previews"
LOGO_PATH = ROOT / "app" / "brand" / "brandycards-logo-original.png"
W, H = A5
URL = "https://shop.brandycards.de"
EMAIL = "brandycards@gmx.de"

# The source logo remains untouched. These are the transparent bounds measured from it.
LOGO_IMAGE_SIZE = (1264, 842)
LOGO_BBOX = (274, 96, 991, 670)
LOGO = ImageReader(str(LOGO_PATH))

NAVY = HexColor("#0F1427")
INK = HexColor("#1A1D25")
CREAM = HexColor("#F5F0E8")
PAPER = HexColor("#FCFAF6")
CORAL = HexColor("#F36D50")
PEACH = HexColor("#FDBD91")
GOLD = HexColor("#D6A64B")
MUTED = HexColor("#75716A")
LINE = HexColor("#D9D1C5")
WHITE = colors.white

FONT = "BCArial"
FONT_BOLD = "BCArial-Bold"
SERIF = "BCGeorgia"
SERIF_BOLD = "BCGeorgia-Bold"

for name, path in {
    FONT: r"C:\Windows\Fonts\arial.ttf",
    FONT_BOLD: r"C:\Windows\Fonts\arialbd.ttf",
    SERIF: r"C:\Windows\Fonts\georgia.ttf",
    SERIF_BOLD: r"C:\Windows\Fonts\georgiab.ttf",
}.items():
    pdfmetrics.registerFont(TTFont(name, path))


def mm(value: float) -> float:
    return value * 72 / 25.4


def text_width(text: str, font: str, size: float) -> float:
    return pdfmetrics.stringWidth(text, font, size)


def wrap(text: str, font: str, size: float, max_width: float) -> list[str]:
    result: list[str] = []
    for paragraph in text.split("\n"):
        if not paragraph:
            result.append("")
            continue
        line = ""
        for word in paragraph.split():
            candidate = word if not line else line + " " + word
            if text_width(candidate, font, size) <= max_width or not line:
                line = candidate
            else:
                result.append(line)
                line = word
        if line:
            result.append(line)
    return result


def para(c: canvas.Canvas, text: str, x: float, top: float, width: float,
         font: str = FONT, size: float = 10, color=INK, leading: float | None = None,
         max_lines: int | None = None) -> float:
    leading = leading or size * 1.32
    lines = wrap(text, font, size, width)
    if max_lines:
        lines = lines[:max_lines]
    c.setFillColor(color)
    c.setFont(font, size)
    y = top
    for line in lines:
        c.drawString(x, y, line)
        y -= leading
    return y


def label(c: canvas.Canvas, text: str, x: float, y: float, color=CORAL, size: float = 7.5,
          tracking: float = 0.5) -> None:
    c.setFillColor(color)
    c.setFont(FONT_BOLD, size)
    c.drawString(x, y, text.upper())


def rule(c: canvas.Canvas, x1: float, y1: float, x2: float, y2: float, color=LINE, width: float = 0.7) -> None:
    c.setStrokeColor(color)
    c.setLineWidth(width)
    c.line(x1, y1, x2, y2)


def draw_logo(c: canvas.Canvas, x: float, y: float, visible_width: float) -> tuple[float, float]:
    """Place the original PNG by its visible alpha bounds, without altering it."""
    iw, ih = LOGO_IMAGE_SIZE
    bx0, by0, bx1, by1 = LOGO_BBOX
    scale = visible_width / (bx1 - bx0)
    overall_w = iw * scale
    overall_h = ih * scale
    overall_x = x - bx0 * scale
    overall_y = y - (ih - by1) * scale
    c.drawImage(LOGO, overall_x, overall_y, width=overall_w, height=overall_h, mask="auto")
    return visible_width, (by1 - by0) * scale


def logo_plate(c: canvas.Canvas, x: float, y: float, visible_width: float, pad_x: float = 13, pad_y: float = 10,
               fill=PAPER) -> tuple[float, float]:
    visible_h = visible_width * (LOGO_BBOX[3] - LOGO_BBOX[1]) / (LOGO_BBOX[2] - LOGO_BBOX[0])
    c.setFillColor(fill)
    c.roundRect(x, y, visible_width + 2 * pad_x, visible_h + 2 * pad_y, mm(1.5), fill=1, stroke=0)
    draw_logo(c, x + pad_x, y + pad_y, visible_width)
    return visible_width + 2 * pad_x, visible_h + 2 * pad_y


def polygon(c: canvas.Canvas, points: Iterable[tuple[float, float]], fill, stroke=None, width: float = 1) -> None:
    p = c.beginPath()
    first = True
    for x, y in points:
        if first:
            p.moveTo(x, y)
            first = False
        else:
            p.lineTo(x, y)
    p.close()
    c.setFillColor(fill)
    if stroke:
        c.setStrokeColor(stroke)
        c.setLineWidth(width)
        c.drawPath(p, fill=1, stroke=1)
    else:
        c.drawPath(p, fill=1, stroke=0)


def card_outline(c: canvas.Canvas, x: float, y: float, w: float, h: float, stroke, fill=None,
                 accent=None, rotate: float = 0, line_width: float = 1.2) -> None:
    c.saveState()
    c.translate(x + w / 2, y + h / 2)
    c.rotate(rotate)
    c.translate(-w / 2, -h / 2)
    if fill:
        c.setFillColor(fill)
        c.roundRect(0, 0, w, h, mm(3), fill=1, stroke=0)
    c.setStrokeColor(stroke)
    c.setLineWidth(line_width)
    c.roundRect(0, 0, w, h, mm(3), fill=0, stroke=1)
    if accent:
        c.setFillColor(accent)
        c.roundRect(mm(7), h - mm(21), w - mm(14), mm(5), mm(1), fill=1, stroke=0)
        c.setStrokeColor(stroke)
        c.setLineWidth(0.55)
        c.line(mm(7), h - mm(31), w - mm(7), h - mm(31))
        c.line(mm(7), h - mm(38), w * 0.65, h - mm(38))
        c.line(mm(7), mm(12), w * 0.55, mm(12))
    c.restoreState()


def qr(c: canvas.Canvas, x: float, y: float, size: float, dark=NAVY) -> None:
    c.setFillColor(WHITE)
    c.roundRect(x, y, size, size, mm(2), fill=1, stroke=0)
    widget = QrCodeWidget(URL)
    x0, y0, x1, y1 = widget.getBounds()
    inner = size - mm(7)
    drawing = Drawing(inner, inner, transform=[inner / (x1 - x0), 0, 0, inner / (y1 - y0), 0, 0])
    drawing.add(widget)
    c.saveState()
    c.setFillColor(dark)
    renderPDF.draw(drawing, c, x + mm(3.5), y + mm(3.5))
    c.restoreState()


def footer(c: canvas.Canvas, dark: bool = False, y: float = mm(10), label_text: str = "BRANDYCARDS SPORTS CARDS") -> None:
    color = CREAM if dark else NAVY
    rule(c, mm(15), y + mm(6), W - mm(15), y + mm(6), color, 0.55)
    c.setFillColor(color)
    c.setFont(FONT_BOLD, 7.1)
    c.drawString(mm(15), y, label_text)
    c.setFont(FONT, 7.1)
    c.drawRightString(W - mm(15), y, "shop.brandycards.de")


def front_archive(c: canvas.Canvas) -> None:
    c.setFillColor(CREAM)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    margin = mm(15)
    # quiet editorial grid
    for i in range(1, 7):
        rule(c, margin + i * mm(18), mm(23), margin + i * mm(18), H - mm(18), LINE, 0.35)
    label(c, "BRANDYCARDS / SPORTS CARDS", margin, H - mm(18), CORAL, 7.2)
    logo_plate(c, margin, H - mm(43), 126, 11, 9, PAPER)
    label(c, "01 / FIND YOUR NEXT", W - margin - mm(55), H - mm(40), MUTED, 6.8)
    c.setFillColor(INK)
    c.setFont(FONT_BOLD, 37)
    c.drawString(margin, H - mm(82), "DIE KARTE,")
    c.drawString(margin, H - mm(100), "DIE DU")
    c.setFillColor(CORAL)
    c.drawString(margin, H - mm(118), "SUCHST.")
    para(c, "Einzelkarten, Sammlungen und Sportkarten mit Charakter.", margin,
         H - mm(132), W - 2 * margin - mm(24), FONT, 11.5, INK, 14)
    # abstract card stack, intentionally image-free
    card_outline(c, W - mm(86), mm(62), mm(56), mm(80), NAVY, fill=PEACH, accent=CORAL, rotate=-8, line_width=1.3)
    card_outline(c, W - mm(103), mm(71), mm(56), mm(80), CORAL, fill=None, accent=CORAL, rotate=5, line_width=1.1)
    c.setFillColor(NAVY)
    c.roundRect(margin, mm(31), W - 2 * margin, mm(24), mm(1.5), fill=1, stroke=0)
    c.setFillColor(CREAM)
    c.setFont(FONT_BOLD, 12.4)
    c.drawString(margin + mm(8), mm(44), "SAMMELN  /  KAUFEN  /  VERKAUFEN")
    c.setFont(FONT, 8.6)
    c.drawString(margin + mm(8), mm(36), "Dein Hobby. Deine Auswahl. Dein nächster Fund.")
    footer(c, dark=False, y=mm(12))


def back_archive(c: canvas.Canvas) -> None:
    c.setFillColor(PAPER)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    margin = mm(15)
    c.setFillColor(NAVY)
    c.rect(0, H - mm(30), W, mm(30), fill=1, stroke=0)
    logo_plate(c, margin, H - mm(25), 86, 8, 6, CREAM)
    label(c, "DAS FINDEST DU BEI UNS", margin, H - mm(49), NAVY, 7.2)
    c.setFillColor(INK)
    c.setFont(SERIF_BOLD, 25)
    c.drawString(margin, H - mm(65), "Dein nächster Fund")
    c.setFont(SERIF, 16)
    c.drawString(margin, H - mm(75), "beginnt hier.")
    rule(c, margin, H - mm(83), W - margin, H - mm(83), LINE, 0.8)
    items = [
        ("01", "EINZELKARTEN", "Für die Lücke im Binder und die Karte, die dir noch fehlt."),
        ("02", "SAMMLUNGEN", "Für neue Kapitel, besondere Funde und ehrliche Auswahl."),
        ("03", "AN- & VERKAUF", "Du willst Karten abgeben? Schreib uns mit ein paar Fotos."),
    ]
    y = H - mm(105)
    for number, title, body in items:
        c.setFillColor(CORAL)
        c.setFont(FONT_BOLD, 9)
        c.drawString(margin, y, number)
        c.setFillColor(NAVY)
        c.setFont(FONT_BOLD, 11)
        c.drawString(margin + mm(15), y, title)
        para(c, body, margin + mm(15), y - mm(7), W - 2 * margin - mm(15), FONT, 8.6, MUTED, 11)
        rule(c, margin + mm(15), y - mm(24), W - margin, y - mm(24), LINE, 0.6)
        y -= mm(32)
    # CTA section
    c.setFillColor(PEACH)
    c.roundRect(margin, mm(37), W - 2 * margin, mm(64), mm(2.5), fill=1, stroke=0)
    label(c, "SCHAU DICH UM", margin + mm(10), mm(88), NAVY, 7.2)
    c.setFillColor(NAVY)
    c.setFont(FONT_BOLD, 15)
    c.drawString(margin + mm(10), mm(75), "shop.brandycards.de")
    c.setFont(FONT, 8.4)
    c.drawString(margin + mm(10), mm(62), "QR scannen, Shop öffnen, Karte auswählen.")
    qr(c, W - margin - mm(42), mm(48), mm(36), NAVY)
    c.setFillColor(NAVY)
    c.setFont(FONT, 7.5)
    c.drawString(margin + mm(10), mm(49), EMAIL)
    footer(c, dark=False, y=mm(12), label_text="BRANDYCARDS / LEVERKUSEN")


def front_archive_note(c: canvas.Canvas) -> None:
    c.setFillColor(NAVY)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    margin = mm(16)
    # gold register lines
    for y in range(28, 570, 24):
        rule(c, margin, y, W - margin, y, HexColor("#33384A"), 0.35)
    logo_plate(c, margin, H - mm(45), 116, 12, 10, CREAM)
    label(c, "ARCHIVE NOTE / 02", W - margin - mm(52), H - mm(23), GOLD, 7)
    c.setFillColor(GOLD)
    c.setFont(FONT_BOLD, 62)
    c.drawString(W - mm(67), H - mm(92), "BC")
    c.setFillColor(CREAM)
    c.setFont(SERIF_BOLD, 40)
    c.drawString(margin, H - mm(95), "KARTEN,")
    c.drawString(margin, H - mm(113), "DIE")
    c.setFillColor(PEACH)
    c.drawString(margin, H - mm(131), "BLEIBEN.")
    para(c, "Sammeln ist mehr als Haben. Es ist Auswahl, Erinnerung und die Freude am nächsten Fund.",
         margin, H - mm(147), W - 2 * margin - mm(10), FONT, 10.5, CREAM, 13.2)
    # filing-card motif
    c.setStrokeColor(GOLD)
    c.setLineWidth(1.4)
    c.roundRect(margin, mm(53), mm(92), mm(88), mm(3), fill=0, stroke=1)
    c.setStrokeColor(PEACH)
    c.setLineWidth(0.7)
    c.line(margin + mm(10), mm(118), margin + mm(77), mm(118))
    c.line(margin + mm(10), mm(108), margin + mm(63), mm(108))
    c.line(margin + mm(10), mm(94), margin + mm(82), mm(94))
    c.line(margin + mm(10), mm(87), margin + mm(52), mm(87))
    c.setFillColor(GOLD)
    c.rect(margin + mm(10), mm(67), mm(14), mm(7), fill=1, stroke=0)
    c.setFillColor(CREAM)
    c.setFont(FONT_BOLD, 8.2)
    c.drawString(margin + mm(31), mm(69), "COLLECT / 2026")
    c.setFillColor(PEACH)
    c.setFont(FONT_BOLD, 9.2)
    c.drawString(W - margin - mm(95), mm(118), "SACHLICH.")
    c.drawString(W - margin - mm(95), mm(107), "PERSÖNLICH.")
    c.drawString(W - margin - mm(95), mm(96), "FÜR SAMMLER.")
    rule(c, W - margin - mm(95), mm(86), W - margin, mm(86), GOLD, 0.8)
    c.setFillColor(CREAM)
    c.setFont(FONT, 8.5)
    c.drawString(W - margin - mm(95), mm(72), "Ein Familienprojekt")
    c.drawString(W - margin - mm(95), mm(64), "aus Leverkusen.")
    footer(c, dark=True, y=mm(12), label_text="BRANDYCARDS SPORTS CARDS")


def back_archive_note(c: canvas.Canvas) -> None:
    c.setFillColor(CREAM)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    margin = mm(16)
    c.setFillColor(NAVY)
    c.rect(0, H - mm(24), W, mm(24), fill=1, stroke=0)
    logo_plate(c, margin, H - mm(21), 82, 8, 5, CREAM)
    label(c, "FIELD NOTE / 02", W - margin - mm(44), H - mm(15), GOLD, 6.4)
    c.setFillColor(NAVY)
    c.setFont(SERIF_BOLD, 23)
    c.drawString(margin, H - mm(46), "Was BrandyCards")
    c.drawString(margin, H - mm(57), "ausmacht.")
    rule(c, margin, H - mm(65), W - margin, H - mm(65), NAVY, 0.8)
    rows = [
        ("01", "AUS LEIDENSCHAFT", "Zwei Brüder, ein Familienprojekt und die Lust an guten Sportkarten."),
        ("02", "KLAR AUSGEWÄHLT", "Karten werden verständlich beschrieben und sauber präsentiert."),
        ("03", "SICHER VERPACKT", "Deine Bestellung wird mit Sorgfalt für den Weg zu dir vorbereitet."),
        ("04", "PERSÖNLICH ERREICHBAR", "Fragen, Wünsche oder eine Sammlung? Schreib uns direkt."),
    ]
    y = H - mm(84)
    for number, title, body in rows:
        c.setFillColor(GOLD)
        c.setFont(FONT_BOLD, 8.5)
        c.drawString(margin, y, number)
        c.setFillColor(NAVY)
        c.setFont(FONT_BOLD, 9.5)
        c.drawString(margin + mm(14), y, title)
        para(c, body, margin + mm(14), y - mm(7), W - 2 * margin - mm(14), FONT, 8.1, MUTED, 10.2)
        rule(c, margin + mm(14), y - mm(24), W - margin, y - mm(24), LINE, 0.55)
        y -= mm(29)
    c.setFillColor(NAVY)
    c.roundRect(margin, mm(39), W - 2 * margin, mm(63), mm(2), fill=1, stroke=0)
    c.setFillColor(CREAM)
    c.setFont(FONT_BOLD, 11.5)
    c.drawString(margin + mm(10), mm(84), "DEIN ARCHIV BEGINNT MIT EINER KARTE.")
    c.setFont(FONT, 8.2)
    c.drawString(margin + mm(10), mm(70), "Shop öffnen und in Ruhe stöbern:")
    c.setFillColor(PEACH)
    c.setFont(FONT_BOLD, 10.2)
    c.drawString(margin + mm(10), mm(58), "shop.brandycards.de")
    c.setFillColor(CREAM)
    c.setFont(FONT, 7.4)
    c.drawString(margin + mm(10), mm(47), "Fragen? " + EMAIL)
    qr(c, W - margin - mm(42), mm(50), mm(36), NAVY)
    footer(c, dark=False, y=mm(12), label_text="BRANDYCARDS / LEVERKUSEN")


def front_match(c: canvas.Canvas) -> None:
    c.setFillColor(CORAL)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    # diagonal navy field
    polygon(c, [(W * 0.37, 0), (W, 0), (W, H), (W * 0.72, H)], NAVY)
    polygon(c, [(0, H * 0.22), (W * 0.42, 0), (W * 0.53, 0), (0, H * 0.34)], PEACH)
    margin = mm(16)
    logo_plate(c, margin, H - mm(45), 116, 12, 10, CREAM)
    label(c, "FIELD / 03", W - margin - mm(32), H - mm(22), CREAM, 7)
    c.setFillColor(NAVY)
    c.setFont(FONT_BOLD, 41)
    c.drawString(margin, H - mm(91), "SIEHST DU")
    c.drawString(margin, H - mm(109), "DIE LÜCKE?")
    para(c, "Dann ist es Zeit für die nächste Karte.", margin, H - mm(125), mm(77), FONT_BOLD, 11, NAVY, 13.2)
    # graphic card + target mark on navy
    card_outline(c, W - mm(97), mm(80), mm(57), mm(84), CREAM, fill=None, accent=CORAL, rotate=8, line_width=1.3)
    c.setStrokeColor(PEACH)
    c.setLineWidth(1)
    c.circle(W - mm(68), mm(118), mm(15), fill=0, stroke=1)
    c.circle(W - mm(68), mm(118), mm(5), fill=0, stroke=1)
    c.setFillColor(CREAM)
    c.setFont(FONT_BOLD, 9.5)
    c.drawString(W - mm(87), mm(58), "BUY")
    c.drawString(W - mm(87), mm(48), "SELL")
    c.drawString(W - mm(87), mm(38), "TRADE")
    c.setFillColor(NAVY)
    c.setFont(FONT_BOLD, 11)
    c.drawString(margin, mm(44), "DEIN SPIEL.")
    c.setFont(FONT, 9.2)
    c.drawString(margin, mm(34), "DEINE KARTEN. DEINE GESCHICHTE.")
    footer(c, dark=False, y=mm(12), label_text="BRANDYCARDS SPORTS CARDS")


def back_match(c: canvas.Canvas) -> None:
    c.setFillColor(PAPER)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    margin = mm(15)
    # top block and diagonal accent
    c.setFillColor(NAVY)
    c.rect(0, H - mm(39), W, mm(39), fill=1, stroke=0)
    polygon(c, [(W - mm(57), H - mm(39)), (W, H - mm(39)), (W, H), (W - mm(27), H)], CORAL)
    logo_plate(c, margin, H - mm(34), 86, 8, 6, CREAM)
    label(c, "START HERE", W - margin - mm(44), H - mm(22), CREAM, 6.5)
    c.setFillColor(NAVY)
    c.setFont(FONT_BOLD, 24)
    c.drawString(margin, H - mm(60), "NICHT NUR KARTEN.")
    para(c, "Sport, Nostalgie und die nächste gute Geschichte. BrandyCards bringt Menschen und Karten zusammen.",
         margin, H - mm(71), W - 2 * margin, FONT, 9.4, INK, 12)
    rule(c, margin, H - mm(99), W - margin, H - mm(99), CORAL, 1.3)
    # Two calls to action
    c.setFillColor(NAVY)
    c.roundRect(margin, H - mm(146), W - 2 * margin, mm(35), mm(1.5), fill=1, stroke=0)
    label(c, "DU SUCHST EINE KARTE?", margin + mm(9), H - mm(123), PEACH, 7)
    c.setFillColor(CREAM)
    c.setFont(FONT_BOLD, 10.8)
    c.drawString(margin + mm(9), H - mm(135), "Finde sie im Shop.")
    c.setFont(FONT, 8.1)
    c.drawString(margin + mm(9), H - mm(142), "Einzelkarten, Sammlungen, Vorverkauf.")
    c.setFillColor(CORAL)
    c.roundRect(margin, H - mm(194), W - 2 * margin, mm(35), mm(1.5), fill=1, stroke=0)
    label(c, "DU WILLST KARTEN VERKAUFEN?", margin + mm(9), H - mm(171), NAVY, 7)
    c.setFillColor(NAVY)
    c.setFont(FONT_BOLD, 10.8)
    c.drawString(margin + mm(9), H - mm(183), "Schick uns ein paar Fotos.")
    c.setFont(FONT, 8.1)
    c.drawString(margin + mm(9), H - mm(190), "Wir melden uns persönlich bei dir.")
    # contact footer/QR
    c.setFillColor(PEACH)
    c.roundRect(margin, mm(44), W - 2 * margin, mm(69), mm(2), fill=1, stroke=0)
    label(c, "DEIN NÄCHSTER SCHRITT", margin + mm(10), mm(99), NAVY, 7)
    c.setFillColor(NAVY)
    c.setFont(FONT_BOLD, 12.2)
    c.drawString(margin + mm(10), mm(86), "shop.brandycards.de")
    c.setFont(FONT, 8.1)
    c.drawString(margin + mm(10), mm(73), "Oder direkt an: " + EMAIL)
    qr(c, W - margin - mm(42), mm(58), mm(39), NAVY)
    footer(c, dark=False, y=mm(12), label_text="BRANDYCARDS / LEVERKUSEN")


def build(filename: str, front_fn, back_fn) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    PREVIEWS.mkdir(parents=True, exist_ok=True)
    pdf_path = OUT / filename
    c = canvas.Canvas(str(pdf_path), pagesize=A5, pageCompression=1)
    c.setTitle(filename.replace("_", " ").replace(".pdf", ""))
    front_fn(c)
    c.showPage()
    back_fn(c)
    c.showPage()
    c.save()


if __name__ == "__main__":
    build("brandycards_flyer_01_die_karte.pdf", front_archive, back_archive)
    build("brandycards_flyer_02_das_archiv.pdf", front_archive_note, back_archive_note)
    build("brandycards_flyer_03_match_point.pdf", front_match, back_match)
    print("created", *sorted(str(p) for p in OUT.glob("*.pdf")), sep="\n")
