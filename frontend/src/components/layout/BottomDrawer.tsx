import { useMemo, useState } from "react";
import {
  BarChart3,
  ChevronDown,
  ChevronUp,
  Database,
  Download,
  FileJson,
  FileText,
  FolderArchive,
  Search,
  Table2
} from "lucide-react";

import type {
  OutputFile,
  RankingRow
} from "../../data/mockSpatialData";
import { cx } from "../../utils/cx";

type BottomTab =
  | "outputs"
  | "ranking"
  | "files"
  | "reports"
  | "metadata";

type BottomDrawerProps = {
  collapsed: boolean;
  onToggle: () => void;
  rankingRows: RankingRow[];
  files: OutputFile[];
  requestId?: string;
  selectedParcelId?: string | null;
  onSelectRankingRow?: (row: RankingRow) => void;
  onDownloadFile?: (file: OutputFile) => void;
};

const tabs: Array<{
  id: BottomTab;
  label: string;
}> = [
  { id: "outputs", label: "Outputs" },
  { id: "ranking", label: "Ranking Table" },
  { id: "files", label: "Files" },
  { id: "reports", label: "Reports" },
  { id: "metadata", label: "Metadata" }
];

function escapeCsvCell(value: unknown) {
  const text = String(value ?? "");
  const escaped = text.replace(/"/g, '""');

  if (/[",\n]/.test(escaped)) {
    return `"${escaped}"`;
  }

  return escaped;
}

function downloadBlob(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function exportRankingRowsToCsv(rows: RankingRow[]) {
  const headers = [
    "Rank",
    "Parcel ID",
    "Suitability Score",
    "Distance to Metro",
    "Distance to Shopping Center",
    "Mean NDVI",
    "Mean Slope",
    "Area",
    "Recommendation"
  ];

  const body = rows.map((row) => [
    row.rank,
    row.parcelId,
    row.suitabilityScore,
    row.distanceToMetro,
    row.distanceToShoppingCenter,
    row.meanNdvi,
    row.meanSlope,
    row.area,
    row.recommendation
  ]);

  const csv = [headers, ...body]
    .map((line) => line.map(escapeCsvCell).join(","))
    .join("\n");

  downloadBlob("ranking_table.csv", csv, "text/csv;charset=utf-8;");
}

function EmptyState({
  title,
  description
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/70">
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm">
          <FolderArchive size={20} />
        </div>
        <div className="text-sm font-extrabold text-slate-800">{title}</div>
        <div className="mt-1 text-xs text-slate-500">{description}</div>
      </div>
    </div>
  );
}

function FileIcon({ type }: { type: OutputFile["type"] }) {
  if (type === "pdf") {
    return <FileText size={15} className="text-red-600" />;
  }

  if (type === "geojson") {
    return <Database size={15} className="text-emerald-600" />;
  }

  if (type === "csv") {
    return <Table2 size={15} className="text-blue-600" />;
  }

  return <FileJson size={15} className="text-slate-500" />;
}

export function BottomDrawer({
  collapsed,
  onToggle,
  rankingRows,
  files,
  requestId,
  selectedParcelId,
  onSelectRankingRow,
  onDownloadFile
}: BottomDrawerProps) {
  const [activeTab, setActiveTab] = useState<BottomTab>("ranking");
  const [searchTerm, setSearchTerm] = useState("");

  const filteredRows = useMemo(() => {
    const normalized = searchTerm.trim().toLowerCase();

    if (!normalized) {
      return rankingRows;
    }

    return rankingRows.filter((row) =>
      [
        row.rank,
        row.parcelId,
        row.suitabilityScore,
        row.distanceToMetro,
        row.distanceToShoppingCenter,
        row.meanNdvi,
        row.meanSlope,
        row.area,
        row.recommendation
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalized)
    );
  }, [rankingRows, searchTerm]);

  const reportFiles = useMemo(
    () =>
      files.filter((file) => {
        const name = file.name.toLowerCase();

        return (
          file.type === "pdf" ||
          name.includes("report") ||
          name.includes("summary") ||
          name.endsWith(".pdf") ||
          name.endsWith(".doc") ||
          name.endsWith(".docx")
        );
      }),
    [files]
  );

  const hasRequestContext = Boolean(requestId);
  const hasAnyOutputs =
    rankingRows.length > 0 || files.length > 0 || reportFiles.length > 0;

  return (
    <section
      className={cx(
        "shrink-0 border-t border-slate-200 bg-white transition-all duration-300",
        collapsed ? "h-[48px]" : "h-[230px]"
      )}
    >
      <div className="flex h-12 items-center justify-between px-4">
        <div className="flex items-center gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cx(
                "h-8 rounded-lg px-3 text-xs font-extrabold",
                activeTab === tab.id
                  ? "bg-blue-50 text-blue-700"
                  : "text-slate-600 hover:bg-slate-50"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {!collapsed && activeTab === "ranking" && (
            <>
              <div className="flex h-8 w-[240px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-2">
                <Search size={14} className="text-slate-400" />
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className="w-full bg-transparent text-xs outline-none placeholder:text-slate-400"
                  placeholder="Search ranking table..."
                />
              </div>

              <button
                onClick={() => exportRankingRowsToCsv(filteredRows)}
                className="secondary-button h-8 px-3 text-xs"
                disabled={!filteredRows.length}
              >
                <Download size={14} />
                Export CSV
              </button>
            </>
          )}

          {!collapsed && activeTab === "files" && (
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs font-bold text-slate-500">
              {files.length} files
            </div>
          )}

          <button
            onClick={onToggle}
            className="icon-button h-8 w-8"
            title={collapsed ? "Show outputs drawer" : "Hide outputs drawer"}
          >
            {collapsed ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="h-[182px] px-4 pb-4">
          {activeTab === "ranking" && (
            <div className="grid h-full grid-cols-[1fr_330px] gap-4">
              <div className="overflow-hidden rounded-xl border border-slate-200">
                {filteredRows.length ? (
                  <>
                    <div className="h-[140px] overflow-auto">
                      <table className="w-full min-w-[980px] border-collapse text-xs">
                        <thead className="sticky top-0 z-10 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                          <tr>
                            {[
                              "Rank",
                              "Parcel ID",
                              "Suitability Score",
                              "Distance to Metro",
                              "Distance to Shopping Center",
                              "Mean NDVI",
                              "Mean Slope",
                              "Area",
                              "Recommendation"
                            ].map((header) => (
                              <th key={header} className="px-3 py-3 text-left font-extrabold">
                                {header}
                              </th>
                            ))}
                          </tr>
                        </thead>

                        <tbody>
                          {filteredRows.map((row) => (
                            <tr
                              key={`${row.rank}-${row.parcelId}`}
                              onClick={() => onSelectRankingRow?.(row)}
                              className={cx(
                                "cursor-pointer border-t border-slate-200 text-slate-700 hover:bg-slate-50",
                                selectedParcelId === row.parcelId && "bg-blue-50/80 ring-1 ring-inset ring-blue-200"
                              )}
                            >
                              <td className="px-3 py-3">{row.rank}</td>
                              <td className="px-3 py-3 font-extrabold text-slate-900">{row.parcelId}</td>

                              <td className="px-3 py-3">
                                <span className="rounded-lg bg-emerald-50 px-2 py-1 font-extrabold text-emerald-700">
                                  {row.suitabilityScore}
                                </span>
                              </td>

                              <td className="px-3 py-3">{row.distanceToMetro}</td>
                              <td className="px-3 py-3">{row.distanceToShoppingCenter}</td>
                              <td className="px-3 py-3">{row.meanNdvi}</td>
                              <td className="px-3 py-3">{row.meanSlope}</td>
                              <td className="px-3 py-3">{row.area}</td>

                              <td className="px-3 py-3">
                                <span className="rounded-lg bg-blue-50 px-2 py-1 font-extrabold text-blue-700">
                                  {row.recommendation}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="border-t border-slate-200 px-3 py-2 text-[11px] font-semibold text-slate-500">
                      Showing {filteredRows.length} of {rankingRows.length} ranking rows
                    </div>
                  </>
                ) : (
                  <EmptyState
                    title="No ranking rows found"
                    description="Try another search term or run a new analysis."
                  />
                )}
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-200">
                <div className="flex h-10 items-center justify-between border-b border-slate-200 px-3">
                  <div className="text-xs font-extrabold text-slate-900">Files ({files.length})</div>
                  {requestId && (
                    <div className="max-w-[160px] truncate text-[11px] font-bold text-slate-400">
                      {requestId}
                    </div>
                  )}
                </div>

                <div className="h-[140px] overflow-y-auto p-2">
                  {files.length ? (
                    files.map((file) => (
                      <button
                        key={file.name}
                        onClick={() => onDownloadFile?.(file)}
                        className="mb-1.5 flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs hover:bg-slate-50"
                        title={`Download ${file.name}`}
                      >
                        <span className="mr-2 shrink-0">
                          <FileIcon type={file.type} />
                        </span>
                        <span className="min-w-0 flex-1 truncate font-semibold text-slate-700">
                          {file.name}
                        </span>
                        <span className="ml-2 shrink-0 text-slate-400">{file.size}</span>
                        <Download size={13} className="ml-2 shrink-0 text-blue-600" />
                      </button>
                    ))
                  ) : (
                    <EmptyState
                      title="No files loaded"
                      description="Files will appear after analysis output is generated."
                    />
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "files" && (
            <div className="h-full overflow-hidden rounded-xl border border-slate-200">
              <div className="grid h-10 grid-cols-[40px_1fr_120px_120px] items-center border-b border-slate-200 bg-slate-50 px-3 text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
                <div />
                <div>Filename</div>
                <div>Type</div>
                <div>Size</div>
              </div>

              <div className="h-[140px] overflow-y-auto">
                {files.length ? (
                  files.map((file) => (
                    <button
                      key={file.name}
                      onClick={() => onDownloadFile?.(file)}
                      className="grid h-10 w-full grid-cols-[40px_1fr_120px_120px] items-center border-b border-slate-100 px-3 text-left text-xs hover:bg-slate-50"
                    >
                      <FileIcon type={file.type} />
                      <span className="truncate font-bold text-slate-700">{file.name}</span>
                      <span className="uppercase text-slate-500">{file.type}</span>
                      <span className="text-slate-500">{file.size}</span>
                    </button>
                  ))
                ) : (
                  <EmptyState
                    title="No downloadable files"
                    description="Run an analysis or open request outputs to load backend-generated files."
                  />
                )}
              </div>
            </div>
          )}

          {activeTab === "outputs" && (
            <div className="grid h-full gap-3 md:grid-cols-4">
              {[
                {
                  title: "Ranking Rows",
                  description: rankingRows.length
                    ? "Rows available in the current backend ranking table."
                    : "No ranking table has been loaded yet.",
                  value: String(rankingRows.length)
                },
                {
                  title: "Files",
                  description: files.length
                    ? "Downloadable files returned by backend request outputs."
                    : "No backend files have been loaded yet.",
                  value: String(files.length)
                },
                {
                  title: "Reports",
                  description: reportFiles.length
                    ? "Report-like documents detected in returned files."
                    : "No report documents have been detected yet.",
                  value: String(reportFiles.length)
                },
                {
                  title: "Request",
                  description: hasRequestContext
                    ? "Current drawer is linked to a backend request."
                    : "No backend request is selected yet.",
                  value: hasRequestContext ? "1" : "0"
                }
              ].map((item) => {
                const numericValue = Number(item.value);
                const hasValue = Number.isFinite(numericValue) && numericValue > 0;

                return (
                  <div
                    key={item.title}
                    className={[
                      "rounded-xl border p-4 transition",
                      hasValue
                        ? "border-emerald-200 bg-emerald-50"
                        : "border-slate-200 bg-slate-50"
                    ].join(" ")}
                  >
                    <div
                      className={[
                        "mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-white shadow-sm",
                        hasValue ? "text-emerald-700" : "text-slate-400"
                      ].join(" ")}
                    >
                      <BarChart3 size={18} />
                    </div>
                    <div className="text-sm font-extrabold text-slate-900">{item.title}</div>
                    <div className="mt-1 min-h-[34px] text-xs leading-5 text-slate-500">
                      {item.description}
                    </div>
                    <div
                      className={[
                        "mt-3 text-2xl font-extrabold",
                        hasValue ? "text-emerald-700" : "text-slate-500"
                      ].join(" ")}
                    >
                      {item.value}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === "reports" && (
            reportFiles.length ? (
              <div className="h-full overflow-hidden rounded-xl border border-slate-200">
                <div className="grid h-10 grid-cols-[40px_1fr_120px_120px] items-center border-b border-slate-200 bg-slate-50 px-3 text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
                  <div />
                  <div>Report file</div>
                  <div>Type</div>
                  <div>Size</div>
                </div>

                <div className="h-[140px] overflow-y-auto">
                  {reportFiles.map((file) => (
                    <button
                      key={file.name}
                      onClick={() => onDownloadFile?.(file)}
                      className="grid h-10 w-full grid-cols-[40px_1fr_120px_120px] items-center border-b border-slate-100 px-3 text-left text-xs hover:bg-slate-50"
                    >
                      <FileIcon type={file.type} />
                      <span className="truncate font-bold text-slate-700">{file.name}</span>
                      <span className="uppercase text-slate-500">{file.type}</span>
                      <span className="text-slate-500">{file.size}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <EmptyState
                title="No reports available"
                description="Run an analysis with report generation enabled or open request outputs that include PDF/document files."
              />
            )
          )}

          {activeTab === "metadata" && (
            <div className="h-full overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-4">
              <pre className="text-xs leading-5 text-slate-700">
                {JSON.stringify(
                  {
                    requestId: requestId || null,
                    rankingRows: rankingRows.length,
                    files: files.length,
                    reports: reportFiles.length,
                    hasOutputs: hasAnyOutputs
                  },
                  null,
                  2
                )}
              </pre>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
