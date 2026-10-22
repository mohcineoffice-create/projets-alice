#!/usr/bin/env python3
"""
Outil de montage vidéo rapide (basé sur ffmpeg).

Utilisation :  python3 montage.py <commande> [options]
Les résultats sont écrits à côté de la vidéo source, dans un dossier « Montage ».

Commandes :
  info        <video>                                   Durée, résolution, images/s, son
  couper      <video> --debut 00:00:05 --fin 00:00:20   Garder un extrait
  assembler   <v1> <v2> [...] [--fondu 0.5]             Mettre plusieurs vidéos bout à bout
  vertical    <video> [--mode flou|recadrer]            Format TikTok / Reels / Shorts (1080x1920)
  musique     <video> <audio> [--volume 0.3] [--sans-son-original]
  texte       <video> "Mon texte" [--position haut|centre|bas] [--debut 0] [--fin 5] [--taille 64]
  soustitres  <video> <fichier.srt>                     Incruster des sous-titres
  vitesse     <video> <facteur>                         1.5 = plus rapide, 0.5 = ralenti
  compresser  <video> [--qualite 28]                    Réduire la taille (23 = très bon, 32 = léger)
  audio       <video>                                   Extraire le son en MP3
  muet        <video>                                   Supprimer le son
  miniature   <video> [--temps 00:00:03]                Image JPG pour la miniature
  logo        <video> <image.png> [--coin haut-droite|haut-gauche|bas-droite|bas-gauche] [--largeur 180]
  gif         <video> [--debut 0] [--duree 4]
"""
import argparse, json, os, subprocess, sys, tempfile

FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
V_ENC = ["-c:v", "libx264", "-preset", "veryfast", "-crf", "21", "-pix_fmt", "yuv420p"]
A_ENC = ["-c:a", "aac", "-b:a", "160k"]


def run(cmd):
    print("→", " ".join(cmd[:3]), "…", flush=True)
    r = subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True)
    if r.returncode != 0:
        sys.exit("Erreur ffmpeg :\n" + r.stderr[-1500:])


def probe(path):
    r = subprocess.run(["ffprobe", "-v", "error", "-print_format", "json", "-show_format", "-show_streams", path],
                       capture_output=True, text=True)
    if r.returncode != 0:
        sys.exit(f"Impossible de lire : {path}")
    return json.loads(r.stdout)


def has_audio(path):
    return any(s["codec_type"] == "audio" for s in probe(path)["streams"])


def duration(path):
    return float(probe(path)["format"]["duration"])


def out_path(src, suffix, ext=None):
    d = os.path.dirname(os.path.abspath(src))
    if os.path.basename(d) != "Montage":
        d = os.path.join(d, "Montage")
    os.makedirs(d, exist_ok=True)
    base, e = os.path.splitext(os.path.basename(src))
    p = os.path.join(d, f"{base}_{suffix}{ext or e}")
    n = 2
    while os.path.exists(p):
        p = os.path.join(d, f"{base}_{suffix}_{n}{ext or e}"); n += 1
    return p


def done(p):
    print("OK :", p)


# ------------------------------------------------------------------ commandes
def c_info(a):
    info = probe(a.video)
    v = next((s for s in info["streams"] if s["codec_type"] == "video"), None)
    print(f"Fichier   : {a.video}")
    print(f"Durée     : {float(info['format']['duration']):.1f} s")
    print(f"Taille    : {int(info['format']['size']) / 1048576:.1f} Mo")
    if v:
        num, den = (v.get("r_frame_rate", "0/1").split("/") + ["1"])[:2]
        print(f"Image     : {v['width']}x{v['height']}, {float(num) / float(den or 1):.0f} images/s, {v['codec_name']}")
    print(f"Son       : {'oui' if has_audio(a.video) else 'non'}")


def c_couper(a):
    o = out_path(a.video, "extrait")
    cmd = ["ffmpeg", "-y", "-i", a.video, "-ss", a.debut]
    if a.fin: cmd += ["-to", a.fin]
    run(cmd + V_ENC + A_ENC + [o]); done(o)


