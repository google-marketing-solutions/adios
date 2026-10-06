#!/bin/bash
# ==============================================================================
# Adios 2.0 GCP Cloud Run Master Orchestration Deployment Script
# ==============================================================================
# Heavily inspired by Google Marketing Solutions' Scene Machine.
# This script orchestrates a complete, least-privilege, friction-free 
# bootstrapping of Adios 2.0 microservices on an empty GCP project.
# ==============================================================================

set -euo pipefail

# --- 1. Load Shared Deployment Library ----------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ ! -f "${SCRIPT_DIR}/scripts/libs.sh" ]; then
  echo "ERROR: Could not find ${SCRIPT_DIR}/scripts/libs.sh" >&2
  exit 1
fi
source "${SCRIPT_DIR}/scripts/libs.sh"

# --- 2. Phase Timer & Heartbeat Definitions -----------------------------------
CURRENT_PHASE=""
CURRENT_PHASE_START=0

fmt_hms() {
  local total=$1
  printf '%dh %02dm %02ds' $((total / 3600)) $(((total % 3600) / 60)) $((total % 60))
}

_emit_phase_time() {
  local now total
  now=$(date +%s)
  total=$((now - ${SCRIPT_START:-$now}))
  echo
  echo "[t] ${CURRENT_PHASE}"
  echo "       $(date +%H:%M:%S)  ·  +$((now - CURRENT_PHASE_START))s this phase  ·  $(fmt_hms "$total") total"
  echo
}

phase() {
  [ -n "$CURRENT_PHASE" ] && _emit_phase_time
  CURRENT_PHASE="$1"
  CURRENT_PHASE_START=$(date +%s)
  echo "[>] $1"
}

close_phase() {
  if [ -n "$CURRENT_PHASE" ]; then
    _emit_phase_time
    CURRENT_PHASE=""
  fi
}

run_with_heartbeat() {
  local label=$1; shift
  local hb_secs=${HEARTBEAT_SECS:-15}
  local start rc=0
  start=$(date +%s)
  "$@" &
  local cmd_pid=$!
  (
    while kill -0 "$cmd_pid" 2>/dev/null; do
      sleep "$hb_secs"
      kill -0 "$cmd_pid" 2>/dev/null || break
      echo "    … ${label} still running ($(fmt_hms $(( $(date +%s) - start ))) elapsed)"
    done
  ) &
  local hb_pid=$!
  wait "$cmd_pid" || rc=$?
  kill "$hb_pid" 2>/dev/null || true
  wait "$hb_pid" 2>/dev/null || true
  return $rc
}

usage() {
  echo "Usage: $0 [--non-interactive]"
  echo "  --non-interactive  headless/CI run: auto-confirms target and"
  echo "                     fails fast on missing credentials without prompting."
}

# --- 3. Argument Parsing ------------------------------------------------------
NONINTERACTIVE=0
for arg in "$@"; do
  case "$arg" in
    --non-interactive) NONINTERACTIVE=1 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "ERROR: unknown argument '$arg'" >&2; usage >&2; exit 1 ;;
  esac
done

# --- 4. Pre-flight Tool Validation -------------------------------------------
echo "================================================================================"
echo "  Adios 2.0 Advanced Deployment Orchestration"
echo "================================================================================"
echo "[>] Validating mandatory tools..."
require_tool gcloud  "Install: https://cloud.google.com/sdk/docs/install"
require_tool curl    "Ships natively with macOS and most Linux distributions"
require_tool openssl "Ships natively; required for secure key generation"

if [ $MISSING_TOOLS -gt 0 ]; then
  echo "ERROR: Please install missing binaries, then re-run $0" >&2
  exit 1
fi

ACTIVE_ACCOUNT=$(gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>/dev/null || true)
if [ -z "$ACTIVE_ACCOUNT" ]; then
  echo "ERROR: gcloud has no active authenticated account. Run: gcloud auth login" >&2
  exit 1
fi
echo " ✓ All mandatory tools found."

# --- 5. Environment Config Bootstrapping --------------------------------------
CONFIG_FILE="${SCRIPT_DIR}/config.txt"
if [ ! -f "${CONFIG_FILE}" ]; then
  echo "WARNING: config.txt not found. Creating from config.template.txt..."
  if [ -f "${SCRIPT_DIR}/config.template.txt" ]; then
    cp "${SCRIPT_DIR}/config.template.txt" "${CONFIG_FILE}"
  else
    echo "ERROR: Both config.txt and config.template.txt are missing." >&2
    exit 1
  fi
