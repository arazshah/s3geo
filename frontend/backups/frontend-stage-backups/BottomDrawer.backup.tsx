import {
  ChevronDown,
  ChevronUp,
  Download
} from "lucide-react";

import type {
  OutputFile,
  RankingRow
} from "../../data/mockSpatialData";
import { cx } from "../../utils/cx";

type BottomDrawerProps = {
  collapsed: boolean;
  onToggle: () => void;
  rankingRows: RankingRow[];
  files: OutputFile[];
};

export function BottomDrawer({
  collapsed,
  onToggle,
  rankingRows,
  files
}: BottomDrawerProps) {
  return (
    <section
      className={cx(
        "shrink-0 border-t border-slate-200 bg-white transition-all duration-300",
        collapsed ? "h-[48px]" : "h-[230px]"
      )}
    >
      <div className="flex h-12 items-center justify-between px-4">
        <div className="flex items-center gap-2">
          {["Outputs", "Ranking Table", "Files", "Reports", "Trace", "Metadata"].map(
            (tab, index) => (
              <button
                key={tab}
                className={cx(
                  "h-8 rounded-lg px-3 text-xs font-extrabold",
                  index === 1
                    ? "bg-blue-50 text-blue-700"
                    : "text-slate-600 hover:bg-slate-50"
                )}
              >
                {tab}
              </button>
            )
          )}
        </div>

        <div className="flex items-center gap-2">
          {!collapsed && (
            <button className="secondary-button h-8 px-3 text-xs">
              <Download size={14} />
              Export Table
            </button>
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
        <div className="grid h-[182px] grid-cols-[1fr_330px] gap-4 px-4 pb-4">
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full border-collapse text-xs">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
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
                {rankingRows.map((row) => (
                  <tr
                    key={`${row.rank}-${row.parcelId}`}
                    className="border-t border-slate-200 text-slate-700"
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

            <div className="border-t border-slate-200 px-3 py-2 text-[11px] font-semibold text-slate-500">
              Showing 1 to {rankingRows.length} of {Math.max(rankingRows.length, 12)} results
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200">
            <div className="flex h-10 items-center justify-between border-b border-slate-200 px-3">
              <div className="text-xs font-extrabold text-slate-900">Files ({files.length})</div>
            </div>

            <div className="h-[140px] overflow-y-auto p-2">
              {files.map((file) => (
                <div
                  key={file.name}
                  className="mb-1.5 flex items-center justify-between rounded-lg px-2 py-1.5 text-xs hover:bg-slate-50"
                >
                  <span className="truncate font-semibold text-slate-700">{file.name}</span>
                  <span className="ml-2 shrink-0 text-slate-400">{file.size}</span>
                  <Download size={13} className="ml-2 shrink-0 text-blue-600" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
