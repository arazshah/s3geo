# Left Menu API Coverage Contract

This document maps the left sidebar workspaces to the available frontend API client methods.

## Target left menu order

1. Dashboard
2. AI Query
3. Projects
4. Uploads
5. Data Source
6. Map Layers
7. Results
8. Reports
9. Plugins
10. Scoring
11. Settings
12. System Health
13. System Status card

---

## 1. Dashboard

Primary API methods:

- `api.health()`
- `api.listProjects()`
- `api.listUploads()`
- `api.listRequests()`
- `api.listPlugins()`
- `api.listWeights()`
- `api.getRuntimeSettings()`

Expected UI:

- Backend status
- API version/service info
- Projects count
- Uploads count
- Requests/results count
- Plugins status
- Scoring/weights status
- Runtime settings summary
- Recent requests if available

Notes:

- Dashboard is aggregate/read-only.
- It should have loading, empty, error, and refresh states.

---

## 2. AI Query

Primary API methods:

- `api.previewPlan(payload)`
- `api.planIntent(payload)`
- `api.runGeoQuery(payload)`
- `api.submitFeedback(payload)`
- `api.getRequest(requestId)`
- `api.getRequestOutputs(requestId)`
- `api.getRequestMapLayers(requestId)`
- `api.getRequestOutputFiles(requestId)`

Expected UI:

- Natural language query
- Project/data source context
- Plan preview
- Run analysis
- Request details
- Outputs/layers/files integration
- Feedback action if needed

Notes:

- This workspace is mostly operational.
- Future work should focus on final QA and removing stale/mock behavior.

---

## 3. Projects

Primary API methods:

- `api.listProjects()`
- `api.createProject(payload)`
- `api.getProject(projectId)`
- `api.listProjectDataSources(projectId)`

Expected UI:

- List projects
- Create project
- Select active project
- Project details
- Project data sources
- Refresh/loading/error/empty states

Known API gaps:

- No confirmed project update endpoint.
- No confirmed project delete endpoint.

---

## 4. Uploads

Primary API methods:

- `api.listUploads()`
- `api.uploadVector(file)`
- `api.uploadRaster(file)`
- `api.getUpload(uploadId)`
- `api.getUploadFileUrl(uploadId)`
- `api.downloadUploadFileUrl(uploadId)`

Expected UI:

- Upload vector
- Upload raster
- Upload list
- Upload details
- Download original uploaded file
- Refresh/loading/error/empty states

---

## 5. Data Source

Primary API methods:

- `api.getDataSource(uploadId)`
- `api.previewDataSource(uploadId)`
- `api.updateDataSource(uploadId, payload)`
- `api.deleteDataSource(uploadId)`
- `api.registerCsvTableSource(payload)`
- `api.registerPostgisSource(payload)`
- `api.registerUrlSource(payload)`
- `api.registerWfsSource(payload)`
- `api.registerWmsSource(payload)`
- `api.listProjectDataSources(projectId)`

Expected UI:

- Project data source list
- Data source metadata
- Data source preview
- Register external source
- Update source metadata
- Delete data source
- Send preview to map
- Refresh/loading/error/empty states

Known API gaps:

- No confirmed global `GET /api/v1/data-sources`.
- Listing should use `GET /api/v1/projects/{project_id}/data-sources` or a fallback based on uploads.

---

## 6. Map Layers

Primary API methods:

- `api.getRequestMapLayers(requestId)`

Related methods:

- `api.listRequests()`
- `api.getRequest(requestId)`

Expected UI:

- Request-based map layer list
- Layer visibility toggle in frontend state
- Add/remove from map
- Zoom to layer
- Copy layer ID/source
- Refresh/loading/error/empty states

Known API gaps:

- No confirmed global map layers list endpoint.
- Layers are request-derived.

---

## 7. Results

Primary API methods:

- `api.listRequests()`
- `api.getRequest(requestId)`
- `api.getRequestOutputs(requestId)`
- `api.getRequestMapLayers(requestId)`
- `api.getRequestOutputFiles(requestId)`
- `api.saveRequestOutputs(requestId, payload)`

Expected UI:

- Request/result history
- Result details
- Output summary
- Ranking preview
- Related map layers
- Related files
- Save outputs
- Refresh/loading/error/empty states

---

## 8. Reports

Primary API methods:

