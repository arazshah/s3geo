# Phase 2 baseline installation

## Backend installation: succeeded

From the repository root, the following isolated editable installation succeeded:

```bash
python3 -m venv backend/.venv
backend/.venv/bin/python -m pip install -e 'backend[dev,geo,pdf,postgis]'
```

Imported successfully: FastAPI 0.141.1, Pydantic 2.13.4, GeoPandas 1.1.4, Rasterio 1.4.4, WeasyPrint 69.0, Psycopg 3.3.4, and `api.main:app`. This is stronger than the image installation, which installs only `.[geo]` and omits the declared `dev`, `pdf`, and `postgis` extras ([backend/Dockerfile](/home/araz/Projects/Career/s3geo/backend/Dockerfile:20), [backend/pyproject.toml](/home/araz/Projects/Career/s3geo/backend/pyproject.toml:52)).

## Frontend installation: succeeded

```bash
cd frontend
npm ci
```

`npm` reported 222 packages installed and 3 audit findings (1 moderate, 2 high). No remediation was attempted in this phase.

## Reproducibility gaps (confirmed)

* There is no Python lockfile or requirements file. `pyproject.toml` uses broad, unpinned runtime requirements; repeat installations can resolve different transitive versions.
* The README directs users to install a built wheel, but the repository does not contain a `dist/` artifact and the Dockerfile uses source extras instead ([README.md](/home/araz/Projects/Career/s3geo/README.md:54)).
* The root Compose configuration requires an uncommitted `.env`; `.env.example` does not provide actual provider credentials or an executable environment guarantee.
* The active frontend and nested `frontend/smart-spatial-frontend/` each have independent package manifests/locks. The Dockerfile builds only the active frontend directory, while lint discovers both trees.
