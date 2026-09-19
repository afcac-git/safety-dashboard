"use client";
import type { KpiData, TargetRow } from "@/lib/types";
import ExportButtons from "@/components/ExportButtons";
import { exportExcel, exportPdf } from "@/lib/exportUtils";
import { useLanguage } from "./LanguageProvider";

type Locale = "en" | "fr" | "pt" | "ar";

const LEVEL_DEFS: { pct: number; color: string; labels: Record<Locale, string>; descs: Record<Locale, string> }[] = [
  {
    pct: 0,   color: "#95a5a6",
    labels: { en: "Not Started / N/A",               fr: "Non démarré / N/A",           pt: "Não Iniciado / N/A",            ar: "غير مبدوء"        },
    descs:  { en: "— Action not yet initiated (0%)", fr: "— Action non encore initiée (0%)", pt: "— Ação ainda não iniciada (0%)", ar: "— الإجراء لم يبدأ بعد (0%)" },
  },
  {
    pct: 25,  color: "#e74c3c",
    labels: { en: "Partially / Initiated",            fr: "Partiellement / Initié",       pt: "Parcialmente / Iniciado",       ar: "مبدوء جزئياً"     },
    descs:  { en: "— Initiated but not finalized (25%)", fr: "— Initié mais non finalisé (25%)", pt: "— Iniciado mas não finalizado (25%)", ar: "— تم البدء لكن لم يكتمل (25%)" },
  },
  {
    pct: 50,  color: "#e07b39",
    labels: { en: "Partially / Initiated",            fr: "Partiellement / Initié",       pt: "Parcialmente / Iniciado",       ar: "مبدوء جزئياً"     },
    descs:  { en: "— Partially implemented, gaps remain (50%)", fr: "— Partiellement mis en œuvre (50%)", pt: "— Parcialmente implementado (50%)", ar: "— منفذ جزئياً (50%)" },
  },
  {
    pct: 75,  color: "#f0a500",
    labels: { en: "In Progress / Partially Achieved", fr: "En cours / Part. Atteint",     pt: "Em Progresso / Part. Atingido", ar: "قيد التنفيذ"      },
    descs:  { en: "— Implementation underway, mostly achieved (75%)", fr: "— Mise en œuvre en cours, majoritairement atteint (75%)", pt: "— Implementação em curso, maioritariamente atingido (75%)", ar: "— التنفيذ جارٍ (75%)" },
  },
  {
    pct: 100, color: "#2d9d5e",
    labels: { en: "Fully Achieved",                   fr: "Pleinement atteint",            pt: "Totalmente Alcançado",          ar: "محقق بالكامل"    },
    descs:  { en: "— Target fully achieved (100%)",   fr: "— Cible pleinement atteinte (100%)", pt: "— Meta totalmente atingida (100%)", ar: "— تحقق الهدف بالكامل (100%)" },
  },
];

function compute5Segs(targets: TargetRow[], locale: string) {
  const total = targets.length;
  if (total === 0) return null;
  const loc = (["en", "fr", "pt", "ar"].includes(locale) ? locale : "en") as Locale;
  return LEVEL_DEFS.map(def => {
    const count = targets.filter(r => r.pct === def.pct).length;
    return {
      pct:   Math.round(count / total * 100),
      color: def.color,
      label: def.labels[loc],
      desc:  def.descs[loc],
      hex:   def.color,
      count,
      total,
    };
  });
}

