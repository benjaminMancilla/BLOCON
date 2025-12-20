#!/usr/bin/env pwsh
$ErrorActionPreference = "Stop"

$RootDir = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$DesktopDir = Join-Path $RootDir "app/desktop"

& (Join-Path $RootDir "scripts/build_backend.ps1")

Push-Location $DesktopDir
npm install
npm run build
npm run tauri build
Pop-Location

& (Join-Path $RootDir "scripts/verify_bundle.ps1")