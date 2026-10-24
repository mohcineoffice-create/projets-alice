$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$src = Split-Path -Parent $MyInvocation.MyCommand.Path
$dest = Join-Path $src 'AliceCalculatrice'
$exe = Join-Path $dest 'Alice Calculatrice.exe'
$tmp = Join-Path $env:TEMP 'alice_calc_install'
New-Item -ItemType Directory -Force -Path $tmp | Out-Null

# 1) Electron : on reutilise celui d'une autre application Alice deja installee (evite 110 Mo)
if (-not (Test-Path $exe)) {
  $voisins = @('..\AliceTelecharge-installateur\AliceTelecharge', '..\AliceMontage-installateur\AliceMontage', '..\AliceTelecharge-installer\AliceTelecharge', '..\AliceMontage-installer\AliceMontage')
  $trouve = $null
  foreach ($v in $voisins) { $p = Join-Path $src $v; if (Test-Path (Join-Path $p 'resources')) { $trouve = $p; break } }
  if ($trouve) {
    Write-Host '1/3 Moteur Electron deja present avec une autre application Alice : copie locale...'
    New-Item -ItemType Directory -Force -Path $dest | Out-Null
    Get-ChildItem -Path $trouve -Force | Where-Object { $_.Name -ne 'resources' } | ForEach-Object { Copy-Item -Recurse -Force $_.FullName $dest }
    $res = Join-Path $dest 'resources'; New-Item -ItemType Directory -Force -Path $res | Out-Null
    Get-ChildItem -Path (Join-Path $trouve 'resources') -Force | Where-Object { $_.Name -notin @('app', 'bin') } | ForEach-Object { Copy-Item -Recurse -Force $_.FullName $res }
    $autre = Get-ChildItem -Path $dest -Filter 'Alice *.exe' | Select-Object -First 1
    if ($autre) { Rename-Item $autre.FullName 'Alice Calculatrice.exe' }
  } else {
    Write-Host '1/3 Telechargement du moteur (Electron, environ 110 Mo)...'
    $ez = Join-Path $tmp 'electron.zip'
    Invoke-WebRequest -UseBasicParsing -Uri 'https://github.com/electron/electron/releases/download/v31.7.7/electron-v31.7.7-win32-x64.zip' -OutFile $ez
    if ((Get-Item $ez).Length -lt 100MB) { throw 'Telechargement Electron incomplet' }
    Expand-Archive -Force -Path $ez -DestinationPath $dest
    Rename-Item (Join-Path $dest 'electron.exe') 'Alice Calculatrice.exe'
  }
  Remove-Item -Force -ErrorAction SilentlyContinue (Join-Path $dest 'resources\default_app.asar')
}
if (-not (Test-Path $exe)) { throw "Alice Calculatrice.exe introuvable apres la copie" }

# 2) fichiers du programme (petits)
Write-Host '2/3 Installation des fichiers du programme...'
$app = Join-Path $dest 'resources\app'
if (Test-Path $app) { Remove-Item -Recurse -Force $app }
Copy-Item -Recurse -Force (Join-Path $src 'app') $app

# 3) Pyodide (npm) + sympy/mpmath (PyPI) : environ 25 Mo en tout
Write-Host '3/3 Telechargement du moteur de calcul (Pyodide + SymPy, environ 25 Mo)...'
$pyd = Join-Path $app 'node_modules\pyodide'
New-Item -ItemType Directory -Force -Path $pyd | Out-Null
$tgz = Join-Path $tmp 'pyodide.tgz'
Invoke-WebRequest -UseBasicParsing -Uri 'https://registry.npmjs.org/pyodide/-/pyodide-0.27.7.tgz' -OutFile $tgz
if ((Get-Item $tgz).Length -lt 5MB) { throw 'Telechargement Pyodide incomplet' }
$px = Join-Path $tmp 'pyodide_x'
if (Test-Path $px) { Remove-Item -Recurse -Force $px }
New-Item -ItemType Directory -Force -Path $px | Out-Null
tar -xzf $tgz -C $px
if ($LASTEXITCODE -ne 0) { throw 'Extraction de Pyodide impossible (tar)' }
Copy-Item -Recurse -Force (Join-Path $px 'package\*') $pyd
$wh = Join-Path $app 'wheels'
New-Item -ItemType Directory -Force -Path $wh | Out-Null
foreach ($pk in @(@('sympy', '1.14.0'), @('mpmath', '1.3.0'))) {
  $j = Invoke-RestMethod -UseBasicParsing -Uri ("https://pypi.org/pypi/{0}/{1}/json" -f $pk[0], $pk[1])
  $u = $j.urls | Where-Object { $_.packagetype -eq 'bdist_wheel' } | Select-Object -First 1
  if (-not $u) { throw "Roue introuvable pour $($pk[0])" }
  Invoke-WebRequest -UseBasicParsing -Uri $u.url -OutFile (Join-Path $wh $u.filename)
}
if ((Get-ChildItem $wh).Count -lt 2) { throw 'Roues Python manquantes' }

Write-Host 'Termine. Lancement...'
Start-Process $exe
Remove-Item -Recurse -Force -ErrorAction SilentlyContinue $tmp