def c_assembler(a):
    vids = a.videos
    v0 = next(s for s in probe(vids[0])["streams"] if s["codec_type"] == "video")
    W, H = v0["width"] - v0["width"] % 2, v0["height"] - v0["height"] % 2
    o = out_path(vids[0], "assemblage")
    cmd = ["ffmpeg", "-y"]
    for v in vids: cmd += ["-i", v]
    parts, n = [], len(vids)
    for i, v in enumerate(vids):
        parts.append(f"[{i}:v]scale={W}:{H}:force_original_aspect_ratio=decrease,pad={W}:{H}:(ow-iw)/2:(oh-ih)/2,"
                     f"setsar=1,fps=30,format=yuv420p[v{i}]")
        if has_audio(v):
            parts.append(f"[{i}:a]aresample=44100,aformat=channel_layouts=stereo[a{i}]")
        else:
            parts.append(f"anullsrc=r=44100:cl=stereo,atrim=0:{duration(v)}[a{i}]")
    if a.fondu and n > 1:
        f = a.fondu; acc = duration(vids[0]); lv, la = "[v0]", "[a0]"
        for i in range(1, n):
            off = max(acc - f, 0)
            parts.append(f"{lv}[v{i}]xfade=transition=fade:duration={f}:offset={off}[x{i}]")
            parts.append(f"{la}[a{i}]acrossfade=d={f}[y{i}]")
            lv, la = f"[x{i}]", f"[y{i}]"; acc = off + duration(vids[i])
        maps = ["-map", lv, "-map", la]
    else:
        parts.append("".join(f"[v{i}][a{i}]" for i in range(n)) + f"concat=n={n}:v=1:a=1[vo][ao]")
        maps = ["-map", "[vo]", "-map", "[ao]"]
    run(cmd + ["-filter_complex", ";".join(parts)] + maps + V_ENC + A_ENC + [o]); done(o)


def c_vertical(a):
    o = out_path(a.video, "vertical")
    if a.mode == "recadrer":
        vf = "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1"
        cmd = ["ffmpeg", "-y", "-i", a.video, "-vf", vf]
    else:
        fc = ("[0:v]split[a][b];[a]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=25:2[bg];"
              "[b]scale=1080:1920:force_original_aspect_ratio=decrease[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2,setsar=1[v]")
        cmd = ["ffmpeg", "-y", "-i", a.video, "-filter_complex", fc, "-map", "[v]", "-map", "0:a?"]
    run(cmd + V_ENC + A_ENC + [o]); done(o)


def c_musique(a):
    o = out_path(a.video, "musique")
    d = duration(a.video)
    if has_audio(a.video) and not a.sans_son_original:
        fc = (f"[1:a]volume={a.volume},aloop=loop=-1:size=2e9,atrim=0:{d},afade=t=out:st={max(d - 2, 0)}:d=2[m];"
              f"[0:a][m]amix=inputs=2:duration=first:dropout_transition=0[ao]")
    else:
        fc = f"[1:a]volume={a.volume},aloop=loop=-1:size=2e9,atrim=0:{d},afade=t=out:st={max(d - 2, 0)}:d=2[ao]"
    run(["ffmpeg", "-y", "-i", a.video, "-i", a.audio, "-filter_complex", fc, "-map", "0:v", "-map", "[ao]",
         "-c:v", "copy"] + A_ENC + ["-shortest", o]); done(o)


def c_texte(a):
    o = out_path(a.video, "texte")
    y = {"haut": "h*0.08", "centre": "(h-text_h)/2", "bas": "h*0.85-text_h"}[a.position]
    en = f":enable='between(t,{a.debut},{a.fin})'" if a.fin else ""
    with tempfile.TemporaryDirectory() as td:
        tf = os.path.join(td, "texte.txt")
        with open(tf, "w", encoding="utf-8") as fh: fh.write(a.texte)
        vf = (f"drawtext=fontfile={FONT}:textfile={tf}:expansion=none:fontsize={a.taille}:fontcolor=white:"
              f"borderw=4:bordercolor=black@0.8:box=1:boxcolor=black@0.35:boxborderw=18:x=(w-text_w)/2:y={y}{en}")
        run(["ffmpeg", "-y", "-i", a.video, "-vf", vf] + V_ENC + ["-c:a", "copy", o])
    done(o)


def c_soustitres(a):
    o = out_path(a.video, "soustitres")
    with tempfile.TemporaryDirectory() as td:
        srt = os.path.join(td, "s.srt")
        with open(a.srt, "rb") as fi, open(srt, "wb") as fo: fo.write(fi.read())
        style = "FontName=DejaVu Sans,FontSize=16,Bold=1,Outline=2,BorderStyle=1,MarginV=60"
        run(["ffmpeg", "-y", "-i", a.video, "-vf", f"subtitles={srt}:force_style='{style}'"] + V_ENC + ["-c:a", "copy", o])
    done(o)


def c_vitesse(a):
    o = out_path(a.video, f"x{a.facteur}")
    f = a.facteur
    at, r = [], f
    while r > 2.0: at.append("atempo=2.0"); r /= 2.0
    while r < 0.5: at.append("atempo=0.5"); r /= 0.5
    at.append(f"atempo={r}")
    cmd = ["ffmpeg", "-y", "-i", a.video, "-vf", f"setpts=PTS/{f}"]
    if has_audio(a.video): cmd += ["-af", ",".join(at)] + A_ENC
    run(cmd + V_ENC + [o]); done(o)


def c_compresser(a):
    o = out_path(a.video, "leger", ".mp4")
    run(["ffmpeg", "-y", "-i", a.video, "-c:v", "libx264", "-preset", "medium", "-crf", str(a.qualite),
         "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", o])
    av, ap = os.path.getsize(a.video), os.path.getsize(o)
    print(f"{av / 1048576:.1f} Mo → {ap / 1048576:.1f} Mo ({100 - 100 * ap / av:.0f} % de moins)"); done(o)


