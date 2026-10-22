"""Vidéo verticale 1080x1920 : exercice C 'somme des chiffres' expliqué en darija."""
import subprocess
from PIL import Image, ImageDraw, ImageFont

W, H, FPS = 1080, 1920, 30
BG = (14, 20, 33); CARD = (24, 33, 52); ACC = (255, 196, 0); TXT = (235, 240, 248); MUT = (140, 155, 180)
GREEN = (80, 220, 140); BLUE = (110, 170, 255); PINK = (255, 120, 170); ORANGE = (255, 170, 90)
SANS = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
SANSR = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
MONO = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"
MONOB = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf"
f = lambda p, s: ImageFont.truetype(p, s)

def ease(t): return 1 - (1 - min(max(t, 0), 1)) ** 3

def centered(d, y, text, font, fill):
    w = d.textlength(text, font=font); d.text(((W - w) / 2, y), text, font=font, fill=fill)

def wrap(d, text, font, maxw):
    words, lines, cur = text.split(), [], ""
    for w in words:
        t = (cur + " " + w).strip()
        if d.textlength(t, font=font) <= maxw: cur = t
        else: lines.append(cur); cur = w
    lines.append(cur); return lines

def base(progress):
    im = Image.new("RGB", (W, H), BG); d = ImageDraw.Draw(im)
    d.text((60, 70), "LANGAGE C  ·  S3", font=f(SANS, 34), fill=ACC)
    d.text((60, 118), "Exercice f 1 minute", font=f(SANSR, 30), fill=MUT)
    d.rounded_rectangle((60, H - 70, W - 60, H - 58), 6, fill=CARD)
    d.rounded_rectangle((60, H - 70, 60 + (W - 120) * progress, H - 58), 6, fill=ACC)
    return im, d

CODE = [
 [("int", BLUE), (" n = ", TXT), ("5072", ORANGE), (";", TXT)],
 [("int", BLUE), (" somme = ", TXT), ("0", ORANGE), (";", TXT)],
 [("", TXT)],
 [("while", PINK), (" (n > ", TXT), ("0", ORANGE), (") {", TXT)],
 [("    somme += n ", TXT), ("% 10", GREEN), (";", TXT), ("  // akhir chiffre", MUT)],
 [("    n = n ", TXT), ("/ 10", GREEN), (";", TXT), ("       // n7ydouh", MUT)],
 [("}", TXT)],
 [("", TXT)],
 [("printf", BLUE), ("(", TXT), ('"%d"', ORANGE), (", somme);", TXT)],
]
TOTAL_CHARS = sum(len(s) for line in CODE for s, _ in line)

def draw_code(d, nchars, y0=560):
    d.rounded_rectangle((50, y0 - 40, W - 50, y0 + 9 * 66 + 30), 28, fill=CARD)
    for k, c in enumerate((PINK, ORANGE, GREEN)):
        d.ellipse((90 + k * 40, y0 - 18, 112 + k * 40, y0 + 4), fill=c)
    font = f(MONO, 37); y = y0 + 40; left = nchars
    for line in CODE:
        x = 90
        for seg, col in line:
            if left <= 0: break
            part = seg[:left]; d.text((x, y), part, font=font, fill=col)
            x += d.textlength(part, font=font); left -= len(part)
        y += 66
        if left <= 0:
            return
    return

SCENES = [  # (durée en s, nom)
    (3.5, "hook"), (5.5, "idee"), (11.0, "code"), (9.0, "trace"), (5.0, "fin")]
TOTAL = sum(s for s, _ in SCENES)

