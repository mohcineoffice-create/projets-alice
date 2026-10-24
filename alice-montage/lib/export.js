// Construit et lance la commande ffmpeg a partir du projet de montage.
const { spawn } = require('child_process');

const FILTRES = {
  aucun: '',
  noir_blanc: 'hue=s=0',
  vif: 'eq=saturation=1.6:contrast=1.1',
  chaud: 'colorbalance=rs=0.12:gs=0.02:bs=-0.15,eq=saturation=1.15',
  froid: 'colorbalance=rs=-0.12:bs=0.15,eq=saturation=1.05',
  vintage: 'curves=preset=vintage',
  flou: 'boxblur=6:2',
  lumineux: 'eq=brightness=0.08:contrast=1.05',
  contraste: 'eq=contrast=1.3:saturation=1.1',
};

function tailleSortie(format, qualite) {
  const c = qualite === '1080' ? 1080 : 720;
  if (format === '9:16') return [c, Math.round(c * 16 / 9 / 2) * 2];
  if (format === '1:1') return [c, c];
  return [Math.round(c * 16 / 9 / 2) * 2, c];
}

function atempoChaine(v) {
  const p = []; let x = v;
  while (x > 2) { p.push('atempo=2.0'); x /= 2; }
  while (x < 0.5) { p.push('atempo=0.5'); x /= 0.5; }
  p.push('atempo=' + x.toFixed(4));
  return p.join(',');
}

function dureeClip(c) { return Math.max(0.05, (c.fin - c.debut) / c.vitesse); }
function dureeTotale(clips) { return clips.reduce((s, c) => s + dureeClip(c), 0); }

function construire(projet, overlays, sortie) {
  const clips = projet.clips;
  if (!clips.length) throw new Error('Aucun clip dans la timeline');
  const [W, H] = tailleSortie(projet.format, projet.qualite);
  const total = dureeTotale(clips);
  const args = ['-y', '-hide_banner'];
  const f = [];
  clips.forEach(c => args.push('-i', c.chemin));
  const nOv = overlays.length;
  overlays.forEach(o => args.push('-i', o.png));
  const hasMusic = !!(projet.musique && projet.musique.chemin);
  if (hasMusic) args.push('-stream_loop', '-1', '-i', projet.musique.chemin);

  clips.forEach((c, i) => {
    const d = dureeClip(c);
    const ajuste = c.ajuster === 'ajuster';
    let v = `[${i}:v]trim=start=${c.debut}:end=${c.fin},setpts=(PTS-STARTPTS)/${c.vitesse},`;
    v += ajuste
      ? `scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:black,`
      : `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},`;
    v += 'setsar=1,fps=30,';
    if (FILTRES[c.filtre]) v += FILTRES[c.filtre] + ',';
    if (c.fondu) v += `fade=t=in:st=0:d=0.4,fade=t=out:st=${Math.max(0, d - 0.4).toFixed(3)}:d=0.4,`;
    v += `format=yuv420p[v${i}]`;
    f.push(v);
    let a;
    if (c.audio) {
      a = `[${i}:a]atrim=start=${c.debut}:end=${c.fin},asetpts=PTS-STARTPTS,${atempoChaine(c.vitesse)},volume=${c.volume}`;
      if (c.fondu) a += `,afade=t=in:st=0:d=0.4,afade=t=out:st=${Math.max(0, d - 0.4).toFixed(3)}:d=0.4`;
      a += `,aresample=44100,aformat=sample_fmts=fltp:channel_layouts=stereo[a${i}]`;
    } else {
      a = `anullsrc=r=44100:cl=stereo,atrim=duration=${d.toFixed(3)},asetpts=PTS-STARTPTS[a${i}]`;
    }
    f.push(a);
  });
  f.push(clips.map((_, i) => `[v${i}][a${i}]`).join('') + `concat=n=${clips.length}:v=1:a=1[vc][ac]`);
  let vlast = 'vc';
  overlays.forEach((o, k) => {
    const idx = clips.length + k;
    f.push(`[${idx}:v]format=rgba[o${k}]`);
    f.push(`[${vlast}][o${k}]overlay=0:0:format=auto:enable='between(t,${o.debut},${o.fin})'[vo${k}]`);
    vlast = `vo${k}`;
  });
  let alast = 'ac';
  if (hasMusic) {
    const mi = clips.length + nOv;
    const mv = projet.musique.volume ?? 0.3;
    f.push(`[${mi}:a]atrim=duration=${total.toFixed(3)},asetpts=PTS-STARTPTS,volume=${mv},afade=t=out:st=${Math.max(0, total - 1.5).toFixed(3)}:d=1.5,aresample=44100,aformat=sample_fmts=fltp:channel_layouts=stereo[mus]`);
    f.push(`[ac][mus]amix=inputs=2:duration=first:dropout_transition=0,volume=2,alimiter=limit=0.95[am]`);
    alast = 'am';
  }
  args.push('-filter_complex', f.join(';'), '-map', `[${vlast}]`, '-map', `[${alast}]`,
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-t', total.toFixed(3), sortie);
  return { args, total, W, H };
}

function lancer(ffmpeg, projet, overlays, sortie, onProgress) {
  return new Promise((resolve, reject) => {
    let b;
    try { b = construire(projet, overlays, sortie); } catch (e) { return reject(e); }
    const p = spawn(ffmpeg, b.args);
    let err = '';
    p.stderr.on('data', d => {
      const s = d.toString(); err += s; if (err.length > 20000) err = err.slice(-20000);
      const m = /time=(\d+):(\d+):(\d+\.\d+)/.exec(s);
      if (m && onProgress) onProgress(Math.min(1, (+m[1] * 3600 + +m[2] * 60 + +m[3]) / b.total));
    });
    p.on('error', reject);
    p.on('close', code => code === 0 ? resolve({ sortie, duree: b.total, taille: [b.W, b.H] })
      : reject(new Error('ffmpeg a echoue (code ' + code + ') : ' + err.slice(-800))));
  });
}

module.exports = { construire, lancer, dureeClip, dureeTotale, tailleSortie, FILTRES };
