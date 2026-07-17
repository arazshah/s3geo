#!/usr/bin/env bash

set +e

PROJECT_ROOT="$(pwd)"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
REPORT="${PROJECT_ROOT}/audit_status_planning_${TIMESTAMP}.txt"

exec > >(tee "$REPORT") 2>&1

section() {
    printf '\n\n'
    printf '%s\n' '======================================================================'
    printf ' %s\n' "$1"
    printf '%s\n' '======================================================================'
}

run_cmd() {
    printf '\n$ %s\n' "$*"
    "$@"
    local rc=$?
    printf '[exit_code=%s]\n' "$rc"
    return 0
}

run_shell() {
    printf '\n$ %s\n' "$1"
    bash -c "$1"
    local rc=$?
    printf '[exit_code=%s]\n' "$rc"
    return 0
}

print_file_if_exists() {
    local file="$1"
    local start="${2:-1}"
    local end="${3:-999999}"

    if [[ -f "$file" ]]; then
        printf '\n--- FILE: %s (lines %s-%s) ---\n' "$file" "$start" "$end"
        nl -ba "$file" | sed -n "${start},${end}p"
    else
        printf '\n--- MISSING FILE: %s ---\n' "$file"
    fi
}

section "AUDIT HEADER"

printf 'timestamp=%s\n' "$TIMESTAMP"
printf 'project_root=%s\n' "$PROJECT_ROOT"
printf 'shell=%s\n' "$SHELL"
printf 'bash=%s\n' "$BASH_VERSION"
printf 'python=%s\n' "$(python --version 2>&1)"
printf 'python_executable=%s\n' "$(command -v python 2>/dev/null || true)"
printf 'pytest_module_check:\n'
python - <<'PY'
import sys
print("sys.executable =", sys.executable)
try:
    import pytest
    print("pytest.version =", pytest.__version__)
    print("pytest.file =", pytest.__file__)
except Exception as exc:
    print("pytest.import_error =", repr(exc))
PY

section "PROJECT BASIC STRUCTURE"

run_shell 'printf "top-level files/directories:\n"; find . -maxdepth 1 -mindepth 1 -printf "%y %p\n" | sort | sed -n "1,160p"'

section "GIT AND RECENT BACKUPS"

run_shell 'git status --short --branch 2>&1'
run_shell 'git log -5 --oneline --decorate 2>&1'
run_shell 'find orchestrator smart_spatial_system tests -type f \( -name "*.bak" -o -name "*.backup*" -o -name "*before_regression*" \) -printf "%p\n" 2>/dev/null | sort'

section "TARGET FILES"

BRIDGE="orchestrator/planning/kernel_execution_bridge.py"
BRIDGE_BACKUP="orchestrator/planning/kernel_execution_bridge.py.before_regression_01.20260717_101956.bak"
QUERY_SERVICE="smart_spatial_system/application/services/query_execution_service.py"
SERVICE="orchestrator/service.py"
PIPELINE_EXECUTOR="orchestrator/pipeline_executor.py"
DAG_EXECUTOR="orchestrator/planning/dag_executor.py"
AUDIT="orchestrator/audit.py"
PRODUCTION="orchestrator/production_response.py"
PLANNING_ADAPTER="smart_spatial_system/application/services/planning_response_adapter.py"

for file in \
    "$BRIDGE" \
    "$BRIDGE_BACKUP" \
    "$QUERY_SERVICE" \
    "$SERVICE" \
    "$PIPELINE_EXECUTOR" \
    "$DAG_EXECUTOR" \
    "$AUDIT" \
    "$PRODUCTION" \
    "$PLANNING_ADAPTER"
do
    if [[ -f "$file" ]]; then
        printf '%-90s %s bytes\n' "$file" "$(wc -c < "$file")"
        printf '  sha256='
        sha256sum "$file" | awk '{print $1}'
    else
        printf 'MISSING %s\n' "$file"
    fi
done

section "BRIDGE DIFF AGAINST REGRESSION BACKUP"

if [[ -f "$BRIDGE" && -f "$BRIDGE_BACKUP" ]]; then
    run_shell "diff -u '$BRIDGE_BACKUP' '$BRIDGE'"
else
    printf 'Bridge or backup is missing; diff skipped.\n'
