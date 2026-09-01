"use client";
import { useState } from "react";
import type { ActionRow, TargetRow } from "@/lib/types";
import ExportButtons from "@/components/ExportButtons";
import { exportExcel, exportPdf } from "@/lib/exportUtils";
import { useLanguage } from "./LanguageProvider";

const SC: Record<string, { cls: string }> = {
  completed:  { cls: "s-completed" },
  inprogress: { cls: "s-inprogress" },
  delayed:    { cls: "s-delayed" },
  notstarted: { cls: "s-notstarted" },
};

// The questionnaire scale has no "Delayed" level — treat any legacy "delayed"
// status as "In Progress" so it never surfaces in the Status column.
const normStatus = (s: string): string => (s === "delayed" ? "inprogress" : s);

const PCT_COLOR: Record<number, string> = {
  0: "#95a5a6", 25: "#e74c3c", 50: "#e07b39", 75: "#f0a500", 100: "#2d9d5e",
};

export default function ActionTable({
  actions,
  targets = [],
  countryTargets = {},
  isAdmin,
  canExport,
}: {
  actions: ActionRow[];
  targets?: TargetRow[];
  countryTargets?: Record<string, TargetRow[]>;
  isAdmin?: boolean;
  canExport?: boolean;
}) {
  const { t } = useLanguage();

  const [sorted, setSorted] = useState<ActionRow[]>(
    [...actions].sort((a, b) => a.country.localeCompare(b.country))
  );
  const [sortCol, setSortCol] = useState(-1);
  const [sortAsc, setSortAsc] = useState(true);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const statusLabel: Record<string, string> = {
    completed: t("completed"),
    inprogress: t("inProgress"),
    delayed: t("delayed"),
    notstarted: t("notStarted"),
  };

  const cols: { label: string; key: keyof ActionRow }[] = [
    { label: t("colCountry"),   key: "country" },
    { label: t("colTargetId"),  key: "action" },
    { label: t("colSection"),   key: "section" },
    { label: t("colStatus"),    key: "status" },
  ];

  function handleSort(idx: number, key: keyof ActionRow) {
    const asc = sortCol === idx ? !sortAsc : true;
    setSortCol(idx);
    setSortAsc(asc);
    setSorted([...sorted].sort((a, b) => {
      const av = a[key], bv = b[key];
      if (av < bv) return asc ? -1 : 1;
      if (av > bv) return asc ? 1 : -1;
      return 0;
    }));
  }

  function toggleExpand(i: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  async function handleExcel() {
    const headers = [t("colCountry"), t("colTargetId"), t("colSection"), t("colStatus")];
    const rows = sorted.map(r => [r.country, r.action, r.section, statusLabel[r.status] ?? r.status]);
    await exportExcel("AFCAC_Action_Plan", t("actionPlanDetail"), headers, rows);
  }

  async function handlePdf() {
    const headers = [t("colCountry"), t("colTargetId"), t("colSection"), t("colStatus")];
    const rows = sorted.map(r => [r.country, r.action, r.section, statusLabel[r.status] ?? r.status]);
    await exportPdf("AFCAC_Action_Plan", t("actionPlanDetail"), headers, rows, `${sorted.length} ${t("countries")}`);
  }

  return (
    <div className="card" style={{ height: "fit-content" }}>
      <div className="card-head">
        <span className="card-head-title">{t("actionPlanDetail")}</span>
        <span className="card-head-badge">{sorted.length} {t("rows")}</span>
        {(canExport ?? isAdmin) && <ExportButtons onExcel={handleExcel} onPdf={handlePdf} />}
      </div>
      <div className="tbl-scroll">
        <table className="dtable">
          <thead>
            <tr>
              <th style={{ width: 32 }} />
              {cols.map((c, i) => (
                <th key={c.key} onClick={() => handleSort(i, c.key)}>
                  {c.label} {sortCol === i ? (sortAsc ? "↑" : "↓") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => {
              const rowStatus = normStatus(row.status);
              const s = SC[rowStatus] ?? SC.notstarted;
              const sLabel = statusLabel[rowStatus] ?? rowStatus;
              const isOpen = expanded.has(i);
              return (
                <>
                  <tr key={`row-${i}`}>
                    <td style={{ textAlign: "center", padding: "0 4px" }}>
                      <button
                        onClick={() => toggleExpand(i)}
                        style={{
                          width: 22, height: 22, borderRadius: 4,
                          border: "1.5px solid var(--border)",
                          background: isOpen ? "var(--navy)" : "var(--surface2)",
                          color: isOpen ? "#fff" : "var(--ink2)",
                          cursor: "pointer", fontSize: 14, lineHeight: 1,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontWeight: 700, transition: "all .15s",
                        }}
                        title={isOpen ? t("hideTargets") : t("seeTargets")}
                      >
                        {isOpen ? "−" : "+"}
                      </button>
                    </td>
                    <td style={{ fontWeight: 600 }}>{row.country}</td>
                    <td style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700 }}>{row.action}</td>
                    <td style={{ color: "var(--ink2)" }}>{row.section}</td>
                    <td><span className={`badge ${s.cls}`}>{sLabel}</span></td>
                  </tr>

                  {isOpen && (
                    <tr key={`expand-${i}`}>
                      <td colSpan={5} style={{ padding: 0, background: "var(--surface2)", borderBottom: "2px solid var(--border)" }}>
                        <div style={{ padding: "12px 16px" }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--ink3)", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 8 }}>
                            {t("abujaTargets")} — {row.country}
                          </div>
                          {countryTargets[row.country] ? (
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                              <thead>
                                <tr style={{ background: "var(--surface3, #eef0f3)" }}>
                                  <th style={{ padding: "5px 8px", textAlign: "left", fontWeight: 700, color: "var(--ink2)", width: 60 }}>{t("colId")}</th>
                                  <th style={{ padding: "5px 8px", textAlign: "left", fontWeight: 700, color: "var(--ink2)" }}>{t("colTarget")}</th>
                                  <th style={{ padding: "5px 8px", textAlign: "left", fontWeight: 700, color: "var(--ink2)", width: 80 }}>{t("colGroup")}</th>
                                  <th style={{ padding: "5px 8px", textAlign: "center", fontWeight: 700, color: "var(--ink2)", width: 60 }}>{t("colProgress")}</th>
                                  <th style={{ padding: "5px 8px", textAlign: "left", fontWeight: 700, color: "var(--ink2)", width: 90 }}>{t("colStatus")}</th>
                                  <th style={{ padding: "5px 8px", textAlign: "left", fontWeight: 700, color: "var(--ink2)", width: 80 }}>{t("colDeadline")}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {countryTargets[row.country].map((tRow, ti) => {
                                  const pctColor = PCT_COLOR[tRow.pct] ?? PCT_COLOR[0];
                                  const tRowStatus = normStatus(tRow.status);
                                  const ts = SC[tRowStatus] ?? SC.notstarted;
                                  const tsLabel = statusLabel[tRowStatus] ?? tRowStatus;
                                  return (
                                    <tr key={ti} style={{ borderTop: "1px solid var(--border2, #e8eaed)" }}>
                                      <td style={{ padding: "5px 8px", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, color: "var(--navy)" }}>{tRow.id}</td>
                                      <td style={{ padding: "5px 8px", color: "var(--ink1)" }}>{tRow.title}</td>
                                      <td style={{ padding: "5px 8px", color: "var(--ink3)", fontSize: 10 }}>{tRow.group}</td>
                                      <td style={{ padding: "5px 8px", textAlign: "center" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "center" }}>
                                          <div style={{ width: 40, height: 5, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
                                            <div style={{ width: `${tRow.pct}%`, height: "100%", background: pctColor, borderRadius: 3 }} />
                                          </div>
                                          <span style={{ color: pctColor, fontWeight: 700, minWidth: 28 }}>{tRow.pct}%</span>
                                        </div>
                                      </td>
                                      <td style={{ padding: "5px 8px" }}><span className={`badge ${ts.cls}`}>{tsLabel}</span></td>
                                      <td style={{ padding: "5px 8px", color: "var(--ink3)" }}>{tRow.deadline}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          ) : (
                            <div style={{ padding: "12px 8px", color: "var(--ink3)", fontSize: 11, fontStyle: "italic" }}>
                              No individual target data available for this country.
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
