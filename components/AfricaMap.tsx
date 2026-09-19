"use client";
import { useState } from "react";
import type { CountryRow, TargetRow } from "@/lib/types";
import ExportButtons from "@/components/ExportButtons";
import { exportExcel, exportPdf } from "@/lib/exportUtils";
import { useLanguage } from "./LanguageProvider";

const PCT_COLORS: { pct: number; color: string; label: string }[] = [
  { pct: 0,   color: "#95a5a6", label: "Not Started / N/A"               },
  { pct: 25,  color: "#e74c3c", label: "Partially / Initiated (0–25%)"   },
  { pct: 50,  color: "#e07b39", label: "Partially / Initiated (25–50%)"  },
  { pct: 75,  color: "#f0a500", label: "In Progress / Part. Achieved"    },
  { pct: 100, color: "#2d9d5e", label: "Fully Achieved"                  },
];

function avgPctToColor(avg: number): string {
  if (avg >= 75) return "#2d9d5e";
  if (avg >= 50) return "#f0a500";
  if (avg >= 25) return "#e07b39";
  if (avg > 0)   return "#e74c3c";
  return "#95a5a6";
}

function getTargetStats(targets: TargetRow[]) {
  const total = targets.length;
  if (total === 0) return null;
  const avg = Math.round(targets.reduce((s, t) => s + t.pct, 0) / total);
  const counts = PCT_COLORS.map(d => ({
    ...d,
    count: targets.filter(t => t.pct === d.pct).length,
    pctShare: Math.round(targets.filter(t => t.pct === d.pct).length / total * 100),
  }));
  return { avg, total, counts };
}

function hex(cx: number, cy: number, r: number): string {
  const p = (x: number, y: number) => `${Math.round(x)},${Math.round(y)}`;
  return [
    p(cx,           cy - r),
    p(cx + r*0.866, cy - r*0.5),
    p(cx + r*0.866, cy + r*0.5),
    p(cx,           cy + r),
    p(cx - r*0.866, cy + r*0.5),
    p(cx - r*0.866, cy - r*0.5),
  ].join(" ");
}

interface Tooltip { x: number; y: number; country: string; data: CountryRow | null }

