#!/bin/bash
# ==============================================================================
# Adios 2.0 Shared Deployment Library
# ==============================================================================
# Contains enterprise-grade IAM backoff retry handlers and environment pre-flight
# checkers, heavily inspired by Google Marketing Solutions' Scene Machine.
# ==============================================================================

# Internal IAM retry wrapper capturing etag collisions and propagation delays.
# Handles asynchronous SA visibility timing gracefully on brand new projects.
_retry_iam_write() {
  local label="$1"
  local propagating_runtime_sa="$2"
  shift 2

  local err retry_kind
  local attempt=1
  local conflict_max_attempts=6
  local propagation_max_attempts=14
  local propagation_seen=0

  while true; do
    if err=$("$@" --quiet 2>&1 >/dev/null); then
      if [ $attempt -gt 1 ]; then
        echo "  ✓ IAM binding${label} succeeded on attempt $attempt."
      fi
      return 0
    fi

    retry_kind=""
    if [ -n "$propagating_runtime_sa" ]; then
      local missing_sa_error
      local policy_error_preamble
      local conflict_error
      local propagating_project
      local propagation_residual
      local line
      
      missing_sa_error="ERROR: (gcloud.projects.add-iam-policy-binding) INVALID_ARGUMENT: Service account ${propagating_runtime_sa} does not exist."
      policy_error_preamble='ERROR: Policy modification failed. For a binding with condition, run "gcloud alpha iam policies lint-condition" to identify issues in condition.'
      
      # Dynamically extract project ID from the SA email agnostic of SA name
      propagating_project="${propagating_runtime_sa#*@}"
      propagating_project="${propagating_project%.iam.gserviceaccount.com}"
      
      conflict_error="${err//"$propagating_runtime_sa"/<runtime-sa>}"
      conflict_error="${conflict_error//"$propagating_project"/<project>}"
      
      if grep -Fqx "$missing_sa_error" <<<"$err"; then
        propagation_residual=""
        while IFS= read -r line; do
          if [ "$line" != "$missing_sa_error" ] && [ "$line" != "$policy_error_preamble" ]; then
            propagation_residual="${propagation_residual}${line}"$'\n'
          fi
        done <<<"$err"
        
        if ! grep -qiE 'permission_denied|forbidden|unauthorized|invalid_argument|not_found|not found|does not exist|resource_exhausted|quota|concurrent|aborted|etag|stale' <<<"$propagation_residual" \
            && ! grep -qE '^[[:space:]]*(ERROR|FATAL):' <<<"$propagation_residual"; then
          retry_kind="runtime SA propagation"
          propagation_seen=1
        fi
      elif grep -qiE 'permission_denied|forbidden|unauthorized|invalid_argument|not_found|not found|does not exist' <<<"$err"; then
        retry_kind=""
      elif grep -qiE 'concurrent|aborted|etag|stale' <<<"$conflict_error"; then
        retry_kind="conflict"
      fi
    elif grep -qiE 'concurrent|aborted|etag|stale' <<<"$err"; then
      retry_kind="conflict"
    fi

    if [ -z "$retry_kind" ]; then
      echo "  ERROR: IAM binding${label} failed with a non-retryable error:" >&2
      echo "$err" >&2
      return 1
    fi

    local max_attempts=$conflict_max_attempts
    if [ $propagation_seen -eq 1 ]; then
      max_attempts=$propagation_max_attempts
    fi
    if [ $attempt -ge $max_attempts ]; then
      echo "  ERROR: IAM binding${label} still failing with a retryable error after $max_attempts attempts:" >&2
      echo "$err" >&2
      return 1
    fi

    # Exponential backoff with ±25% jitter
    local base=$((2 ** attempt))
    local jitter=$((RANDOM % (base / 2 + 1) - base / 4))
    local backoff=$((base + jitter))
    [ $backoff -lt 1 ] && backoff=1
    if [ $propagation_seen -eq 1 ] && [ $backoff -gt 60 ]; then
      backoff=60
    fi

    echo "  IAM binding${label} hit a transient ${retry_kind} error — retrying in ${backoff}s (attempt $attempt/$max_attempts)..."
    sleep $backoff
    attempt=$((attempt + 1))
  done
}

# Idempotently creates the runtime service account, correctly handling visibility lag.
# Usage: ensure_runtime_service_account <email> <project> <max_attempts>
ensure_runtime_service_account() {
  local runtime_sa="$1"
  local project="$2"
  local max_attempts="$3"
  local create_output=""
  local sa_short="${runtime_sa%%@*}"

  if gcloud iam service-accounts describe "$runtime_sa" --project="$project" &>/dev/null; then
    return 0
  fi

  if create_output=$(gcloud iam service-accounts create "$sa_short" \
      --project="$project" \
      --display-name="Adios Runtime (Backend + Firestore)" 2>&1); then
    [ -z "$create_output" ] || printf '%s\n' "$create_output"
  elif grep -q 'ALREADY_EXISTS:' <<<"$create_output" || grep -Fq "Service account ${sa_short} already exists" <<<"$create_output"; then
    echo "  Runtime service account was created by another deploy; waiting for visibility."
  else
    echo "ERROR: failed to create runtime SA ${runtime_sa}:" >&2
    printf '%s\n' "$create_output" >&2
    return 1
  fi

  local attempts=0
  until gcloud iam service-accounts describe "$runtime_sa" --project="$project" &>/dev/null; do
    attempts=$((attempts + 1))
    if [ "$attempts" -ge "$max_attempts" ]; then
      echo "ERROR: runtime SA ${runtime_sa} did not appear after propagation window." >&2
      return 1
    fi
    sleep 5
  done
}

# Adds an IAM role binding to the project, suppressing duplicates and handling etags.
# Usage: add_iam_binding "$PROJECT" --member=... --role=...
add_iam_binding() {
  local role=""
  local member=""
  local project="$1"
  
  for arg in "$@"; do
    case "$arg" in
      --role=*) role="${arg#--role=}" ;;
      --member=*) member="${arg#--member=}" ;;
    esac
  done
  
  local label="${role:+ (for $role)}"
  local propagating_runtime_sa=""
  
  # Map exactly if the member being added is the SA we just created
  if [[ "$member" == serviceAccount:* ]]; then
    propagating_runtime_sa="${member#serviceAccount:}"
  fi

  if [ -n "$role" ] && [ -n "$member" ] && [ -n "$project" ]; then
    if gcloud projects get-iam-policy "$project" \
        --flatten="bindings[].members" \
        --filter="bindings.role=${role} AND bindings.members=${member}" \
        --format="value(bindings.role)" 2>/dev/null | grep -q .; then
      echo "  ✓ ${member} already has ${role} — skipping."
      return 0
    fi
  fi

  _retry_iam_write "$label" "$propagating_runtime_sa" \
    gcloud projects add-iam-policy-binding "$@"
}

# Verifies a mandatory binary exists on the host machine.
# Usage: require_tool <name> <hint>
MISSING_TOOLS=0
require_tool() {
  local name="$1"
  local hint="$2"
  if ! command -v "$name" >/dev/null 2>&1; then
    echo "ERROR: '$name' is not installed. $hint" >&2
    MISSING_TOOLS=$((MISSING_TOOLS + 1))
  fi
}
