#!/usr/bin/env bash

set -u
set -o pipefail

ROOT="${ROOT:-$(pwd)}"
MAX_CHARS="${MAX_CHARS:-50000}"
RAW="/tmp/audit_v3_raw.txt"

cd "$ROOT" || exit 1
: > "$RAW"

section() {
    printf '\n\n============================================================\n' >> "$RAW"
    printf '## %s\n' "$1" >> "$RAW"
    printf '============================================================\n' >> "$RAW"
}

add_file() {
    local title="$1"
    local file="$2"
    local start="${3:-1}"
    local end="${4:-1000}"

    if [[ -f "$file" ]]; then
        section "$title: $file [$start-$end]"
        printf 'file_lines=%s\n' "$(wc -l < "$file")" >> "$RAW"
        sed -n "${start},${end}p" "$file" >> "$RAW" 2>&1
    else
        section "$title: MISSING $file"
    fi
}

add_rg() {
    local title="$1"
    local pattern="$2"
    shift 2

    section "$title"
    rg -n -C 8 "$pattern" "$@" 2>/dev/null | sed -n '1,1000p' >> "$RAW" || true
}

section "Project identity"
printf 'pwd=%s\n' "$PWD" >> "$RAW"
printf 'date=%s\n' "$(date -Is)" >> "$RAW"
printf 'python=%s\n' "$(command -v python)" >> "$RAW"
python --version >> "$RAW" 2>&1 || true
printf 'pytest=%s\n' "$(command -v pytest)" >> "$RAW"
pytest --version >> "$RAW" 2>&1 || true

section "Git repositories near project"
find .. -maxdepth 4 -type d -name .git -print 2>/dev/null | sort >> "$RAW"

if git rev-parse --show-toplevel >/tmp/audit_v3_git_root 2>/dev/null; then
    GIT_ROOT="$(cat /tmp/audit_v3_git_root)"
    section "Current Git repository"
    printf 'git_root=%s\n' "$GIT_ROOT" >> "$RAW"
    git -C "$GIT_ROOT" status --short --branch >> "$RAW" 2>&1 || true
    git -C "$GIT_ROOT" log --oneline --decorate -12 >> "$RAW" 2>&1 || true
else
    section "Current Git repository"
    printf 'NOT_A_GIT_REPOSITORY\n' >> "$RAW"
fi

section "Sibling repository comparison"
if [[ -d "../smart_spatial_system/.git" ]]; then
    printf 'sibling_root=%s\n' "$(realpath ../smart_spatial_system)" >> "$RAW"
    git -C ../smart_spatial_system status --short --branch >> "$RAW" 2>&1 || true
    git -C ../smart_spatial_system log --oneline --decorate -12 >> "$RAW" 2>&1 || true

    printf '\nSource comparison:\n' >> "$RAW"
    diff -q \
        orchestrator/production_response.py \
        ../smart_spatial_system/orchestrator/production_response.py \
        >> "$RAW" 2>&1 || true
    diff -q \
        orchestrator/service.py \
        ../smart_spatial_system/orchestrator/service.py \
        >> "$RAW" 2>&1 || true
fi

section "Python imports"
python -c '
for name in ["smart_spatial_system", "orchestrator", "api", "plugins"]:
    try:
        module = __import__(name)
        print(name + ": " + str(getattr(module, "__file__", None)))
    except Exception as exc:
        print(name + ": IMPORT_ERROR: " + repr(exc))
' >> "$RAW" 2>&1 || true

# ------------------------------------------------------------------
# Exact failing-test inventory
# ------------------------------------------------------------------

add_rg "Failure-related tests" \
'def test_|assert .*status|polygon_layer|vegetation_polygons|kernel_execution|production_response|feedback|proposal|manifest|download' \
tests/test_api_mvp.py \
tests/test_api_map_layers.py \
tests/test_api_outputs.py \
tests/test_api_uploads.py \
tests/test_orchestrator_service.py \
tests/test_orchestrator_service_integration.py \
tests/test_phase3_output_parity.py \
tests/test_service_planning_artifacts.py

# ------------------------------------------------------------------
# Exact source locations, limited and relevant
# ------------------------------------------------------------------

add_rg "Status assignments and normalization" \
'status[[:space:]]*[:=].*(success|succeeded|failed|error)|VALID_RESPONSE_STATUSES|_status|raw_status|audit_record.get\("status"\)' \
api orchestrator smart_spatial_system

