#!/usr/bin/env bash

set -u
set -o pipefail

PROJECT_ROOT="${PROJECT_ROOT:-$(pwd)}"
MAX_CHARS="${MAX_CHARS:-50000}"
RAW_FILE="${RAW_FILE:-/tmp/smart_spatial_audit_raw.txt}"

cd "$PROJECT_ROOT" || exit 1
: > "$RAW_FILE"

section() {
    printf '\n\n================================================================\n' >> "$RAW_FILE"
    printf '## %s\n' "$1" >> "$RAW_FILE"
    printf '================================================================\n' >> "$RAW_FILE"
}

cmd() {
    local title="$1"
    shift

    section "$title"
    printf '$' >> "$RAW_FILE"
    printf ' %q' "$@" >> "$RAW_FILE"
    printf '\n' >> "$RAW_FILE"

    "$@" >> "$RAW_FILE" 2>&1 || {
        printf '[exit_code=%s]\n' "$?" >> "$RAW_FILE"
    }
}

shell_cmd() {
    local title="$1"
    local command="$2"

    section "$title"
    printf '$ %s\n' "$command" >> "$RAW_FILE"

    bash -c "$command" >> "$RAW_FILE" 2>&1 || {
        printf '[exit_code=%s]\n' "$?" >> "$RAW_FILE"
    }
}

# ------------------------------------------------------------------
# Environment
# ------------------------------------------------------------------

shell_cmd "Environment" \
'printf "project_root=%s\n" "$PWD"
printf "date=%s\n" "$(date -Is)"
printf "python=%s\n" "$(command -v python || true)"
python --version 2>&1 || true
printf "pytest=%s\n" "$(command -v pytest || true)"
pytest --version 2>&1 || true
python -m pip show smart-spatial-system 2>/dev/null || true'

# ------------------------------------------------------------------
# Git - safely detect repository
# ------------------------------------------------------------------

section "Git repository detection"

if git rev-parse --show-toplevel >/tmp/audit_git_root 2>/dev/null; then
    GIT_ROOT="$(cat /tmp/audit_git_root)"
    printf 'git_root=%s\n' "$GIT_ROOT" >> "$RAW_FILE"

    cmd "Git branch and status" git -C "$GIT_ROOT" status --short --branch
    cmd "Git recent commits" git -C "$GIT_ROOT" log --oneline --decorate -15
    cmd "Git reflog" git -C "$GIT_ROOT" reflog --date=local -15
    cmd "Git diff stat" git -C "$GIT_ROOT" diff --stat
    cmd "Git changed files" git -C "$GIT_ROOT" diff --name-only
    cmd "Git safe diff" git -C "$GIT_ROOT" diff -- \
        '*.py' '*.toml' '*.yaml' '*.yml' '*.json' '*.md' \
        ':(exclude).env' ':(exclude).env.*' \
        ':(exclude)var/**' ':(exclude)build/**' \
        ':(exclude)dist/**' ':(exclude)node_modules/**'
else
    printf 'git_repository=NOT_FOUND\n' >> "$RAW_FILE"
    printf 'searched_from=%s\n' "$PROJECT_ROOT" >> "$RAW_FILE"

    shell_cmd "Nearby Git repositories" \
    'find .. -maxdepth 4 -type d -name .git -print 2>/dev/null | sort'
fi

# ------------------------------------------------------------------
# Import locations
# ------------------------------------------------------------------

section "Python import locations"

python -c '
modules = ["smart_spatial_system", "orchestrator", "api", "plugins"]
for name in modules:
    try:
        module = __import__(name)
        print(f"{name}: {getattr(module, \"__file__\", None)}")
    except Exception as exc:
        print(f"{name}: IMPORT_ERROR: {type(exc).__name__}: {exc}")
' >> "$RAW_FILE" 2>&1 || true

# ------------------------------------------------------------------
# Relevant tests
# ------------------------------------------------------------------

shell_cmd "Relevant tests" \
'rg -n -C 5 \
--glob "*.py" \
"request_id|production_response|feedback|proposal|polygon_layer|vegetation_polygons|kernel_execution|succeeded|manifest|download|3 عارضه" \
tests 2>/dev/null | sed -n "1,2400p"'

