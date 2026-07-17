from __future__ import annotations

from pathlib import Path

from orchestrator.service import OrchestratorService, OrchestratorServiceConfig


def test_orchestrator_uses_runtime_plugin_state_path_by_default(
    tmp_path: Path,
) -> None:
    service = OrchestratorService(
        OrchestratorServiceConfig(
            runtime_dir=tmp_path / "runtime",
            weights_path=tmp_path / "weights" / "router_weights.json",
            persist_outputs=False,
        )
    )

    expected = tmp_path / "runtime" / "config" / "plugin_state.json"

    assert service.plugin_state_path == expected
    assert service.plugin_state_store.path == expected


def test_orchestrator_accepts_custom_plugin_state_path(
    tmp_path: Path,
) -> None:
    custom_path = tmp_path / "custom-state" / "plugins.json"

    service = OrchestratorService(
        OrchestratorServiceConfig(
            weights_path=tmp_path / "weights" / "router_weights.json",
            outputs_path=tmp_path / "outputs",
            uploads_path=tmp_path / "uploads",
            projects_path=tmp_path / "projects",
            reports_path=tmp_path / "reports",
            plugin_state_path=custom_path,
            persist_outputs=False,
        )
    )

    assert service.plugin_state_path == custom_path
    assert service.plugin_state_store.path == custom_path

    service.plugin_state_store.set_enabled("local_vector_loader", False)

    assert custom_path.is_file()
    assert service.plugin_state_store.is_enabled(
        "local_vector_loader",
        default=True,
    ) is False


def test_plugin_runtime_inventory_reports_actual_plugin_state_source(
    tmp_path: Path,
) -> None:
    custom_path = tmp_path / "state" / "plugin_state.json"

    service = OrchestratorService(
        OrchestratorServiceConfig(
            weights_path=tmp_path / "weights" / "router_weights.json",
            outputs_path=tmp_path / "outputs",
            uploads_path=tmp_path / "uploads",
            projects_path=tmp_path / "projects",
            reports_path=tmp_path / "reports",
            plugin_state_path=custom_path,
            persist_outputs=False,
        )
    )

    inventory = service.plugin_runtime_service.list_plugins()

    assert inventory
    assert {
        item.get("state_source")
        for item in inventory
    } == {str(custom_path)}