fi

# Load variables
set -o allexport
eval "$(grep -v '^#' "${CONFIG_FILE}" | grep -v '^[[:space:]]*$' | sed 's/^/export /')"
set +o allexport

# Enforce strictly non-derivable Mandatory Credentials
if [ -z "${GCP_PROJECT_ID:-}" ] || [ -z "${GOOGLE_ADS_DEVELOPER_TOKEN:-}" ] || [ -z "${GOOGLE_ADS_MCC_CUSTOMER_ID:-}" ]; then
  echo "ERROR: GCP_PROJECT_ID, GOOGLE_ADS_DEVELOPER_TOKEN, and GOOGLE_ADS_MCC_CUSTOMER_ID must be populated in config.txt" >&2
  exit 1
fi

GCP_PROJECT="${GCP_PROJECT_ID}"

GCP_REGION="${GCP_REGION:-us-central1}"
FIRESTORE_DATABASE_ID="${FIRESTORE_DATABASE_ID:-"(default)"}"
GCS_BUCKET="${GCS_BUCKET:-"${GCP_PROJECT}-adios_20"}"
ARTIFACT_REPO="${ARTIFACT_REPO:-"adios-docker-repo"}"
APP_SERVICE="${APP_SERVICE:-"adios-20-app"}"

# Dynamically generate secure scheduler key if missing
if [ -z "${SCHEDULER_SECRET_KEY:-}" ]; then
  echo "[>] Generating secure SCHEDULER_SECRET_KEY..."
  SCHEDULER_SECRET_KEY=$(openssl rand -hex 16)
  echo "SCHEDULER_SECRET_KEY=\"$SCHEDULER_SECRET_KEY\"" >> "${CONFIG_FILE}"
  echo " ✓ Auto-generated and appended to config.txt"
fi

# --- 6. OAuth Client Prompting Gateway ---------------------------------------
if [ -z "${GOOGLE_LOGIN_CLIENT_ID:-}" ] || [ -z "${GOOGLE_LOGIN_CLIENT_SECRET:-}" ]; then
  echo
  echo "════════════════════════════════════════════════════════════════════════"
  echo " ⚠️  ACTION REQUIRED: OAuth 2.0 Web Client Credentials Missing"
  echo "════════════════════════════════════════════════════════════════════════"
  echo " Due to GCP security boundaries, standard OAuth 2.0 Web Clients "
  echo " cannot be automatically fetched or created via gcloud."
  echo
  echo " Please create your OAuth Credentials in the Google Cloud Console:"
  echo " https://console.cloud.google.com/apis/credentials?project=${GCP_PROJECT}"
  echo
  echo " NOTE: At the end of this deployment, you MUST add the JavaScript"
  echo " Origin and Redirect URI to your Client ID:"
  echo " Authorized Redirect URI: https://<frontend-url>/auth-handler"
  echo " (The exact final URLs will be printed at the very end of this script)."
  echo "════════════════════════════════════════════════════════════════════════"
  echo
  
  if [ "$NONINTERACTIVE" = "1" ]; then
    echo "ERROR: Missing OAuth credentials in --non-interactive mode." >&2
    exit 1
  fi
  
  if [ ! -t 0 ]; then
    echo "ERROR: stdin is not a TTY — cannot prompt for credentials." >&2
    exit 1
  fi
  
  read -r -p "Enter Google OAuth Client ID: " GOOGLE_LOGIN_CLIENT_ID
  read -r -p "Enter Google OAuth Client Secret: " GOOGLE_LOGIN_CLIENT_SECRET
  
  if [ -z "$GOOGLE_LOGIN_CLIENT_ID" ] || [ -z "$GOOGLE_LOGIN_CLIENT_SECRET" ]; then
    echo "ERROR: Both Client ID and Secret are strictly required." >&2
    exit 1
  fi
  
  echo >> "${CONFIG_FILE}"
  echo "GOOGLE_LOGIN_CLIENT_ID=\"$GOOGLE_LOGIN_CLIENT_ID\"" >> "${CONFIG_FILE}"
  echo "GOOGLE_LOGIN_CLIENT_SECRET=\"$GOOGLE_LOGIN_CLIENT_SECRET\"" >> "${CONFIG_FILE}"
  echo " ✓ Credentials appended and saved to config.txt"
fi

