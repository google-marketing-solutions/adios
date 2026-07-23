@echo off
:: ==============================================================================
:: Adios 2.0 Server Stop Launcher
:: ==============================================================================

echo ==========================================================================
echo Stopping Adios 2.0 Windows Development Servers...
echo ==========================================================================

:: Find and terminate processes listening on port 8000 (Backend)
echo Checking for Backend processes on Port 8000...
set "BACKEND_FOUND=0"
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000 ^| findstr LISTENING') do (
    echo Killing Backend Process with PID %%a...
    taskkill /f /pid %%a
    set "BACKEND_FOUND=1"
)
if "%BACKEND_FOUND%"=="0" (
    echo No active Backend process found listening on Port 8000.
)

echo.

:: Find and terminate processes listening on port 4200 (Frontend)
echo Checking for Frontend processes on Port 4200...
set "FRONTEND_FOUND=0"
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :4200 ^| findstr LISTENING') do (
    echo Killing Frontend Process with PID %%a...
    taskkill /f /pid %%a
    set "FRONTEND_FOUND=1"
)
if "%FRONTEND_FOUND%"=="0" (
    echo No active Frontend process found listening on Port 4200.
)

echo.
echo ==========================================================================
echo Done! Servers stopped.
echo ==========================================================================
pause
