from __future__ import annotations

import tomllib
from pathlib import Path

from packaging.requirements import Requirement
from packaging.utils import canonicalize_name


def _pyproject() -> dict:
    return tomllib.loads(Path("pyproject.toml").read_text(encoding="utf-8"))


def _requirement_names(requirements: list[str]) -> set[str]:
    return {
        canonicalize_name(Requirement(requirement).name)
        for requirement in requirements
    }


def test_runtime_dependencies_cover_api_and_config_imports() -> None:
    data = _pyproject()
    deps = set(data["project"]["dependencies"])

    assert "fastapi" in deps
    assert "uvicorn" in deps
    assert "python-dotenv" in deps
    assert "httpx" in deps
    assert "requests" in deps
    assert "PyYAML" in deps


def test_dev_dependencies_cover_packaging_smoke_tools() -> None:
    data = _pyproject()
    dev = set(data["project"]["optional-dependencies"]["dev"])

    assert "pytest" in dev
    assert "httpx" in dev
    assert "setuptools>=68" in dev
    assert "wheel" in dev


def test_optional_dependencies_cover_geo_pdf_and_postgis_imports() -> None:
    data = _pyproject()
    extras = data["project"]["optional-dependencies"]

    geo = _requirement_names(extras["geo"])
    assert {
        canonicalize_name("numpy"),
        canonicalize_name("pandas"),
        canonicalize_name("shapely"),
        canonicalize_name("pyproj"),
        canonicalize_name("geopandas"),
        canonicalize_name("rasterio"),
    } <= geo

    postgis = _requirement_names(extras["postgis"])
    assert canonicalize_name("psycopg2-binary") in postgis
    assert canonicalize_name("psycopg") in postgis

    pdf = _requirement_names(extras["pdf"])
    assert {canonicalize_name("jinja2"), canonicalize_name("weasyprint")} <= pdf


def test_local_sdk_and_kernel_packages_are_included_in_package_discovery() -> None:
    data = _pyproject()
    include = set(data["tool"]["setuptools"]["packages"]["find"]["include"])

    assert "api*" in include
    assert "orchestrator*" in include
    assert "plugins*" in include
    assert "smart_spatial_system*" in include
    assert "geochat_sdk*" in include
    assert "geochat_kernel*" in include


def test_backend_container_installs_pdf_runtime() -> None:
    dockerfile = (
        Path(__file__).resolve().parents[2] / "deploy" / "backend.Dockerfile"
    ).read_text(encoding="utf-8")

    assert dockerfile.startswith("FROM python:3.12-slim-bookworm\n")
    assert 'python -m pip install ".[geo,pdf]"' in dockerfile
    assert "libpango-1.0-0" in dockerfile
    assert "libpangoft2-1.0-0" in dockerfile
    assert "libharfbuzz-subset0" in dockerfile
    assert "from weasyprint import HTML" in dockerfile
    assert "Acquire::Retries=5" in dockerfile
    assert "build-essential" not in dockerfile
    assert "libgdal-dev" not in dockerfile
    assert "libgeos-dev" not in dockerfile
    assert "libproj-dev" not in dockerfile
