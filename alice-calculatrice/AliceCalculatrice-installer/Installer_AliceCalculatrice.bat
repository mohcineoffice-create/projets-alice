@echo off
setlocal
cd /d "%~dp0"
title Alice Calculatrice - installation
echo.
echo  Alice Calculatrice - installation (une seule fois)
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0installer.ps1"
if errorlevel 1 (
  echo.
  echo  ERREUR : l'installation a echoue. Envoyez une capture de cette fenetre a Claude.
  pause
  exit /b 1
)
