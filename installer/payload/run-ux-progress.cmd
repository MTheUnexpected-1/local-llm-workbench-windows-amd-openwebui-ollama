@echo off
setlocal
set SCRIPT_DIR=%~dp0
powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Normal -File "%SCRIPT_DIR%..\scripts\install-ux-progress.ps1"
exit /b %ERRORLEVEL%
