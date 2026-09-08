"use client";
import { useState } from "react";
import type { CountryRow } from "@/lib/types";
import ExportButtons from "@/components/ExportButtons";
import { exportExcel, exportPdf } from "@/lib/exportUtils";
import { useLanguage } from "./LanguageProvider";

type SortKey = keyof CountryRow;

export default function BreakdownTable({ countries, isAdmin, canExport }: { countries: CountryRow[]; isAdmin?: boolean; canExport?: boolean }) {
  const { t } = useLanguage();
  const [sorted, setSorted] = useState<CountryRow[]>(
    [...countries].sort((a, b) => a.country.localeCompare(b.country))
  );
  const [sortCol, setSortCol] = useState(-1);
  const [sortAsc, setSortAsc] = useState(true);

  const cols: { label: string; key: SortKey }[] = [
    { label: t("colCountry"),      key: "country" },
    { label: t("colTotalActions"), key: "actions" },
    { label: t("colPctCompleted"), key: "completed" },
    { label: t("colPctInProgress"),key: "inprogress" },
    { label: t("colResponsible"),  key: "entity" },
  ];

  function handleSort(idx: number, key: SortKey) {
    const asc = sortCol === idx ? !sortAsc : true;
    setSortCol(idx); setSortAsc(asc);
    setSorted([...sorted].sort((a, b) => {
      const av = a[key], bv = b[key];
      if (av < bv) return asc ? -1 : 1;
      if (av > bv) return asc ? 1 : -1;
      return 0;
    }));
  }

  async function handleExcel() {
    const headers = [t("colCountry"), t("colTotalActions"), t("colPctCompleted"), t("colPctInProgress"), "Implementation Status", t("notStarted"), "Entity"];
    const rows = sorted.map(r => [r.country, r.actions, r.completed, r.inprogress, r.completed + r.inprogress, r.notstarted, r.entity]);
    await exportExcel("AFCAC_Country_Breakdown", t("actionPlanBreakdown"), headers, rows);
  }

  async function handlePdf() {
    const headers = [t("colCountry"), t("totalActions"), t("completed"), t("inProgress"), "Implementation Status", t("notStarted"), "Entity"];
    const rows = sorted.map(r => [r.country, r.actions, `${r.completed}%`, `${r.inprogress}%`, `${r.completed + r.inprogress}%`, `${r.notstarted}%`, r.entity]);
    await exportPdf("AFCAC_Country_Breakdown", t("actionPlanBreakdown"), headers, rows, `${sorted.length} African States`);
  }

  return (
    <div className="card">
      <div className="card-head">
        <span className="card-head-title">{t("actionPlanBreakdown")}</span>
        <span className="card-head-badge">{sorted.length} {t("countries")}</span>
        {(canExport ?? isAdmin) && <ExportButtons onExcel={handleExcel} onPdf={handlePdf} />}
      </div>
      <div className="tbl-scroll" style={{ maxHeight: "none" }}>
        <table className="dtable">
          <thead>
            <tr>
              {cols.map((c, i) => (
                <th key={c.key} onClick={() => handleSort(i, c.key)}>
                  {c.label} {sortCol === i ? (sortAsc ? "↑" : "↓") : ""}
                </th>
              ))}
              <th>{t("colProgressVisual")}</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr key={row.country}>
                <td style={{ fontWeight: 600 }}>{row.country}</td>
                <td style={{ textAlign: "center" }}>{row.actions}</td>
                <td>
                  <span style={{ color: "#2d9d5e", fontWeight: 700 }}>{row.completed}%</span>
                </td>
                <td>
                  <span style={{ color: "var(--c-progress)", fontWeight: 700 }}>{row.inprogress}%</span>
                </td>
                <td style={{ color: "var(--ink3)", fontSize: 11 }}>{row.entity}</td>
                <td style={{ minWidth: 120 }}>
                  <div style={{ display: "flex", gap: 2, height: 10 }}>
                    {[
                      { pct: row.completed,  color: "#2d9d5e" },
                      { pct: row.inprogress, color: "#f0a500" },
                      { pct: row.delayed,    color: "#e74c3c" },
                      { pct: row.notstarted, color: "#95a5a6" },
                    ].map((s, si) =>
                      s.pct > 0 ? (
                        <div
                          key={si}
                          style={{ width: `${s.pct}%`, background: s.color, borderRadius: 2, minWidth: 3 }}
                          title={`${s.pct}%`}
                        />
                      ) : null
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
