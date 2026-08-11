from __future__ import annotations

from pathlib import Path

from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A5
from reportlab.pdfgen import canvas

from create_brandycards_flyers import (
    CREAM,
    CORAL,
    EMAIL,
    FONT,
    FONT_BOLD,
    GOLD,
    H,
    INK,
    NAVY,
    PAPER,
    PEACH,
    W,
    footer,
    label,
    logo_plate,
    mm,
    polygon,
    para,
    qr,
    rule,
)

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output" / "pdf"
PREVIEWS = ROOT / "output" / "previews"
OUT.mkdir(parents=True, exist_ok=True)
PREVIEWS.mkdir(parents=True, exist_ok=True)

SLAB_INK = HexColor("#080D1D")
SLAB_BLUE = HexColor("#132347")
ICE = HexColor("#DDEAF2")
CYAN = HexColor("#8CDCE5")
VIOLET = HexColor("#9D84D9")
PINK = HexColor("#F5A7C7")
METAL = HexColor("#B8C9D1")
SOFT_GOLD = HexColor("#ECD08A")
MID = HexColor("#5D6D8C")


def barcode(c: canvas.Canvas, x: float, y: float, width: float, height: float, color=SLAB_INK) -> None:
    pattern = "1101001011101010111010010110100111010110011010111010011011101001011101011"
    c.setFillColor(color)
    bar_w = width / len(pattern)
    for index, bit in enumerate(pattern):
        if bit == "1":
            c.rect(x + index * bar_w, y, max(0.45, bar_w * 0.84), height, fill=1, stroke=0)


def screw(c: canvas.Canvas, x: float, y: float) -> None:
    c.setFillColor(ICE)
    c.circle(x, y, mm(3.1), fill=1, stroke=0)
    c.setStrokeColor(MID)
    c.setLineWidth(0.7)
    c.circle(x, y, mm(2.1), fill=0, stroke=1)
    c.line(x - mm(1.3), y - mm(1.3), x + mm(1.3), y + mm(1.3))
    c.line(x - mm(1.3), y + mm(1.3), x + mm(1.3), y - mm(1.3))


def holo_lines(c: canvas.Canvas, x: float, y: float, w: float, h: float) -> None:
    # A restrained foil language: several diagonal color bands, not a noisy texture.
    bands = [
        (PINK, 0.00, 0.10),
        (VIOLET, 0.16, 0.24),
        (CYAN, 0.31, 0.38),
        (SOFT_GOLD, 0.47, 0.53),
        (CORAL, 0.64, 0.70),
        (CYAN, 0.80, 0.86),
    ]
    for color, start, end in bands:
        polygon(c, [(x + w * start, y), (x + w * (start + 0.08), y),
                    (x + w * (end + 0.15), y + h), (x + w * (end + 0.07), y + h)], color)
    c.setStrokeColor(ICE)
    c.setLineWidth(0.35)
    for i in range(8):
        x1 = x + w * (0.02 + i * 0.13)
        c.line(x1, y, x1 + mm(38), y + h)


def slab_shell(c: canvas.Canvas) -> None:
    c.setFillColor(SLAB_INK)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    c.setFillColor(HexColor("#111A31"))
    c.roundRect(mm(6), mm(6), W - mm(12), H - mm(12), mm(9), fill=1, stroke=0)
    c.setStrokeColor(ICE)
    c.setLineWidth(1.6)
    c.roundRect(mm(8), mm(8), W - mm(16), H - mm(16), mm(8), fill=0, stroke=1)
    c.setStrokeColor(CYAN)
    c.setLineWidth(0.6)
    c.roundRect(mm(11), mm(11), W - mm(22), H - mm(22), mm(6), fill=0, stroke=1)
    # small rainbow-reflective edge accents
    for color, xx in [(PINK, mm(17)), (VIOLET, mm(21)), (CYAN, W - mm(22)), (SOFT_GOLD, W - mm(18))]:
        c.setStrokeColor(color)
        c.setLineWidth(1.0)
        c.line(xx, mm(20), xx, H - mm(20))
    for x, y in [(mm(14), mm(18)), (W - mm(14), mm(18)), (mm(14), H - mm(18)), (W - mm(14), H - mm(18))]:
        screw(c, x, y)


