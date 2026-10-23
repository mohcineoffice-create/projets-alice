#!/bin/sh
# Garde uniquement les binaires Linux x64 (limite de taille des fonctions Vercel).
ORT=node_modules/onnxruntime-node/bin/napi-v6
rm -rf "$ORT/darwin" "$ORT/win32" "$ORT/linux/arm64"
rm -rf node_modules/@img/*darwin* node_modules/@img/*win32* node_modules/@img/*arm* node_modules/@img/*musl* node_modules/@img/*wasm* 2>/dev/null
du -sh node_modules 2>/dev/null || true