def c_audio(a):
    o = out_path(a.video, "son", ".mp3")
    run(["ffmpeg", "-y", "-i", a.video, "-vn", "-c:a", "libmp3lame", "-q:a", "2", o]); done(o)


def c_muet(a):
    o = out_path(a.video, "muet")
    run(["ffmpeg", "-y", "-i", a.video, "-an", "-c:v", "copy", o]); done(o)


def c_miniature(a):
    o = out_path(a.video, "miniature", ".jpg")
    run(["ffmpeg", "-y", "-ss", a.temps, "-i", a.video, "-frames:v", "1", "-q:v", "2", o]); done(o)


def c_logo(a):
    o = out_path(a.video, "logo")
    pos = {"haut-droite": "W-w-30:30", "haut-gauche": "30:30", "bas-droite": "W-w-30:H-h-30", "bas-gauche": "30:H-h-30"}[a.coin]
    fc = f"[1:v]scale={a.largeur}:-1,format=rgba,colorchannelmixer=aa=0.9[l];[0:v][l]overlay={pos}[v]"
    run(["ffmpeg", "-y", "-i", a.video, "-i", a.image, "-filter_complex", fc, "-map", "[v]", "-map", "0:a?"]
        + V_ENC + ["-c:a", "copy", o]); done(o)


def c_gif(a):
    o = out_path(a.video, "anim", ".gif")
    fc = "fps=12,scale=480:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse"
    run(["ffmpeg", "-y", "-ss", str(a.debut), "-t", str(a.duree), "-i", a.video, "-vf", fc, o]); done(o)


def main():
    p = argparse.ArgumentParser(description="Outil de montage vidéo rapide (ffmpeg)")
    s = p.add_subparsers(dest="cmd", required=True)
    x = s.add_parser("info"); x.add_argument("video"); x.set_defaults(fn=c_info)
    x = s.add_parser("couper"); x.add_argument("video"); x.add_argument("--debut", default="0"); x.add_argument("--fin"); x.set_defaults(fn=c_couper)
    x = s.add_parser("assembler"); x.add_argument("videos", nargs="+"); x.add_argument("--fondu", type=float, default=0); x.set_defaults(fn=c_assembler)
    x = s.add_parser("vertical"); x.add_argument("video"); x.add_argument("--mode", choices=["flou", "recadrer"], default="flou"); x.set_defaults(fn=c_vertical)
    x = s.add_parser("musique"); x.add_argument("video"); x.add_argument("audio"); x.add_argument("--volume", type=float, default=0.3)
    x.add_argument("--sans-son-original", action="store_true"); x.set_defaults(fn=c_musique)
    x = s.add_parser("texte"); x.add_argument("video"); x.add_argument("texte"); x.add_argument("--position", choices=["haut", "centre", "bas"], default="bas")
    x.add_argument("--debut", type=float, default=0); x.add_argument("--fin", type=float); x.add_argument("--taille", type=int, default=64); x.set_defaults(fn=c_texte)
    x = s.add_parser("soustitres"); x.add_argument("video"); x.add_argument("srt"); x.set_defaults(fn=c_soustitres)
    x = s.add_parser("vitesse"); x.add_argument("video"); x.add_argument("facteur", type=float); x.set_defaults(fn=c_vitesse)
    x = s.add_parser("compresser"); x.add_argument("video"); x.add_argument("--qualite", type=int, default=28); x.set_defaults(fn=c_compresser)
    x = s.add_parser("audio"); x.add_argument("video"); x.set_defaults(fn=c_audio)
    x = s.add_parser("muet"); x.add_argument("video"); x.set_defaults(fn=c_muet)
    x = s.add_parser("miniature"); x.add_argument("video"); x.add_argument("--temps", default="00:00:03"); x.set_defaults(fn=c_miniature)
    x = s.add_parser("logo"); x.add_argument("video"); x.add_argument("image")
    x.add_argument("--coin", choices=["haut-droite", "haut-gauche", "bas-droite", "bas-gauche"], default="haut-droite")
    x.add_argument("--largeur", type=int, default=180); x.set_defaults(fn=c_logo)
    x = s.add_parser("gif"); x.add_argument("video"); x.add_argument("--debut", type=float, default=0); x.add_argument("--duree", type=float, default=4); x.set_defaults(fn=c_gif)
    a = p.parse_args()
    for k in ("video", "audio", "srt", "image"):
        if getattr(a, k, None) and not os.path.isfile(getattr(a, k)):
            sys.exit(f"Fichier introuvable : {getattr(a, k)}")
    for v in getattr(a, "videos", []) or []:
        if not os.path.isfile(v): sys.exit(f"Fichier introuvable : {v}")
    a.fn(a)


if __name__ == "__main__":
    main()