- `api.listRequests()`
- `api.listRequestOutputFiles(requestId)`
- `api.getRequestOutputFileUrl(requestId, filename)`
- `api.downloadRequestOutputFileUrl(requestId, filename)`
- `api.getRequestDocumentUrl(requestId, filename)`
- `api.downloadRequestDocumentUrl(requestId, filename)`

Expected UI:

- Request-based reports/files list
- Open report
- Download report
- Copy URL
- Refresh/loading/error/empty states

Known API gaps:

- No confirmed global reports list endpoint.
- Reports should be derived from request output files/documents.

---

## 9. Plugins

Primary API methods:

- `api.listPlugins()`
- `api.getPlugin(pluginId)`
- `api.patchPlugin(pluginId, payload)`
- `api.getPluginConfig(pluginId)`
- `api.putPluginConfig(pluginId, payload)`

Expected UI:

- Plugin registry list
- Plugin details
- Enable/disable or status patch if backend supports it
- Config viewer/editor
- Save config
- Refresh/loading/error/empty states

---

## 10. Scoring

Primary API methods:

- `api.listWeights()`
- `api.reloadWeights()`
- `api.saveWeights(payload)`
- `api.applyWeightProposal(payload)`

Expected UI:

- Weights/scoring display
- Reload weights
- Save weights
- Apply proposal
- Refresh/loading/error/empty states

Notes:

- Frontend menu name is `Scoring`.
- Backend/API name is `weights`.

---

## 11. Settings

Primary API methods:

- `api.getRuntimeSettings()`
- `api.llmSmokeTest(payload)`

Expected UI:

- Runtime settings read-only summary
- API base URL display
- LLM smoke test
- Frontend env hints
- Refresh/loading/error/empty states

Known API gaps:

- No confirmed runtime settings update endpoint.
- LLM credentials should not be exposed in frontend responses.

---

## 12. System Health

Primary API methods:

- `api.health()`
- `api.getRuntimeSettings()`
- `api.listPlugins()`
- `api.listWeights()`

Expected UI:

- Backend health
- Runtime settings status
- Plugin registry health
- Weights/scoring health
- API availability diagnostics
- Refresh/loading/error states

---

## 13. System Status card

Primary API methods:

- `api.health()`
- `api.getRuntimeSettings()`
- `api.listPlugins()`
- `api.listWeights()`
- `api.listRequests()`

Expected UI:

- Backend online/offline
- API version/service
- Plugin registry status
- Planner/LLM status if available
- Weights status
- Last request status if available

Notes:

- This card should be compact.
- It can share data with Dashboard/System Health where possible.

---

## Completion workflow per menu

Each menu should be completed with this sequence:

1. Audit current UI and state.
2. Confirm API methods/endpoints.
3. Add/clean API client methods only if needed.
4. Implement loading state.
5. Implement empty state.
6. Implement error state.
7. Implement success state.
8. Add refresh action.
9. Add details/action drawer if needed.
10. Build.
11. Manual smoke test.
12. Commit.
13. Move to next menu.


---

## Actual frontend navigation contract detected in Stage 18.0

The current frontend uses the following workspace keys:

| Sidebar label | Internal key | Notes |
|---|---|---|
| Dashboard | `dashboard` | Aggregate dashboard workspace |
| AI Query | `ai-query` | Natural language spatial query workspace |
| Projects | `projects` | Project list/create/detail workspace |
| Uploads | `uploads` | Vector/raster upload workspace |
| Data Sources | `data-sources` | Data source list/preview/register workspace |
| Map Layers | `map-layers` | Request-derived map layer workspace |
| Results | `outputs` | Internal key remains `outputs`; sidebar label is Results |
| Reports | `reports` | Request-derived reports/documents workspace |
| Plugins | `plugins` | Plugin registry/config workspace |
| Scoring | `weights` | Backend/API naming is weights; sidebar label is Scoring |
| Settings | `settings` | Runtime/LLM/frontend settings workspace |
| System Health | `system-health` | Backend/runtime diagnostics workspace |
| System Status card | Sidebar card/action | Compact status card in left sidebar |

Important naming notes:

- The user-facing menu says `Results`, but the internal workspace key is `outputs`.
- The user-facing menu says `Scoring`, but the internal workspace key is `weights`.
- The user-facing menu currently says `Data Sources`, while the planning name may be written as `Data Source`.
- System Status is not a full workspace key by itself; it is currently represented as a compact card/action in the left sidebar.

