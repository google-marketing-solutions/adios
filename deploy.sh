#!/bin/bash
# ==============================================================================
# Adios 2.0 GCP Cloud Run Deployment Script
# ==============================================================================
# This script builds and deploys the Adios 2.0 backend and frontend services
# to Google Cloud Run using Google Cloud Build.
#
# Requirements:
#   - Google Cloud SDK (gcloud) installed and authenticated.
#   - Active GCP Project with Billing enabled.
# ==============================================================================

set -euo pipefail

# 1. Configuration & Defaults
DEFAULT_REGION="us-central1"
DEFAULT_REPO="adios-docker-repo"
DEFAULT_BACKEND="adios-backend"
DEFAULT_FRONTEND="adios-frontend"

# Highlight text formatting
bold=$(tput bold || echo "")
normal=$(tput sgr0 || echo "")
green=$(tput setaf 2 || echo "")
red=$(tput setaf 1 || echo "")
yellow=$(tput setaf 3 || echo "")

log() {
  echo -e "${green}[INFO]${normal} $1"
}

warn() {
  echo -e "${yellow}[WARNING]${normal} $1"
}

error() {
  echo -e "${red}[ERROR]${normal} $1"
  exit 1
}

# 2. Check dependencies
if ! command -v gcloud &> /dev/null; then
  error "Google Cloud SDK (gcloud) is not installed. Please install it first: https://cloud.google.com/sdk"
fi

# Load variables from config.txt if present
CONFIG_FILE="$(dirname "$0")/config.txt"
if [ -f "${CONFIG_FILE}" ]; then
  log "Loading environment configuration from 'config.txt'..."
  set -o allexport
  eval "$(grep -v '^#' "${CONFIG_FILE}" | grep -v '^[[:space:]]*$' | sed 's/^/export /')"
  set +o allexport
fi

# 3. Retrieve GCP Project ID
GCP_PROJECT="${GCP_PROJECT_ID:-$(gcloud config get-value project 2>/dev/null || echo "")}"
if [ -z "${GCP_PROJECT}" ]; then
  error "No active GCP project found. Please set one in config.txt or using: gcloud config set project [PROJECT_ID]"
fi

# Allow overriding variables via environment variables
GCP_REGION="${GCP_REGION:-$DEFAULT_REGION}"
REPO_NAME="${REPO_NAME:-$DEFAULT_REPO}"
BACKEND_SERVICE="${BACKEND_SERVICE:-$DEFAULT_BACKEND}"
FRONTEND_SERVICE="${FRONTEND_SERVICE:-$DEFAULT_FRONTEND}"

echo "=========================================================================="
echo "${bold}Deploying Adios 2.0 to GCP${normal}"
echo "=========================================================================="
echo "Project ID : ${bold}${GCP_PROJECT}${normal}"
echo "GCP Region : ${bold}${GCP_REGION}${normal}"
echo "Registry   : ${bold}${REPO_NAME}${normal}"
echo "Backend    : ${bold}${BACKEND_SERVICE}${normal}"
echo "Frontend   : ${bold}${FRONTEND_SERVICE}${normal}"
echo "Firestore  : ${bold}${FIRESTORE_DATABASE_ID:-"(default)"}${normal}"
echo "GCS Bucket : ${bold}${GCS_BUCKET:-}${normal}"
echo "=========================================================================="
echo "Proceeding in 5 seconds... Press Ctrl+C to cancel."
sleep 5

# 4. Enable required GCP Service APIs
log "Enabling required GCP Service APIs..."
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  cloudscheduler.googleapis.com \
  --project="${GCP_PROJECT}"

# 5. Create Artifact Registry Repository if not exists
log "Checking Artifact Registry Repository..."
REPO_EXISTS=$(gcloud artifacts repositories list --project="${GCP_PROJECT}" --location="${GCP_REGION}" --filter="name:projects/${GCP_PROJECT}/locations/${GCP_REGION}/repositories/${REPO_NAME}" --format="value(name)" || echo "")

if [ -z "${REPO_EXISTS}" ]; then
  log "Creating Artifact Registry repository '${REPO_NAME}' in region '${GCP_REGION}'..."
  gcloud artifacts repositories create "${REPO_NAME}" \
    --repository-format=docker \
    --location="${GCP_REGION}" \
    --description="Docker repository for Adios 2.0" \
    --project="${GCP_PROJECT}"
else
  log "Repository '${REPO_NAME}' already exists."
fi

if [ -n "${GCS_BUCKET:-}" ]; then
  log "Checking GCS Bucket gs://${GCS_BUCKET}..."
  if ! gcloud storage buckets describe "gs://${GCS_BUCKET}" --project="${GCP_PROJECT}" &>/dev/null; then
    log "Creating GCS Bucket '${GCS_BUCKET}' in region '${GCP_REGION}'..."
    gcloud storage buckets create "gs://${GCS_BUCKET}" \
      --project="${GCP_PROJECT}" \
      --location="${GCP_REGION}" \
      --uniform-bucket-level-access
  else
    log "GCS Bucket '${GCS_BUCKET}' already exists."
  fi
fi