# --- 7. Target Confirmation --------------------------------------------------
echo
echo "[>] Confirming deployment target..."
echo "════════════════════════════════════════════════════════════════════════"
echo "  Active Account :  $ACTIVE_ACCOUNT"
echo "  Target Project :  $GCP_PROJECT"
echo "  Deploy Region  :  $GCP_REGION"
echo "  GCS Bucket     :  $GCS_BUCKET"
echo "  Firestore ID   :  $FIRESTORE_DATABASE_ID"
echo "════════════════════════════════════════════════════════════════════════"

if [ "$NONINTERACTIVE" = "1" ]; then
  echo " ✓ Auto-confirming target (--non-interactive)."
else
  if [ ! -t 0 ]; then
    echo "ERROR: stdin is not a TTY — cannot confirm." >&2
    exit 1
  fi
  read -r -p "Proceed and deploy to '${GCP_PROJECT}'? (y/N) " confirm
  confirm=$(echo "$confirm" | tr '[:upper:]' '[:lower:]')
  if [ "$confirm" != "y" ] && [ "$confirm" != "yes" ]; then
    echo "Deployment aborted by user." >&2
    exit 1
  fi
fi

# Start clock after human interactions conclude
SCRIPT_START=$(date +%s)

# --- 8. Enable Google Cloud APIs ---------------------------------------------
phase "Enabling required Google Cloud APIs..."
REQUIRED_APIS=(
  "run.googleapis.com"
  "artifactregistry.googleapis.com"
  "cloudbuild.googleapis.com"
  "cloudscheduler.googleapis.com"
  "firestore.googleapis.com"
  "storage.googleapis.com"
  "cloudresourcemanager.googleapis.com"
)

ENABLED_APIS=$(gcloud services list --enabled --project="${GCP_PROJECT}" --format="value(config.name)" 2>/dev/null || true)
TO_ENABLE=""
already=0
total=0

for api in "${REQUIRED_APIS[@]}"; do
  total=$((total + 1))
  if printf '%s\n' "$ENABLED_APIS" | grep -Fxq "$api"; then
    already=$((already + 1))
  else
    TO_ENABLE="$TO_ENABLE $api"
  fi
done

echo "  ${already} of ${total} APIs already enabled."
if [ -n "${TO_ENABLE// /}" ]; then
  for api in $TO_ENABLE; do
    echo "  - enabling ${api}"
  done
  run_with_heartbeat "gcloud services enable" \
    gcloud services enable $TO_ENABLE --project="${GCP_PROJECT}" > /dev/null
  echo " ✓ Enabled $((total - already)) API(s)."
else
  echo " ✓ All APIs already enabled."
fi

# --- 9. Service Account & IAM Least Privilege ---------------------------------
phase "Ensuring runtime service account adios-runtime exists..."
RUNTIME_SA="adios-runtime@${GCP_PROJECT}.iam.gserviceaccount.com"
ensure_runtime_service_account "$RUNTIME_SA" "$GCP_PROJECT" 120
echo " ✓ Service account ${RUNTIME_SA} ready."

ROLES=(
  "roles/datastore.user"
  "roles/storage.objectUser"
  "roles/logging.logWriter"
)
phase "Granting least privilege IAM roles to adios-runtime..."
for ROLE in "${ROLES[@]}"; do
  echo " - $ROLE"
  add_iam_binding "$GCP_PROJECT" --member="serviceAccount:${RUNTIME_SA}" --role="$ROLE" --condition=None
done
echo " ✓ IAM Roles granted and propagated successfully for adios-runtime."

PROJECT_NUMBER=$(gcloud projects describe "${GCP_PROJECT}" --format="value(projectNumber)")
COMPUTE_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
COMPUTE_ROLES=(
  "roles/storage.objectViewer"
  "roles/artifactregistry.writer"
)
phase "Granting least privilege IAM roles to Default Compute SA (Cloud Build)..."
for ROLE in "${COMPUTE_ROLES[@]}"; do
  echo " - $ROLE"
  add_iam_binding "$GCP_PROJECT" --member="serviceAccount:${COMPUTE_SA}" --role="$ROLE" --condition=None
done
echo " ✓ IAM Roles granted and propagated successfully for Compute SA."

# --- 10. Provision Artifact Registry ------------------------------------------
phase "Setting up Artifact Registry Repository..."
if ! gcloud artifacts repositories describe "${ARTIFACT_REPO}" --project="${GCP_PROJECT}" --location="${GCP_REGION}" &>/dev/null; then
  echo "  Creating repository '${ARTIFACT_REPO}'..."
  gcloud artifacts repositories create "${ARTIFACT_REPO}" \
    --repository-format=docker \
    --location="${GCP_REGION}" \
    --description="Docker repository for Adios 2.0 microservices" \
    --project="${GCP_PROJECT}"
