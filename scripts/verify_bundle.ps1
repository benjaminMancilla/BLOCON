#!/usr/bin/env pwsh
$ErrorActionPreference = "Stop"

$RootDir = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$BundleDir = if ($args.Count -gt 0) { $args[0] } else { Join-Path $RootDir "app/desktop/src-tauri/target/release/bundle" }
$BinName = "api_server"

if (-not (Test-Path $BundleDir)) {
  throw "Bundle directory not found: $BundleDir"
}

# 1) (Opcional) sanity check: existe el sidecar en src-tauri/bin
$SidecarDir = Join-Path $RootDir "app/desktop/src-tauri/bin"
$sidecarMatches = @()
if (Test-Path $SidecarDir) {
  $sidecarMatches += Get-ChildItem -Path $SidecarDir -File -Filter "$BinName*.exe" -ErrorAction SilentlyContinue
}
if (-not $sidecarMatches) {
  Write-Warning "No '$BinName*.exe' found in src-tauri/bin. Bundling may still fail."
} else {
  Write-Host "Sidecar present in src-tauri/bin:"
  $sidecarMatches.FullName | ForEach-Object { Write-Host " - $_" }
}

# 2) Verificar dentro del MSI (Windows)
$msiDir = Join-Path $BundleDir "msi"
$msi = $null
if (Test-Path $msiDir) {
  $msi = Get-ChildItem -Path $msiDir -File -Filter "*.msi" -ErrorAction SilentlyContinue | Select-Object -First 1
}

if (-not $msi) {
  throw "No .msi found under '$msiDir'. Cannot verify bundled sidecar via MSI extraction."
}

$extract = Join-Path $env:TEMP ("blocon_msi_extract_" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $extract | Out-Null

try {
  msiexec /a $msi.FullName /qn TARGETDIR="$extract" | Out-Null

  $matches = Get-ChildItem -Path $extract -Recurse -File -Filter "$BinName*.exe" -ErrorAction SilentlyContinue
  if (-not $matches) {
    throw "Expected backend binary '$BinName*.exe' not found INSIDE MSI after extraction: $($msi.FullName)"
  }

  Write-Host "Backend binary detected inside MSI:"
  $matches.FullName | ForEach-Object { Write-Host " - $_" }
}
finally {
  Remove-Item $extract -Recurse -Force -ErrorAction SilentlyContinue
}