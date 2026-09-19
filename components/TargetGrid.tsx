"use client";
import type { TargetRow } from "@/lib/types";
import ExportButtons from "@/components/ExportButtons";
import { exportExcel, exportPdf } from "@/lib/exportUtils";
import { useLanguage } from "./LanguageProvider";

const TARGET_NAMES: Record<number, string> = {
  1:  "Safety Trend Targets",
  2:  "Safety Oversight Enhancement",
  3:  "State Safety Programme (SSP)",
  4:  "Assistance & Regional Safety Plans",
  5:  "Industry Safety Standards",
  6:  "Air Navigation & Aerodrome Infrastructure",
  7:  "Air Navigation Infrastructure Gap Analysis",
  8:  "Aerodrome Certification",
  9:  "Search and Rescue (SAR)",
  10: "AIS to AIM Transition",
  11: "Performance-Based Navigation (PBN)",
  12: "Seamless Air Navigation Services",
  13: "ASBU Implementation",
  14: "CO₂ Emissions Reduction",
  15: "ANSP Peer Review & SMS Maturity",
};

function barColor(pct: number): string {
  if (pct >= 100) return "#2d9d5e";
  if (pct >= 75)  return "#f0a500";
  if (pct >= 50)  return "#e07b39";
  if (pct >= 25)  return "#e74c3c";
  return "#95a5a6";
}

function groupNum(id: string): number {
  return parseInt(id.replace(/^T/, "").split(".")[0], 10);
}

const TOTAL_AFRICAN_STATES = 54;

