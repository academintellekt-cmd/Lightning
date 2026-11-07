@echo off
setlocal
set "ELECTRON_RUN_AS_NODE="
set "LIGHTNING_DESIGN_MODE=1"
set "LIGHTNING_INTERFACE_TEST=1"
call "%~dp0start-dev.bat"
