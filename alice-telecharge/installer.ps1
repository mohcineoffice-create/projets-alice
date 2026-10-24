$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$src = Split-Path -Parent $MyInvocation.MyCommand.Path
$dest = Join-Path $src 'AliceTelecharge'
$exe = Join-Path $dest 'Alice Telecharge.exe'
$tmp = Join-Path $env:TEMP 'alice_telecharge_install'
New-Item -ItemType Directory -Force -Path $tmp | Out-Null

if (-not (Test-Path $exe)) {
  Write-Host '1/4 Telechargement du moteur (Electron, environ 110 Mo)...'
  $ez = Join-Path $tmp 'electron.zip'
  Invoke-WebRequest -UseBasicParsing -Uri 'https://github.com/electron/electron/releases/download/v31.7.7/electron-v31.7.7-win32-x64.zip' -OutFile $ez
  if ((Get-Item $ez).Length -lt 100MB) { throw 'Telechargement Electron incomplet' }
  Expand-Archive -Force -Path $ez -DestinationPath $dest
  Rename-Item (Join-Path $dest 'electron.exe') 'Alice Telecharge.exe'
  Remove-Item -Force -ErrorAction SilentlyContinue (Join-Path $dest 'resources\default_app.asar')
}

$bin = Join-Path $dest 'resources\bin'
New-Item -ItemType Directory -Force -Path $bin | Out-Null

if (-not (Test-Path (Join-Path $bin 'yt-dlp.exe'))) {
  Write-Host '2/4 Telechargement de yt-dlp...'
  Invoke-WebRequest -UseBasicParsing -Uri 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe' -OutFile (Join-Path $bin 'yt-dlp.exe')
  if ((Get-Item (Join-Path $bin 'yt-dlp.exe')).Length -lt 5MB) { throw 'Telechargement yt-dlp incomplet' }
}

if (-not (Test-Path (Join-Path $bin 'ffmpeg.exe'))) {
  $deja = Join-Path $src '..\AliceMontage-installateur\AliceMontage\resources\bin'
  if (Test-Path (Join-Path $deja 'ffmpeg.exe')) {
    Write-Host '3/4 ffmpeg deja present avec Alice Montage : copie...'
    Copy-Item (Join-Path $deja 'ffmpeg.exe') $bin -Force
    if (Test-Path (Join-Path $deja 'ffprobe.exe')) { Copy-Item (Join-Path $deja 'ffprobe.exe') $bin -Force }
  } else {
    Write-Host '3/4 Telechargement de ffmpeg (environ 200 Mo, patientez)...'
    $fz = Join-Path $tmp 'ffmpeg.zip'
    Invoke-WebRequest -UseBasicParsing -Uri 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip' -OutFile $fz
    if ((Get-Item $fz).Length -lt 50MB) { throw 'Telechargement ffmpeg incomplet' }
    $fx = Join-Path $tmp 'ffmpeg_x'
    if (Test-Path $fx) { Remove-Item -Recurse -Force $fx }
    Expand-Archive -Force -Path $fz -DestinationPath $fx
    foreach ($n in 'ffmpeg.exe','ffprobe.exe') {
      $f = Get-ChildItem -Path $fx -Recurse -Filter $n | Select-Object -First 1
      if (-not $f) { throw "$n introuvable dans l'archive" }
      Copy-Item $f.FullName (Join-Path $bin $n) -Force
    }
  }
}

Write-Host '4/4 Installation des fichiers du programme...'
$app = Join-Path $dest 'resources\app'
if (Test-Path $app) { Remove-Item -Recurse -Force $app }
Copy-Item -Recurse -Force (Join-Path $src 'app') $app

Write-Host 'Termine. Lancement...'
Start-Process $exe
Remove-Item -Recurse -Force -ErrorAction SilentlyContinue $tmp