fi

section "BRIDGE HELPER AND CAPABILITY HANDLER"

run_shell "rg -n -C 35 \
  '_filter_kwargs_for_callable|class CapabilityStepHandler|async def handle|capability_fn\\(\\*\\*kwargs\\)|dropped_unsupported_capability_kwargs' \
  '$BRIDGE' '$BRIDGE_BACKUP' 2>&1"

section "ALL STATUS LITERALS IN APPLICATION CODE"

run_shell 'rg -n --glob "*.py" --glob "!*.bak" --glob "!*.backup*" --glob "!*.before_regression*" \
  "\"success\"|\"succeeded\"|'\''success'\''|'\''succeeded'\''" \
  orchestrator smart_spatial_system api plugins 2>&1'

section "ALL STATUS ASSERTIONS IN TESTS"

run_shell 'rg -n --glob "test_*.py" --glob "*.py" \
  "status.*success|status.*succeeded|success.*status|succeeded.*status" \
  tests 2>&1'

section "PLANNING ENTRYPOINTS AND CALLERS"

run_shell 'rg -n -C 80 \
  "_try_handle_query_with_planning|query_spec_planning_enabled|planning_attempted|planning_response|enable_kernel_execution|kernel_execution" \
  orchestrator/service.py \
  smart_spatial_system/application/services/query_execution_service.py \
  tests/test_orchestrator_service.py 2>&1'

section "STATUS CREATION IN QUERY EXECUTION SERVICE"

run_shell 'rg -n -C 45 \
  "\"status\"[[:space:]]*:[[:space:]]*('\''success'\'|\''succeeded'\'|\''failed'\'|\''error'\'')" \
  smart_spatial_system/application/services/query_execution_service.py 2>&1'

section "STATUS CREATION IN ORCHESTRATOR SERVICE"

run_shell 'rg -n -C 45 \
  "\"status\"[[:space:]]*:[[:space:]]*('\''success'\'|\''succeeded'\'|\''failed'\'|\''error'\'')" \
  orchestrator/service.py 2>&1'

section "STATUS CREATION IN PRODUCTION RESPONSE BUILDER"

run_shell 'rg -n -C 45 \
  "class ProductionResponseBuilder|def build|def build_dict|status|audit_ref" \
  orchestrator/production_response.py \
  tests/test_orchestrator_production_response.py 2>&1'

section "STATUS CREATION IN EXECUTORS AND AUDIT"

run_shell 'rg -n -C 25 \
  "status|success|succeeded|audit_record|trace" \
  orchestrator/pipeline_executor.py \
  orchestrator/planning/dag_executor.py \
  orchestrator/audit.py 2>&1'

section "RELEVANT TEST FUNCTION SOURCE"

run_shell 'rg -n -C 140 \
  "def test_service_planning_opt_in_kernel_execution_metadata_includes_summary_and_parity|def test_service_planning_uses_config_kernel_execution_flag" \
  tests/test_orchestrator_service.py 2>&1'

section "PLANNING RESPONSE TESTS"

run_shell 'rg -n -C 60 \
  "planning|kernel|status|metadata|parity|succeeded|success" \
  tests/test_orchestrator_service.py \
  tests/test_orchestrator_production_response.py \
  tests/test_real_estate_ranking_bridge.py 2>&1'

section "PYTHON AST-LIKE STATUS EXTRACTION"

python - <<'PY'
from pathlib import Path
import ast

files = [
    Path("smart_spatial_system/application/services/query_execution_service.py"),
    Path("orchestrator/service.py"),
    Path("orchestrator/pipeline_executor.py"),
    Path("orchestrator/planning/dag_executor.py"),
    Path("orchestrator/audit.py"),
    Path("orchestrator/production_response.py"),
    Path("orchestrator/planning/kernel_execution_bridge.py"),
]

def literal_string(node):
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        return node.value
    return None

