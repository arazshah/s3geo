from orchestrator.planning.llm_spec_generator import (
    StaticLLMClient,
    LLMQuerySpecGenerator,
    query_spec_to_dict,
    build_llm_messages,
)


def test_generator_pre_normalizes_operation_inputs_array_to_object():
    client = StaticLLMClient(
        """
        {
          "goal": "nearest shopping center to metro",
          "entities": [],
          "operations": [
            {
              "op": "query_database",
              "inputs": {},
              "params": {
                "source_type": "postgis",
                "mode": "select_table",
                "schema": "public",
                "table": "planet_osm_point",
                "columns": ["osm_id", "name"],
                "geom_col": "way",
                "geom_alias": "geom",
                "where": "\\"way\\" IS NOT NULL",
                "limit": 100,
                "output_srid": 3857
              },
              "output": "metro_layer"
            },
            {
              "op": "spatial_nearest",
              "inputs": [
                {"source": "metro_layer"},
                {"target": "shopping_layer"}
              ],
              "params": [
                {"k": 1},
                {"include_target_geometry": true}
              ],
              "output": "nearest_result"
            }
          ],
          "outputs": [
            {
              "kind": "vector",
              "source": "nearest_result",
              "format": "geojson",
              "config": [
                {"display": true}
              ]
            }
          ],
          "metadata": {}
        }
        """
    )

    spec = LLMQuerySpecGenerator(client).generate(
        "نزدیک‌ترین مرکز خرید به هر ایستگاه مترو"
    )

    data = query_spec_to_dict(spec)

    nearest = data["operations"][1]
    assert nearest["inputs"] == {
        "source": "metro_layer",
        "target": "shopping_layer",
    }
    assert nearest["params"]["k"] == 1
    assert nearest["params"]["include_target_geometry"] is True

    assert data["outputs"][0]["config"] == {"display": True}


def test_semantic_context_prompt_explicitly_requires_inputs_and_params_objects():
    messages = build_llm_messages(
        "نزدیک‌ترین مرکز خرید به هر ایستگاه مترو",
        context={
            "semantic_planning_context": {
                "detected_concepts": ["metro_station", "shopping_center"],
                "guardrails": {
                    "llm_must_not_generate_raw_sql": True,
                    "llm_must_not_invent_table_names": True,
                    "llm_must_not_invent_column_names": True,
                },
            }
        },
    )

    system = messages[0]["content"]

    assert "operations[i].inputs must be a JSON object, never an array" in system
    assert "operations[i].params must be a JSON object, never an array" in system
    assert '"inputs": {"source": "metro_layer", "target": "shopping_layer"}' in system


def test_generator_repairs_attribute_value_filter_to_where_expression():
    client = StaticLLMClient(
        """
        {
          "goal": "filter subsidence zones",
          "entities": [],
          "operations": [
            {
              "op": "filter_attribute",
              "inputs": {"vector": "uploaded_geojson"},
              "params": {"attribute": "layer", "value": "subsidence_zone"},
              "output": "hazard_zones"
            }
          ],
          "outputs": [],
          "metadata": {}
        }
        """
    )

    spec = LLMQuerySpecGenerator(client).generate("filter hazard zones")
    operation = query_spec_to_dict(spec)["operations"][0]

    assert operation["params"] == {"where": {"layer": "subsidence_zone"}}


def test_generator_binds_render_pdf_to_preceding_report_output():
    client = StaticLLMClient(
        """
        {
          "goal": "rank and render report",
          "entities": [],
          "operations": [
            {
              "op": "build_report",
              "inputs": {"vector": "ranked_features"},
              "params": {},
              "output": "hazard_report"
            },
            {
              "op": "render_pdf",
              "inputs": {},
              "params": {"save_to_disk": true},
              "output": "hazard_pdf"
            }
          ],
          "outputs": [
            {"kind": "report", "source": "hazard_pdf", "format": "pdf", "config": {}}
          ],
          "metadata": {}
        }
        """
    )

    spec = LLMQuerySpecGenerator(client).generate("generate a PDF report")
    operations = query_spec_to_dict(spec)["operations"]
    render = next(op for op in operations if op["op"] == "render_pdf")

    assert render["inputs"] == {"report": "hazard_report"}


