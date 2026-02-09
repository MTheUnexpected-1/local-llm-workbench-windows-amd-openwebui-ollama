@echo off
setlocal
set SCRIPT_DIR=%~dp0
powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Normal -File "%SCRIPT_DIR%..\scripts\setup-flow.ps1" -Phase stack
exit /b %ERRORLEVEL%
