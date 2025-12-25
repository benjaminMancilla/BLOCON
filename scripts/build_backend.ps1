#!/usr/bin/env pwsh
$ErrorActionPreference = "Stop"

$RootDir = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$PySrc = Join-Path $RootDir "app/api_server.py"
$OutputDir = Join-Path $RootDir "app/desktop/src-tauri/bin"

New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null

$OutputName = "api_server"

python -m PyInstaller --version *> $null
if ($LASTEXITCODE -ne 0) {
    throw "PyInstaller is not installed. Run 'python -m pip install pyinstaller' and retry."
}

$DistPath = Join-Path $RootDir "app/desktop/src-tauri/bin"
if (Test-Path $DistPath) {
    Get-ChildItem -Path $DistPath -Filter "api_server*" | Remove-Item -Force -ErrorAction SilentlyContinue
    Write-Host "Cleaned previous builds in $DistPath"
}

$BuildPath = Join-Path $RootDir "app/build"
$SpecPath = Join-Path $RootDir "app"

if (Test-Path $BuildPath) {
    Remove-Item -Path $BuildPath -Recurse -Force -ErrorAction SilentlyContinue
}

python -m PyInstaller `
    --onefile `
    --name $OutputName `
    --distpath $OutputDir `
    --workpath $BuildPath `
    --specpath $SpecPath `
    --clean `
    $PySrc

if ($LASTEXITCODE -ne 0) {
    throw "PyInstaller failed to build the backend binary."
}

$ExpectedExe = Join-Path $OutputDir "$OutputName.exe"
if (-not (Test-Path $ExpectedExe)) {
    throw "Expected output file not found: $ExpectedExe"
}

Write-Host "Backend binary written to $OutputDir"
Write-Host "Generated: $OutputName.exe"

Write-Host "`nFiles in output directory:"
Get-ChildItem -Path $OutputDir -Filter "api_server*" | ForEach-Object {
    Write-Host "  - $($_.Name) ($([math]::Round($_.Length / 1KB, 2)) KB)"
}

$triple = (rustc -Vv | Select-String '^host:' ).ToString().Split(':')[1].Trim()

$src = Join-Path $OutputDir "api_server.exe"
$dst = Join-Path $OutputDir ("api_server-{0}.exe" -f $triple)

Copy-Item $src $dst -Force
Write-Host "Copied: $(Split-Path $dst -Leaf)"