def test_generator_preserves_report_and_selects_rendered_pdf_output():
    client = StaticLLMClient(
        """
        {
          "goal": "rank and render report",
          "entities": [],
          "operations": [
            {"op": "build_report", "inputs": {"vector": "ranked"}, "params": {}, "output": "hazard_report"},
            {"op": "render_pdf", "inputs": {"report": "hazard_report"}, "params": {}, "output": "hazard_pdf"}
          ],
          "outputs": [
            {"kind": "report", "source": "hazard_report", "format": "pdf", "config": {}}
          ],
          "metadata": {}
        }
        """
    )

    spec = query_spec_to_dict(
        LLMQuerySpecGenerator(client).generate("generate a PDF report")
    )

    render = next(op for op in spec["operations"] if op["op"] == "render_pdf")
    assert render["params"]["save_to_disk"] is True
    assert [(item["source"], item["format"]) for item in spec["outputs"]] == [
        ("hazard_report", "json"),
        ("hazard_pdf", "pdf"),
    ]


def test_generator_repairs_mislabeled_render_pdf_report_role():
    client = StaticLLMClient(
        """
        {
          "goal": "render reports",
          "entities": [],
          "operations": [
            {"op": "build_report", "inputs": {"vector": "ranked"}, "params": {}, "output": "ranking_report"},
            {"op": "render_pdf", "inputs": {"vector": "ranking_report"}, "params": {}, "output": "ranking_pdf"}
          ],
          "outputs": [
            {"kind": "report", "source": "ranking_report", "format": "pdf", "config": {}}
          ],
          "metadata": {}
        }
        """
    )

    spec = query_spec_to_dict(
        LLMQuerySpecGenerator(client).generate("generate ranking PDF")
    )
    render = next(operation for operation in spec["operations"] if operation["op"] == "render_pdf")

    assert render["inputs"] == {"report": "ranking_report"}
    assert spec["outputs"][-1]["source"] == "ranking_pdf"


def test_generator_injects_pdf_renderers_for_existing_report_outputs():
    client = StaticLLMClient(
        """
        {
          "goal": "generate reports",
          "entities": [],
          "operations": [
            {"op": "build_report", "inputs": {"vector": "validated"}, "params": {}, "output": "validation_report"},
            {"op": "build_report", "inputs": {"vector": "ranked"}, "params": {}, "output": "ranking_report"}
          ],
          "outputs": [
            {"kind": "report", "source": "validation_report", "format": "pdf", "config": {}},
            {"kind": "report", "source": "ranking_report", "format": "pdf", "config": {}}
          ],
          "metadata": {}
        }
        """
    )

    spec = query_spec_to_dict(
        LLMQuerySpecGenerator(client).generate("generate both PDF reports")
    )
    renders = [operation for operation in spec["operations"] if operation["op"] == "render_pdf"]

    assert [operation["inputs"]["report"] for operation in renders] == [
        "validation_report",
        "ranking_report",
    ]
    assert [(output["source"], output["format"]) for output in spec["outputs"]] == [
        ("validation_report", "json"),
        ("validation_report_pdf", "pdf"),
        ("ranking_report", "json"),
        ("ranking_report_pdf", "pdf"),
    ]


