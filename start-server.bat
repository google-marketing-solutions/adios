@echo off
:: ==============================================================================
:: Adios 2.0 Server Start Launcher
:: ==============================================================================

echo ==========================================================================
echo Starting Adios 2.0 Windows Development Servers...
echo ==========================================================================

:: Change directory to the workspace root where this batch file is located
cd /d "%~dp0"

:: Launch the PowerShell orchestrator script
powershell.exe -ExecutionPolicy Bypass -File "%~dp0local\start-servers.ps1"

echo ==========================================================================
echo Servers have exited.
echo ==========================================================================
pause
