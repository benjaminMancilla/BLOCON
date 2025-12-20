#!/usr/bin/env pwsh
$ErrorActionPreference = "Stop"

$RootDir = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$PySrc = Join-Path $RootDir "app/api_server.py"
$OutputDir = Join-Path $RootDir "app/desktop/src-tauri/bin"

New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null

$OutputName = "api_server"
$TargetTriple = $null
try {
    $RustcInfo = & rustc -Vv 2>$null
    $TargetTriple = ($RustcInfo | Select-String -Pattern "^host:").ToString().Split(":")[1].Trim()
} catch {
    $TargetTriple = $null
}

if ($TargetTriple) {
    $OutputName = "api_server-$TargetTriple"
}

python -m PyInstaller --version *> $null
if ($LASTEXITCODE -ne 0) {
    throw "PyInstaller is not installed. Run 'python -m pip install pyinstaller' and retry."
}

python -m PyInstaller --onefile --name $OutputName --distpath $OutputDir $PySrc
if ($LASTEXITCODE -ne 0) {
    throw "PyInstaller failed to build the backend binary."
}

Write-Host "Backend binary written to $OutputDir"