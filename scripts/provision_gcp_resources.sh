#!/bin/bash
# ==============================================================================
# Adios 2.0 GCP Provisioning Script for Firestore and GCS
# ==============================================================================
# This script reads config.txt to provision the Firestore Database and the 
# Google Cloud Storage (GCS) Bucket if they do not already exist.
# ==============================================================================

set -euo pipefail

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

# Check dependencies
if ! command -v gcloud &> /dev/null; then
  error "Google Cloud SDK (gcloud) is not installed. Please install it first: https://cloud.google.com/sdk"
fi

# Load variables from config.txt if present
CONFIG_FILE="$(dirname "$0")/../config.txt"
if [ -f "${CONFIG_FILE}" ]; then
  log "Loading environment configuration from 'config.txt'..."
  set -o allexport
  eval "$(grep -v '^#' "${CONFIG_FILE}" | grep -v '^[[:space:]]*$' | sed 's/^/export /')"
  set +o allexport
else
  error "config.txt not found in project root. Please create it first."
fi

# Retrieve GCP Project ID
GCP_PROJECT="${GCP_PROJECT_ID:-$(gcloud config get-value project 2>/dev/null || echo "")}"
if [ -z "${GCP_PROJECT}" ]; then
  error "No active GCP project found. Please set GCP_PROJECT_ID in config.txt"
fi

GCP_REGION="${GCP_REGION:-us-central1}"

echo "=========================================================================="
echo "${bold}Provisioning Firestore and GCS Bucket for Adios 2.0${normal}"
echo "=========================================================================="
echo "Project ID : ${bold}${GCP_PROJECT}${normal}"
echo "GCP Region : ${bold}${GCP_REGION}${normal}"
echo "Firestore  : ${bold}${FIRESTORE_DATABASE_ID:-"(default)"}${normal}"
echo "GCS Bucket : ${bold}${GCS_BUCKET:-}${normal}"
echo "=========================================================================="
echo "Proceeding in 3 seconds... Press Ctrl+C to cancel."
sleep 3

log "Enabling required APIs (Firestore and Storage)..."
gcloud services enable \
  firestore.googleapis.com \
  storage.googleapis.com \
  --project="${GCP_PROJECT}"

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
else
  warn "GCS_BUCKET is not set in config.txt. Skipping."
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
else
  warn "FIRESTORE_DATABASE_ID is not set in config.txt. Skipping."
fi

log "${bold}${green}Provisioning completed successfully!${normal}"
