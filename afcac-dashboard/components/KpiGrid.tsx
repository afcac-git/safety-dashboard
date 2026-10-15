import { type ReactNode } from "react";
import type { KpiData, ExpertStat, UpdateLog } from "@/lib/types";
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import TopExpertsCard from "./TopExpertsCard";

interface KpiCardProps {
  icon: string;
  iconBg: string;
  value: string;
  valueColor?: string;
  label: string;
  trend: string;
  trendClass: string;
  colorClass: string;
  delay?: string;
  bottomNote?: ReactNode;
}

function KpiCard({ icon, iconBg, value, valueColor, label, trend, trendClass, colorClass, delay, bottomNote }: KpiCardProps) {
  return (
    <div className={`kpi-card ${colorClass}`} style={delay ? { animationDelay: delay } : {}}>
      <div className="kpi-icon-wrap" style={{ background: iconBg }}>{icon}</div>
      <div className="kpi-val" style={valueColor ? { color: valueColor } : {}}>{value}</div>
      <div className="kpi-label">{label}</div>
      <div className={`kpi-trend ${trendClass}`}>{trend}</div>
      {bottomNote && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(0,0,0,0.07)", fontSize: 10, color: "var(--ink3)", display: "flex", alignItems: "center", gap: 5 }}>
          {bottomNote}
        </div>
      )}
    </div>
  );
}

export default function KpiGrid({ kpis, experts, locale = "en", lastCountryUpdate, isCountryProfile = false, globalPctCompleted = 0, connectedUsers = 0 }: { kpis: KpiData; experts: ExpertStat[]; locale?: Locale; lastCountryUpdate?: UpdateLog | null; isCountryProfile?: boolean; globalPctCompleted?: number; connectedUsers?: number }) {
  return (
    <div className="kpi-grid">
      <KpiCard
        colorClass="k-teal" icon="🌍" iconBg="#e8f5ee"
        value={String(kpis.totalCountries)} label={t(locale, "totalCountries")}
        trend="" trendClass="trend-flat" delay=".05s"
      />
      <KpiCard
        colorClass="k-green" icon="✅" iconBg="#d4f0e0"
        value={`${kpis.pctCompleted}%`} valueColor="#2d9d5e"
        label={t(locale, "avgCompletionRate")}
        trend="" trendClass="trend-flat" delay=".15s"
      />
      <KpiCard
        colorClass="k-amber" icon="⏳" iconBg="#fff0e0"
        value={`${kpis.pctInProgress}%`} valueColor="#f0a500"
        label={t(locale, "statesWithProgress")}
        trend="" trendClass="trend-flat" delay=".2s"
      />
      {isCountryProfile && (
        <KpiCard
          colorClass="k-red" icon="⏸" iconBg="#fdecea"
          value={`${kpis.pctNotStarted}%`} valueColor="#95a5a6"
          label={t(locale, "pctNotStarted")}
          trend={`▼ ${kpis.pctNotStartedTrend}`} trendClass="trend-down" delay=".25s"
        />
      )}
      {isCountryProfile ? (
        <KpiCard
          colorClass="k-green" icon="🌍" iconBg="#d4f0e0"
          value={`${globalPctCompleted}%`} valueColor="#2d9d5e"
          label={t(locale, "continentalProgress")}
          trend={t(locale, "continentalSub")} trendClass="trend-flat" delay=".3s"
        />
      ) : (
        <KpiCard
          colorClass="k-blue" icon="👥" iconBg="#eee8f8"
          value={String(connectedUsers)} valueColor="#2d9d5e"
          label={t(locale, "connectedUsersLabel")}
          trend={t(locale, "afcacExperts")} trendClass="trend-flat" delay=".3s"
        />
      )}
      <TopExpertsCard experts={experts} locale={locale} lastCountryUpdate={lastCountryUpdate} />
    </div>
  );
}
