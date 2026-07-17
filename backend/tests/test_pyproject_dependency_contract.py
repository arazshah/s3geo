from __future__ import annotations

import tomllib
from pathlib import Path


def _pyproject() -> dict:
    return tomllib.loads(Path("pyproject.toml").read_text(encoding="utf-8"))


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

    geo = set(extras["geo"])
    assert {
        "numpy",
        "pandas",
        "shapely",
        "pyproj",
        "geopandas",
        "rasterio",
    } <= geo

    postgis = set(extras["postgis"])
    assert "psycopg2-binary" in postgis
    assert "psycopg[binary]" in postgis

    pdf = set(extras["pdf"])
    assert {"jinja2", "weasyprint"} <= pdf


def test_local_sdk_and_kernel_packages_are_included_in_package_discovery() -> None:
    data = _pyproject()
    include = set(data["tool"]["setuptools"]["packages"]["find"]["include"])

    assert "api*" in include
    assert "orchestrator*" in include
    assert "plugins*" in include
    assert "smart_spatial_system*" in include
    assert "geochat_sdk*" in include
    assert "geochat_kernel*" in include
