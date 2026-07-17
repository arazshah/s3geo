#!/usr/bin/env bash
set -u
set -o pipefail

PROJECT_ROOT="${PROJECT_ROOT:-$(pwd)}"
MAX_CHARS="${MAX_CHARS:-50000}"
RUN_TESTS="${RUN_TESTS:-0}"
AUDIT_FILE="${AUDIT_FILE:-/tmp/smart_spatial_audit_raw.txt}"

cd "$PROJECT_ROOT" || {
  echo "Cannot enter project root: $PROJECT_ROOT" >&2
  exit 1
}

: > "$AUDIT_FILE"

section() {
  printf '\n\n================================================================\n' >> "$AUDIT_FILE"
  printf '## %s\n' "$1" >> "$AUDIT_FILE"
  printf '================================================================\n' >> "$AUDIT_FILE"
}

run_cmd() {
  local title="$1"
  shift

  section "$title"
  printf '$' >> "$AUDIT_FILE"
  printf ' %q' "$@" >> "$AUDIT_FILE"
  printf '\n' >> "$AUDIT_FILE"

  "$@" >> "$AUDIT_FILE" 2>&1 || {
    printf '\n[command exit code: %s]\n' "$?" >> "$AUDIT_FILE"
  }
}

run_shell() {
  local title="$1"
  local command="$2"

  section "$title"
  printf '$ %s\n' "$command" >> "$AUDIT_FILE"
  bash -lc "$command" >> "$AUDIT_FILE" 2>&1 || {
    printf '\n[command exit code: %s]\n' "$?" >> "$AUDIT_FILE"
  }
}

# ---------------------------------------------------------------------
# Basic environment
# ---------------------------------------------------------------------

run_shell "Environment" '
printf "project_root=%s\n" "$PWD"
printf "date=%s\n" "$(date -Is)"
printf "user=%s\n" "${USER:-unknown}"
printf "shell=%s\n" "$SHELL"
printf "python=%s\n" "$(command -v python || true)"
python --version 2>&1 || true
printf "pytest=%s\n" "$(command -v pytest || true)"
pytest --version 2>&1 || true
printf "pip_package=%s\n" "$(python -m pip show smart-spatial-system 2>/dev/null || true)"
'

# ---------------------------------------------------------------------
# Git state
# ---------------------------------------------------------------------

run_shell "Git status and branch" '
git rev-parse --show-toplevel 2>&1 || true
git branch --show-current 2>&1 || true
git status --short 2>&1 || true
git log --oneline --decorate -12 2>&1 || true
git reflog --date=local -12 2>&1 || true
'

run_shell "Git diff summary" '
git diff --stat 2>&1 || true
git diff --name-only 2>&1 || true
'

# Exclude secrets and generated/binary directories.
run_shell "Relevant safe Git diff" '
git diff -- \
  "*.py" "*.toml" "*.yaml" "*.yml" "*.json" "*.md" \
  ":!.env" ":!.env.*" \
  ":!*.key" ":!*.pem" \
  ":!var/*" ":!build/*" ":!dist/*" \
  ":!node_modules/*" \
  2>&1 || true
'

# ---------------------------------------------------------------------
# Import/source verification
# ---------------------------------------------------------------------

run_shell "Python import locations" '
python - <<'"'"'"'"'"'PY'"'"'"'"'"'
import importlib.util
modules = [
    "smart_spatial_system",
    "orchestrator",
    "api",
    "plugins",
]
for name in modules:
    try:
        module = __import__(name)
        print(f"{name}: {getattr(module, "__file__", None)}")
    except Exception as exc:
        print(f"{name}: IMPORT_ERROR: {type(exc).__name__}: {exc}")
PY
'

run_shell "Project top-level files" '
find . -maxdepth 2 \
  -type f \
  ! -path "./.git/*" \
  ! -path "./.venv/*" \
  ! -path "./node_modules/*" \
  ! -path "./var/*" \
  ! -path "./build/*" \
  ! -path "./dist/*" \
  | sort | sed -n "1,500p"
'

# ---------------------------------------------------------------------
# Relevant tests
# ---------------------------------------------------------------------