export default function AfricaMap({ countries, isAdmin, allCountryTargets }: {
  countries: CountryRow[];
  isAdmin?: boolean;
  allCountryTargets?: Record<string, TargetRow[]>;
}) {
  const { t, locale } = useLanguage();
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);
  const countryMap = Object.fromEntries(countries.map((c) => [c.country, c]));

  function getColor(name: string): string {
    const row = countryMap[name];
    if (!row || row.actions === 0) return "#b8c8c0";
    const targets = allCountryTargets?.[name];
    if (targets && targets.length > 0) {
      const avg = targets.reduce((s, t) => s + t.pct, 0) / targets.length;
      return avgPctToColor(avg);
    }
    // fallback to 4-status
    const dominant = (["completed","inprogress","delayed","notstarted"] as const)
      .map(k => ({ k, v: row[k] as number }))
      .reduce((a, b) => (b.v > a.v ? b : a)).k;
    const fallback: Record<string, string> = { completed: "#2d9d5e", inprogress: "#f0a500", delayed: "#e74c3c", notstarted: "#95a5a6" };
    return fallback[dominant] ?? "#b8c8c0";
  }

  function handleMouseMove(e: React.MouseEvent, name: string) {
    const rect = (e.currentTarget as SVGElement).closest("svg")!.getBoundingClientRect();
    setTooltip({ x: e.clientX - rect.left + 10, y: e.clientY - rect.top - 10, country: name, data: countryMap[name] ?? null });
  }

  const customShapes: { name: string; points: string }[] = [
    { name: "Nigeria",      points: "188,202 222,198 236,208 233,228 216,240 194,232 180,219" },
    { name: "South Africa", points: "195,400 248,390 272,402 275,428 252,455 222,458 196,440 186,420" },
    { name: "Egypt",        points: "252,78 302,76 312,102 306,136 272,144 248,130 242,100" },
    { name: "Kenya",        points: "288,248 322,242 336,260 325,288 298,296 280,275" },
    { name: "Ethiopia",     points: "292,200 338,195 352,214 340,240 312,248 286,232 278,212" },
    { name: "Algeria",      points: "182,78 252,74 258,100 244,132 210,138 176,126 168,98" },
    { name: "Morocco",      points: "144,74 182,72 182,98 168,114 144,110 130,94" },
    { name: "Ghana",        points: "166,226 192,222 196,244 180,257 160,250 155,235" },
    { name: "Tanzania",     points: "278,292 318,286 330,310 315,336 288,340 268,318" },
    { name: "Senegal",      points: "124,178 158,175 163,193 142,204 120,200 112,188" },
    { name: "Uganda",       points: "272,244 298,240 302,262 284,270 266,262" },
    { name: "Cameroon",     points: "202,220 228,216 234,238 218,252 198,245 193,228" },
    { name: "DR Congo",     points: "216,254 272,248 284,282 272,320 242,330 210,314 200,276" },
    { name: "Zambia",       points: "232,328 274,320 284,344 270,366 240,370 218,350" },
    { name: "Zimbabwe",     points: "246,366 274,360 280,382 264,396 240,394 234,378" },
  ];

  const hexShapes: { name: string; cx: number; cy: number; r: number }[] = [
    { name: "Angola",                   cx: 243, cy: 319, r: 15 },
    { name: "Benin",                    cx: 192, cy: 202, r:  7 },
    { name: "Botswana",                 cx: 265, cy: 382, r: 11 },
    { name: "Burkina Faso",             cx: 179, cy: 185, r:  8 },
    { name: "Burundi",                  cx: 282, cy: 276, r:  5 },
    { name: "Cabo Verde",               cx:  98, cy: 164, r:  5 },
    { name: "Central African Republic", cx: 253, cy: 217, r: 12 },
    { name: "Chad",                     cx: 245, cy: 167, r: 15 },
    { name: "Comoros",                  cx: 326, cy: 321, r:  4 },
    { name: "Congo (Republic)",         cx: 228, cy: 261, r:  9 },
    { name: "Djibouti",                 cx: 330, cy: 188, r:  4 },
    { name: "Equatorial Guinea",        cx: 214, cy: 247, r:  5 },
    { name: "Eritrea",                  cx: 320, cy: 170, r:  7 },
    { name: "Eswatini",                 cx: 283, cy: 408, r:  4 },
    { name: "Gabon",                    cx: 220, cy: 262, r:  8 },
    { name: "Gambia",                   cx: 127, cy: 183, r:  4 },
    { name: "Guinea",                   cx: 146, cy: 196, r:  9 },
    { name: "Guinea-Bissau",            cx: 128, cy: 193, r:  5 },
    { name: "Cote D'Ivoire",            cx: 164, cy: 215, r: 10 },
    { name: "Lesotho",                  cx: 264, cy: 428, r:  4 },
    { name: "Liberia",                  cx: 150, cy: 222, r:  7 },
    { name: "Libya",                    cx: 240, cy: 106, r: 17 },
    { name: "Madagascar",               cx: 339, cy: 362, r: 14 },
    { name: "Malawi",                   cx: 296, cy: 331, r:  6 },
    { name: "Mali",                     cx: 169, cy: 157, r: 17 },
    { name: "Mauritania",               cx: 146, cy: 140, r: 17 },
    { name: "Mauritius",                cx: 374, cy: 372, r:  4 },
    { name: "Mozambique",               cx: 299, cy: 362, r: 12 },
    { name: "Namibia",                  cx: 236, cy: 390, r: 12 },
    { name: "Niger",                    cx: 211, cy: 156, r: 16 },
    { name: "Rwanda",                   cx: 282, cy: 268, r:  4 },
    { name: "São Tomé & Príncipe",      cx: 203, cy: 257, r:  3 },
    { name: "Seychelles",               cx: 366, cy: 284, r:  4 },
    { name: "Sierra Leone",             cx: 143, cy: 210, r:  6 },
    { name: "Somalia",                  cx: 338, cy: 228, r: 14 },
    { name: "South Sudan",              cx: 284, cy: 218, r: 13 },
    { name: "Sudan",                    cx: 282, cy: 183, r: 17 },
    { name: "Togo",                     cx: 186, cy: 210, r:  5 },
    { name: "Tunisia",                  cx: 215, cy:  62, r:  7 },
  ];

  const allShapes = [
    ...customShapes.map((s) => ({ name: s.name, points: s.points })),
    ...hexShapes.map((s) => ({ name: s.name, points: hex(s.cx, s.cy, s.r) })),
  ];

  async function handleExcel() {
    const headers = [t("colCountry"), "Targets", "Avg PCT", "0%", "25%", "50%", "75%", "100%"];
    const rows = [...countries]
      .sort((a, b) => a.country.localeCompare(b.country))
      .map(c => {
        const tgts = allCountryTargets?.[c.country] ?? [];
        const stats = getTargetStats(tgts);
        if (!stats) return [c.country, 0, 0, 0, 0, 0, 0, 0];
        return [c.country, stats.total, stats.avg,
          ...PCT_COLORS.map(d => stats.counts.find(x => x.pct === d.pct)?.count ?? 0)];
      });
    await exportExcel("AFCAC_Africa_Map_Status", t("africaMap"), headers, rows);
  }

  async function handlePdf() {
    const headers = [t("colCountry"), t("totalActions"), t("completed"), t("inProgress"), t("delayed"), t("notStarted"), t("colResponsible")];
    const rows = [...countries]
      .sort((a, b) => a.country.localeCompare(b.country))
      .map(c => [c.country, c.actions, `${c.completed}%`, `${c.inprogress}%`, `${c.delayed}%`, `${c.notstarted}%`, c.entity]);
    await exportPdf("AFCAC_Africa_Map_Status", t("africaMap"), headers, rows, t("nAfricanStates").replace("{n}", String(countries.length)), locale);
  }

  return (
    <div className="card" style={{ overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div className="card-head">
        <span className="card-head-title">{t("africaMap")}</span>
        <span className="card-head-badge">{countries.length} {t("countries")}</span>
        {isAdmin && <ExportButtons onExcel={handleExcel} onPdf={handlePdf} />}
      </div>
      <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "stretch", position: "relative" }}>
        <svg className="africa-svg" viewBox="0 0 520 540" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" style={{ width: "100%", height: "100%", display: "block" }}>
          <defs>
            <linearGradient id="oceanG" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#c8e0ea" />
              <stop offset="100%" stopColor="#a8ccd8" />
            </linearGradient>
          </defs>
          <rect width="520" height="540" fill="url(#oceanG)" />
          <polygon points="144,74 252,74 306,72 315,100 312,136 306,136 302,76 252,78 242,100 248,130 272,144 306,136 316,164 352,214 370,198 395,214 404,248 416,295 378,265 350,256 348,220 340,240 338,195 292,200 278,212 286,232 272,200 250,185 246,156 260,136 244,132 210,138 208,138 190,162 168,114 164,148 134,110 122,140 112,188 120,200 124,178 158,175 163,193 142,204 130,240 148,272 166,260 160,238 155,235 160,250 180,257 196,244 192,222 188,202 180,219 194,232 216,240 233,228 236,208 222,198 188,202 180,219 194,232 216,240 233,228 234,238 218,252 198,245 216,254 200,276 210,314 192,318 170,296 180,260 200,276 210,314 242,330 272,320 284,282 272,248 284,270 302,262 298,240 302,262 298,296 325,288 336,260 322,242 330,310 315,336 288,340 278,292 268,318 274,360 270,366 284,344 274,320 232,328 218,350 240,370 252,370 226,340 230,362 246,366 234,378 240,394 264,396 280,382 274,360 275,428 252,455 222,458 196,440 186,420 195,400 248,390 272,402" fill="#d8e8d8" opacity="0.3" />

          {allShapes.map((s) => (
            <polygon
              key={s.name}
              className="country-shape"
              data-country={s.name}
              points={s.points}
              fill={getColor(s.name)}
              opacity="0.88"
              stroke="rgba(255,255,255,0.4)"
              strokeWidth="0.5"
              onMouseMove={(e) => handleMouseMove(e, s.name)}
              onMouseLeave={() => setTooltip(null)}
            />
          ))}

          {allShapes.map((s) => {
            const pts = s.points.split(" ").map((p) => p.split(",").map(Number));
            const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length;
            const cy = pts.reduce((a, p) => a + p[1], 0) / pts.length;
            const xSpread = Math.max(...pts.map(p=>p[0])) - Math.min(...pts.map(p=>p[0]));
            if (xSpread < 10) return null;
            const short = s.name.length > 10 ? s.name.split(" ")[0] : s.name;
            return (
              <text
                key={`lbl-${s.name}`}
                x={cx} y={cy}
                textAnchor="middle"
                dominantBaseline="middle"
                style={{ fontSize: 6.5, fill: "white", fontWeight: 700, pointerEvents: "none", fontFamily: "Barlow Condensed, sans-serif", letterSpacing: "0.04em" }}
              >
                {short}
              </text>
            );
          })}
        </svg>

        {tooltip && (() => {
          const tgts = allCountryTargets?.[tooltip.country] ?? [];
          const stats = getTargetStats(tgts);
          return (
            <div className="map-tooltip" style={{ left: tooltip.x, top: tooltip.y }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>{tooltip.country}</div>
              {tooltip.data && tooltip.data.actions > 0 ? (
                stats ? (
                  <>
                    <div style={{ marginBottom: 4 }}>{stats.total} targets · avg {stats.avg}%</div>
                    {stats.counts.filter(x => x.count > 0).map(x => (
                      <div key={x.pct} style={{ color: x.color, display: "flex", justifyContent: "space-between", gap: 10 }}>
                        <span>{x.label}</span>
                        <strong>{x.count}</strong>
                      </div>
                    ))}
                    <div style={{ color: "rgba(255,255,255,0.6)", marginTop: 3 }}>{tooltip.data!.entity}</div>
                  </>
                ) : (
                  <>
                    <div>{t("targetsLabel")} {tooltip.data.actions}</div>
                    <div style={{ color: "#2d9d5e" }}>✓ {tooltip.data.completed}% {t("completed").toLowerCase()}</div>
                    <div style={{ color: "#f0a500" }}>⏳ {tooltip.data.inprogress}% {t("inProgress").toLowerCase()}</div>
                    <div style={{ color: "rgba(255,255,255,0.6)", marginTop: 3 }}>{tooltip.data.entity}</div>
                  </>
                )
              ) : (
                <div style={{ color: "rgba(255,255,255,0.5)" }}>{t("noData")}</div>
              )}
            </div>
          );
        })()}

        {/* Legend */}
        <div style={{ position: "absolute", bottom: 12, right: 12, background: "rgba(255,255,255,0.95)", borderRadius: 6, padding: "8px 12px", fontSize: 10, border: "1px solid var(--border)", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
          {PCT_COLORS.map(d => (
            <div key={d.pct} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: d.color }} />
              <span style={{ color: "var(--ink2)" }}>{d.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
