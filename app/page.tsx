import { getDashboardData, getTopExperts, getAllCountryTargets, findUser, filterDashboardForCountry, filterDashboardForCountries, getLastCountryUpdate } from "@/lib/data";
import { getServerSession } from "@/lib/auth";
import { getSessions } from "@/lib/sessions";
import { cookies } from "next/headers";
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import HeaderControls from "@/components/HeaderControls";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import DocsDropdown from "@/components/DocsDropdown";
import KpiGrid from "@/components/KpiGrid";
import StatusBar from "@/components/StatusBar";
import ActionTable from "@/components/ActionTable";
import BreakdownTable from "@/components/BreakdownTable";
import TargetGrid from "@/components/TargetGrid";
import AfricaMap from "@/components/AfricaMap";
import StatusDonut from "@/components/StatusDonut";
import CountryReportCard from "@/components/CountryReportCard";

export const dynamic = "force-dynamic"; // always fresh data

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const langCookie = cookieStore.get("lang")?.value;
  const locale: Locale = langCookie === "fr" || langCookie === "pt" || langCookie === "ar" ? langCookie : "en";

  const [rawData, allCountryTargets, session, allSessions] = await Promise.all([
    getDashboardData(),
    getAllCountryTargets(),
    getServerSession(),
    getSessions(),
  ]);
  const connectedUsers = new Set(allSessions.map(s => s.username)).size;

  const isAdmin = session?.role === "admin" || session?.role === "observer";

  // Determine user country/countries for filtering
  let userCountry: string | null = null;
  let userCountries: string[] | null = null;
  if (session && !isAdmin) {
    const appUser = await findUser(session.username);
    userCountries = appUser?.countries?.length ? appUser.countries : null;
    userCountry   = userCountries ? null : (appUser?.country?.trim() || null);
  }

  // Apply country filter: RSOO → multi-country, focal_point/expert → single country
  const filtered = userCountries
    ? filterDashboardForCountries(rawData, allCountryTargets, userCountries)
    : (!isAdmin && userCountry)
      ? filterDashboardForCountry(rawData, allCountryTargets, userCountry)
      : null;

  const { kpis, actions, countries, targets } = filtered ?? rawData;
  const countryTargets = filtered?.countryTargets ?? allCountryTargets;

  const [experts, lastCountryUpdate] = await Promise.all([
    getTopExperts(3, userCountry),
    getLastCountryUpdate(userCountry),
  ]);

  return (
    <>
      {/* ── HEADER ── */}
      <header className="db-header">
        <div className="db-header-inner">
          <div className="db-emblem">
            <img src="/afcac_logo.png" alt="AFCAC Logo" style={{ height: 44, width: "auto", objectFit: "contain" }} />
          </div>
          <div className="db-title-wrap">
            <div className="db-title">{t(locale, "dashboardTitle")}</div>
            <div className="db-sub">{t(locale, "dashboardSub")}</div>
          </div>
          <div className="db-controls">
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div className="status-dot" />
              <span className="live-label">{t(locale, "live")}</span>
            </div>
            <LanguageSwitcher />
            <DocsDropdown show={!!session} />
            <HeaderControls session={session} />
          </div>
        </div>
      </header>

      {/* ── MAIN CANVAS ── */}
      <div className="canvas">

        {/* Section 1: KPI Summary */}
        <div className="section-label">{t(locale, "execSummary")}</div>
        <KpiGrid kpis={kpis} experts={experts} locale={locale} lastCountryUpdate={lastCountryUpdate} isCountryProfile={!isAdmin && !!userCountry} globalPctCompleted={rawData.kpis.pctCompleted} connectedUsers={connectedUsers} />

        {/* Section 2: Status + Action Table */}
        <div className="section-label">{t(locale, "statusOverview")}</div>
        <div className="row-wide">
          <StatusDonut kpis={kpis} isAdmin={isAdmin} targets={targets} />
          <ActionTable actions={actions} targets={targets} countryTargets={countryTargets} isAdmin={isAdmin} canExport={isAdmin} />
        </div>

        {/* Section 3: Map + Status Bar */}
        <div className="section-label">{t(locale, "geoOverview")}</div>
        <div className="row-map">
          <AfricaMap countries={countries} isAdmin={isAdmin} allCountryTargets={allCountryTargets} />
          <StatusBar kpis={kpis} isAdmin={isAdmin} canExport={!!session} isCountryProfile={!isAdmin && !!userCountry} targets={targets} />
        </div>

        {/* Section 4: Country Breakdown — hidden for country profile */}
        {!userCountry && (
          <>
            <div className="section-label">{t(locale, "countryBreakdown")}</div>
            <BreakdownTable countries={countries} isAdmin={isAdmin} canExport={!!session} />
          </>
        )}

        {/* Section 5: Safety Targets */}
        <div className="section-label">{t(locale, "questProgress")}</div>
        <TargetGrid targets={targets} isAdmin={isAdmin} canExport={!!session} allCountryTargets={isAdmin ? allCountryTargets : undefined} />

        {/* Section 6: Download Reports (all authenticated users) */}
        {session && (
          <>
            <div className="section-label">{t(locale, "reportSection")}</div>
            <CountryReportCard
              kpis={kpis}
              countries={countries}
              targets={targets}
              actions={actions}
              userCountry={userCountry}
            />
          </>
        )}

      </div>

      {/* ── FOOTER ── */}
      <footer className="db-footer">
        <span>
          <strong>{t(locale, "footerTitle")}</strong> ·{" "}
          {t(locale, "lastUpdated")}: {kpis.lastUpdated}
        </span>
        <span>{t(locale, "footerSource")}</span>
      </footer>
    </>
  );
}
