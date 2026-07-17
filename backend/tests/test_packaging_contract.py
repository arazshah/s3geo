from __future__ import annotations

import importlib.util
import tomllib
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]


def _pyproject() -> dict:
    path = PROJECT_ROOT / "pyproject.toml"

    assert path.is_file()

    return tomllib.loads(path.read_text(encoding="utf-8"))


def test_pyproject_declares_installable_project_metadata() -> None:
    data = _pyproject()

    assert "build-system" in data
    assert data["build-system"]["build-backend"] == "setuptools.build_meta"

    project = data["project"]

    assert project["name"] == "smart-spatial-system"
    assert isinstance(project["version"], str)
    assert project["version"]
    assert project["requires-python"] in {">=3.11", ">=3.12"}

    dependencies = project.get("dependencies", [])

    assert isinstance(dependencies, list)
    assert "fastapi" in dependencies
    assert "uvicorn" in dependencies
    assert "python-dotenv" in dependencies


def test_pyproject_discovers_runtime_packages_only() -> None:
    data = _pyproject()

    find_config = data["tool"]["setuptools"]["packages"]["find"]

    assert find_config["where"] == ["."]

    include = set(find_config["include"])
    exclude = set(find_config["exclude"])

    assert {
        "api*",
        "orchestrator*",
        "plugins*",
        "smart_spatial_system*",
    } <= include

    assert {
        "tests*",
        "frontend*",
        "artifacts*",
        "outputs*",
        "uploads*",
        "data*",
        "projects*",
        "var*",
        "cache*",
    } <= exclude


def test_runtime_package_entrypoints_are_discoverable() -> None:
    expected_modules = [
        "api",
        "api.main",
        "api.routers.query_planner",
        "api.routers.requests_outputs",
        "orchestrator",
        "orchestrator.service",
        "orchestrator.map_layers",
        "plugins",
        "smart_spatial_system",
        "smart_spatial_system.application",
        "smart_spatial_system.application.services.query_execution_service",
    ]

    for module_name in expected_modules:
        assert importlib.util.find_spec(module_name) is not None, module_name


def test_packaging_excludes_generated_runtime_directories_from_package_discovery() -> None:
    data = _pyproject()

    exclude = set(data["tool"]["setuptools"]["packages"]["find"]["exclude"])

    generated_or_local_dirs = {
        "artifacts*",
        "outputs*",
        "uploads*",
        "projects*",
        "var*",
        "cache*",
        "secrets*",
    }

    assert generated_or_local_dirs <= exclude
