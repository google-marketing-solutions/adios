#!/bin/bash
set -e

# Load environment variables if config.txt exists in the current directory or parent
if [ -f "config.txt" ]; then
    echo "Loading configuration from config.txt..."
    export $(grep -v '^#' config.txt | xargs)
elif [ -f "../config.txt" ]; then
    echo "Loading configuration from ../config.txt..."
    export $(grep -v '^#' ../config.txt | xargs)
fi

SCHEDULER_SECRET="${SCHEDULER_SECRET_KEY:-local_secret_key}"
API_BASE_URL="${API_URL:-http://localhost:8000}"

AS_OF_DATE="${1:-}"
URL="$API_BASE_URL/v1/campaign/jobs/run-scheduler"
if [ -n "$AS_OF_DATE" ]; then
  URL="$URL?as_of_date=$AS_OF_DATE"
  echo "Overriding as_of_date to $AS_OF_DATE"
fi

echo "Triggering Scheduled Asset Lifecycle Processing..."
curl -X POST "$URL" \
  -H "X-Scheduler-Secret-Key: $SCHEDULER_SECRET" \
  -H "Content-Type: application/json" \
  -d "{}"

echo ""
echo "Scheduler execution completed."