def label_header(c: canvas.Canvas, back: bool = False) -> None:
    x = mm(20)
    y = H - mm(62)
    w = W - mm(40)
    h = mm(39)
    c.setFillColor(CREAM)
    c.roundRect(x, y, w, h, mm(2.5), fill=1, stroke=0)
    c.setStrokeColor(SOFT_GOLD)
    c.setLineWidth(1.0)
    c.roundRect(x + mm(2), y + mm(2), w - mm(4), h - mm(4), mm(1.5), fill=0, stroke=1)
    logo_plate(c, x + mm(7), y + mm(8), 82, 7, 5, PAPER)
    c.setFillColor(SLAB_INK)
    c.setFont(FONT_BOLD, 6.3)
    c.drawString(x + mm(68), y + mm(29), "BRANDYCARDS / COLLECTOR ISSUE")
    c.setFont(FONT, 5.7)
    c.drawString(x + mm(68), y + mm(21), "SPORTS CARDS  /  SERIES 01  /  2026")
    barcode(c, x + mm(68), y + mm(8), mm(39), mm(8), SLAB_INK)
    c.setFont(FONT, 5.4)
    c.drawString(x + mm(68), y + mm(4), "BC-2026-001")
    # Grade badge, deliberately BrandyCards-branded rather than a grading-service mark.
    bx = x + w - mm(39)
    by = y + mm(6)
    c.setFillColor(SLAB_INK)
    c.roundRect(bx, by, mm(29), mm(27), mm(1.5), fill=1, stroke=0)
    c.setStrokeColor(SOFT_GOLD)
    c.setLineWidth(0.9)
    c.roundRect(bx + mm(1.7), by + mm(1.7), mm(25.6), mm(23.6), mm(1), fill=0, stroke=1)
    c.setFillColor(SOFT_GOLD)
    c.setFont(FONT_BOLD, 5.6)
    c.drawCentredString(bx + mm(14.5), by + mm(18), "BC GRADE")
    c.setFont(FONT_BOLD, 16.5)
    c.drawCentredString(bx + mm(14.5), by + mm(5.5), "10")


def card_window(c: canvas.Canvas, x: float, y: float, w: float, h: float) -> None:
    c.setFillColor(ICE)
    c.roundRect(x, y, w, h, mm(5), fill=1, stroke=0)
    c.setStrokeColor(METAL)
    c.setLineWidth(1.2)
    c.roundRect(x + mm(2), y + mm(2), w - mm(4), h - mm(4), mm(4), fill=0, stroke=1)
    inner_x, inner_y = x + mm(8), y + mm(8)
    inner_w, inner_h = w - mm(16), h - mm(16)
    c.setFillColor(SLAB_BLUE)
    c.roundRect(inner_x, inner_y, inner_w, inner_h, mm(3), fill=1, stroke=0)
    holo_lines(c, inner_x, inner_y, inner_w, inner_h)
    c.setStrokeColor(CREAM)
    c.setLineWidth(1.1)
    c.roundRect(inner_x, inner_y, inner_w, inner_h, mm(3), fill=0, stroke=1)

    # Abstract sport-card action graphic: a fast central figure and a ball.
    cx = inner_x + inner_w * 0.55
    cy = inner_y + inner_h * 0.50
    c.setFillColor(SLAB_INK)
    c.circle(cx, cy + mm(35), mm(9), fill=1, stroke=0)
    polygon(c, [(cx - mm(7), cy + mm(25)), (cx + mm(10), cy + mm(24)),
                (cx + mm(20), cy - mm(11)), (cx + mm(8), cy - mm(13)),
                (cx - mm(3), cy + mm(7)), (cx - mm(18), cy - mm(3)),
                (cx - mm(23), cy + mm(5))], SLAB_INK)
    polygon(c, [(cx + mm(5), cy + mm(19)), (cx + mm(30), cy + mm(5)),
                (cx + mm(27), cy - mm(1)), (cx + mm(1), cy + mm(8))], CORAL)
    polygon(c, [(cx - mm(6), cy + mm(13)), (cx - mm(30), cy + mm(2)),
                (cx - mm(27), cy - mm(3)), (cx - mm(1), cy + mm(4))], PEACH)
    c.setStrokeColor(SOFT_GOLD)
    c.setLineWidth(2.0)
    c.line(cx + mm(8), cy - mm(11), cx + mm(29), cy - mm(30))
    c.setFillColor(ICE)
    c.circle(cx + mm(35), cy - mm(35), mm(5), fill=1, stroke=0)
    c.setStrokeColor(SLAB_INK)
    c.setLineWidth(0.8)
    c.circle(cx + mm(35), cy - mm(35), mm(5), fill=0, stroke=1)
    c.line(cx + mm(31), cy - mm(38), cx + mm(39), cy - mm(32))

    c.setFillColor(CREAM)
    c.setFont(FONT_BOLD, 16)
    c.drawString(inner_x + mm(10), inner_y + mm(18), "SPORTS CARDS")
    c.setFillColor(SOFT_GOLD)
    c.setFont(FONT_BOLD, 7.4)
    c.drawString(inner_x + mm(10), inner_y + mm(9), "BUY  /  SELL  /  TRADE")
    c.setFillColor(CREAM)
    c.setFont(FONT, 6.2)
    c.drawRightString(inner_x + inner_w - mm(10), inner_y + mm(9), "FIND THE NEXT ONE")