if [ -n "${FIRESTORE_DATABASE_ID:-}" ]; then
  log "Checking Firestore Database '${FIRESTORE_DATABASE_ID}'..."
  if ! gcloud firestore databases describe --database="${FIRESTORE_DATABASE_ID}" --project="${GCP_PROJECT}" &>/dev/null; then
    log "Creating Firestore Native Database '${FIRESTORE_DATABASE_ID}' in region '${GCP_REGION}'..."
    gcloud firestore databases create --database="${FIRESTORE_DATABASE_ID}" \
      --project="${GCP_PROJECT}" \
      --location="${GCP_REGION}" \
      --edition=standard
  else
    log "Firestore Database '${FIRESTORE_DATABASE_ID}' already exists."
  fi
fi

# Define full image paths
BACKEND_IMAGE="${GCP_REGION}-docker.pkg.dev/${GCP_PROJECT}/${REPO_NAME}/${BACKEND_SERVICE}:latest"
FRONTEND_IMAGE="${GCP_REGION}-docker.pkg.dev/${GCP_PROJECT}/${REPO_NAME}/${FRONTEND_SERVICE}:latest"

# 6. Build and Deploy Backend Service
log "Building Backend Docker image using Cloud Build..."
gcloud builds submit --tag "${BACKEND_IMAGE}" --project="${GCP_PROJECT}" .

log "Deploying Backend service to Cloud Run..."
gcloud run deploy "${BACKEND_SERVICE}" \
  --image "${BACKEND_IMAGE}" \
  --platform managed \
  --region "${GCP_REGION}" \
  --allow-unauthenticated \
  --port 8080 \
  --set-env-vars "SCHEDULER_SECRET_KEY=${SCHEDULER_SECRET_KEY:-local_secret_key},GCP_PROJECT_ID=${GCP_PROJECT},GOOGLE_LOGIN_CLIENT_ID=${GOOGLE_LOGIN_CLIENT_ID:-},GOOGLE_LOGIN_CLIENT_SECRET=${GOOGLE_LOGIN_CLIENT_SECRET:-},GOOGLE_ADS_DEVELOPER_TOKEN=${GOOGLE_ADS_DEVELOPER_TOKEN:-},GOOGLE_ADS_MCC_CUSTOMER_ID=${GOOGLE_ADS_MCC_CUSTOMER_ID:-${GOOGLE_ADS_CUSTOMER_ID:-}},FIRESTORE_DATABASE_ID=${FIRESTORE_DATABASE_ID:-},GCS_BUCKET=${GCS_BUCKET:-}" \
  --project="${GCP_PROJECT}"

# Retrieve Backend Service URL
BACKEND_URL=$(gcloud run services describe "${BACKEND_SERVICE}" --platform managed --region "${GCP_REGION}" --format="value(status.url)" --project="${GCP_PROJECT}")
log "Backend Service successfully deployed to: ${bold}${BACKEND_URL}${normal}"

# 8. Configure Cloud Scheduler Job for Automated Lifecycle Processing
log "Checking Cloud Scheduler Job..."
JOB_NAME="adios-pmax-scheduler"
if ! gcloud scheduler jobs describe "${JOB_NAME}" --location="${GCP_REGION}" --project="${GCP_PROJECT}" &>/dev/null; then
  log "Creating Cloud Scheduler job '${JOB_NAME}'..."
  gcloud scheduler jobs create http "${JOB_NAME}" \
    --location="${GCP_REGION}" \
    --schedule="0 0 * * *" \
    --uri="${BACKEND_URL}/v1/campaign/jobs/run-scheduler" \
    --http-method=POST \
    --headers="X-Scheduler-Secret-Key=${SCHEDULER_SECRET_KEY:-local_secret_key},Content-Type=application/json" \
    --message-body="{}" \
    --project="${GCP_PROJECT}"
else
  log "Updating Cloud Scheduler job '${JOB_NAME}'..."
  gcloud scheduler jobs update http "${JOB_NAME}" \
    --location="${GCP_REGION}" \
    --schedule="0 0 * * *" \
    --uri="${BACKEND_URL}/v1/campaign/jobs/run-scheduler" \
    --http-method=POST \
    --headers="X-Scheduler-Secret-Key=${SCHEDULER_SECRET_KEY:-local_secret_key},Content-Type=application/json" \
    --message-body="{}" \
    --project="${GCP_PROJECT}"
fi

# 7. Build and Deploy Frontend Service
log "Building Frontend Docker image using Cloud Build..."
gcloud builds submit --tag "${FRONTEND_IMAGE}" --project="${GCP_PROJECT}" ./frontend

log "Deploying Frontend service to Cloud Run (passing BACKEND_URL)..."
gcloud run deploy "${FRONTEND_SERVICE}" \
  --image "${FRONTEND_IMAGE}" \
  --platform managed \
  --region "${GCP_REGION}" \
  --allow-unauthenticated \
  --port 8080 \
  --set-env-vars "BACKEND_URL=${BACKEND_URL}" \
  --project="${GCP_PROJECT}"

# Retrieve Frontend Service URL
FRONTEND_URL=$(gcloud run services describe "${FRONTEND_SERVICE}" --platform managed --region "${GCP_REGION}" --format="value(status.url)" --project="${GCP_PROJECT}")

echo "=========================================================================="
echo "${bold}${green}Deployment Successful!${normal}"
echo "=========================================================================="
echo "Backend URL  : ${bold}${BACKEND_URL}${normal}"
echo "Frontend URL : ${bold}${FRONTEND_URL}${normal}"
echo "=========================================================================="