# ------------------------------------------------------------------
# Relevant source locations
# ------------------------------------------------------------------

shell_cmd "Production response and request identity" \
'rg -n -C 8 \
--glob "*.py" \
"request_id|final_request_id|production_response|handle_query|query_hash|request_history|remember" \
api orchestrator smart_spatial_system 2>/dev/null | sed -n "1,2200p"'

shell_cmd "Feedback and proposals" \
'rg -n -C 10 \
--glob "*.py" \
"submit_feedback|feedback|signals|proposals|apply.*proposal|weight.*proposal|evidence_count|pending_review" \
api orchestrator smart_spatial_system tests 2>/dev/null | sed -n "1,2200p"'

shell_cmd "Outputs and downloads" \
'rg -n -C 10 \
--glob "*.py" \
"manifest|output_contract|outputs_summary|map_layers|download|geojson|persist_outputs|output_storage|vegetation_polygons|polygon_layer" \
api orchestrator smart_spatial_system tests 2>/dev/null | sed -n "1,2600p"'

shell_cmd "Planning and kernel execution" \
'rg -n -C 10 \
--glob "*.py" \
"kernel_execution|enable_kernel_execution|allow_request_kernel_execution|query_spec_planning|planning_result|succeeded|success" \
api orchestrator smart_spatial_system tests 2>/dev/null | sed -n "1,2600p"'

shell_cmd "Feature counts and Persian summaries" \
'rg -n -C 8 \
--glob "*.py" \
"feature_count|output_feature_count|selected_pixel_count|عارضه|تحلیل با موفقیت انجام شد|summary" \
api orchestrator smart_spatial_system plugins tests 2>/dev/null | sed -n "1,1800p"'

# ------------------------------------------------------------------
# Exact files: only relevant line ranges, not entire huge files
# ------------------------------------------------------------------

for file in \
    orchestrator/production_response.py \
    orchestrator/output_storage.py \
    orchestrator/request_history_service.py \
    orchestrator/feedback_proposal_service.py \
    orchestrator/weight_proposals.py \
    orchestrator/feedback.py \
    smart_spatial_system/application/services/planning_execution_policy.py \
    smart_spatial_system/application/services/planning_response_adapter.py \
    smart_spatial_system/application/services/vector_display_handler.py \
    plugins/raster_to_vector.py \
    api/main.py \
    api/support.py
do
    if [[ -f "$file" ]]; then
        section "File: $file"
        printf 'lines=%s\n' "$(wc -l < "$file")" >> "$RAW_FILE"

        # فقط خطوطی که برای این failureها مهم هستند
        rg -n -C 12 \
        "request_id|production_response|feedback|proposal|manifest|download|geojson|polygon_layer|vegetation_polygons|kernel_execution|succeeded|success|feature_count|عارضه|summary" \
        "$file" 2>/dev/null | sed -n "1,1800p" >> "$RAW_FILE"
    fi
done

# ------------------------------------------------------------------
# Backup files
# ------------------------------------------------------------------

shell_cmd "Backup files" \
'find . \
-path "./.venv" -prune -o \
-path "./node_modules" -prune -o \
-path "./var" -prune -o \
-type f \( -name "*.bak" -o -name "*.before*" -o -name "*.backup" \) \
-print 2>/dev/null | sort'

# ------------------------------------------------------------------
# Final bounded output
# ------------------------------------------------------------------

section "Audit metadata"
printf 'raw_file=%s\n' "$RAW_FILE" >> "$RAW_FILE"
printf 'raw_chars=' >> "$RAW_FILE"
wc -m < "$RAW_FILE" >> "$RAW_FILE"
printf 'max_chars=%s\n' "$MAX_CHARS" >> "$RAW_FILE"

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
        "\n\n================================================================\n"
        "## OUTPUT TRUNCATED\n"
        "================================================================\n"
        f"original_chars={len(text)}\n"
        f"displayed_chars={limit}\n"
        f"complete_raw_file={path}\n"
    )
    print(text[:max(0, limit - len(marker))] + marker, end="")
' "$RAW_FILE" "$MAX_CHARS"