def slab_footer(c: canvas.Canvas, text: str, code: str = "BC-2026-001") -> None:
    x = mm(20)
    y = mm(10)
    w = W - mm(40)
    h = mm(19)
    c.setFillColor(CREAM)
    c.roundRect(x, y, w, h, mm(2.3), fill=1, stroke=0)
    c.setStrokeColor(SOFT_GOLD)
    c.setLineWidth(0.9)
    c.roundRect(x + mm(2), y + mm(2), w - mm(4), h - mm(4), mm(1.4), fill=0, stroke=1)
    c.setFillColor(SLAB_INK)
    c.setFont(FONT_BOLD, 8.3)
    c.drawString(x + mm(9), y + mm(14), text)
    c.setFont(FONT, 6.5)
    c.drawString(x + mm(9), y + mm(6), "shop.brandycards.de")
    barcode(c, x + w - mm(43), y + mm(8), mm(33), mm(8), SLAB_INK)
    c.setFont(FONT, 5.2)
    c.drawRightString(x + w - mm(9), y + mm(4), code)


def front(c: canvas.Canvas) -> None:
    slab_shell(c)
    # The main chamber sits below the certification label, like a real slab.
    panel_x, panel_y, panel_w, panel_h = mm(20), mm(28), W - mm(40), mm(80)
    c.setFillColor(HexColor("#1A2B55"))
    c.roundRect(panel_x, panel_y, panel_w, panel_h, mm(5), fill=1, stroke=0)
    holo_lines(c, panel_x + mm(2), panel_y + mm(2), panel_w - mm(4), panel_h - mm(4))
    c.setStrokeColor(ICE)
    c.setLineWidth(1.0)
    c.roundRect(panel_x, panel_y, panel_w, panel_h, mm(5), fill=0, stroke=1)
    label_header(c)
    card_window(c, mm(31), mm(34), W - mm(62), mm(68))
    # Identification strip between the top label and the card window.
    c.setFillColor(CREAM)
    c.setFont(FONT_BOLD, 6.1)
    c.drawString(mm(28), mm(105), "BRANDYCARDS AUTHENTIC COLLECTOR PIECE")
    c.setFillColor(SOFT_GOLD)
    c.setFont(FONT, 5.8)
    c.drawRightString(W - mm(28), mm(105), "ONE COMMUNITY / MANY STORIES")
    slab_footer(c, "THE NEXT CARD IS OUT THERE")
    c.setFillColor(ICE)
    c.setFont(FONT, 5.5)
    c.drawCentredString(W / 2, mm(6), "PROTECT YOUR COLLECTION. KEEP THE SEARCH GOING.")

def info_panel(c: canvas.Canvas, x: float, y: float, w: float, h: float, accent, title: str, body: str, code: str) -> None:
    c.setFillColor(SLAB_BLUE)
    c.roundRect(x, y, w, h, mm(2.5), fill=1, stroke=0)
    c.setStrokeColor(accent)
    c.setLineWidth(1.0)
    c.roundRect(x, y, w, h, mm(2.5), fill=0, stroke=1)
    c.setFillColor(accent)
    c.setFont(FONT_BOLD, 6.2)
    c.drawString(x + mm(8), y + h - mm(11), code)
    c.setFillColor(CREAM)
    c.setFont(FONT_BOLD, 11)
    c.drawString(x + mm(8), y + h - mm(24), title)
    para(c, body, x + mm(8), y + h - mm(33), w - mm(16), FONT, 7.6, ICE, 9.7)