for path in files:
    print(f"\n### {path}")
    if not path.exists():
        print("MISSING")
        continue

    try:
        tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
    except Exception as exc:
        print("AST_PARSE_ERROR:", repr(exc))
        continue

    lines = path.read_text(encoding="utf-8").splitlines()

    for node in ast.walk(tree):
        if isinstance(node, ast.Dict):
            keys = [literal_string(key) for key in node.keys]
            if "status" not in keys:
                continue

            index = keys.index("status")
            value = node.values[index] if index < len(node.values) else None
            value_text = ast.unparse(value) if value is not None else "<missing>"

            line_no = getattr(node, "lineno", "?")
            context_start = max(1, int(line_no) - 3)
            context_end = min(len(lines), int(line_no) + 8)

            print(
                f"\nstatus-dict line={line_no} "
                f"value={value_text}"
            )
            for number in range(context_start, context_end + 1):
                print(f"{number:5}: {lines[number - 1]}")
PY

section "SIGNATURE CHECK FOR CAPABILITIES USED BY THE FAILING TEST"

python - <<'PY'
import inspect

targets = [
    ("plugins.feature_scoring", "score_features"),
    ("plugins.feature_scoring", "rank_features"),
]

for module_name, function_name in targets:
    print(f"\n### {module_name}.{function_name}")
    try:
        module = __import__(module_name, fromlist=[function_name])
        fn = getattr(module, function_name)
        print("object:", fn)
        print("signature:", inspect.signature(fn))
    except Exception as exc:
        print("ERROR:", repr(exc))
PY

section "COMPILE CHECK"

run_cmd python -m py_compile \
  orchestrator/planning/kernel_execution_bridge.py \
  smart_spatial_system/application/services/query_execution_service.py \
  orchestrator/service.py \
  orchestrator/production_response.py \
  orchestrator/pipeline_executor.py \
  orchestrator/planning/dag_executor.py

section "COLLECT RELEVANT TESTS"

run_shell 'python -m pytest --collect-only -q \
  tests/test_orchestrator_service.py \
  tests/test_orchestrator_production_response.py \
  tests/test_real_estate_ranking_bridge.py 2>&1 | \
  grep -Ei "kernel|planning|production|ranking|response|status|config"'

section "RUN PRIMARY FAILING TEST"

run_cmd python -m pytest -q \
  tests/test_orchestrator_service.py::test_service_planning_opt_in_kernel_execution_metadata_includes_summary_and_parity \
  --tb=long

section "RUN SECOND PLANNING TEST IF PRESENT"

if grep -q \
  'def test_service_planning_uses_config_kernel_execution_flag' \
  tests/test_orchestrator_service.py 2>/dev/null
then
    run_cmd python -m pytest -q \
      tests/test_orchestrator_service.py::test_service_planning_uses_config_kernel_execution_flag \
      --tb=long
else
    printf 'Second planning test was not found with the expected exact name.\n'
    run_shell 'python -m pytest --collect-only -q tests/test_orchestrator_service.py 2>&1 | grep -Ei "kernel|planning|config"'
fi

section "RUN STATUS-CONTRACT TESTS"

run_cmd python -m pytest -q \
  tests/test_api_mvp.py \
  tests/test_api_uploads.py \
  tests/test_orchestrator_production_response.py \
  --tb=short

section "RUN RELATED BRIDGE TESTS"

run_shell 'python -m pytest -q tests \
  -k "kernel_execution or capability_step_handler or planning or real_estate_ranking" \
  --tb=short'

section "FINAL MACHINE-READABLE SUMMARY"

python - <<'PY'
from pathlib import Path
import re

files = [
    Path("smart_spatial_system/application/services/query_execution_service.py"),
    Path("orchestrator/service.py"),
    Path("orchestrator/pipeline_executor.py"),
    Path("orchestrator/planning/dag_executor.py"),
    Path("orchestrator/audit.py"),
    Path("orchestrator/production_response.py"),
]

counts = {"success": 0, "succeeded": 0, "failed": 0, "error": 0}

for path in files:
    if not path.exists():
        continue
    text = path.read_text(encoding="utf-8")
    for key in counts:
        counts[key] += len(re.findall(rf'["\'']{key}["\'']', text))

print("status_literal_counts_in_application_files:")
for key, value in counts.items():
    print(f"  {key}={value}")

print("\nreport_file_is_the_stdout_target:")
print("  The complete report path is printed below by the shell script.")
PY

section "AUDIT COMPLETE"

printf 'REPORT_PATH=%s\n' "$REPORT"
printf 'You can send this file for analysis:\n%s\n' "$REPORT"