def frame(t):
    acc = 0
    for dur, name in SCENES:
        if t < acc + dur: lt = t - acc; break
        acc += dur
    im, d = base(t / TOTAL)

    if name == "hook":
        a = ease(lt / 0.6)
        centered(d, 620 - 40 * (1 - a), "Ch7al kayswa", f(SANS, 80), TXT)
        centered(d, 735, "5 + 0 + 7 + 2 ?", f(SANS, 100), ACC)
        if lt > 1.4:
            centered(d, 950, "Walakin b C", f(SANS, 70), TXT)
            centered(d, 1040, "bla ma t9te3 r9m b yeddek", f(SANSR, 50), MUT)
        if lt > 2.3:
            centered(d, 1250, "Chouf 7ta lekher", f(SANS, 46), PINK)

    elif name == "idee":
        centered(d, 300, "L FIKRA", f(SANS, 54), ACC)
        items = [("n % 10", "kayjib AKHIR chiffre", "5072 % 10 = 2", GREEN),
                 ("n / 10", "kayms7 AKHIR chiffre", "5072 / 10 = 507", BLUE)]
        for k, (op, desc, ex, col) in enumerate(items):
            if lt < 0.4 + k * 1.8: continue
            a = ease((lt - 0.4 - k * 1.8) / 0.5); y = 470 + k * 520 + 40 * (1 - a)
            d.rounded_rectangle((70, y, W - 70, y + 440), 32, fill=CARD)
            centered(d, y + 50, op, f(MONOB, 110), col)
            centered(d, y + 200, desc, f(SANS, 50), TXT)
            centered(d, y + 300, ex, f(MONO, 54), MUT)

    elif name == "code":
        centered(d, 300, "L CODE", f(SANS, 54), ACC)
        centered(d, 380, "Boucle while + % + /", f(SANSR, 42), MUT)
        n = int(TOTAL_CHARS * min(1, lt / 8.0)); draw_code(d, n)
        if lt > 8.6:
            for k, l in enumerate(wrap(d, "Kol tour: nzido akhir chiffre, w n7ydouh men n", f(SANS, 46), W - 160)):
                centered(d, 1300 + k * 62, l, f(SANS, 46), TXT)

    elif name == "trace":
        centered(d, 300, "N9LBOU 3LA L CODE", f(SANS, 54), ACC)
        rows = [("5072", "2", "2", "507"), ("507", "7", "9", "50"), ("50", "0", "9", "5"), ("5", "5", "14", "0")]
        heads = ("n", "n % 10", "somme", "n / 10"); xs = (110, 330, 590, 820)
        d.rounded_rectangle((60, 430, W - 60, 560), 22, fill=CARD)
        for x, h in zip(xs, heads): d.text((x, 470), h, font=f(SANS, 42), fill=ACC)
        for k, r in enumerate(rows):
            if lt < 0.5 + k * 1.6: continue
            a = ease((lt - 0.5 - k * 1.6) / 0.4); y = 600 + k * 150
            hl = (k == 3)
            d.rounded_rectangle((60, y, W - 60, y + 120), 22, fill=(40, 56, 40) if hl and lt > 7 else CARD)
            for x, v, col in zip(xs, r, (TXT, GREEN, ORANGE, BLUE)):
                d.text((x, y + 30 + 20 * (1 - a)), v, font=f(MONOB, 54), fill=col)
        if lt > 7:
            centered(d, 1260, "n = 0  →  n7bsou", f(SANS, 52), MUT)

    elif name == "fin":
        a = ease(lt / 0.5)
        centered(d, 520, "Natija", f(SANS, 70), MUT)
        centered(d, 620, "14", f(SANS, int(260 * (0.6 + 0.4 * a))), GREEN)
        centered(d, 960, "5 + 0 + 7 + 2 = 14", f(MONO, 56), TXT)
        if lt > 1.5:
            d.rounded_rectangle((90, 1160, W - 90, 1420), 30, fill=ACC)
            centered(d, 1205, "Pack C S3 b Darija", f(SANS, 58), BG)
            centered(d, 1300, "Link f bio", f(SANS, 50), BG)
        if lt > 2.5:
            centered(d, 1500, "Tab3ni: exercice jdid kol nhar", f(SANSR, 44), TXT)
    return im

out = "/home/claude/video/exercice_c_somme_chiffres.mp4"
p = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
                      "-r", str(FPS), "-i", "-", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo",
                      "-shortest", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", "-preset", "medium",
                      "-c:a", "aac", "-movflags", "+faststart", out], stdin=subprocess.PIPE)
N = int(TOTAL * FPS)
for i in range(N):
    p.stdin.write(frame(i / FPS).tobytes())
p.stdin.close(); p.wait()
for t in (2.8, 7.5, 18, 27, 32): frame(t).resize((360, 640)).save(f"/home/claude/video/apercu_{int(t)}.png")
print(out, TOTAL, "s")
