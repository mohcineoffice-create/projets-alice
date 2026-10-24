# Alice Montage

Simple desktop video editor (Electron + ffmpeg): cut, split, speed, volume, filters, fade, Arabic/French text and subtitles, background music, export 16:9 / 9:16 / 1:1.
It also opens a local control API on 127.0.0.1 only, protected by a token stored in `%APPDATA%/alice-montage/controle.json`.

- Windows: download `AliceMontage-win.zip` from the Releases page, unzip the whole folder, run `Alice Montage.exe`.
- Or run `Installer_AliceMontage.bat` (downloads Electron and ffmpeg on your PC).
- From source: `npm install` then `npx electron .`.

First version: tested on Linux only, not yet tested on Windows by the author.
