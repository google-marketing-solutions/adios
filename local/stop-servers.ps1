Write-Host "Shutting down any running local servers..." -ForegroundColor Yellow

# Stop Backend (uvicorn)
$BackendProcs = Get-CimInstance Win32_Process -Filter "CommandLine LIKE '%uvicorn src.main:app%'"
if ($BackendProcs) {
    ForEach ($P in $BackendProcs) {
        Write-Host "Stopping Backend (PID: $($P.ProcessId))..."
        Stop-Process -Id $P.ProcessId -Force -ErrorAction SilentlyContinue
    }
} else {
    Write-Host "No Backend processes found."
}

# Stop Frontend (node/ng)
$FrontendProcs = Get-CimInstance Win32_Process -Filter "CommandLine LIKE '%ng serve%' OR CommandLine LIKE '%node%ng%'"
if ($FrontendProcs) {
    ForEach ($P in $FrontendProcs) {
        Write-Host "Stopping Frontend (PID: $($P.ProcessId))..."
        Stop-Process -Id $P.ProcessId -Force -ErrorAction SilentlyContinue
    }
} else {
    Write-Host "No Frontend processes found."
}

Write-Host "All local servers stopped." -ForegroundColor Green
