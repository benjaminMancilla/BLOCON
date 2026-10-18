# BLOCON

App de escritorio: Tauri 1 (Rust) + React/Vite (`app/desktop`) + backend HTTP en Python (`app/src`, puerto 8000).
En producción el backend va empaquetado con PyInstaller como sidecar (`api_server`) que Tauri lanza al iniciar.

## Requisitos

- Python 3.12
- Node 20
- Rust estable + Visual Studio Build Tools ("Desktop development with C++")
- WebView2 (incluido en Windows 11)

## Setup

```powershell
python -m venv .venv; .venv\Scripts\activate
pip install -r requirements.txt

# Sidecar: Tauri exige src-tauri/bin/api_server-<target>.exe para compilar, incluso en dev
.\scripts\build_backend.ps1

cd app\desktop; npm ci
```

Copiar `app/.env` (credenciales SharePoint, no versionado). Plantilla: `app/.env.example`.

## Desarrollo

```powershell
# Terminal 1 — backend en vivo
cd app; python run_server.py
# Terminal 2 — frontend
cd app\desktop; npm run tauri dev
```

Si al arrancar hay un backend respondiendo en :8000, Tauri lo usa; si no, lanza el sidecar compilado (puede estar desactualizado).

## Tests

```powershell
pytest -q
```

## Build del instalador

```powershell
.\scripts\build_desktop.ps1
```
