@echo off
setlocal EnableDelayedExpansion

:: ============================================================
:: uninstall-service.bat — Stop and remove the StrivexGateway
:: Windows service registered by install-service.bat.
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

set "SERVICE_NAME=StrivexGateway"

echo.
echo ============================================================
echo  Strivex Gateway — Service Uninstaller
echo ============================================================
echo.

:: --- Locate NSSM ---
set "NSSM="

where nssm >nul 2>&1
if %errorLevel% equ 0 (
    set "NSSM=nssm"
    goto :found_nssm
)

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

echo [ERROR] NSSM not found on PATH or at known locations.
echo         Install NSSM or ensure nssm.exe is on your PATH.
pause
exit /b 1

:found_nssm
echo [OK] NSSM found: %NSSM%

:: --- Check service exists ---
"%NSSM%" status %SERVICE_NAME% >nul 2>&1
if %errorLevel% neq 0 (
    echo [INFO] Service "%SERVICE_NAME%" is not installed. Nothing to do.
    pause
    exit /b 0
)

:: --- Stop the service ---
echo [INFO] Stopping service "%SERVICE_NAME%"...
"%NSSM%" stop %SERVICE_NAME% confirm
if %errorLevel% neq 0 (
    echo [WARN] Could not stop the service gracefully; proceeding with removal anyway.
)

:: --- Remove the service ---
echo [INFO] Removing service "%SERVICE_NAME%"...
"%NSSM%" remove %SERVICE_NAME% confirm
if %errorLevel% neq 0 (
    echo [ERROR] Failed to remove service "%SERVICE_NAME%".
    echo         You can try manually with: sc delete %SERVICE_NAME%
    pause
    exit /b 1
)

echo.
echo ============================================================
echo  [SUCCESS] StrivexGateway service stopped and removed.
echo.
echo  Log files (if any) are still in the logs\ directory.
echo  Delete them manually if no longer needed.
echo ============================================================
echo.
pause