add_rg "Request ID flow" \
'request_id|final_request_id|query_hash|production_response' \
api/main.py \
api/support.py \
orchestrator/service.py \
orchestrator/production_response.py \
smart_spatial_system/application/services/query_execution_service.py \
smart_spatial_system/application/services/request_history_service.py

add_rg "Planning output flow" \
'output_nodes|planning_outputs_to_response_payload|map_layers|layers|source_node|artifact_id|vegetation_polygons|polygon_layer' \
orchestrator \
smart_spatial_system \
api \
tests/test_phase3_output_parity.py \
tests/test_service_planning_artifacts.py

add_rg "Feedback and proposal flow" \
'feedback|proposal|signals|apply|weight|request_id' \
orchestrator/feedback.py \
orchestrator/feedback_proposal_service.py \
orchestrator/weight_proposals.py \
smart_spatial_system/application/services/feedback_proposal_service.py \
api/main.py \
tests/test_api_mvp.py \
tests/test_orchestrator_feedback_integration.py \
tests/test_orchestrator_weight_proposals_integration.py

add_rg "Output storage and downloads" \
'manifest|list_files|get_file_path|get_media_type|download|output_service|output_storage|persist_outputs' \
api \
orchestrator \
smart_spatial_system \
tests/test_api_outputs.py \
tests/test_request_document_download_contract.py \
tests/test_output_service.py

add_rg "Kernel execution and planning flags" \
'kernel_execution|enable_kernel_execution|allow_request_kernel_execution|QUERY_SPEC_PLANNING_ENABLED|planning_result|kernel_execution_to_summary' \
orchestrator \
smart_spatial_system \
tests/test_orchestrator_service.py \
tests/test_planning_runner.py \
tests/test_phase3_output_parity.py

# ------------------------------------------------------------------
# Focused source files
# ------------------------------------------------------------------

add_file "Production response" \
orchestrator/production_response.py 1 900

add_file "Service orchestration" \
orchestrator/service.py 1 1300

add_file "Output storage" \
orchestrator/output_storage.py 1 500

add_file "Feedback proposal service" \
orchestrator/feedback_proposal_service.py 1 700

add_file "API main" \
api/main.py 1 1200

add_file "API support" \
api/support.py 1 900

add_file "Planning response adapter" \
smart_spatial_system/application/services/planning_response_adapter.py 1 500

add_file "Planning execution policy" \
smart_spatial_system/application/services/planning_execution_policy.py 1 220

# ------------------------------------------------------------------
# Focused tests complete
# ------------------------------------------------------------------

add_file "API MVP tests" tests/test_api_mvp.py 1 380
add_file "API map layer tests" tests/test_api_map_layers.py 1 500
add_file "API output tests" tests/test_api_outputs.py 1 500
add_file "API upload tests" tests/test_api_uploads.py 1 260
add_file "Orchestrator service tests" tests/test_orchestrator_service.py 1 1400
add_file "Phase 3 output parity tests" tests/test_phase3_output_parity.py 1 700
add_file "Planning artifact tests" tests/test_service_planning_artifacts.py 1 700

# ------------------------------------------------------------------
# Targeted test execution
# ------------------------------------------------------------------

section "Targeted pytest execution"

python -m pytest -q \
    tests/test_api_mvp.py \
    tests/test_api_map_layers.py \
    tests/test_api_outputs.py \
    tests/test_api_uploads.py \
    tests/test_orchestrator_service.py \
    tests/test_phase3_output_parity.py \
    tests/test_service_planning_artifacts.py \
    --tb=short \
    >> "$RAW" 2>&1 || true

# ------------------------------------------------------------------
# Bound output
# ------------------------------------------------------------------

section "Audit metadata"
printf 'raw_file=%s\n' "$RAW" >> "$RAW"
printf 'raw_chars=' >> "$RAW"
wc -m < "$RAW" >> "$RAW"
printf 'max_chars=%s\n' "$MAX_CHARS" >> "$RAW"

python -c '
from pathlib import Path
import sys

path = Path(sys.argv[1])
limit = int(sys.argv[2])
text = path.read_text(encoding="utf-8", errors="replace")

if len(text) <= limit:
    print(text, end="")
else:
    marker = (
        "\n\n============================================================\n"
        "## OUTPUT TRUNCATED\n"
        "============================================================\n"
        f"original_chars={len(text)}\n"
        f"displayed_chars={limit}\n"
        f"complete_raw_file={path}\n"
    )
    print(text[:limit-len(marker)] + marker, end="")
' "$RAW" "$MAX_CHARS"
