# Get the directory of the current script and go to repo root
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoDir = Resolve-Path (Join-Path $ScriptDir "..")
Set-Location $RepoDir

Write-Host "==========================================================================" -ForegroundColor Cyan
Write-Host "Starting Adios 2.0 Windows Development Orchestrator" -ForegroundColor Cyan
Write-Host "Repository Root: $RepoDir" -ForegroundColor Cyan
Write-Host "==========================================================================" -ForegroundColor Cyan

# 1. Determine Python location
$PythonBin = "python"
$LocalPython = Join-Path $RepoDir "runtimes\python\python.exe"
if (Test-Path $LocalPython) {
    $PythonBin = $LocalPython
    Write-Host "Using local Python: $PythonBin" -ForegroundColor Green
} else {
    Write-Host "Local Python runtime not found. Using system python." -ForegroundColor Yellow
}

# 2. Determine Node location
$LocalNode = Join-Path $RepoDir "runtimes\node"
if (Test-Path $LocalNode) {
    # Add local Node to path for the process
    $env:PATH = "$LocalNode;" + $env:PATH
    Write-Host "Using local Node.js: $LocalNode" -ForegroundColor Green
} else {
    Write-Host "Local Node.js runtime not found. Using system node." -ForegroundColor Yellow
}

# 3. Start Backend
Write-Host "Starting FastAPI Backend on http://localhost:8000..." -ForegroundColor Green
$BackendProcess = Start-Process -FilePath $PythonBin -ArgumentList "-m uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload" -NoNewWindow -PassThru -ErrorAction Stop

# 4. Wait briefly
Start-Sleep -Seconds 2

# 5. Start Frontend
Write-Host "Starting Angular Frontend on http://localhost:4200..." -ForegroundColor Green
$FrontendProcess = Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm run start" -WorkingDirectory (Join-Path $RepoDir "frontend") -NoNewWindow -PassThru -ErrorAction Stop

# 6. Monitor and Cleanup on Exit
Write-Host "Both servers are running. Press Ctrl+C to stop both servers." -ForegroundColor Cyan

# Setup cleanup function
function Cleanup-Servers {
    Write-Host ""
    Write-Host "Shutting down servers gracefully..." -ForegroundColor Yellow
    if ($BackendProcess -and -not $BackendProcess.HasExited) {
        Write-Host "Stopping Backend (PID: $($BackendProcess.Id))..."
        Stop-Process -Id $BackendProcess.Id -Force -ErrorAction SilentlyContinue
    }
    if ($FrontendProcess -and -not $FrontendProcess.HasExited) {
        Write-Host "Stopping Frontend (PID: $($FrontendProcess.Id))..."
        Stop-Process -Id $FrontendProcess.Id -Force -ErrorAction SilentlyContinue
    }
    Exit
}

# Wait loop monitoring the processes
try {
    while ($true) {
        if ($BackendProcess.HasExited) {
            Write-Host "Backend server exited unexpectedly." -ForegroundColor Red
            break
        }
        if ($FrontendProcess.HasExited) {
            Write-Host "Frontend server exited unexpectedly." -ForegroundColor Red
            break
        }
        Start-Sleep -Seconds 1
    }
}
finally {
    Cleanup-Servers
}
