@echo off
setlocal
cd /d "%~dp0"
title Studintos - installation
echo.
echo  Studintos - installation (une seule fois)
echo.
if not exist "%~dp0installer.ps1" powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -Force -Path '%~dp0studintos_paquet.zip' -DestinationPath '%~dp0'"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0installer.ps1"
if errorlevel 1 (
  echo.
  echo  ERREUR : l'installation a echoue. Envoyez une capture de cette fenetre a Claude.
  pause
  exit /b 1
)