else
  echo " ✓ Repository '${ARTIFACT_REPO}' already exists."
fi

# --- 11. Provision GCS Bucket ------------------------------------------------
phase "Setting up GCS Bucket..."
if ! gcloud storage buckets describe "gs://${GCS_BUCKET}" --project="${GCP_PROJECT}" &>/dev/null; then
  echo "  Creating bucket 'gs://${GCS_BUCKET}'..."
  gcloud storage buckets create "gs://${GCS_BUCKET}" \
    --project="${GCP_PROJECT}" \
    --location="${GCP_REGION}" \
    --uniform-bucket-level-access
  gcloud storage buckets update "gs://${GCS_BUCKET}" --update-labels=app=adios --project="${GCP_PROJECT}"
else
  echo " ✓ Bucket 'gs://${GCS_BUCKET}' already exists."
fi

# --- 12. Provision Firestore Native -------------------------------------------
phase "Setting up Firestore Native Database..."
if ! gcloud firestore databases describe --database="${FIRESTORE_DATABASE_ID}" --project="${GCP_PROJECT}" &>/dev/null; then
  echo "  Creating Firestore Native Database '${FIRESTORE_DATABASE_ID}'..."
  gcloud firestore databases create --database="${FIRESTORE_DATABASE_ID}" \
    --project="${GCP_PROJECT}" \
    --location="${GCP_REGION}" \
    --edition=standard
else
  echo " ✓ Firestore Database '${FIRESTORE_DATABASE_ID}' already exists."
fi

# --- 13. Build Monolithic App (Cloud Build) -----------------------------------
phase "Building App Container Image (Cloud Build)..."
APP_IMAGE="${GCP_REGION}-docker.pkg.dev/${GCP_PROJECT}/${ARTIFACT_REPO}/${APP_SERVICE}:latest"
BUILD_START=$(date +%s)
if ! run_with_heartbeat "Cloud Build (App)" \
  gcloud builds submit --tag "${APP_IMAGE}" --project="${GCP_PROJECT}" "${SCRIPT_DIR}"; then
  BUILD_END=$(date +%s)
  ELAPSED=$((BUILD_END - BUILD_START))
  # If it failed extremely fast (less than 45s), it is almost certainly a transient
  # GCS IAM propagation delay on the newly, lazily-provisioned default source bucket.
  if [ $ELAPSED -lt 45 ]; then
    echo "  ⚠️  Transient IAM propagation delay detected on default Cloud Build GCS bucket."
    echo "      Waiting 45 seconds for GCS IAM caching to catch up, then retrying once..."
    sleep 45
    run_with_heartbeat "Cloud Build (App - Retry)" \
      gcloud builds submit --tag "${APP_IMAGE}" --project="${GCP_PROJECT}" "${SCRIPT_DIR}"
  else
    exit 1
  fi
fi

# --- 14. Deploy and Secure Monolithic App -------------------------------------
phase "Deploying and Securing App Cloud Run Service..."
run_with_heartbeat "Cloud Run Deploy (App)" \
  gcloud run deploy "${APP_SERVICE}" \
    --image "${APP_IMAGE}" \
    --region "${GCP_REGION}" \
    --service-account="${RUNTIME_SA}" \
    --no-allow-unauthenticated \
    --iap \
    --port 8080 \
    --set-env-vars "GOOGLE_LOGIN_CLIENT_ID=${GOOGLE_LOGIN_CLIENT_ID},GOOGLE_LOGIN_CLIENT_SECRET=${GOOGLE_LOGIN_CLIENT_SECRET},GOOGLE_ADS_DEVELOPER_TOKEN=${GOOGLE_ADS_DEVELOPER_TOKEN},GOOGLE_ADS_MCC_CUSTOMER_ID=${GOOGLE_ADS_MCC_CUSTOMER_ID},GCP_PROJECT_ID=${GCP_PROJECT},GCP_REGION=${GCP_REGION},FIRESTORE_DATABASE_ID=${FIRESTORE_DATABASE_ID},GCS_BUCKET=${GCS_BUCKET},SCHEDULER_SECRET_KEY=${SCHEDULER_SECRET_KEY}" \
    --project="${GCP_PROJECT}"

APP_URL=$(gcloud run services describe "${APP_SERVICE}" --region "${GCP_REGION}" --format="value(status.url)" --project="${GCP_PROJECT}")
echo " ✓ App successfully deployed."

