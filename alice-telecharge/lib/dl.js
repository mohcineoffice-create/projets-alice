// Construction des arguments yt-dlp.
const MODES = {
  max: 'أعلى جودة (فيديو)',
  '1080': 'فيديو 1080p',
  '720': 'فيديو 720p',
  '480': 'فيديو 480p',
  mp3: 'صوت MP3',
};
function formatPour(mode) {
  if (mode === '1080' || mode === '720' || mode === '480')
    return `bv*[height<=${mode}]+ba/b[height<=${mode}]/b`;
  return 'bv*+ba/b';
}
function args({ url, mode, dossier, ffmpegDir, playlist }) {
  const a = ['--newline', '--no-colors', '--progress', '--windows-filenames', '--no-mtime',
    '--progress-template', 'download:PROG|%(progress._percent_str)s|%(progress._speed_str)s|%(progress._eta_str)s',
    '-P', dossier, '-o', mode === 'mp3' ? '%(title).120B [%(id)s] audio.%(ext)s' : '%(title).120B [%(id)s].%(ext)s', playlist ? '--yes-playlist' : '--no-playlist'];
  if (ffmpegDir) a.push('--ffmpeg-location', ffmpegDir);
  if (mode === 'mp3') a.push('-x', '--audio-format', 'mp3', '--audio-quality', '0');
  else a.push('-f', formatPour(mode), '--merge-output-format', 'mp4');
  a.push('--print', 'after_move:FINI|%(filepath)s', '--', url);
  return a;
}
function urlValide(u) { try { const x = new URL(u); return x.protocol === 'http:' || x.protocol === 'https:'; } catch { return false; } }
module.exports = { MODES, args, urlValide };