def test_generator_uses_explicit_query_rank_order_instead_of_default_scoring():
    client = StaticLLMClient(
        """
        {
          "goal": "rank hazards",
          "entities": [],
          "operations": [
            {"op": "score_features", "inputs": {"vector": "hazards"}, "params": {}, "output": "scored"},
            {"op": "rank_features", "inputs": {"vector": "scored"}, "params": {}, "output": "ranked"}
          ],
          "outputs": [],
          "metadata": {}
        }
        """
    )

    query = """Rank the hazard zones using this deterministic rule:
1. annual_rate_mm descending;
2. probability_score descending;
3. confidence_score descending;
4. monitoring_priority ascending.
"""
    operations = query_spec_to_dict(
        LLMQuerySpecGenerator(client).generate(query)
    )["operations"]

    assert [operation["op"] for operation in operations] == ["rank_features"]
    assert operations[0]["inputs"] == {"vector": "hazards"}
    assert operations[0]["params"]["sort_by"] == [
        "annual_rate_mm",
        "probability_score",
        "confidence_score",
        "monitoring_priority",
    ]
    assert operations[0]["params"]["order"] == ["desc", "desc", "desc", "asc"]


def test_generator_normalizes_structured_multi_field_sort_items():
    client = StaticLLMClient(
        """
        {
          "goal": "rank hazards",
          "entities": [],
          "operations": [
            {
              "op": "rank_features",
              "inputs": {"vector": "hazards"},
              "params": {
                "sort_by": [
                  {"field": "annual_rate_mm", "order": "descending"},
                  {"field": "monitoring_priority", "order": "ascending"}
                ]
              },
              "output": "ranked"
            }
          ],
          "outputs": [],
          "metadata": {}
        }
        """
    )

    rank = query_spec_to_dict(
        LLMQuerySpecGenerator(client).generate("rank hazards")
    )["operations"][0]

    assert rank["params"]["sort_by"] == [
        "annual_rate_mm",
        "monitoring_priority",
    ]
    assert rank["params"]["order"] == ["desc", "asc"]


def test_generator_converts_field_only_scoring_to_multi_field_ranking():
    client = StaticLLMClient(
        """
        {
          "goal": "rank hazards",
          "entities": [],
          "operations": [
            {
              "op": "score_features",
              "inputs": {"vector": "hazards"},
              "params": {"fields": ["annual_rate_mm", "probability_score", "monitoring_priority"]},
              "output": "scored"
            },
            {
              "op": "rank_features",
              "inputs": {"vector": "scored"},
              "params": {"order": ["annual_rate_mm", "probability_score", "monitoring_priority"]},
              "output": "ranked"
            }
          ],
          "outputs": [],
          "metadata": {}
        }
        """
    )

    spec = LLMQuerySpecGenerator(client).generate("rank hazards by rate and probability")
    operations = query_spec_to_dict(spec)["operations"]

    assert [op["op"] for op in operations] == ["rank_features"]
    assert operations[0]["inputs"] == {"vector": "hazards"}
    assert operations[0]["params"]["sort_by"] == [
        "annual_rate_mm",
        "probability_score",
        "monitoring_priority",
    ]
    assert operations[0]["params"]["order"] == ["desc", "desc", "asc"]


def test_generator_rewrites_report_input_from_inspection_to_source_vector():
    client = StaticLLMClient(
        """
        {
          "goal": "validate and report",
          "entities": [],
          "operations": [
            {"op": "inspect_vector", "inputs": {"vector": "uploaded_geojson"}, "params": {}, "output": "inspection"},
            {"op": "build_report", "inputs": {"vector": "inspection"}, "params": {}, "output": "report"}
          ],
          "outputs": [],
          "metadata": {}
        }
        """
    )

    spec = LLMQuerySpecGenerator(client).generate("inspect and report")
    report = next(op for op in query_spec_to_dict(spec)["operations"] if op["op"] == "build_report")

    assert report["inputs"] == {"vector": "uploaded_geojson"}


def test_generator_propagates_rank_fields_through_filter_to_report():
    client = StaticLLMClient(
        """
        {
          "goal": "rank, filter, and report hazards",
          "entities": [],
          "operations": [
            {
              "op": "rank_features",
              "inputs": {"vector": "hazards"},
              "params": {
                "sort_by": ["annual_rate_mm", "probability_score"],
                "order": ["desc", "desc"],
                "rank_field": "rank"
              },
              "output": "ranked"
            },
            {
              "op": "filter_attribute",
              "inputs": {"vector": "ranked"},
              "params": {"field": "hazard_class", "operator": "eq", "value": "high"},
              "output": "high_priority"
            },
            {
              "op": "build_report",
              "inputs": {"vector": "high_priority"},
              "params": {},
              "output": "hazard_report"
            }
          ],
          "outputs": [],
          "metadata": {}
        }
        """
    )

    operations = query_spec_to_dict(
        LLMQuerySpecGenerator(client).generate("rank hazards and report high priority zones")
    )["operations"]
    report = next(operation for operation in operations if operation["op"] == "build_report")

    assert report["params"]["score_field"] == "annual_rate_mm"
    assert report["params"]["rank_field"] == "rank"