run_with_heartbeat "Enforcing Private Perimeter" \
  gcloud run services remove-iam-policy-binding "${APP_SERVICE}" \
    --member="allUsers" \
    --role="roles/run.invoker" \
    --region="${GCP_REGION}" \
    --project="${GCP_PROJECT}" || true

IAP_MEMBER="${IAP_USER_GROUP:-domain:google.com}"
run_with_heartbeat "Granting IAP Access to ${IAP_MEMBER}" \
  gcloud iap web add-iam-policy-binding \
    --resource-type=cloud-run \
    --service="${APP_SERVICE}" \
    --region="${GCP_REGION}" \
    --member="${IAP_MEMBER}" \
    --role="roles/iap.httpsResourceAccessor" \
    --project="${GCP_PROJECT}"

run_with_heartbeat "Granting IAP Invoker Access" \
  gcloud run services add-iam-policy-binding "${APP_SERVICE}" \
    --member="serviceAccount:service-${PROJECT_NUMBER}@gcp-sa-iap.iam.gserviceaccount.com" \
    --role="roles/run.invoker" \
    --region="${GCP_REGION}" \
    --project="${GCP_PROJECT}"

run_with_heartbeat "Granting Scheduler OIDC Invoker Access to ${RUNTIME_SA}" \
  gcloud run services add-iam-policy-binding "${APP_SERVICE}" \
    --member="serviceAccount:${RUNTIME_SA}" \
    --role="roles/run.invoker" \
    --region="${GCP_REGION}" \
    --project="${GCP_PROJECT}"

run_with_heartbeat "Granting Scheduler IAP Access to ${RUNTIME_SA}" \
  gcloud iap web add-iam-policy-binding \
    --resource-type=cloud-run \
    --service="${APP_SERVICE}" \
    --region="${GCP_REGION}" \
    --member="serviceAccount:${RUNTIME_SA}" \
    --role="roles/iap.httpsResourceAccessor" \
    --project="${GCP_PROJECT}"

close_phase

# --- 15. Provision Cloud Scheduler --------------------------------------------
phase "Setting up Background Cloud Scheduler Job..."
JOB_NAME="adios-pmax-scheduler"
SCHEDULER_URI="${APP_URL}/v1/campaign/jobs/run-scheduler"

if ! gcloud scheduler jobs describe "${JOB_NAME}" --location="${GCP_REGION}" --project="${GCP_PROJECT}" &>/dev/null; then
  echo "  Creating scheduler job '${JOB_NAME}'..."
  gcloud scheduler jobs create http "${JOB_NAME}" \
    --location="${GCP_REGION}" \
    --schedule="0 0 * * *" \
    --uri="${SCHEDULER_URI}" \
    --http-method=POST \
    --headers="X-Scheduler-Secret-Key=${SCHEDULER_SECRET_KEY},Content-Type=application/json" \
    --message-body="{}" \
    --oidc-service-account-email="${RUNTIME_SA}" \
    --oidc-token-audience="${APP_URL}" \
    --project="${GCP_PROJECT}"
else
  echo "  Updating scheduler job '${JOB_NAME}'..."
  gcloud scheduler jobs update http "${JOB_NAME}" \
    --location="${GCP_REGION}" \
    --schedule="0 0 * * *" \
    --uri="${SCHEDULER_URI}" \
    --http-method=POST \
    --update-headers="X-Scheduler-Secret-Key=${SCHEDULER_SECRET_KEY},Content-Type=application/json" \
    --message-body="{}" \
    --oidc-service-account-email="${RUNTIME_SA}" \
    --oidc-token-audience="${APP_URL}" \
    --project="${GCP_PROJECT}"
fi
echo " ✓ Cloud Scheduler configured."

# --- 16. Summary & Manual Reminders -------------------------------------------
echo "================================================================================"
echo " 🎉 Deployment Successful!"
echo "================================================================================"
echo "  App URL      : ${APP_URL}"
echo "  App IAP      : Secured (Restricted to ${IAP_MEMBER})"
echo
echo " ⚠️  CRITICAL MANUAL STEP REQUIRED:"
echo "  Go here to update your OAuth Client ID in the Cloud Console:"
echo "  https://console.cloud.google.com/apis/credentials?project=${GCP_PROJECT}"
echo
echo "  Copy and paste the following URLs into the exact matching fields:"
echo
echo "  1️⃣ Authorized JavaScript origins"
echo "  ${APP_URL}"
echo
echo "  2️⃣ Authorized redirect URIs"
echo "  ${APP_URL}/auth-handler"
echo "================================================================================"