export default function StatusBar({ kpis, isAdmin, canExport, isCountryProfile, targets }: {
  kpis: KpiData; isAdmin?: boolean; canExport?: boolean; isCountryProfile?: boolean; targets?: TargetRow[];
}) {
  const { t, locale } = useLanguage();
  const titleKey = isCountryProfile ? "stateStatusDistribution" : "statusDistribution";

  const levels = targets && targets.length > 0 ? compute5Segs(targets, locale) : null;

  const segs = levels ?? [
    { pct: kpis.pctCompleted,  color: "#2d9d5e", label: t("completed"),  hex: "#2d9d5e", desc: t("completedDesc"),  count: 0, total: kpis.totalActions },
    { pct: kpis.pctInProgress, color: "#f0a500", label: t("inProgress"), hex: "#f0a500", desc: t("inProgressDesc"), count: 0, total: kpis.totalActions },
    { pct: kpis.pctDelayed,    color: "#e74c3c", label: t("delayed"),    hex: "#e74c3c", desc: t("delayedDesc"),    count: 0, total: kpis.totalActions },
    { pct: kpis.pctNotStarted, color: "#95a5a6", label: t("notStarted"), hex: "#95a5a6", desc: t("notStartedDesc"), count: 0, total: kpis.totalActions },
  ];

  const totalCount = levels ? (levels[0]?.total ?? kpis.totalActions) : kpis.totalActions;
  const totalLabel = levels ? t("targetsPlural") : t("actions");

  async function handleExcel() {
    const headers = [t("colStatus"), "(%)", totalLabel];
    const rows = segs.map(s => [s.label, s.pct, levels ? s.count : Math.round(s.pct * kpis.totalActions / 100)]);
    rows.push([t("totalRowLabel"), 100, totalCount] as (string | number)[]);
    await exportExcel("AFCAC_Continental_Status", t(titleKey), headers, rows);
  }

  async function handlePdf() {
    const headers = [t("colStatus"), "(%)", totalLabel];
    const rows = segs.map(s => [s.label, `${s.pct}%`, levels ? s.count : Math.round(s.pct * kpis.totalActions / 100)]);
    rows.push([t("totalRowLabel"), "100%", totalCount] as (string | number)[]);
    await exportPdf("AFCAC_Continental_Status", t(titleKey), headers, rows, `${t("totalRowLabel")}: ${totalCount} ${totalLabel}`, locale);
  }

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column" }}>
      <div className="card-head">
        <span className="card-head-title">{t(titleKey)}</span>
        <span className="card-head-badge">{totalCount} {totalLabel}</span>
        {(canExport ?? isAdmin) && <ExportButtons onExcel={handleExcel} onPdf={handlePdf} />}
      </div>
      <div className="card-body" style={{ flex: 1 }}>
        {/* Stacked bar */}
        <div className="stack-bar">
          {segs.map((s) => (
            <div key={s.label + s.pct} className="stack-seg"
              style={{ width: `${s.pct}%`, background: s.color }}
              title={`${s.label} ${s.pct}%`}
            />
          ))}
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 6 }}>
          {segs.map((s) => (
            <span key={s.label + s.pct} style={{ fontSize: 10, display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: s.color, display: "inline-block", flexShrink: 0 }} />
              {s.label} <strong style={{ color: s.color }}>{s.pct}%</strong>
            </span>
          ))}
        </div>

        {/* Detailed bars */}
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border2)" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--ink3)", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 8 }}>
            {t("detailedDist")}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {segs.map((s) => (
              <div key={s.label + s.pct}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 }}>
                  <span>{s.label}</span>
                  <span style={{ color: s.color, fontWeight: 700 }}>{s.pct}%</span>
                </div>
                <div className="mini-track">
                  <div className="mini-fill" style={{ width: `${s.pct}%`, background: s.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Description */}
        <div style={{ marginTop: 24, paddingTop: 14, borderTop: "1px solid var(--border2)" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--ink3)", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 8 }}>
            {t("aboutIndicator")}
          </div>
          <ul style={{ fontSize: 11, color: "var(--ink2)", lineHeight: 1.7, margin: 0, paddingLeft: 16 }}>
            {segs.map((s) => (
              <li key={s.label + s.pct}>
                <strong style={{ color: s.color }}>{s.label}</strong> {s.desc}
              </li>
            ))}
          </ul>
          <p style={{ fontSize: 10, color: "var(--ink3)", marginTop: 10, marginBottom: 0, fontStyle: "italic" }}>
            {t("statusSource")}
          </p>
        </div>

        {/* Bar Chart */}
        <div style={{ marginTop: 24, paddingTop: 14, borderTop: "1px solid var(--border2)" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--ink3)", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 14 }}>
            {t(titleKey)}
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 130, position: "relative", paddingLeft: 28 }}>
            {[0, 25, 50, 75, 100].map((v) => (
              <div key={v} style={{
                position: "absolute", left: 28, right: 0,
                bottom: `${v}%`, height: 1,
                background: v === 0 ? "var(--border)" : "var(--border2)",
                zIndex: 0,
              }}>
                <span style={{ position: "absolute", left: -26, top: -6, fontSize: 8, color: "var(--ink3)", fontWeight: 600 }}>{v}%</span>
              </div>
            ))}
            {segs.map((s) => (
              <div key={s.label + s.pct} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%", justifyContent: "flex-end", position: "relative", zIndex: 1 }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: s.hex, marginBottom: 2 }}>{s.pct}%</span>
                <div style={{
                  width: "60%", height: `${s.pct}%`, minHeight: s.pct > 0 ? 4 : 0,
                  background: s.hex, borderRadius: "3px 3px 0 0",
                  transition: "height .4s ease",
                }} />
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6, paddingLeft: 28, marginTop: 6 }}>
            {segs.map((s) => (
              <div key={s.label + s.pct} style={{ flex: 1, textAlign: "center", fontSize: 8, color: "var(--ink2)", fontWeight: 600, lineHeight: 1.3 }}>
                {s.pct}%
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
