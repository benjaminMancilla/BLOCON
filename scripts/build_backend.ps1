#!/usr/bin/env powershell
$ErrorActionPreference = "Stop"

$RootDir = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$PySrc = Join-Path $RootDir "app\api_server.py"
$BinDir = Join-Path $RootDir "app\desktop\src-tauri\bin"
$TempDistDir = Join-Path $RootDir "temp_dist"

if (-not (Test-Path $BinDir)) {
    New-Item -ItemType Directory -Path $BinDir -Force | Out-Null
}

$OutputName = "api_server"

# Verificar PyInstaller
$null = python -m PyInstaller --version 2>&1
if ($LASTEXITCODE -ne 0) {
    throw "PyInstaller is not installed. Run 'python -m pip install pyinstaller' and retry."
}

# Limpiar builds anteriores en bin/ (solo archivos, no directorios)
Write-Host "Cleaning previous builds in bin/..."
Get-ChildItem -Path $BinDir -Filter "api_server*.exe" -File -ErrorAction SilentlyContinue | Remove-Item -Force

# Limpiar directorio temporal
if (Test-Path $TempDistDir) {
    Remove-Item -Path $TempDistDir -Recurse -Force -ErrorAction SilentlyContinue
}

$BuildPath = Join-Path $RootDir "app\build"
$SpecPath = Join-Path $RootDir "app"

if (Test-Path $BuildPath) {
    Remove-Item -Path $BuildPath -Recurse -Force -ErrorAction SilentlyContinue
}

# Eliminar archivos .spec anteriores
Get-ChildItem -Path $SpecPath -Filter "*.spec" -ErrorAction SilentlyContinue | Remove-Item -Force

Write-Host "Building backend with PyInstaller (onefile mode)..."

# Build con PyInstaller en modo ONEFILE
python -m PyInstaller --onefile --name $OutputName --distpath $TempDistDir --workpath $BuildPath --specpath $SpecPath --clean --console $PySrc

if ($LASTEXITCODE -ne 0) {
    throw "PyInstaller failed to build the backend binary."
}

# Verificar si esta el exe
$TempExe = Join-Path $TempDistDir "$OutputName.exe"
if (-not (Test-Path $TempExe)) {
    throw "Expected output file not found: $TempExe"
}

# Obtener el target triple de Rust
$TargetTriple = $null
if (Get-Command rustc -ErrorAction SilentlyContinue) {
    $RustcInfo = rustc -Vv 2>$null
    if ($LASTEXITCODE -eq 0) {
        $HostLine = $RustcInfo | Where-Object { $_ -match "^host:" }
        if ($HostLine) {
            $TargetTriple = $HostLine.ToString().Split(":")[1].Trim()
        }
    }
}

if (-not $TargetTriple) {
    throw "Could not determine Rust target triple. Make sure rustc is in PATH."
}

# Copiar el ejecutable a bin/ directamente
$FinalExe = Join-Path $BinDir "$OutputName.exe"
Copy-Item $TempExe $FinalExe -Force

# Crear copia con el target triple (Tauri)
$TargetExe = Join-Path $BinDir "$OutputName-$TargetTriple.exe"
Copy-Item $TempExe $TargetExe -Force

$FileSize = (Get-Item $FinalExe).Length
$FileSizeMB = [math]::Round($FileSize / 1MB, 2)

Write-Host ""
Write-Host "Backend binary built successfully!" -ForegroundColor Green
Write-Host "  Location: $BinDir"
Write-Host "  Base executable: $OutputName.exe ($FileSizeMB MB)"
Write-Host "  Target executable: $OutputName-$TargetTriple.exe"

# Limpiar directorios temporales
Remove-Item -Path $TempDistDir -Recurse -Force -ErrorAction SilentlyContinue
if (Test-Path $BuildPath) {
    Remove-Item -Path $BuildPath -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "Files in bin/:"
Get-ChildItem -Path $BinDir -Filter "*.exe" | ForEach-Object {
    $Size = [math]::Round($_.Length / 1MB, 2)
    Write-Host "  - $($_.Name) ($Size MB)"
}

Write-Host ""
Write-Host "Build complete!" -ForegroundColor Green
Write-Host "Tauri will use: bin/$OutputName-$TargetTriple.exe"