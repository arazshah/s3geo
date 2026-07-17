# S3Geo

Smart Spatial System deployment bundle.

## Services

- Backend: FastAPI + Uvicorn
- Frontend: React + Vite + Nginx
- Runtime storage: Docker named volume

## Local deployment

```bash
cp .env.example .env
nano .env

docker compose build
docker compose up -d

URLs

Frontend:

text
http://localhost:8080


Backend health:

text
http://localhost:8000/api/v1/health


API documentation:

text
http://localhost:8000/docs

Logs
bash
docker compose logs -f backend
docker compose logs -f frontend

Stop
bash
docker compose down

Stop and remove runtime data
bash
docker compose down -v


The last command deletes persisted backend outputs and uploads.
