"use client";
import { useState } from "react";
import type { KpiData, CountryRow, TargetRow, ActionRow } from "@/lib/types";
import { useLanguage } from "./LanguageProvider";
import { ARABIC_FONT, registerArabicFont, shapeArabicForPdf } from "@/lib/pdfArabic";

interface Props {
  kpis: KpiData;
  countries: CountryRow[];
  targets: TargetRow[];
  actions?: ActionRow[];
  userCountry?: string | null;
}

export default function CountryReportCard({ kpis, countries, targets, actions = [], userCountry }: Props) {
  const { t, locale } = useLanguage();
  const isArabic = locale === "ar";
  const [loadingXls, setLoadingXls] = useState(false);
  const [loadingPdf, setLoadingPdf] = useState(false);

  const today = new Date().toISOString().split("T")[0];
  const dateStr = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const slug = userCountry ? userCountry.replace(/ /g, "_") : "Full";
  const reportName = `AFCAC_${slug}_Safety_Report_${today}`;
  const reportTitle = userCountry
    ? `${userCountry} — ${t("reportMainTitle")}`
    : t("reportMainTitle");

  const statusLabel: Record<string, string> = {
    completed: t("completed"),
    inprogress: t("inProgress"),
    delayed: t("delayed"),
    notstarted: t("notStarted"),
  };

  async function handleExcel() {
    setLoadingXls(true);
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();

      // Sheet 1: KPI Summary
      const wsKpi = XLSX.utils.aoa_to_sheet([
        [t("reportMainTitle")],
        [t("reportCountryLabel"), userCountry ?? t("reportAllCountries")],
        [t("lastUpdated"), kpis.lastUpdated],
        [],
        [t("colMetric"), t("colValue")],
        [t("pctCompleted"),   `${kpis.pctCompleted}%`],
        [t("pctInProgress"), `${kpis.pctInProgress}%`],
        [t("pctDelayed"),     `${kpis.pctDelayed}%`],
        [t("pctNotStarted"), `${kpis.pctNotStarted}%`],
        [t("totalCountries"),    kpis.totalCountries],
        [t("totalActions"),      kpis.totalActions],
        [t("totalBudget"), kpis.totalBudget],
        [t("reportPeriodLabel"),      kpis.reportPeriod],
      ]);
      wsKpi["!cols"] = [{ wch: 30 }, { wch: 30 }];
      XLSX.utils.book_append_sheet(wb, wsKpi, t("sheetKpiSummary"));

      // Sheet 2: Safety Targets
      const tHeaders = [t("colId"), t("colGroup"), t("colTitle"), `${t("colScore")} (%)`, t("colStatus"), t("colDeadline")];
      const tRows = targets.map(tgt => [tgt.id, tgt.group, tgt.title, tgt.pct, statusLabel[tgt.status] ?? tgt.status, tgt.deadline]);
      const wsTargets = XLSX.utils.aoa_to_sheet([tHeaders, ...tRows]);
      wsTargets["!cols"] = tHeaders.map((h, ci) => ({
        wch: Math.max(h.length, ...tRows.map(r => String(r[ci] ?? "").length)) + 2,
      }));
      XLSX.utils.book_append_sheet(wb, wsTargets, t("sheetSafetyTargets"));

      // Sheet 3: Country Breakdown (admin / multi-country only)
      if (countries.length > 1) {
        const cHeaders = [
          t("colCountry"), t("colRegion"), t("colAuthorityEntity"),
          t("colTargetsTotal"), t("colPctCompleted"), t("colPctInProgress"), t("colPctDelayed"), t("colPctNotStarted"),
          t("colBudgetUsd"),
        ];
        const cRows = countries.map(c => [
          c.country, c.region, c.entity ?? "",
          c.actions, c.completed, c.inprogress, c.delayed, c.notstarted,
          c.budget ?? 0,
        ]);
        const wsCountries = XLSX.utils.aoa_to_sheet([cHeaders, ...cRows]);
        wsCountries["!cols"] = cHeaders.map((h, ci) => ({
          wch: Math.max(h.length, ...cRows.map(r => String(r[ci] ?? "").length)) + 2,
        }));
        XLSX.utils.book_append_sheet(wb, wsCountries, t("sheetCountryBreakdown"));
      }

      // Sheet 4: Action Plans (one row per country)
      if (actions.length > 0) {
        const aHeaders = [
          t("colCountry"), t("colActionTarget"), t("colSection"), t("colStatus"),
          t("colStartYear"), t("colEndYear"), t("colDurationWeeks"), t("colBudgetUsd"),
        ];
        const aRows = actions.map(a => [
          a.country, a.action, a.section, statusLabel[a.status] ?? a.status,
          a.start, a.end, a.duration, a.budget ?? 0,
        ]);
        const wsActions = XLSX.utils.aoa_to_sheet([aHeaders, ...aRows]);
        wsActions["!cols"] = aHeaders.map((h, ci) => ({
          wch: Math.max(h.length, ...aRows.map(r => String(r[ci] ?? "").length)) + 2,
        }));
        XLSX.utils.book_append_sheet(wb, wsActions, t("sheetActionPlans"));
      }

      XLSX.writeFile(wb, `${reportName}.xlsx`);
    } finally {
      setLoadingXls(false);
    }
  }

  async function handlePdf() {
    setLoadingPdf(true);
    try {
      const { jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;

      const font = isArabic ? ARABIC_FONT : "helvetica";
      const shape = isArabic ? shapeArabicForPdf : (s: string) => s;
      const halign = isArabic ? "right" as const : "left" as const;

      const C = {
        forest:   [1,   61,  49]  as [number,number,number],
        forest2:  [1,  119, 100]  as [number,number,number],
        forest3:  [1,  148, 120]  as [number,number,number],
        complete: [45, 157,  94]  as [number,number,number],
        progress: [240, 165,   0]  as [number,number,number],
        delayed:  [231,  76,  60]  as [number,number,number],
        nostart:  [149, 165, 166]  as [number,number,number],
        rowAlt:   [237, 247, 244]  as [number,number,number],
        textMint: [77,  184, 154]  as [number,number,number],
      };

      const statusColor = (s: string): [number,number,number] => {
        if (s === "completed")  return C.complete;
        if (s === "inprogress") return C.progress;
        if (s === "delayed")    return C.delayed;
        return C.nostart;
      };

      function makeDoc(landscape = false) {
        return new jsPDF({ orientation: landscape ? "landscape" : "portrait" });
      }

      function addPageHeader(doc: ReturnType<typeof makeDoc>, subtitle: string) {
        const pageW = doc.internal.pageSize.getWidth();
        doc.setFillColor(...C.forest);
        doc.rect(0, 0, pageW, 24, "F");
        doc.setFillColor(...C.forest2);
        doc.rect(pageW * 0.6, 0, pageW * 0.4, 24, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFont(font, "bold");
        doc.setFontSize(12);
        if (isArabic) {
          doc.text(shape(t("reportMainTitle")), pageW - 14, 10, { align: "right" });
        } else {
          doc.text(t("reportMainTitle"), 14, 10);
        }
        doc.setFontSize(8.5);
        doc.setFont(font, "normal");
        doc.setTextColor(...C.textMint);
        if (isArabic) {
          doc.text(shape(subtitle), pageW - 14, 18, { align: "right" });
          doc.setTextColor(255, 255, 255);
          doc.text(dateStr, 14, 18, { align: "left" });
        } else {
          doc.text(subtitle, 14, 18);
          doc.setTextColor(255, 255, 255);
          doc.text(dateStr, pageW - 14, 18, { align: "right" });
        }
      }

      // Build PDF as a multi-page portrait doc; landscape pages added as new docs then merged via pages
      const doc = makeDoc(false);
      const pageW = doc.internal.pageSize.getWidth();
      if (isArabic) await registerArabicFont(doc);

      // ── Page 1: KPI Summary ──
      addPageHeader(doc, reportTitle);

      if (userCountry) {
        doc.setFillColor(...C.complete);
        doc.roundedRect(14, 28, pageW - 28, 9, 2, 2, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFont(font, "bold");
        doc.setFontSize(8.5);
        doc.text(shape(t("reportCountryBadge").replace("{country}", userCountry)), pageW / 2, 33.5, { align: "center" });
      }

      autoTable(doc, {
        head: [[t("colMetric"), t("colValue")].map(shape)],
        body: [
          [t("completed"),          `${kpis.pctCompleted}%`],
          [t("inProgress"),        `${kpis.pctInProgress}%`],
          [t("delayed"),            `${kpis.pctDelayed}%`],
          [t("notStarted"),        `${kpis.pctNotStarted}%`],
          [t("totalCountries"),    String(kpis.totalCountries)],
          [t("totalActions"),      String(kpis.totalActions)],
          [t("totalBudget"), kpis.totalBudget.toLocaleString()],
          [t("reportPeriodLabel"),      kpis.reportPeriod],
          [t("lastUpdated"),       kpis.lastUpdated],
        ].map(row => row.map(shape)),
        startY: userCountry ? 42 : 30,
        styles: { fontSize: 9, cellPadding: 3, font, halign },
        headStyles: { fillColor: C.forest, textColor: [255, 255, 255], fontStyle: "bold" },
        alternateRowStyles: { fillColor: C.rowAlt },
        margin: { left: 14, right: 14 },
        columnStyles: { 0: { fontStyle: "bold", cellWidth: 70 } },
        didParseCell: (data) => {
          if (data.section !== "body") return;
          const colors: [number,number,number][] = [C.complete, C.progress, C.delayed, C.nostart];
          if (data.column.index === 1 && data.row.index < 4) {
            data.cell.styles.textColor = colors[data.row.index];
            data.cell.styles.fontStyle = "bold";
          }
        },
      });

      // ── Page 2: Safety Targets ──
      doc.addPage();
      addPageHeader(doc, t("reportTargetsSubtitle"));
      autoTable(doc, {
        head: [[t("colId"), t("colGroup"), t("colTitle"), t("colScore"), t("colStatus"), t("colDeadline")].map(shape)],
        body: targets.map(tgt => [tgt.id, tgt.group, tgt.title, `${tgt.pct}%`, statusLabel[tgt.status] ?? tgt.status, tgt.deadline].map(shape)),
        startY: 30,
        styles: { fontSize: 7.5, cellPadding: 2.5, font, halign },
        headStyles: { fillColor: C.forest, textColor: [255, 255, 255], fontStyle: "bold" },
        alternateRowStyles: { fillColor: C.rowAlt },
        margin: { left: 14, right: 14 },
        columnStyles: {
          0: { cellWidth: 13 },
          3: { cellWidth: 14, halign: "center" as const },
          4: { cellWidth: 22 },
          5: { cellWidth: 24 },
        },
        didParseCell: (data) => {
          if (data.section !== "body") return;
          if (data.column.index === 3) {
            const pct = targets[data.row.index]?.pct ?? 0;
            if (pct >= 100)     data.cell.styles.textColor = C.complete;
            else if (pct >= 50) data.cell.styles.textColor = C.progress;
            else if (pct >= 25) data.cell.styles.textColor = C.delayed;
            else                data.cell.styles.textColor = C.nostart;
            data.cell.styles.fontStyle = "bold";
          }
          if (data.column.index === 4) {
            data.cell.styles.textColor = statusColor(targets[data.row.index]?.status ?? "");
            data.cell.styles.fontStyle = "bold";
          }
        },
      });

      // ── Page 3: Country Breakdown (admin only) ──
      if (countries.length > 1) {
        doc.addPage("a4", "landscape");
        addPageHeader(doc, t("reportCountryBreakdownSubtitle"));
        autoTable(doc, {
          head: [[t("colCountry"), t("colRegion"), t("colAuthorityEntity"), t("colTargets"), t("colPctCompleted"), t("colPctInProgress"), t("colPctDelayed"), t("colPctNotStarted"), t("colBudgetUsd")].map(shape)],
          body: countries.map(c => [
            c.country, c.region, c.entity ?? "",
            c.actions, `${c.completed}%`, `${c.inprogress}%`, `${c.delayed}%`, `${c.notstarted}%`,
            (c.budget ?? 0).toLocaleString(),
          ].map((v) => shape(String(v)))),
          startY: 30,
          styles: { fontSize: 7, cellPadding: 2, font, halign },
          headStyles: { fillColor: C.forest, textColor: [255, 255, 255], fontStyle: "bold" },
          alternateRowStyles: { fillColor: C.rowAlt },
          margin: { left: 10, right: 10 },
          columnStyles: {
            0: { cellWidth: 38 },
            1: { cellWidth: 28 },
            2: { cellWidth: 20 },
            3: { cellWidth: 16, halign: "center" as const },
            4: { cellWidth: 22, halign: "center" as const },
            5: { cellWidth: 22, halign: "center" as const },
            6: { cellWidth: 18, halign: "center" as const },
            7: { cellWidth: 22, halign: "center" as const },
            8: { cellWidth: 30, halign: "right"  as const },
          },
          didParseCell: (data) => {
            if (data.section !== "body") return;
            const colColors: Record<number, [number,number,number]> = {
              4: C.complete, 5: C.progress, 6: C.delayed, 7: C.nostart,
            };
            if (colColors[data.column.index]) {
              data.cell.styles.textColor = colColors[data.column.index];
              data.cell.styles.fontStyle = "bold";
            }
          },
        });
      }

      // ── Page 4: Action Plans ──
      if (actions.length > 0) {
        doc.addPage("a4", "landscape");
        addPageHeader(doc, t("reportActionPlansSubtitle"));
        autoTable(doc, {
          head: [[t("colCountry"), t("colActionTarget"), t("colSection"), t("colStatus"), t("colStart"), t("colEnd"), t("colDurationWks"), t("colBudgetUsd")].map(shape)],
          body: actions.map(a => [
            a.country, a.action, a.section, statusLabel[a.status] ?? a.status,
            a.start, a.end, a.duration, (a.budget ?? 0).toLocaleString(),
          ].map((v) => shape(String(v)))),
          startY: 30,
          styles: { fontSize: 7, cellPadding: 2, font, halign },
          headStyles: { fillColor: C.forest, textColor: [255, 255, 255], fontStyle: "bold" },
          alternateRowStyles: { fillColor: C.rowAlt },
          margin: { left: 10, right: 10 },
          columnStyles: {
            0: { cellWidth: 38 },
            1: { cellWidth: 22 },
            2: { cellWidth: 55 },
            3: { cellWidth: 22 },
            4: { cellWidth: 16, halign: "center" as const },
            5: { cellWidth: 16, halign: "center" as const },
            6: { cellWidth: 22, halign: "center" as const },
            7: { cellWidth: 30, halign: "right"  as const },
          },
          didParseCell: (data) => {
            if (data.section !== "body" || data.column.index !== 3) return;
            data.cell.styles.textColor = statusColor(actions[data.row.index]?.status ?? "");
            data.cell.styles.fontStyle = "bold";
          },
        });
      }

      doc.save(`${reportName}.pdf`);
    } finally {
      setLoadingPdf(false);
    }
  }

  const btnBase: React.CSSProperties = {
    display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
    padding: "18px 32px", borderRadius: 10, cursor: "pointer",
    transition: "all .15s", minWidth: 150, border: "1.5px solid",
  };

  return (
    <div className="card">
      <div className="card-head">
        <span className="card-head-title">{t("reportDownload")}</span>
        {userCountry
          ? <span className="card-head-badge">📍 {userCountry}</span>
          : <span className="card-head-badge">🌍 {t("reportAllCountries")}</span>
        }
      </div>
      <div className="card-body">
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", padding: "4px 0 8px" }}>

          {/* Excel */}
          <button
            onClick={handleExcel}
            disabled={loadingXls}
            style={{
              ...btnBase,
              background: loadingXls ? "#f4f4f4" : "#e6f4ea",
              borderColor: "#2d9d5e",
              color: "#1a6b3c",
              opacity: loadingXls ? 0.6 : 1,
            }}
          >
            <span style={{ fontSize: 32 }}>📊</span>
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".02em" }}>
              {loadingXls ? t("reportGenerating") : t("downloadExcel")}
            </span>
            <span style={{ fontSize: 10, color: "#2d7a4a", textAlign: "center", lineHeight: 1.4 }}>
              {t("reportExcelDesc")}
            </span>
          </button>

          {/* PDF */}
          <button
            onClick={handlePdf}
            disabled={loadingPdf}
            style={{
              ...btnBase,
              background: loadingPdf ? "#f4f4f4" : "#fff0ee",
              borderColor: "#c0392b",
              color: "#9b1a1a",
              opacity: loadingPdf ? 0.6 : 1,
            }}
          >
            <span style={{ fontSize: 32 }}>📄</span>
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".02em" }}>
              {loadingPdf ? t("reportGenerating") : t("downloadPdf")}
            </span>
            <span style={{ fontSize: 10, color: "#a03030", textAlign: "center", lineHeight: 1.4 }}>
              {t("reportPdfDesc")}
            </span>
          </button>
        </div>

        <div style={{ marginTop: 8, fontSize: 10, color: "var(--ink3)" }}>
          {t("reportPeriodLabel")}: <strong>{kpis.reportPeriod}</strong>
          {" · "}
          {t("lastUpdated")}: <strong>{kpis.lastUpdated}</strong>
          {" · "}
          <span style={{ color: "var(--ink3)" }}>
            {t("reportFooterSummary")
              .replace("{c}", String(countries.length))
              .replace("{t}", String(targets.length))
              .replace("{a}", String(actions.length))}
          </span>
        </div>
      </div>
    </div>
  );
}
