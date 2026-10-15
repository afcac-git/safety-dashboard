// Reference legend for the 15 safety target categories (T1.x … T15.x) — not
// locale-translated, matching how target `group` names are already shown in
// English everywhere else in the app (questionnaire, admin editor).
const CATEGORIES = [
  "Safety Trend Targets",
  "Safety Oversight Enhancement",
  "State Safety Programme (SSP)",
  "Assistance & Regional Safety Plans",
  "Industry Safety Standards",
  "Air Navigation & Aerodrome Infrastructure",
  "Air Navigation Infrastructure Gap Analysis",
  "Aerodrome Certification",
  "Search and Rescue (SAR)",
  "AIS to AIM Transition",
  "Performance-Based Navigation (PBN)",
  "Seamless Air Navigation Services",
  "ASBU Implementation",
  "CO₂ Emissions Reduction",
  "ANSP Peer Review & SMS Maturity",
];

export default function TargetCategoriesCard() {
  return (
    <div className="kpi-card k-teal" style={{ animationDelay: ".08s" }}>
      <div className="kpi-icon-wrap" style={{ background: "#e8f2f8" }}>🎯</div>
      <div className="kpi-label" style={{ marginBottom: 6 }}>Safety Target Categories</div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          columnGap: 10,
          rowGap: 3,
          fontSize: 9.5,
          lineHeight: 1.4,
          color: "var(--ink2)",
        }}
      >
        {CATEGORIES.map((c, i) => (
          <div key={i} style={{ display: "flex", gap: 3 }}>
            <span style={{ color: "var(--ink3)", fontWeight: 700, flexShrink: 0 }}>{i + 1}.</span>
            <span>{c}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