run_shell "Relevant test files and test names" '
rg -n --hidden \
  --glob "!/.git/**" \
  --glob "!/.venv/**" \
  --glob "!/node_modules/**" \
  --glob "!/var/**" \
  --glob "!/build/**" \
  --glob "!/dist/**" \
  "def test_|request_id|production_response|feedback|proposal|polygon_layer|vegetation_polygons|kernel_execution|succeeded|manifest|download|3 عارضه" \
  tests 2>&1 | sed -n "1,1800p"
'

# Print complete bodies of relevant tests where possible.
for test_file in \
  tests/test_api_contract_smoke.py \
  tests/test_api_map_layers.py \
  tests/test_api_mvp.py \
  tests/test_api_outputs.py \
  tests/test_api_uploads.py \
  tests/test_orchestrator_service.py \
  tests/test_orchestrator_service_integration.py
do
  if [[ -f "$test_file" ]]; then
    run_cmd "Test source: $test_file" sed -n '1,1200p' "$test_file"
  fi
done

# ---------------------------------------------------------------------
# Relevant implementation search
# ---------------------------------------------------------------------

run_shell "Production response and request identity implementation" '
rg -n -C 10 --hidden \
  --glob "*.py" \
  --glob "!/.venv/**" \
  --glob "!/node_modules/**" \
  --glob "!/var/**" \
  --glob "!/build/**" \
  --glob "!/dist/**" \
  "request_id|final_request_id|production_response|build_production|handle_query|remember\(|request_history|query_hash" \
  api orchestrator smart_spatial_system 2>&1 | sed -n "1,2500p"
'

run_shell "Feedback and proposal implementation" '
rg -n -C 12 --hidden \
  --glob "*.py" \
  --glob "!/.venv/**" \
  --glob "!/node_modules/**" \
  --glob "!/var/**" \
  "submit_feedback|feedback|signals|proposals|apply.*proposal|weight.*proposal|signal_ids|evidence_count|pending_review" \
  api orchestrator smart_spatial_system tests 2>&1 | sed -n "1,2500p"
'

run_shell "Output, manifest, GeoJSON and download implementation" '
rg -n -C 12 --hidden \
  --glob "*.py" \
  --glob "!/.venv/**" \
  --glob "!/node_modules/**" \
  --glob "!/var/**" \
  "manifest|output_contract|outputs_summary|map_layers|download|geojson|persist_outputs|output_storage|vegetation_polygons|polygon_layer" \
  api orchestrator smart_spatial_system tests 2>&1 | sed -n "1,3000p"
'

run_shell "Planning and kernel execution implementation" '
rg -n -C 12 --hidden \
  --glob "*.py" \
  --glob "!/.venv/**" \
  --glob "!/node_modules/**" \
  --glob "!/var/**" \
  "kernel_execution|QUERY_SPEC_PLANNING_ENABLED|enable_kernel_execution|allow_request_kernel_execution|planning_result|query_spec_planning|status.*succeeded|status.*success" \
  api orchestrator smart_spatial_system tests 2>&1 | sed -n "1,3000p"
'

run_shell "Raster and vector feature-count summaries" '
rg -n -C 10 --hidden \
  --glob "*.py" \
  --glob "!/.venv/**" \
  --glob "!/node_modules/**" \
  "feature_count|features_count|عارضه|تحلیل با موفقیت انجام شد|summary|selected_pixel_count|output_feature_count" \
  api orchestrator smart_spatial_system plugins tests 2>&1 | sed -n "1,2500p"
'

# ---------------------------------------------------------------------
# Exact relevant files
# ---------------------------------------------------------------------

for file in \
  orchestrator/production_response.py \
  orchestrator/output_storage.py \
  orchestrator/request_history.py \
  orchestrator/feedback.py \
  smart_spatial_system/application/services/query_execution_service.py \
  smart_spatial_system/application/services/request_history_service.py \
  smart_spatial_system/application/services/feedback_proposal_service.py \
  smart_spatial_system/application/services/planning_response_adapter.py \
  smart_spatial_system/application/services/planning_execution_policy.py \
  smart_spatial_system/application/services/vector_display_handler.py \
  smart_spatial_system/application/services/query_execution/planning_response.py \
  smart_spatial_system/application/services/query_execution/planning_execution.py \
  smart_spatial_system/application/services/query_execution/planning_persistence.py \
  api \
  plugins/raster_to_vector.py \
  plugins/raster_threshold.py
