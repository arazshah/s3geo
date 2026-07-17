# Smart Spatial System Backend

## Install

```bash
python -m venv .venv
source .venv/bin/activate
python -m pip install -U pip
pip install dist/*.whl

Runtime environment
bash
export SMART_SPATIAL_RUNTIME_DIR="$(pwd)/var"
export GEOCHAT_PLUGIN_CONFIG_DIR="$(pwd)/config/plugins"


If PostGIS plugins are used, configure the database password via environment variable:

bash
export POSTGIS_PASSWORD="your_password_here"

Run API
bash
uvicorn api.main:app --host 127.0.0.1 --port 8000

Health check
bash
curl http://127.0.0.1:8000/api/v1/health

API docs
text
http://127.0.0.1:8000/docs
http://127.0.0.1:8000/openapi.json

Main frontend API flow
text
POST /api/v1/query
GET  /api/v1/requests/{request_id}/outputs
GET  /api/v1/requests/{request_id}/map-layers
GET  /api/v1/requests/{request_id}/outputs/files

Uvicorn entrypoint
text
api.main:app

Included Python packages
text
api
orchestrator
plugins
smart_spatial_system
geochat_sdk
geochat_kernel

Runtime notes

Generated runtime files are written to:

text
./var


Plugin configuration files are loaded from:

text
./config/plugins