def back(c: canvas.Canvas) -> None:
    slab_shell(c)
    main_x, main_y, main_w, main_h = mm(20), mm(30), W - mm(40), mm(82)
    c.setFillColor(SLAB_INK)
    c.roundRect(main_x, main_y, main_w, main_h, mm(5), fill=1, stroke=0)
    c.setStrokeColor(ICE)
    c.setLineWidth(1.0)
    c.roundRect(main_x, main_y, main_w, main_h, mm(5), fill=0, stroke=1)
    holo_lines(c, main_x + mm(2), main_y + mm(2), main_w - mm(4), main_h - mm(4))
    c.setFillColor(SLAB_INK)
    c.roundRect(mm(28), mm(34), W - mm(56), mm(73), mm(3), fill=1, stroke=0)
    label_header(c, back=True)
    label(c, "COLLECTOR REPORT / 2026", mm(28), mm(103), SOFT_GOLD, 6.8)
    c.setFillColor(CREAM)
    c.setFont(FONT_BOLD, 18)
    c.drawString(mm(28), mm(93), "DEINE SAMMLUNG")
    c.setFillColor(PEACH)
    c.setFont(FONT_BOLD, 16)
    c.drawString(mm(28), mm(84), "BEKOMMT EINEN NEUEN FUND.")
    para(c, "BrandyCards verbindet Auswahl, Leidenschaft und den direkten Weg zu deiner nächsten Sportkarte.",
         mm(28), mm(75), W - mm(56), FONT, 7.8, ICE, 9.8)
    rule(c, mm(28), mm(65), W - mm(28), mm(65), MID, 0.8)
    c.setFillColor(CREAM)
    c.setFont(FONT_BOLD, 6.8)
    c.drawString(mm(28), mm(59), "BRANDYCARDS COLLECTOR SCORE")
    score_items = [("CENTERING", "10", CYAN), ("CORNERS", "10", PEACH), ("SURFACE", "10", VIOLET), ("PASSION", "10", SOFT_GOLD)]
    x = mm(28)
    score_w = mm(20)
    for title, score, accent in score_items:
        c.setFillColor(SLAB_BLUE)
        c.roundRect(x, mm(48), score_w, mm(14), mm(1.7), fill=1, stroke=0)
        c.setStrokeColor(accent)
        c.setLineWidth(0.8)
        c.roundRect(x, mm(48), score_w, mm(14), mm(1.7), fill=0, stroke=1)
        c.setFillColor(ICE)
        c.setFont(FONT, 4.5)
        c.drawString(x + mm(2.5), mm(57), title)
        c.setFillColor(accent)
        c.setFont(FONT_BOLD, 10)
        c.drawRightString(x + score_w - mm(2.5), mm(50), score)
        x += mm(21)
    # Two clear utility panels keep the back useful rather than decorative.
    info_panel(c, mm(28), mm(28), mm(43), mm(18), CORAL, "KAUFEN", "Einzelkarten und Sammlungen.", "01 / FIND")
    info_panel(c, mm(75), mm(28), mm(43), mm(18), CYAN, "VERKAUFEN", "Fotos schicken, direkt anfragen.", "02 / SEND")
    # Bottom label works as the back-side call to action and contact strip.
    c.setFillColor(CREAM)
    c.roundRect(mm(20), mm(10), W - mm(40), mm(16), mm(1.7), fill=1, stroke=0)
    c.setFillColor(SLAB_INK)
    c.setFont(FONT_BOLD, 6.5)
    c.drawString(mm(28), mm(20), "SCAN  /  SHOP ÖFFNEN  /  SAMMELN")
    c.setFont(FONT, 5.7)
    c.drawString(mm(28), mm(14), EMAIL)
    qr(c, mm(111), mm(11), mm(12), SLAB_INK)
    c.setFillColor(ICE)
    c.setFont(FONT, 5.3)
    c.drawRightString(W - mm(20), mm(6), "shop.brandycards.de  /  BC-2026-001")

if __name__ == "__main__":
    path = OUT / "brandycards_flyer_04_graded_slab.pdf"
    c = canvas.Canvas(str(path), pagesize=A5, pageCompression=1)
    c.setTitle("BrandyCards Graded Slab Flyer")
    front(c)
    c.showPage()
    back(c)
    c.showPage()
    c.save()
    print(path)