do
  if [[ -f "$file" ]]; then
    run_cmd "Implementation file: $file" sed -n '1,1800p' "$file"
  elif [[ -d "$file" ]]; then
    run_shell "API directory listing: $file" \
      "find '$file' -maxdepth 2 -type f -name '*.py' -print | sort"
  fi
done

# ---------------------------------------------------------------------
# Suspicious backup files
# ---------------------------------------------------------------------

run_shell "Backup and duplicate implementation files" '
find . \
  -path "./.git" -prune -o \
  -path "./.venv" -prune -o \
  -path "./node_modules" -prune -o \
  -type f \( \
    -name "*.bak" -o \
    -name "*.backup" -o \
    -name "*.before*" -o \
    -name "*~" \
  \) -print | sort
'

run_shell "Status literals and output-name literals" '
rg -n --hidden \
  --glob "*.py" \
  --glob "!/.venv/**" \
  --glob "!/node_modules/**" \
  --glob "!/var/**" \
  "status[[:space:]]*=[[:space:]]*[\"'\"'](success|succeeded|failed|error)|[\"'\"']status[\"'\"'][[:space:]]*:[[:space:]]*[\"'\"'](success|succeeded|failed|error)|polygon_layer|vegetation_polygons" \
  . 2>&1 | sed -n "1,2200p"
'

# ---------------------------------------------------------------------
# Optional focused tests
# ---------------------------------------------------------------------

if [[ "$RUN_TESTS" == "1" ]]; then
  run_shell "Focused failing tests" '
python -m pytest -q -x \
  tests/test_api_contract_smoke.py::test_frontend_main_api_contract_smoke_flow \
  tests/test_api_map_layers.py::test_api_map_layers_returns_leaflet_ready_geojson \
  tests/test_api_mvp.py::test_api_query_endpoint_returns_production_response \
  tests/test_api_mvp.py::test_api_feedback_endpoint_builds_proposals \
  tests/test_api_mvp.py::test_api_apply_weight_proposal_endpoint \
  tests/test_api_outputs.py::test_api_outputs_manifest_and_files \
  tests/test_api_outputs.py::test_api_download_geojson_file \
  tests/test_api_uploads.py::test_api_upload_raster_json_and_query_by_ref \
  tests/test_orchestrator_service.py::test_service_handle_query_returns_production_response \
  tests/test_orchestrator_service.py::test_service_handles_failure_as_production_response \
  tests/test_orchestrator_service.py::test_service_submit_feedback_builds_signals_and_proposals \
  tests/test_orchestrator_service.py::test_service_planning_opt_in_kernel_execution_metadata_includes_summary_and_parity \
  tests/test_orchestrator_service.py::test_service_planning_uses_config_kernel_execution_flag \
  tests/test_orchestrator_service_integration.py::test_service_real_user_query_flow \
  tests/test_orchestrator_service_integration.py::test_service_feedback_to_proposal_to_apply_to_persisted_weights_flow
'
fi

# ---------------------------------------------------------------------
# Final bounded output
# ---------------------------------------------------------------------

section "Audit metadata"
printf 'raw_file=%s\n' "$AUDIT_FILE" >> "$AUDIT_FILE"
printf 'raw_char_count=' >> "$AUDIT_FILE"
wc -m < "$AUDIT_FILE" >> "$AUDIT_FILE"
printf 'max_chars=%s\n' "$MAX_CHARS" >> "$AUDIT_FILE"

python - "$AUDIT_FILE" "$MAX_CHARS" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
limit = int(sys.argv[2])

text = path.read_text(encoding="utf-8", errors="replace")

if len(text) <= limit:
    print(text, end="")
else:
    marker = (
        "\n\n================================================================\n"
        "## OUTPUT TRUNCATED\n"
        "================================================================\n"
        f"Original characters: {len(text)}\n"
        f"Displayed characters: {limit}\n"
        "The audit was collected completely in the raw file shown above.\n"
    )
    available = max(0, limit - len(marker))
    print(text[:available] + marker, end="")
PY
