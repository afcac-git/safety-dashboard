"use client";
import { PieChart, Pie, Cell, Tooltip } from "recharts";
import type { KpiData, TargetRow } from "@/lib/types";
import ExportButtons from "@/components/ExportButtons";
import { exportExcel, exportPdf } from "@/lib/exportUtils";
import { useLanguage } from "./LanguageProvider";

type Locale = "en" | "fr" | "pt" | "ar";

const LEVEL_DEFS: { pct: number; color: string; labels: Record<Locale, string> }[] = [
  { pct: 0,   color: "#95a5a6", labels: { en: "Not Started / N/A",               fr: "Non démarré / N/A",         pt: "Não Iniciado / N/A",            ar: "غير مبدوء"       } },
  { pct: 25,  color: "#e74c3c", labels: { en: "Partially / Initiated (25%)",      fr: "Partiellement / Initié (25%)", pt: "Parcialmente / Iniciado (25%)", ar: "مبدوء جزئياً (25%)" } },
  { pct: 50,  color: "#e07b39", labels: { en: "Partially / Initiated (50%)",      fr: "Partiellement / Initié (50%)", pt: "Parcialmente / Iniciado (50%)", ar: "مبدوء جزئياً (50%)" } },
  { pct: 75,  color: "#f0a500", labels: { en: "In Progress / Partially Achieved", fr: "En cours / Part. Atteint",  pt: "Em Progresso / Part. Atingido", ar: "قيد التنفيذ"      } },
  { pct: 100, color: "#2d9d5e", labels: { en: "Fully Achieved",                   fr: "Pleinement atteint",        pt: "Totalmente Alcançado",          ar: "محقق بالكامل"    } },
];

function compute5Levels(targets: TargetRow[], locale: string) {
  const total = targets.length;
  if (total === 0) return null;
  const loc = (["en", "fr", "pt", "ar"].includes(locale) ? locale : "en") as Locale;
  return LEVEL_DEFS.map(def => ({
    name:  def.labels[loc],
    value: Math.round(targets.filter(r => r.pct === def.pct).length / total * 100),
    color: def.color,
    count: targets.filter(r => r.pct === def.pct).length,
    total,
  }));
}

export default function StatusDonut({ kpis, isAdmin, targets }: { kpis: KpiData; isAdmin?: boolean; targets?: TargetRow[] }) {
  const { t, locale } = useLanguage();

  const levels = targets && targets.length > 0 ? compute5Levels(targets, locale) : null;

  const data = levels ?? [
    { name: t("completed"),  value: kpis.pctCompleted,  color: "#2d9d5e", count: 0, total: kpis.totalActions },
    { name: t("inProgress"), value: kpis.pctInProgress, color: "#f0a500", count: 0, total: kpis.totalActions },
    { name: t("delayed"),    value: kpis.pctDelayed,    color: "#e74c3c", count: 0, total: kpis.totalActions },
    { name: t("notStarted"), value: kpis.pctNotStarted, color: "#95a5a6", count: 0, total: kpis.totalActions },
  ];

  const totalLabel = levels ? (levels[0]?.total ?? 0) : kpis.totalActions;

  async function handleExcel() {
    const headers = [t("colStatus"), "(%)", t("totalActions")];
    const rows = data.map(d => [d.name, d.value, levels ? d.count : Math.round(d.value * kpis.totalActions / 100)]);
    rows.push(["TOTAL", 100, totalLabel]);
    await exportExcel("AFCAC_Status_Distribution", t("statusDistTitle"), headers, rows);
  }

  async function handlePdf() {
    const headers = [t("colStatus"), "(%)", t("totalActions")];
    const rows = data.map(d => [d.name, `${d.value}%`, levels ? d.count : Math.round(d.value * kpis.totalActions / 100)]);
    rows.push(["TOTAL", "100%", totalLabel]);
    await exportPdf("AFCAC_Status_Distribution", t("statusDistTitle"), headers, rows, `Total: ${totalLabel} ${t("actions")}`);
  }

  return (
    <div className="card">
      <div className="card-head">
        <span className="card-head-title">{t("statusDistTitle")}</span>
        <span className="card-head-badge">{totalLabel} {t("actions")}</span>
        {isAdmin && <ExportButtons onExcel={handleExcel} onPdf={handlePdf} />}
      </div>
      <div className="card-body">
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
          <PieChart width={200} height={200}>
            <Pie data={data} cx={95} cy={95} innerRadius={50} outerRadius={85} dataKey="value" paddingAngle={1}>
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip formatter={(v) => `${v}%`} />
          </PieChart>
        </div>
        <div className="legend-list">
          {data.map((s) => (
            <div key={s.name} className="legend-item">
              <div className="legend-swatch" style={{ background: s.color }} />
              <span className="legend-name">{s.name}</span>
              <span className="legend-pct" style={{ color: s.color }}>{s.value}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
