"""Baut das Anwendungszeichen für KARL.exe aus dem vorhandenen Avatarkopf.

**Warum ein Skript und keine abgelegte Datei.** Das Zeichen entsteht aus
`Assets/karl-head.png`, das seinerseits aus dem Spritesheet geschnitten ist.
Ändert sich die Figur, wird das Zeichen neu gebaut statt von Hand nachgezogen —
sonst laufen Fenster, Taskleiste und Datei auseinander.

**Warum unterschiedliche Zeichnungen je Größe.** Ein Namenszug, der bei 256
Pixeln trägt, ist bei 16 Pixeln ein grauer Strich. Große Kacheln bekommen
deshalb Kopf **und** Namen, kleine nur den Kopf — größer angeschnitten, damit
das Gesicht auch in der Taskleiste erkennbar bleibt. Genau dafür kennt das
ICO-Format mehrere Bilder in einer Datei.

Aufruf:  python scripts/karl-icon-bauen.py
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

WURZEL = Path(__file__).resolve().parent.parent
KOPF = WURZEL / "avatar" / "BrandyCards.Desktop" / "Assets" / "karl-head.png"
ZIEL_ICO = WURZEL / "avatar" / "BrandyCards.Desktop" / "Assets" / "KarlIcon.ico"
ZIEL_PNG = WURZEL / "avatar" / "BrandyCards.Desktop" / "Assets" / "karl-logo.png"

# Das Rot des Shops und ein dunkler Grund darunter. Der Verlauf gibt der Kachel
# Tiefe, ohne dass ein Bild dafür nötig wäre.
ROT_OBEN = (199, 62, 53)
ROT_UNTEN = (122, 30, 25)
NAME = "KARL"


def verlauf(groesse: int) -> Image.Image:
    """Senkrechter Verlauf als Grundfläche."""
    flaeche = Image.new("RGBA", (groesse, groesse))
    zeichner = ImageDraw.Draw(flaeche)
    for y in range(groesse):
        anteil = y / max(1, groesse - 1)
        farbe = tuple(
            round(ROT_OBEN[i] + (ROT_UNTEN[i] - ROT_OBEN[i]) * anteil) for i in range(3)
        )
        zeichner.line([(0, y), (groesse, y)], fill=(*farbe, 255))
    return flaeche


def abgerundet(bild: Image.Image, radius_anteil: float = 0.22) -> Image.Image:
    """Beschneidet die Fläche auf ein abgerundetes Quadrat.

    Der Radius wächst mit der Größe, damit die Form bei 16 und bei 256 Pixeln
    gleich aussieht statt einmal eckig und einmal rund.
    """
    groesse = bild.size[0]
    maske = Image.new("L", (groesse, groesse), 0)
    ImageDraw.Draw(maske).rounded_rectangle(
        [(0, 0), (groesse - 1, groesse - 1)], radius=round(groesse * radius_anteil), fill=255
    )
    bild.putalpha(maske)
    return bild


def schrift(groesse: int) -> ImageFont.FreeTypeFont:
    """Segoe UI Bold, weil sie auf jedem Windows liegt, auf dem KARL läuft."""
    for pfad in (r"C:\Windows\Fonts\segoeuib.ttf", r"C:\Windows\Fonts\arialbd.ttf"):
        if Path(pfad).exists():
            return ImageFont.truetype(pfad, groesse)
    return ImageFont.load_default()


def kachel(groesse: int, mit_namen: bool) -> Image.Image:
    flaeche = abgerundet(verlauf(groesse))
    kopf = Image.open(KOPF).convert("RGBA")

    if mit_namen:
        # Kopf oben, Namenszug unten. Die Werte sind an der 256er-Kachel
        # abgemessen und wachsen mit ihr.
        kopfhoehe = round(groesse * 0.60)
        kopf = kopf.resize((kopfhoehe, kopfhoehe), Image.LANCZOS)
        flaeche.alpha_composite(kopf, ((groesse - kopfhoehe) // 2, round(groesse * 0.05)))

        zeichner = ImageDraw.Draw(flaeche)
        stift = schrift(round(groesse * 0.22))
        breite = zeichner.textbbox((0, 0), NAME, font=stift)
        zeichner.text(
            ((groesse - (breite[2] - breite[0])) // 2, round(groesse * 0.66)),
            NAME,
            font=stift,
            fill=(255, 255, 255, 255),
        )
    else:
        # Ohne Namen darf der Kopf die Fläche füllen — bei 16 Pixeln zählt jeder.
        kopfhoehe = round(groesse * 0.92)
        kopf = kopf.resize((kopfhoehe, kopfhoehe), Image.LANCZOS)
        flaeche.alpha_composite(kopf, ((groesse - kopfhoehe) // 2, round(groesse * 0.06)))

    return flaeche


def main() -> None:
    # Große Kacheln mit Namen, kleine ohne — siehe Kopfkommentar.
    kacheln = {
        256: kachel(256, mit_namen=True),
        128: kachel(128, mit_namen=True),
        64: kachel(64, mit_namen=False),
        48: kachel(48, mit_namen=False),
        32: kachel(32, mit_namen=False),
        16: kachel(16, mit_namen=False),
    }
    kacheln[256].save(ZIEL_PNG)
    # `append_images` trägt die kleineren Zeichnungen bei; ohne sie würde Pillow
    # alle Größen aus dem 256er herunterrechnen und der Namenszug verschmierte.
    kacheln[256].save(
        ZIEL_ICO,
        format="ICO",
        sizes=[(g, g) for g in sorted(kacheln)],
        append_images=[kacheln[g] for g in sorted(kacheln) if g != 256],
    )
    print(f"geschrieben: {ZIEL_ICO.name}, {ZIEL_PNG.name}")


if __name__ == "__main__":
    main()
