@echo off
setlocal
cd /d "%~dp0"

REM ---------------------------
REM 0) Detectar Python
REM ---------------------------
set "PY=py -3"
%PY% -c "import sys" >nul 2>&1
if errorlevel 1 set "PY=python"

%PY% -c "import sys; print(sys.version)" >nul 2>&1
if errorlevel 1 (
  echo [ERROR] No se encontro Python en el PATH.
  echo Instala Python o habilita "Add Python to PATH".
  pause
  exit /b 1
)

REM ---------------------------
REM 1) Verificar wheels/
REM ---------------------------
if not exist "wheels\" (
  echo [ERROR] Falta la carpeta "wheels".
  echo Asegurate de copiar el proyecto completo con sus dependencias offline.
  pause
  exit /b 1
)

REM ---------------------------
REM 2) Crear venv si no existe
REM ---------------------------
if not exist ".venv\Scripts\python.exe" (
  echo Creando entorno virtual...
  %PY% -m venv .venv
  if errorlevel 1 (
    echo [ERROR] No se pudo crear el venv.
    pause
    exit /b 1
  )
)

set "VENV_PY=%CD%\.venv\Scripts\python.exe"

REM Asegurar pip (offline)
"%VENV_PY%" -m ensurepip >nul 2>&1

REM ---------------------------
REM 3) Instalar dependencias OFFLINE
REM ---------------------------
set "LOG=%CD%\run_log.txt"
echo ==== %date% %time% ==== > "%LOG%"

echo Instalando dependencias desde wheels (offline)...
"%VENV_PY%" -m pip install --no-index --find-links "%CD%\wheels" -r requirements.lock.txt
if errorlevel 1 (
  echo [ERROR] Fallo la instalacion offline. Revisa run_log.txt
  type "%LOG%"
  pause
  exit /b 1
)

REM ---------------------------
REM 4) Ejecutar app
REM ---------------------------
echo Ejecutando app...
echo --- RUN main_gui.py --- >> "%LOG%"
"%VENV_PY%" "%CD%\main_gui.py" >> "%LOG%" 2>&1

if errorlevel 1 (
  echo [ERROR] La app termino con error. Revisa run_log.txt
  type "%LOG%"
  pause
  exit /b 1
)

echo OK. (Si no se abrio ventana, el script termino sin levantar GUI)
pause
endlocal
