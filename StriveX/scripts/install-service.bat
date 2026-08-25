@echo off
setlocal EnableDelayedExpansion

:: ============================================================
:: install-service.bat — Register StrivexGateway as a Windows
:: service using NSSM (Non-Sucking Service Manager).
::
:: Must be run as Administrator.
:: ============================================================

:: --- Admin check ---
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [ERROR] This script must be run as Administrator.
    echo         Right-click the file and choose "Run as administrator".
    pause
    exit /b 1
)

:: --- Locate the repo root (parent of the scripts\ folder) ---
set "SCRIPT_DIR=%~dp0"
set "REPO_ROOT=%SCRIPT_DIR%.."

:: Resolve to an absolute path
pushd "%REPO_ROOT%"
set "REPO_ROOT=%CD%"
popd

set "GATEWAY_DIR=%REPO_ROOT%\gateway"
set "ENTRY_POINT=%GATEWAY_DIR%\src\index.js"
set "LOG_DIR=%REPO_ROOT%\logs"
set "SERVICE_NAME=StrivexGateway"

echo.
echo ============================================================
echo  Strivex Gateway — Service Installer
echo ============================================================
echo  Repo root  : %REPO_ROOT%
echo  Gateway dir: %GATEWAY_DIR%
echo  Entry point: %ENTRY_POINT%
echo  Log dir    : %LOG_DIR%
echo ============================================================
echo.

:: --- Verify gateway entry point exists ---
if not exist "%ENTRY_POINT%" (
    echo [ERROR] Entry point not found: %ENTRY_POINT%
    echo         Make sure you are running this script from the Strivex repo.
    pause
    exit /b 1
)

:: --- Locate NSSM ---
set "NSSM="

:: 1) Check PATH
where nssm >nul 2>&1
if %errorLevel% equ 0 (
    set "NSSM=nssm"
    goto :found_nssm
)

:: 2) Common installation paths
for %%P in (
    "C:\nssm\win64\nssm.exe"
    "C:\nssm\nssm.exe"
    "C:\tools\nssm\nssm.exe"
    "C:\ProgramData\chocolatey\bin\nssm.exe"
    "%ProgramFiles%\nssm\nssm.exe"
    "%ProgramFiles(x86)%\nssm\nssm.exe"
) do (
    if exist %%P (
        set "NSSM=%%~P"
        goto :found_nssm
    )
)

echo [ERROR] NSSM not found.
echo.
echo  Install NSSM via one of:
echo    choco install nssm          (Chocolatey)
echo    scoop install nssm          (Scoop)
echo    https://nssm.cc/download    (manual)
echo.
echo  Then ensure nssm.exe is on your PATH and re-run this script.
pause
exit /b 1

:found_nssm
echo [OK] NSSM found: %NSSM%

:: --- Locate Node.js ---
where node >nul 2>&1
if %errorLevel% neq 0 (
    echo [ERROR] node.exe not found on PATH.
    echo         Install Node.js from https://nodejs.org and re-run this script.
    pause
    exit /b 1
)
for /f "delims=" %%N in ('where node') do set "NODE_EXE=%%N"
echo [OK] Node.js found: %NODE_EXE%

:: --- Create log directory ---
if not exist "%LOG_DIR%" (
    mkdir "%LOG_DIR%"
    echo [OK] Created log directory: %LOG_DIR%
)

:: --- Remove stale service if present ---
"%NSSM%" status %SERVICE_NAME% >nul 2>&1
if %errorLevel% equ 0 (
    echo [INFO] Existing service found — stopping and removing it first...
    "%NSSM%" stop %SERVICE_NAME% confirm >nul 2>&1
    "%NSSM%" remove %SERVICE_NAME% confirm
    if %errorLevel% neq 0 (
        echo [ERROR] Failed to remove existing service.
        pause
        exit /b 1
    )
    echo [OK] Existing service removed.
)

:: --- Install the service ---
echo.
echo [INFO] Installing service "%SERVICE_NAME%"...
"%NSSM%" install %SERVICE_NAME% "%NODE_EXE%" "%ENTRY_POINT%"
if %errorLevel% neq 0 (
    echo [ERROR] NSSM install failed.
    pause
    exit /b 1
)

:: --- Configure service parameters ---
"%NSSM%" set %SERVICE_NAME% AppDirectory        "%GATEWAY_DIR%"
"%NSSM%" set %SERVICE_NAME% AppStdout           "%LOG_DIR%\gateway-stdout.log"
"%NSSM%" set %SERVICE_NAME% AppStderr           "%LOG_DIR%\gateway-stderr.log"
"%NSSM%" set %SERVICE_NAME% AppStdoutCreationDisposition 4
"%NSSM%" set %SERVICE_NAME% AppStderrCreationDisposition 4
"%NSSM%" set %SERVICE_NAME% AppRotateFiles      1
"%NSSM%" set %SERVICE_NAME% AppRotateOnline     1
"%NSSM%" set %SERVICE_NAME% AppRotateBytes      10485760
"%NSSM%" set %SERVICE_NAME% Start               SERVICE_AUTO_START
"%NSSM%" set %SERVICE_NAME% DisplayName         "Strivex Station Gateway"
"%NSSM%" set %SERVICE_NAME% Description         "Strivex station gateway — manages NFC tap flow and hardware adapter"

:: --- Start the service ---
echo.
echo [INFO] Starting service...
"%NSSM%" start %SERVICE_NAME%
if %errorLevel% neq 0 (
    echo [WARN] Service installed but failed to start. Check the logs:
    echo        %LOG_DIR%\gateway-stderr.log
    echo.
    echo        Also verify that gateway\.env exists and contains valid settings.
    pause
    exit /b 1
)

echo.
echo ============================================================
echo  [SUCCESS] StrivexGateway service installed and started.
echo.
echo  Manage with:
echo    nssm status  StrivexGateway
echo    nssm stop    StrivexGateway
echo    nssm start   StrivexGateway
echo    nssm restart StrivexGateway
echo.
echo  Logs:
echo    %LOG_DIR%\gateway-stdout.log
echo    %LOG_DIR%\gateway-stderr.log
echo ============================================================
echo.
pause
