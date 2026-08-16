# Phase 2 frontend–backend connectivity baseline

## Proven connection

Backend: `http://127.0.0.1:8001`.

Frontend: Vite at `http://127.0.0.1:5173`, built with `VITE_API_BASE_URL=http://127.0.0.1:8001`.

Browser evidence:

* Header changed to **Backend Online / API Connected**.
* Health displayed service `OrchestratorService`.
* AI Query showed **2 datasets available** after two vector uploads.
* Projects workspace created and fetched project `prj-c2ec52ed-1482-4bb4-a71d-e3c776e54c89`.

## Failed connection configuration

With exactly the same backend and frontend URL setting but Vite at port 5174, the page showed **Backend Offline / API Unreachable**. An Origin test confirmed the response did not include `Access-Control-Allow-Origin` for that port. The static origin list contains 3000 and 5173 only ([backend/api/main.py](/home/araz/Projects/Career/s3geo/backend/api/main.py:48)).

## Confirmed contract gaps

| UI expectation | Backend observation | Consequence |
| --- | --- | --- |
| a created project appears in AI Query selector | Projects module lists one project; AI Query selector remains disabled/no projects | primary workflow cannot carry project context |
| selected upload can be sent to analysis | UI passes selected source IDs; direct vector success needs `inputs.vector_ref` | simple map request fails end-to-end |
| HTTP 200 indicates a usable analysis | failed analysis returns HTTP 200 with failure payload | client needs non-HTTP failure interpretation |
| successful result supports Files/download | direct map success has no `/outputs/files` manifest | artifact UI cannot offer a durable file |

The frontend did render Leaflet map chrome and output panels. It did **not** render a returned GeoJSON result during this phase because its only end-to-end query attempt failed. Therefore actual map-layer rendering of backend-produced geometry remains unverified.
