@echo off
setlocal enableextensions

REM Run from repo root regardless of where launched.
cd /d "%~dp0"

echo =========================================
echo PostByteCL - Full Start (Flask + React)
echo =========================================

REM -------------------------
REM Backend (Flask)
REM -------------------------
set "BACKEND_VENV=%CD%\backend\.venv"
set "PY=%BACKEND_VENV%\Scripts\python.exe"

if not exist "%PY%" (
  echo [backend] Creating venv...
  py -3 -m venv "%BACKEND_VENV%" 2>nul
  if errorlevel 1 (
    python -m venv "%BACKEND_VENV%"
  )
)

echo [backend] Installing requirements...
"%PY%" -m pip install -r "%CD%\backend\requirements.txt" || goto :error

REM Optional: set an admin key for report listing / delete endpoints.
if "%ADMIN_KEY%"=="" (
  set "ADMIN_KEY=change-me"
)

REM Avoid duplicate Flask servers on the same port.
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 5000 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { try { Stop-Process -Id $_ -Force -ErrorAction Stop } catch {} }" >nul 2>nul

echo [backend] Starting Flask on http://127.0.0.1:5000 ...
start "PostByteCL Backend (Flask)" cmd /k ^
  "cd /d %CD% && set ADMIN_KEY=%ADMIN_KEY% && %PY% -m flask --app backend.app run --debug --port 5000"

REM -------------------------
REM Frontend (Vite/React)
REM -------------------------
where npm >nul 2>nul
if errorlevel 1 (
  echo.
  echo [frontend] npm not found. Install Node.js to run the React dev server.
  echo [frontend] Backend is still running in a separate window.
  goto :done
)

echo [frontend] Installing dependencies (first run only may take a bit)...
start "PostByteCL Frontend (Vite)" cmd /k ^
  "cd /d %CD% && npm install && set VITE_API_BASE=http://localhost:5000 && npm run dev"

:done
echo.
echo Started. Close the opened windows to stop servers.
exit /b 0

:error
echo.
echo Failed. See errors above.
exit /b 1

