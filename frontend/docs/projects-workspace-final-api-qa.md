# Projects Workspace Final API QA

## Stage

Stage 18.3 — Projects workspace final API QA

## Documented API contract

The Projects workspace uses only documented API endpoints:

```txt
GET  /api/v1/projects
POST /api/v1/projects
GET  /api/v1/projects/{project_id}
GET  /api/v1/projects/{project_id}/data-sources


Non-documented query fallbacks must not be used for project-scoped data sources:

txt
GET /api/v1/uploads?project_id=...
GET /api/v1/data-sources?project_id=...


Reason: the OpenAPI contract does not define these filters. If the backend ignores query parameters, global uploads may appear as project data sources for every project.

Project list behavior

Expected:

Projects are loaded from GET /api/v1/projects.
Project ID is read from:
project_id
projectId
id
slug
uuid
project_uuid
Project title is read from:
name
title
project_name
projectName
label
display_name
displayName
slug
If backend does not provide status, the card shows Backend Project.
The workspace must not show fake status values such as active.
The workspace must not show Study Area unless the documented API provides such a field.
The card displays Created instead.
Project selection behavior

Expected:

Clicking Open Project selects that project.
The selected project card is visually highlighted.
The selected card badge shows Selected.
Project details are loaded from GET /api/v1/projects/{project_id}.
Project data sources are loaded from GET /api/v1/projects/{project_id}/data-sources.
Project data sources behavior

Expected:

Project Data Sources represents only attached project data sources returned by:
txt
GET /api/v1/projects/{project_id}/data-sources

Global uploads must not be shown as project data sources.
If the endpoint returns [], the UI shows a clear empty state:
txt
No attached data sources were returned by GET /projects/{project_id}/data-sources for this project.

Current backend observation

Live backend response shows project objects with:

json
{
  "uploads": [],
  "requests": ["req-..."],
  "outputs": []
}


Therefore:

Requests count can be shown from project.requests.length.
Attached Sources count should come from project.uploads, project.data_sources, or similar attached fields.
If uploads is empty, Attached Sources should be 0.
Existing global uploads are not counted as project-attached sources.
Create project behavior

Expected:

Create Project uses POST /api/v1/projects.
Payload includes:
name
description
metadata
On success:
user sees success message.
project list refreshes.
On failure:
user sees readable error message.
Manual smoke test checklist
Open Projects from left sidebar.
Confirm AI Query panel is hidden.
Confirm project cards show Backend Project, not fake active.
Confirm no Study Area field is shown.
Confirm Created field is shown.
Click Open Project.
Confirm selected project card becomes highlighted and badge shows Selected.
Confirm Project Details updates for the selected project.
Click Data Sources.
Confirm only attached project data sources are shown.
If endpoint returns empty list, confirm clear empty state.
Confirm global uploads are not repeated for every project.
Create a new project.
Confirm list refreshes.
Build must pass. 
