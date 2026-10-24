@echo off
setlocal
cd /d "%~dp0"
title Alice Montage - installation
echo.
echo  Alice Montage - installation (une seule fois, environ 300 Mo a telecharger)
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0installer.ps1"
if errorlevel 1 (
  echo.
  echo  ERREUR : l'installation a echoue. Envoyez une capture de cette fenetre a Claude.
  pause
  exit /b 1
)