export default function TargetGrid({ targets, isAdmin, canExport, allCountryTargets }: { targets: TargetRow[]; isAdmin?: boolean; canExport?: boolean; allCountryTargets?: Record<string, TargetRow[]> }) {
  const { t, locale } = useLanguage();

  function statusInfo(pct: number): { label: string; cls: string } {
    if (pct >= 100) return { label: t("completed"),   cls: "s-completed" };
    if (pct >= 50)  return { label: t("inProgress"),  cls: "s-inprogress" };
    if (pct >= 25)  return { label: t("delayed"),     cls: "s-delayed" };
    return           { label: t("notStarted"),  cls: "s-notstarted" };
  }

  const grouped = targets.reduce<Record<number, TargetRow[]>>((acc, tRow) => {
    const n = groupNum(tRow.id);
    if (!acc[n]) acc[n] = [];
    acc[n].push(tRow);
    return acc;
  }, {});

  const allSubmissions = allCountryTargets ? Object.values(allCountryTargets) : null;

  const rows = Object.entries(grouped)
    .map(([n, ts]) => {
      const num = Number(n);
      let avgPct: number;
      if (allSubmissions) {
        // Average per sub-target across all 54 countries (0 for non-submitted), then avg the group
        const groupAvg = ts.reduce((sum, tRow) => {
          const submittedSum = allSubmissions.reduce((s, sub) => s + (sub.find(x => x.id === tRow.id)?.pct ?? 0), 0);
          return sum + submittedSum / TOTAL_AFRICAN_STATES;
        }, 0);
        avgPct = Math.round(groupAvg / ts.length);
      } else {
        avgPct = Math.round(ts.reduce((s, tRow) => s + tRow.pct, 0) / ts.length);
      }
      const deadlines = [...new Set(ts.map(tRow => tRow.deadline))].join(" / ");
      return { num, name: TARGET_NAMES[num] ?? ts[0].group, avgPct, count: ts.length, deadlines };
    })
    .sort((a, b) => a.num - b.num);

  const globalAvg = Math.round(rows.reduce((s, r) => s + r.avgPct, 0) / rows.length);

  async function handleExcel() {
    const headers = [t("colHash"), t("colTarget"), `${t("colScore")} (%)`, t("colStatus"), t("colDeadline"), "Sub-targets"];
    const tableRows = rows.map(r => [r.num, r.name, r.avgPct, statusInfo(r.avgPct).label, r.deadlines, r.count]);
    tableRows.push(["", t("continentalAvg"), globalAvg, "", "", ""] as (string | number)[]);
    await exportExcel("AFCAC_Safety_Targets", t("targetAchievement"), headers, tableRows);
  }

  async function handlePdf() {
    const headers = [t("colHash"), t("colTarget"), t("colScore"), t("colStatus"), t("colDeadline"), "Sub"];
    const tableRows = rows.map(r => [r.num, r.name, `${r.avgPct}%`, statusInfo(r.avgPct).label, r.deadlines, r.count]);
    await exportPdf("AFCAC_Safety_Targets", t("targetAchievement"), headers, tableRows, `${t("continentalScore")}: ${globalAvg}%`, locale);
  }

  return (
    <div className="card">
      <div className="card-head">
        <span className="card-head-title">{t("targetAchievement")}</span>
        <span className="card-head-badge">{t("continentalScore")} · {globalAvg}%</span>
        {(canExport ?? isAdmin) && <ExportButtons onExcel={handleExcel} onPdf={handlePdf} />}
      </div>

      <div className="card-body">
        <div style={{
          display: "grid",
          gridTemplateColumns: "28px 1fr 180px 56px 80px",
          gap: 8, padding: "0 4px 8px",
          borderBottom: "1px solid var(--border2)",
          marginBottom: 6,
        }}>
          {[t("colHash"), t("colTarget"), t("colDeadline"), t("colSub"), t("colScore")].map(h => (
            <div key={h} style={{ fontSize: 9, fontWeight: 700, color: "var(--ink3)", textTransform: "uppercase", letterSpacing: ".08em" }}>
              {h}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {rows.map(r => {
            const color = barColor(r.avgPct);
            const { label, cls } = statusInfo(r.avgPct);

            return (
              <div
                key={r.num}
                style={{
                  display: "grid",
                  gridTemplateColumns: "28px 1fr 180px 56px 80px",
                  gap: 8, alignItems: "center",
                  padding: "7px 4px",
                  borderRadius: 6,
                  background: "var(--snow)",
                  border: "1px solid var(--border2)",
                  transition: "box-shadow .15s",
                }}
              >
                <div style={{
                  width: 24, height: 24, borderRadius: 5,
                  background: color, color: "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontSize: 11, fontWeight: 800,
                }}>
                  {r.num}
                </div>

                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--ink)", marginBottom: 4, lineHeight: 1.3 }}>
                    {r.name}
                  </div>
                  <div style={{ height: 6, background: "var(--border2)", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{
                      height: "100%", width: `${r.avgPct}%`,
                      background: color, borderRadius: 3,
                      transition: "width .5s ease",
                    }} />
                  </div>
                </div>

                <div style={{ fontSize: 10, color: "var(--ink3)" }}>
                  🗓 {r.deadlines}
                </div>

                <div style={{ fontSize: 10, color: "var(--ink3)", textAlign: "center" }}>
                  {r.count} {r.count > 1 ? t("targetsPlural") : t("targets")}
                </div>

                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 800, color, lineHeight: 1 }}>
                    {r.avgPct}%
                  </span>
                  <span className={`badge ${cls}`} style={{ fontSize: 9 }}>{label}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{
          marginTop: 16, padding: "12px 16px",
          background: "linear-gradient(135deg, var(--forest) 0%, var(--forest2) 100%)",
          borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,.5)", textTransform: "uppercase", letterSpacing: ".1em", fontWeight: 700, marginBottom: 2 }}>
              {t("continentalAvg")}
            </div>
            <div style={{ height: 8, width: 220, background: "rgba(255,255,255,.15)", borderRadius: 4, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${globalAvg}%`, background: "var(--gold)", borderRadius: 4, transition: "width .5s ease" }} />
            </div>
          </div>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 32, fontWeight: 800, color: "var(--gold)" }}>
            {globalAvg}%
          </div>
        </div>
      </div>
    </div>
  );
}
