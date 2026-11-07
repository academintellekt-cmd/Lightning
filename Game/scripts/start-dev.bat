@echo off
setlocal EnableExtensions
set "ELECTRON_RUN_AS_NODE="
title Lightning Attraction
cd /d "%~dp0.."

echo [1/5] Checking Node.js...
where node >nul 2>nul
if errorlevel 1 goto :NO_NODE
node --version
call npm --version

echo [2/5] Checking dependencies...
if exist "node_modules\electron\cli.js" goto :RUNTIME
call npm install --include=dev --ignore-scripts=false
if errorlevel 1 goto :ERROR

:RUNTIME
echo [3/5] Checking Electron runtime...
if not exist "node_modules\electron\path.txt" goto :REPAIR_RUNTIME
if exist "node_modules\electron\dist\electron.exe" goto :START

:REPAIR_RUNTIME
set ELECTRON_GET_USE_PROXY=1
call npm rebuild electron --ignore-scripts=false --verbose
if errorlevel 1 goto :ERROR

:START
echo [4/5] Dependencies ready.
echo [5/5] Starting Lightning...
call npm start
set "CODE=%ERRORLEVEL%"
echo.
echo Lightning closed with code %CODE%.
pause
exit /b %CODE%

:NO_NODE
echo ERROR: Node.js was not found.
echo Install Node.js LTS from https://nodejs.org/
pause
exit /b 1

:ERROR
echo.
echo ERROR: Installation or startup failed. See the messages above.
pause
exit /b 1