def test_generator_reclassifies_build_report_named_as_geojson():
    client = StaticLLMClient(
        """
        {
          "goal": "return high priority hazards as GeoJSON",
          "entities": [],
          "operations": [
            {
              "op": "filter_attribute",
              "inputs": {"vector": "hazards"},
              "params": {"field": "risk_class", "operator": "eq", "value": "High"},
              "output": "high_priority_hazards"
            },
            {
              "op": "build_report",
              "inputs": {"vector": "high_priority_hazards"},
              "params": {},
              "output": "high_priority_hazard_geojson"
            }
          ],
          "outputs": [
            {"kind": "report", "source": "high_priority_hazard_geojson", "format": "json", "config": {}}
          ],
          "metadata": {}
        }
        """
    )

    spec = query_spec_to_dict(
        LLMQuerySpecGenerator(client).generate("return high priority hazards as GeoJSON")
    )

    assert [operation["op"] for operation in spec["operations"]] == ["filter_attribute"]
    assert spec["outputs"] == [
        {
            "kind": "vector",
            "source": "high_priority_hazards",
            "format": "geojson",
            "config": {},
        }
    ]


def test_generator_preserves_high_priority_report_vector_as_geojson():
    client = StaticLLMClient(
        """
        {
          "goal": "report high priority hazards",
          "entities": [],
          "operations": [
            {
              "op": "filter_attribute",
              "inputs": {"vector": "hazards"},
              "params": {"field": "risk_class", "operator": "eq", "value": "High"},
              "output": "high_priority_hazards"
            },
            {
              "op": "build_report",
              "inputs": {"vector": "high_priority_hazards"},
              "params": {},
              "output": "high_priority_hazard_report"
            }
          ],
          "outputs": [
            {"kind": "report", "source": "high_priority_hazard_report", "format": "json", "config": {}}
          ],
          "metadata": {}
        }
        """
    )

    outputs = query_spec_to_dict(
        LLMQuerySpecGenerator(client).generate("report and return high priority hazards")
    )["outputs"]

    assert {
        "kind": "vector",
        "source": "high_priority_hazards",
        "format": "geojson",
        "config": {},
    } in outputs


def test_generator_preserves_unselected_high_priority_vector_output():
    client = StaticLLMClient(
        """
        {
          "goal": "rank hazards and create a PDF",
          "entities": [],
          "operations": [
            {
              "op": "rank_features",
              "inputs": {"vector": "hazards"},
              "params": {"sort_by": ["annual_rate_mm"], "order": ["desc"]},
              "output": "ranked_hazards"
            },
            {
              "op": "filter_attribute",
              "inputs": {"vector": "ranked_hazards"},
              "params": {"field": "risk_class", "operator": "eq", "value": "High"},
              "output": "high_priority_hazard_zones"
            },
            {
              "op": "build_report",
              "inputs": {"vector": "ranked_hazards"},
              "params": {},
              "output": "hazard_report"
            }
          ],
          "outputs": [
            {"kind": "report", "source": "hazard_report", "format": "pdf", "config": {}}
          ],
          "metadata": {}
        }
        """
    )

    outputs = query_spec_to_dict(
        LLMQuerySpecGenerator(client).generate("rank hazards, map high priority zones, and create PDF")
    )["outputs"]

    assert {
        "kind": "vector",
        "source": "high_priority_hazard_zones",
        "format": "geojson",
        "config": {},
    } in outputs
