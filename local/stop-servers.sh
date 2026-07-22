#!/bin/bash
# Local development orchestration script to stop backend & frontend servers.

echo "Shutting down any running local servers..."

# Stop Backend (uvicorn)
PIDS=$(pgrep -f "uvicorn src.main:app" || true)
if [ -n "$PIDS" ]; then
  echo "Stopping Backend processes: $PIDS"
  kill -TERM $PIDS 2>/dev/null || true
  sleep 1
  kill -KILL $PIDS 2>/dev/null || true
else
  echo "No Backend processes found."
fi

# Stop Frontend (node/ng)
PIDS=$(pgrep -f "ng serve|node.*node_modules.*ng" || true)
if [ -n "$PIDS" ]; then
  echo "Stopping Frontend processes: $PIDS"
  kill -TERM $PIDS 2>/dev/null || true
  sleep 1
  kill -KILL $PIDS 2>/dev/null || true
else
  echo "No Frontend processes found."
fi

echo "All local servers stopped."
