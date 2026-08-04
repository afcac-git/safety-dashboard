"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { DashboardData, KpiData, ActionRow, CountryRow, TargetRow, UserRole, AppUser, UpdateLog } from "@/lib/types";
import OnlineUsers from "@/components/OnlineUsers";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import DocsDropdown from "@/components/DocsDropdown";
import { useLanguage } from "@/components/LanguageProvider";
import { exportExcel } from "@/lib/exportUtils";

/* ─── Types ──────────────────────────────────────── */
type Tab = "kpis" | "targets" | "actions" | "countries" | "users" | "sessions" | "updates";

const AFRICAN_STATES = [
  "Algeria","Angola","Benin","Botswana","Burkina Faso","Burundi","Cabo Verde",
  "Cameroon","Central African Republic","Chad","Comoros","Congo (Republic)",
  "DR Congo","Djibouti","Egypt","Equatorial Guinea","Eritrea","Eswatini",
  "Ethiopia","Gabon","Gambia","Ghana","Guinea","Guinea-Bissau","Cote D'Ivoire",
  "Kenya","Lesotho","Liberia","Libya","Madagascar","Malawi","Mali","Mauritania",
  "Mauritius","Morocco","Mozambique","Namibia","Niger","Nigeria","Rwanda",
  "São Tomé & Príncipe","Senegal","Seychelles","Sierra Leone","Somalia",
  "South Africa","South Sudan","Sudan","Tanzania","Togo","Tunisia","Uganda",
  "Zambia","Zimbabwe",
];


const STATUS_OPTIONS = ["completed", "inprogress", "delayed", "notstarted"] as const;
const STATUS_LABELS: Record<string, string> = {
  completed: "Completed", inprogress: "In Progress",
  delayed: "Delayed", notstarted: "Not Started",
};
const PCT_COLORS: Record<number, string> = {
  0: "#95a5a6", 25: "#e74c3c", 50: "#e07b39", 75: "#f0a500", 100: "#2d9d5e",
};

/* ─── Section nav items (translated at render time) ─ */
const NAV_ITEM_DEFS: { id: Tab; icon: string; labelKey: string; subKey: string; adminOnly?: boolean }[] = [
  { id: "kpis",      icon: "📊", labelKey: "navKpiLabel",      subKey: "navKpiSub" },
  { id: "targets",   icon: "🎯", labelKey: "navTargetsLabel",  subKey: "navTargetsSub" },
  { id: "actions",   icon: "📋", labelKey: "navActionsLabel",  subKey: "navActionsSub" },
  { id: "countries", icon: "🌍", labelKey: "navCountriesLabel",subKey: "navCountriesSub" },
  { id: "users",     icon: "🔑", labelKey: "navUsersLabel",    subKey: "navUsersSub",    adminOnly: true },
  { id: "sessions",  icon: "🟢", labelKey: "navSessionsLabel", subKey: "navSessionsSub", adminOnly: true },
  { id: "updates",   icon: "📝", labelKey: "navUpdatesLabel",  subKey: "navUpdatesSub",  adminOnly: true },
];

/* ─── Toast ──────────────────────────────────────── */
function Toast({ msg, type, visible }: { msg: string; type: "ok" | "warn" | ""; visible: boolean }) {
  return (
    <div className={`toast ${visible ? "show" : ""} ${type === "ok" ? "t-ok" : type === "warn" ? "t-warn" : ""}`}>
      {msg}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════ */
export default function AdminClient({
  initialData,
  username,
  displayName,
  role,
  users = [],
  isMasterAdmin = false,
  userCountry,
}: {
  initialData: DashboardData;
  username: string;
  displayName: string;
  role: UserRole;
  users?: AppUser[];
  isMasterAdmin?: boolean;
  userCountry?: string;
}) {
  const router = useRouter();
  const { t } = useLanguage();
  const [tab, setTab] = useState<Tab>(role === "admin" ? "targets" : "targets");
  const [kpis, setKpis] = useState<KpiData>(initialData.kpis);
  const [actions, setActions] = useState<ActionRow[]>(initialData.actions);
  const [countries, setCountries] = useState<CountryRow[]>(initialData.countries);
  const [targets, setTargets] = useState<TargetRow[]>(initialData.targets);
  const [saving, setSaving] = useState(false);
  const [openQuestions, setOpenQuestions] = useState<Set<string>>(new Set());
  const [fullName] = useState(displayName);
  const [updaterCountry, setUpdaterCountry] = useState(userCountry ?? "");
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "warn" | "" }>({ msg: "", type: "" });
  const [toastVisible, setToastVisible] = useState(false);
  const [loginTime] = useState(() => new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }));
  const [loginDate] = useState(() => new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }));
  const [sessionStats, setSessionStats] = useState<{ online: number; total: number } | null>(null);
  const mainRef = useRef<HTMLElement>(null);

  /* ── User management states ── */
  const [localUsers, setLocalUsers] = useState<AppUser[]>(users);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{ newUsername: string; devPassword: string; role: UserRole; country: string; displayName: string; email: string }>({ newUsername: "", devPassword: "", role: "focal_point", country: "", displayName: "", email: "" });
  const [userSearch, setUserSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | UserRole>("all");
  const [userSaving, setUserSaving] = useState(false);

  /* ── Add user modal states ── */
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [addUserDraft, setAddUserDraft] = useState<{ username: string; displayName: string; devPassword: string; role: UserRole; country: string; email: string }>({ username: "", displayName: "", devPassword: "", role: "focal_point", country: "", email: "" });
  const [addUserSaving, setAddUserSaving] = useState(false);
  const [addUserError, setAddUserError] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [userDeleting, setUserDeleting] = useState(false);

  /* ── Update logs states ── */
  const [updateLogs, setUpdateLogs] = useState<UpdateLog[]>([]);
  const [updatesLoading, setUpdatesLoading] = useState(false);
  const [updatesLoaded, setUpdatesLoaded] = useState(false);

  function startEdit(u: AppUser) {
    setEditingUser(u.username);
    setEditDraft({ newUsername: u.username, devPassword: "", role: u.role, country: u.country ?? "", displayName: u.displayName, email: u.email ?? "" });
  }
  function cancelEdit() { setEditingUser(null); }

  const MASTER_ADMINS = ["admin", "mohamed.wade"];

  async function toggleDisabled(u: AppUser) {
    const newDisabled = !u.disabled;
    if (MASTER_ADMINS.includes(u.username)) return; // protect master admins
    if (u.username === username) return;             // cannot disable yourself
    try {
      const res = await fetch("/api/admin/update-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: u.username, disabled: newDisabled }),
      });
      if (!res.ok) throw new Error();
      setLocalUsers((prev) => prev.map((p) => p.username === u.username ? { ...p, disabled: newDisabled } : p));
      showToast(newDisabled ? t("toastAccountDisabled") : t("toastAccountEnabled"), newDisabled ? "warn" : "ok");
    } catch {
      showToast("❌ " + t("toastSaveError"), "warn");
    }
  }

  async function saveUser() {
    if (!editingUser) return;
    setUserSaving(true);
    try {
      const res = await fetch("/api/admin/update-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: editingUser, ...editDraft }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 409) { showToast(t("toastUsernameTaken"), "warn"); return; }
        throw new Error(data.error ?? "Save failed");
      }
      const resolvedUsername = editDraft.newUsername.trim() || editingUser;
      setLocalUsers((prev) => prev.map((u) => u.username === editingUser ? {
        ...u,
        username: resolvedUsername,
        displayName: editDraft.displayName || u.displayName,
        role: editDraft.role,
        country: editDraft.country,
        email: editDraft.email,
        devPassword: editDraft.devPassword || u.devPassword,
      } : u));
      showToast(t("toastUserSaved"), "ok");
      setEditingUser(null);
    } catch {
      showToast("❌ " + t("toastSaveError"), "warn");
    } finally {
      setUserSaving(false);
    }
  }

  async function createUser() {
    if (!addUserDraft.username.trim() || !addUserDraft.displayName.trim() || !addUserDraft.devPassword.trim()) {
      setAddUserError(t("addUserRequired"));
      return;
    }
    setAddUserSaving(true);
    setAddUserError("");
    try {
      const res = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(addUserDraft),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erreur lors de la création");
      const newUser: AppUser = { ...addUserDraft, passwordHash: "", disabled: false };
      setLocalUsers((prev) => [...prev, newUser]);
      setAddUserOpen(false);
      setAddUserDraft({ username: "", displayName: "", devPassword: "", role: "focal_point", country: "", email: "" });
      showToast(t("toastUserCreated"), "ok");
    } catch (err) {
      setAddUserError((err as Error).message);
    } finally {
      setAddUserSaving(false);
    }
  }

  async function deleteUser(uname: string) {
    setUserDeleting(true);
    try {
      const res = await fetch("/api/admin/delete-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: uname }),
      });
      if (!res.ok) throw new Error();
      setLocalUsers((prev) => prev.filter((u) => u.username !== uname));
      showToast(t("toastUserDeleted"), "ok");
    } catch {
      showToast("❌ " + t("toastSaveError"), "warn");
    } finally {
      setUserDeleting(false);
      setDeleteConfirm(null);
    }
  }

  /* ── Heartbeat: keep session "online" every 2 min ── */
  useEffect(() => {
    const ping = () => fetch("/api/auth/heartbeat", { method: "POST" }).catch(() => {});
    ping();
    const id = setInterval(ping, 2 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  /* ── Session stats for profile card ── */
  useEffect(() => {
    fetch("/api/admin/sessions?page=0&limit=1")
      .then(r => r.json())
      .then(d => setSessionStats({ online: (d.online ?? []).length, total: d.total ?? 0 }))
      .catch(() => {});
  }, []);

  /* ── Load update logs when tab opens ── */
  useEffect(() => {
    if (tab !== "updates" || updatesLoaded) return;
    setUpdatesLoading(true);
    fetch("/api/admin/updates")
      .then(r => r.json())
      .then(d => { setUpdateLogs(d.logs ?? []); setUpdatesLoaded(true); })
      .catch(() => {})
      .finally(() => setUpdatesLoading(false));
  }, [tab, updatesLoaded]);

  function showToast(msg: string, type: "ok" | "warn") {
    setToast({ msg, type });
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 3500);
  }

  /* ── Count modified targets ── */
  const answeredTargets = targets.filter((t) => t.pct > 0).length;

  /* ── Save ── */
  async function handleSave() {
    setSaving(true);
    try {
      const payload = (role === "expert" || role === "focal_point")
        ? { targets, fullName, updaterCountry }
        : { kpis, actions, countries, targets, fullName, updaterCountry };
      const res = await fetch("/api/dashboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erreur de sauvegarde");
      showToast(t("toastSaved"), "ok");
      router.refresh();
    } catch (err) {
      showToast(`⚠ ${(err as Error).message}`, "warn");
    } finally {
      setSaving(false);
    }
  }

  /* ── Logout ── */
  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  }

  /* ── Scroll to section ── */
  function scrollToSection(id: string) {
    setTab(id as Tab);
    setTimeout(() => {
      mainRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    }, 50);
  }

  /* ── KPI updater ── */
  function updateKpi<K extends keyof KpiData>(key: K, value: KpiData[K]) {
    setKpis((p) => ({ ...p, [key]: value }));
  }

  /* ── Target updater ── */
  function updateTarget(id: string, pct: number) {
    const statusMap: Record<number, TargetRow["status"]> = {
      0: "notstarted", 25: "delayed", 50: "inprogress", 75: "inprogress", 100: "completed",
    };
    setTargets((p) =>
      p.map((t) => (t.id === id ? { ...t, pct, status: statusMap[pct] ?? "inprogress" } : t))
    );
  }

  function updateTargetField(id: string, field: keyof TargetRow, value: unknown) {
    setTargets((p) => p.map((t) => (t.id === id ? { ...t, [field]: value } : t)));
  }

  /* ── Action updater ── */
  function updateAction(idx: number, field: keyof ActionRow, value: unknown) {
    setActions((p) => p.map((a, i) => (i === idx ? { ...a, [field]: value } : a)));
  }

  /* ── Country updater ── */
  function updateCountry(name: string, field: keyof CountryRow, value: unknown) {
    setCountries((p) => p.map((c) => (c.country === name ? { ...c, [field]: value } : c)));
  }

  /* ── Toggle question ── */
  function toggleQuestion(id: string) {
    setOpenQuestions((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  /* ── Group targets ── */
  const targetGroups = targets.reduce<Record<string, TargetRow[]>>((acc, t) => {
    (acc[t.group] = acc[t.group] ?? []).push(t);
    return acc;
  }, {});

  /* ── Avatar initial ── */
  const initial = displayName.charAt(0).toUpperCase();

  /* ══════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════ */
  return (
    <>
      {/* ── HEADER ── */}
      <header className="db-header" style={{ position: "sticky", top: 0, zIndex: 300, height: 60, display: "flex", alignItems: "center" }}>
        <div className="db-header-inner" style={{ width: "100%", height: "100%" }}>
          <div className="db-emblem">
            <img src="/afcac_logo.png" alt="AFCAC Logo" style={{ height: 44, width: "auto", objectFit: "contain" }} />
          </div>
          <div className="db-title-wrap">
            <div className="db-title">{t("adminPanelTitle")}</div>
            <div className="db-sub">{t("adminPanelSub")}</div>
          </div>
          <div className="db-controls">
            <LanguageSwitcher />
            <DocsDropdown show={true} />
            {/* Header progress */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>{t("pctCompleted")}</span>
              <div style={{ width: 140, height: 8, background: "rgba(255,255,255,0.15)", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ height: "100%", background: "var(--gold)", borderRadius: 4, width: `${(answeredTargets / targets.length) * 100}%`, transition: "width .4s" }} />
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--gold)", fontFamily: "'Barlow Condensed', sans-serif", minWidth: 36 }}>
                {Math.round((answeredTargets / targets.length) * 100)}%
              </span>
            </div>
            <Link href="/" className="hbtn" style={{ fontSize: 11, width: "auto", padding: "0 12px", gap: 6, textDecoration: "none" }}>
              👁 {t("dashboard")}
            </Link>
            <button
              onClick={handleLogout}
              className="hbtn"
              style={{ fontSize: 11, width: "auto", padding: "0 12px", gap: 6, cursor: "pointer", border: "1.5px solid rgba(255,100,100,0.5)", background: "rgba(200,50,50,0.15)", color: "#ffaaaa" }}
              title={t("disconnect")}
            >
              {t("logOut")}
            </button>
          </div>
        </div>
      </header>

      {/* ── SHELL ── */}
      <div className="shell">

        {/* ══════════════════════════════════════
            SIDEBAR
        ══════════════════════════════════════ */}
        <nav className="sidebar">

          {/* Profile block */}
          <div className="profile-block">
            <div className="profile-avatar">{initial}</div>
            <div className="profile-name">{displayName}</div>
            <div className="profile-role">
              {role === "admin" ? t("roleAdministrator") : role === "focal_point" ? t("roleFocalPointLabel") : role === "rsoo" ? t("filterRsoo") : t("filterExpert")}
              {userCountry ? ` — ${userCountry}` : " · AFCAC"}
            </div>
            <div className="profile-meta">
              <div className="profile-meta-row">
                <span>🗓</span>
                <span>{loginDate}</span>
              </div>
              <div className="profile-meta-row">
                <span>🕐</span>
                <span>Session: {loginTime}</span>
              </div>
              <div className="profile-meta-row">
                <span>🔒</span>
                <span>Expires in 8h</span>
              </div>
            </div>
            <div className="profile-badge">
              <div className="profile-dot" />
              Connected
            </div>
            {sessionStats !== null && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border)", width: "100%", display: "flex", justifyContent: "space-between", fontSize: 10 }}>
                <div style={{ textAlign: "center", flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: 16, color: "#2d9d5e" }}>{sessionStats.online}</div>
                  <div style={{ color: "var(--ink3)", marginTop: 1 }}>En ligne</div>
                </div>
                <div style={{ width: 1, background: "var(--border)" }} />
                <div style={{ textAlign: "center", flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: 16, color: "var(--ink)" }}>{sessionStats.total.toLocaleString()}</div>
                  <div style={{ color: "var(--ink3)", marginTop: 1 }}>Connexions</div>
                </div>
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="sb-section">{t("tabTargets")}</div>
          {NAV_ITEM_DEFS.filter((item) => role === "admin" ? true : item.id === "targets").filter((item) => !item.adminOnly || role === "admin").filter((item) => item.id !== "users" || isMasterAdmin).map((item) => (
            <div
              key={item.id}
              className={`sb-item${tab === item.id ? " active" : ""}${tab === item.id ? " done" : ""}`}
              onClick={() => scrollToSection(item.id)}
            >
              <span className="sb-num" style={{ fontSize: 18, width: 22 }}>{item.icon}</span>
              <span className="sb-text">
                <span style={{ fontWeight: 600 }}>{t(item.labelKey as Parameters<typeof t>[0])}</span>
                <br />
                <span style={{ fontSize: 10, opacity: 0.65 }}>{t(item.subKey as Parameters<typeof t>[0])}</span>
              </span>
              {tab === item.id && <span className="sb-check">▶</span>}
            </div>
          ))}

          {/* Targets navigation */}
          {tab === "targets" && (
            <>
              <div className="sb-section" style={{ marginTop: 8 }}>Groupes de cibles</div>
              {Object.entries(targetGroups).map(([group, groupTargets], gi) => {
                const answered = groupTargets.filter((t) => t.pct > 0).length;
                return (
                  <div key={group}
                    className={`sb-item${answered === groupTargets.length ? " done" : ""}`}
                    style={{ paddingTop: 5, paddingBottom: 5 }}
                  >
                    <span className="sb-num">{gi + 1}</span>
                    <span className="sb-text" style={{ fontSize: 10 }}>
                      {group.length > 28 ? group.substring(0, 28) + "…" : group}
                    </span>
                    {answered === groupTargets.length && <span className="sb-check">✓</span>}
                  </div>
                );
              })}
            </>
          )}

          {/* Footer stats + logout */}
          <div className="sb-footer">
            <div className="sb-stats">
              <div className="sb-stat">
                <div className="sb-stat-val">{answeredTargets}</div>
                <div className="sb-stat-label">Définis</div>
              </div>
              <div className="sb-stat">
                <div className="sb-stat-val">{targets.length - answeredTargets}</div>
                <div className="sb-stat-label">À compléter</div>
              </div>
            </div>
            <button className="sb-logout" onClick={handleLogout}>
              🚪 Déconnexion
            </button>
          </div>
        </nav>

        {/* ══════════════════════════════════════
            MAIN CONTENT
        ══════════════════════════════════════ */}
        <main className="form-main" ref={mainRef}>

          {/* Intro */}
          <div className="intro">
            <div className="intro-title">
              {tab === "kpis"      && t('adminTabKpisTitle')}
              {tab === "targets"   && t('adminTabTargetsTitle')}
              {tab === "actions"   && t('adminTabActionsTitle')}
              {tab === "countries" && t('adminTabCountriesTitle')}
              {tab === "users"     && t('adminTabUsersTitle')}
              {tab === "sessions"  && t('adminTabSessionsTitle')}
              {tab === "updates"   && t('adminTabUpdatesTitle')}
            </div>
            <div className="intro-text">
              {tab === "kpis"      && t('adminIntroKpis')}
              {tab === "targets"   && t('adminIntroTargets').replace('{n}', String(targets.length)).replace('{g}', String(Object.keys(targetGroups).length))}
              {tab === "actions"   && t('adminIntroActions')}
              {tab === "countries" && t('adminIntroCountries')}
              {tab === "users"     && t('adminIntroUsers').replace('{n}', String(users?.length ?? 0))}
              {tab === "sessions"  && t('adminIntroSessions')}
              {tab === "updates"   && t('adminIntroUpdates')}
            </div>
          </div>

          {/* ─────────────────── UPDATER IDENTITY ─────────────────── */}
          {tab !== "users" && (
            <>
              <div className="group-header" style={{ marginTop: 0 }}>
                <span className="gh-title">{t("adminUpdaterTitle")}</span>
                <span className="gh-count">{t("adminUpdaterSub")}</span>
              </div>
              <div className="q-card" style={{ borderRadius: "0 0 8px 8px", borderTop: "1px solid var(--border)", marginBottom: 24 }}>
                <div className="q-options">
                  <div className="field-grid" style={{ gridTemplateColumns: userCountry ? "1fr" : "1fr 1fr" }}>
                    <div className="field-group">
                      <label className="field-label">{t("adminFullName")}</label>
                      <input
                        className="field-input"
                        type="text"
                        value={fullName}
                        readOnly
                        style={{ background: "var(--bg2)", color: "var(--ink2)", cursor: "default" }}
                      />
                    </div>
                    {userCountry ? (
                      <div className="field-group">
                        <label className="field-label">{t("adminCountryRepresented")}</label>
                        <input
                          className="field-input"
                          type="text"
                          value={userCountry}
                          readOnly
                          style={{ background: "var(--bg2)", color: "#2d9d5e", fontWeight: 700, cursor: "default" }}
                        />
                      </div>
                    ) : (
                      <div className="field-group">
                        <label className="field-label">{t("adminCountryRepresented")}</label>
                        <select
                          className="field-input"
                          value={updaterCountry}
                          onChange={(e) => setUpdaterCountry(e.target.value)}
                          style={{ cursor: "pointer" }}
                        >
                          <option value="">{t("adminSelectCountry")}</option>
                          {AFRICAN_STATES.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ─────────────────── KPIs ─────────────────── */}
          {tab === "kpis" && (
            <>
              {/* Group: Overview */}
              <div className="group-header">
                <span className="gh-title">{t("adminKpiTitle")}</span>
                <span className="gh-count">{t("adminKpiCount")}</span>
              </div>
              <div className="q-card" style={{ borderRadius: "0 0 8px 8px", borderTop: "1px solid var(--border)" }}>
                <div className="q-options">
                  <div className="field-grid">
                    <div className="field-group">
                      <label className="field-label">{t("totalCountries")}</label>
                      <input className="field-input" type="number" value={kpis.totalCountries}
                        onChange={(e) => updateKpi("totalCountries", Number(e.target.value))} />
                      <input className="field-input" type="text" value={kpis.totalCountriesTrend} placeholder={t("adminTrendPlaceholder")}
                        onChange={(e) => updateKpi("totalCountriesTrend", e.target.value)}
                        style={{ marginTop: 6, fontSize: 11 }} />
                    </div>
                    <div className="field-group">
                      <label className="field-label">{t("totalActions")}</label>
                      <input className="field-input" type="number" value={kpis.totalActions}
                        onChange={(e) => updateKpi("totalActions", Number(e.target.value))} />
                      <input className="field-input" type="text" value={kpis.totalActionsTrend} placeholder={t("adminTrendPlaceholder")}
                        onChange={(e) => updateKpi("totalActionsTrend", e.target.value)}
                        style={{ marginTop: 6, fontSize: 11 }} />
                    </div>
                    <div className="field-group">
                      <label className="field-label">Budget Total (USD)</label>
                      <input className="field-input" type="number" value={kpis.totalBudget}
                        onChange={(e) => updateKpi("totalBudget", Number(e.target.value))} />
                      <span style={{ fontSize: 11, color: "var(--ink3)", marginTop: 4 }}>
                        = ${(kpis.totalBudget / 1_000_000).toFixed(1)}M USD
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Group: Status */}
              <div className="group-header">
                <span className="gh-title">{t("adminStatusTitle")}</span>
                <span className="gh-count">{t("adminStatusCount")}</span>
              </div>
              {(["pctCompleted", "pctInProgress", "pctDelayed", "pctNotStarted"] as const).map((key, i) => {
                const meta: Record<string, { label: string; color: string; trendKey: keyof KpiData; icon: string }> = {
                  pctCompleted:  { label: t("pctCompleted"),  color: "#2d9d5e", trendKey: "pctCompletedTrend",  icon: "✅" },
                  pctInProgress: { label: t("pctInProgress"), color: "#f0a500", trendKey: "pctInProgressTrend", icon: "⏳" },
                  pctDelayed:    { label: t("pctDelayed"),    color: "#e74c3c", trendKey: "pctDelayedTrend",    icon: "⚠" },
                  pctNotStarted: { label: t("pctNotStarted"), color: "#95a5a6", trendKey: "pctNotStartedTrend", icon: "🔘" },
                };
                const m = meta[key];
                return (
                  <div key={key} className="q-card" style={i === 4 ? { borderRadius: "0 0 8px 8px" } : {}}>
                    <div className="q-head">
                      <span className="q-num">KPI {i + 1}</span>
                      <span className="q-target" style={{ background: m.color }}>{m.icon}</span>
                      <span className="q-title">{m.label}</span>
                      <span className="q-deadline">
                        <span className={`pct-pill p${kpis[key]}`}>{kpis[key]}%</span>
                      </span>
                    </div>
                    <div className="q-options">
                      <div className="q-select-wrap">
                        <div className="q-swatch" style={{ background: m.color }} />
                        <div style={{ flex: 1, display: "flex", gap: 10, alignItems: "center" }}>
                          <input className="field-input" type="number" min="0" max="100"
                            value={kpis[key]}
                            onChange={(e) => updateKpi(key, Number(e.target.value))}
                            style={{ width: 90 }}
                          />
                          <span style={{ fontSize: 11, color: "var(--ink3)" }}>%</span>
                          <input className="field-input" type="text"
                            value={kpis[m.trendKey] as string}
                            onChange={(e) => updateKpi(m.trendKey, e.target.value)}
                            placeholder={t("adminTrendPlaceholder")}
                            style={{ flex: 1, fontSize: 11 }}
                          />
                        </div>
                        <div className={`q-score-badge sc-${kpis[key]}`} style={{ fontSize: 13 }}>
                          {kpis[key]}%
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Group: Metadata */}
              <div className="group-header" style={{ marginTop: 28 }}>
                <span className="gh-title">{t("adminMetaTitle")}</span>
                <span className="gh-count">{t("adminMetaCount")}</span>
              </div>
              <div className="q-card" style={{ borderRadius: "0 0 8px 8px", borderTop: "1px solid var(--border)" }}>
                <div className="q-options">
                  <div className="field-grid">
                    <div className="field-group">
                      <label className="field-label">{t("reportPeriodLabel")}</label>
                      <input className="field-input" type="text" value={kpis.reportPeriod}
                        onChange={(e) => updateKpi("reportPeriod", e.target.value)} />
                    </div>
                    <div className="field-group">
                      <label className="field-label">{t("lastUpdated")}</label>
                      <input className="field-input" type="date" value={kpis.lastUpdated}
                        onChange={(e) => updateKpi("lastUpdated", e.target.value)} />
                    </div>
                    <div className="field-group">
                      <label className="field-label">{t("avgDuration")}</label>
                      <input className="field-input" type="number" value={kpis.avgDurationWeeks}
                        onChange={(e) => updateKpi("avgDurationWeeks", Number(e.target.value))} />
                    </div>
                    <div className="field-group">
                      <label className="field-label">{t("expertsPlanned")}</label>
                      <input className="field-input" type="number" value={kpis.expertsPlanned}
                        onChange={(e) => updateKpi("expertsPlanned", Number(e.target.value))} />
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ─────────────────── TARGETS ─────────────────── */}
          {tab === "targets" && (
            <>
              {Object.entries(targetGroups).map(([group, groupTargets], gi) => (
                <div key={group}>
                  <div className="group-header" style={gi === 0 ? { marginTop: 0 } : {}}>
                    <span className="gh-title">📌 {group}</span>
                  </div>
                  {groupTargets.map((tgt, qi) => {
                    const isLast = qi === groupTargets.length - 1;
                    return (
                      <div key={tgt.id} className="q-card" style={isLast ? { borderRadius: "0 0 8px 8px" } : {}}>
                        <div className="q-head">
                          <span className="q-num">T{gi + 1}.{qi + 1}</span>
                          <span className="q-title">{tgt.title}</span>
                          {tgt.question && (
                            <button
                              onClick={() => toggleQuestion(tgt.id)}
                              title="?"
                              style={{
                                marginLeft: 8, width: 22, height: 22, borderRadius: "50%",
                                border: "1.5px solid var(--gold)", background: openQuestions.has(tgt.id) ? "var(--gold)" : "transparent",
                                color: openQuestions.has(tgt.id) ? "#fff" : "var(--gold)",
                                fontWeight: 700, fontSize: 12, cursor: "pointer",
                                flexShrink: 0, lineHeight: 1,
                              }}
                            >?</button>
                          )}
                        </div>
                        {tgt.question && openQuestions.has(tgt.id) && (
                          <div style={{ margin: "0 20px 12px", padding: "12px 16px", background: "var(--surface2)", borderRadius: 6, borderLeft: "3px solid var(--gold)", fontSize: 12, color: "var(--ink2)", lineHeight: 1.65 }}>
                            <div style={{ fontWeight: 700, color: "var(--ink1)", marginBottom: 8 }}>{tgt.question}</div>
                            {tgt.options && (
                              <ul style={{ margin: "6px 0 0 0", paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4 }}>
                                {(["0","25","50","75","100"] as const).map((k) => tgt.options![k] && (
                                  <li key={k} style={{ fontSize: 11, color: "var(--ink2)" }}>
                                    <span style={{ fontWeight: 700, color: PCT_COLORS[Number(k)] ?? "var(--ink3)", marginRight: 4 }}>{k}%</span>
                                    — {tgt.options![k]}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )}
                        <div className="q-options">
                          <div className="q-select-wrap">
                            <div className="q-swatch" style={{ background: PCT_COLORS[tgt.pct] ?? "var(--border)" }} />
                            <select
                              className="q-select"
                              value={tgt.pct}
                              style={{ borderColor: PCT_COLORS[tgt.pct] ?? "var(--border)" }}
                              onChange={(e) => updateTarget(tgt.id, Number(e.target.value))}
                            >
                              <option value={0}   data-pct="0">{t('scoreOpt0')}</option>
                              <option value={25}  data-pct="25">{t('scoreOpt25')}</option>
                              <option value={50}  data-pct="50">{t('scoreOpt50')}</option>
                              <option value={75}  data-pct="75">{t('scoreOpt75')}</option>
                              <option value={100} data-pct="100">{t('scoreOpt100')}</option>
                            </select>
                            <div className={`q-score-badge sc-${tgt.pct}`}>
                              <span style={{ fontSize: 11, opacity: 0.7 }}>
                                {["a","b","c","d","e"][[0,25,50,75,100].indexOf(tgt.pct)] ?? "—"})
                              </span>
                              <br />
                              {tgt.pct}%
                            </div>
                          </div>
                          {/* Description */}
                          {tgt.pct > 0 && (
                            <div className={`q-desc-box dc-${tgt.pct}`} style={{ marginTop: 10 }}>
                              <strong>{tgt.pct}%</strong> — {
                                tgt.pct === 25  ? t('scoreDesc25') :
                                tgt.pct === 50  ? t('scoreDesc50') :
                                tgt.pct === 75  ? t('scoreDesc75') :
                                tgt.pct === 100 ? t('scoreDesc100') :
                                                  t('scoreDesc0')
                              }
                            </div>
                          )}
                        </div>
                        {/* Deadline field */}
                        <div style={{ padding: "0 20px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ fontSize: 11, color: "var(--ink3)" }}>{t('adminDeadline')}</span>
                          <input
                            className="field-input"
                            type="text"
                            value={tgt.deadline}
                            onChange={(e) => updateTargetField(tgt.id, "deadline", e.target.value)}
                            style={{ width: 140, fontSize: 11, padding: "5px 9px" }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </>
          )}

          {/* ─────────────────── ACTIONS ─────────────────── */}
          {tab === "actions" && (
            <>
              <div className="group-header" style={{ marginTop: 0 }}>
                <span className="gh-title">{t('adminActionsDetailTitle')}</span>
                <span className="gh-count">{actions.length} actions</span>
              </div>
              {actions.map((row, idx) => {
                const statusColor: Record<string, string> = {
                  completed: "#2d9d5e", inprogress: "#f0a500", delayed: "#e74c3c", notstarted: "#95a5a6",
                };
                const sc = statusColor[row.status] ?? "#95a5a6";
                const isLast = idx === actions.length - 1;
                return (
                  <div key={idx} className="q-card" style={isLast ? { borderRadius: "0 0 8px 8px" } : {}}>
                    <div className="q-head">
                      <span className="q-num">{idx + 1}</span>
                      <span className="q-target">{row.action}</span>
                      <span className="q-title">
                        <strong>{row.country}</strong>
                        <span style={{ fontWeight: 400, color: "var(--ink3)" }}> — {row.section}</span>
                      </span>
                      <span className="q-deadline">💰 ${row.budget.toLocaleString()}</span>
                    </div>
                    <div className="q-options">
                      <div className="q-select-wrap">
                        <div className="q-swatch" style={{ background: sc }} />
                        <select
                          className="q-select"
                          value={row.status}
                          style={{ borderColor: sc }}
                          onChange={(e) => updateAction(idx, "status", e.target.value)}
                        >
                          {STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                          ))}
                        </select>
                        <div className="q-score-badge" style={{ fontSize: 11, minWidth: 70, background: `${sc}1a`, borderColor: sc, color: sc }}>
                          {STATUS_LABELS[row.status]}
                        </div>
                      </div>
                    </div>
                    <div style={{ padding: "0 20px 14px", display: "flex", gap: 16, alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 11, color: "var(--ink3)" }}>Début :</span>
                        <input className="field-input" type="number" value={row.start}
                          onChange={(e) => updateAction(idx, "start", Number(e.target.value))}
                          style={{ width: 80, fontSize: 11, padding: "5px 9px" }} />
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 11, color: "var(--ink3)" }}>Fin :</span>
                        <input className="field-input" type="number" value={row.end}
                          onChange={(e) => updateAction(idx, "end", Number(e.target.value))}
                          style={{ width: 80, fontSize: 11, padding: "5px 9px" }} />
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 11, color: "var(--ink3)" }}>Budget USD :</span>
                        <input className="field-input" type="number" value={row.budget}
                          onChange={(e) => updateAction(idx, "budget", Number(e.target.value))}
                          style={{ width: 120, fontSize: 11, padding: "5px 9px" }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          )}

          {/* ─────────────────── COUNTRIES ─────────────────── */}
          {tab === "countries" && (
            <>
              {countries.map((row, ci) => {
                const isLast = ci === countries.length - 1;
                return (
                  <div key={row.country}>
                    <div className="group-header" style={ci === 0 ? { marginTop: 0 } : {}}>
                      <span className="gh-title">🌍 {row.country}</span>
                      <span className="gh-count">{row.region} · {row.actions} actions</span>
                    </div>
                    <div className="q-card" style={isLast ? { borderRadius: "0 0 8px 8px", borderTop: "1px solid var(--border)" } : { borderTop: "1px solid var(--border)" }}>
                      <div className="q-options">
                        <div className="field-grid">
                          <div className="field-group">
                            <label className="field-label">{t("totalActions")}</label>
                            <input className="field-input" type="number" value={row.actions}
                              onChange={(e) => updateCountry(row.country, "actions", Number(e.target.value))} />
                          </div>
                          <div className="field-group">
                            <label className="field-label">Budget (USD)</label>
                            <input className="field-input" type="number" value={row.budget}
                              onChange={(e) => updateCountry(row.country, "budget", Number(e.target.value))} />
                          </div>
                          <div className="field-group">
                            <label className="field-label">{t("colResponsible")}</label>
                            <input className="field-input" type="text" value={row.entity}
                              onChange={(e) => updateCountry(row.country, "entity", e.target.value)} />
                          </div>
                          <div className="field-group">
                            <label className="field-label" style={{ color: "var(--c-complete)" }}>{t("pctCompleted")}</label>
                            <input className="field-input" type="number" min="0" max="100" value={row.completed}
                              onChange={(e) => updateCountry(row.country, "completed", Number(e.target.value))}
                              style={{ borderColor: "var(--c-complete)" }} />
                          </div>
                          <div className="field-group">
                            <label className="field-label" style={{ color: "#f0a500" }}>{t("pctInProgress")}</label>
                            <input className="field-input" type="number" min="0" max="100" value={row.inprogress}
                              onChange={(e) => updateCountry(row.country, "inprogress", Number(e.target.value))}
                              style={{ borderColor: "var(--c-progress)" }} />
                          </div>
                          <div className="field-group">
                            <label className="field-label" style={{ color: "var(--c-delayed)" }}>{t("pctDelayed")}</label>
                            <input className="field-input" type="number" min="0" max="100" value={row.delayed}
                              onChange={(e) => updateCountry(row.country, "delayed", Number(e.target.value))}
                              style={{ borderColor: "var(--c-delayed)" }} />
                          </div>
                          <div className="field-group">
                            <label className="field-label" style={{ color: "var(--slate)" }}>{t("pctNotStarted")}</label>
                            <input className="field-input" type="number" min="0" max="100" value={row.notstarted}
                              onChange={(e) => updateCountry(row.country, "notstarted", Number(e.target.value))}
                              style={{ borderColor: "var(--c-nostart)" }} />
                          </div>
                        </div>
                        {/* Visual bar */}
                        <div style={{ marginTop: 14, display: "flex", gap: 2, height: 8, borderRadius: 4, overflow: "hidden" }}>
                          {[
                            { v: row.completed,  c: "#2d9d5e" },
                            { v: row.inprogress, c: "#f0a500" },
                            { v: row.delayed,    c: "#e74c3c" },
                            { v: row.notstarted, c: "#95a5a6" },
                          ].map((s, i) => s.v > 0 && (
                            <div key={i} style={{ width: `${s.v}%`, background: s.c, minWidth: 4 }} title={`${s.v}%`} />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          )}

          {/* ─────────────────── USERS / ACCESS ─────────────────── */}
          {tab === "users" && isMasterAdmin && (() => {
            const ROLE_COLORS: Record<string, string> = { admin: "#c0392b", focal_point: "#2980b9", expert: "#27ae60", rsoo: "#8e44ad", observer: "#d97706" };
            const ROLE_LABELS: Record<string, string> = { admin: t("roleAdministrator"), focal_point: t("roleFocalPointLabel"), expert: t("filterExpert"), rsoo: t("filterRsoo"), observer: t("roleObserver") };
            const filtered = localUsers.filter((u) => {
              if (roleFilter !== "all" && u.role !== roleFilter) return false;
              const q = userSearch.toLowerCase();
              return !q || u.username.toLowerCase().includes(q) || u.displayName?.toLowerCase().includes(q) || u.country?.toLowerCase().includes(q);
            });
            return (
              <>
                {/* Header */}
                <div className="group-header" style={{ marginTop: 0 }}>
                  <span className="gh-title">{t("adminUsersTitle")}</span>
                  <span className="gh-count">{t("adminUsersCount").replace("{n}", String(localUsers.length))}</span>
                </div>

                {/* Toolbar */}
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
                  <input
                    type="text"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder={t("searchUserPlaceholder")}
                    style={{ flex: 1, minWidth: 200, padding: "6px 10px", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12, background: "var(--bg2)", color: "var(--ink1)" }}
                  />
                  {(["all", "admin", "focal_point", "expert", "rsoo", "observer"] as const).map((r) => (
                    <button key={r} onClick={() => setRoleFilter(r as "all" | UserRole)} style={{
                      padding: "5px 12px", borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: "pointer",
                      border: roleFilter === r ? "2px solid var(--forest2)" : "1px solid var(--border)",
                      background: roleFilter === r ? "var(--forest2)" : "var(--surface2)",
                      color: roleFilter === r ? "#fff" : "var(--ink2)",
                    }}>
                      {r === "all"
                        ? `${t("filterAll")} (${localUsers.length})`
                        : r === "admin"       ? `${t("roleAdministrator")} (${localUsers.filter(u => u.role === "admin").length})`
                        : r === "focal_point" ? `${t("filterFocalPoint")} (${localUsers.filter(u => u.role === "focal_point").length})`
                        : r === "rsoo"        ? `${t("filterRsoo")} (${localUsers.filter(u => u.role === "rsoo").length})`
                        : r === "observer"    ? `${t("filterObserver")} (${localUsers.filter(u => u.role === "observer").length})`
                        :                       `${t("filterExpert")} (${localUsers.filter(u => u.role === "expert").length})`}
                    </button>
                  ))}
                  <button onClick={() => exportExcel(
                    "AFCAC_Users",
                    "Users",
                    ["#", t("colDisplayName"), t("colUsername"), t("colRole"), t("colCountry"), "Email", t("colPassword")],
                    localUsers.map((u, i) => [i + 1, u.displayName, u.username, u.role, u.country ?? "", u.email ?? "", u.devPassword ?? ""])
                  )} style={{ padding: "5px 14px", borderRadius: 5, fontSize: 11, fontWeight: 700, cursor: "pointer", border: "1px solid #27ae60", background: "rgba(39,174,96,0.12)", color: "#27ae60", whiteSpace: "nowrap" }}>
                    {t("btnExportExcel")}
                  </button>
                  <button onClick={() => { setAddUserOpen(true); setAddUserError(""); }} style={{ padding: "5px 16px", borderRadius: 5, fontSize: 11, fontWeight: 700, cursor: "pointer", border: "1px solid var(--forest2)", background: "var(--forest2)", color: "#fff", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 5 }}>
                    + {t("btnAddUser")}
                  </button>
                </div>

                {/* Table */}
                <div style={{ borderRadius: 8, border: "1px solid var(--border)", overflow: "hidden" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: "var(--forest)", color: "#fff" }}>
                        <th style={{ padding: "9px 12px", textAlign: "left", fontWeight: 700, width: 32 }}>#</th>
                        <th style={{ padding: "9px 12px", textAlign: "left", fontWeight: 700 }}>{t("colDisplayName")}</th>
                        <th style={{ padding: "9px 12px", textAlign: "left", fontWeight: 700 }}>{t("colUsername")}</th>
                        <th style={{ padding: "9px 12px", textAlign: "left", fontWeight: 700 }}>{t("colCountry")}</th>
                        <th style={{ padding: "9px 12px", textAlign: "left", fontWeight: 700 }}>{t("colRole")}</th>
                        <th style={{ padding: "9px 12px", textAlign: "center", fontWeight: 700 }}>{t("colAccountStatus")}</th>
                        <th style={{ padding: "9px 12px", textAlign: "left", fontWeight: 700 }}>{t("colPassword")}</th>
                        <th style={{ padding: "9px 12px", textAlign: "center", fontWeight: 700, width: 140 }}>{t("colActions")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((u, i) => {
                        const isEditing = editingUser === u.username;
                        const isDisabled = !!u.disabled;
                        const canToggle = !MASTER_ADMINS.includes(u.username) && u.username !== username;
                        return (
                          <>
                            <tr key={u.username} style={{ borderTop: "1px solid var(--border)", background: isEditing ? "rgba(1,119,100,0.07)" : i % 2 === 0 ? "transparent" : "var(--surface2)", opacity: isDisabled ? 0.55 : 1 }}>
                              <td style={{ padding: "8px 12px", color: "var(--ink3)", fontWeight: 600 }}>{i + 1}</td>
                              <td style={{ padding: "8px 12px", fontWeight: 600, color: "var(--ink1)" }}>
                                {u.displayName}
                                {isDisabled && <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 700, color: "#fff", background: "#dc2626", padding: "1px 5px", borderRadius: 4, letterSpacing: ".04em" }}>{t("statusBadgeDisabled")}</span>}
                              </td>
                              <td style={{ padding: "8px 12px" }}>
                                <code style={{ background: "var(--surface2)", padding: "2px 6px", borderRadius: 4, fontSize: 11, color: "var(--forest2)", border: "1px solid var(--border)" }}>
                                  {u.username}
                                </code>
                              </td>
                              <td style={{ padding: "8px 12px", color: "var(--ink2)", maxWidth: 260 }}>
                                {u.role === "rsoo" && u.countries?.length ? (
                                  <div>
                                    <div style={{ fontSize: 10, fontWeight: 700, color: "#8e44ad", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 4 }}>
                                      {u.countries.length} {t("countriesAssigned")}
                                    </div>
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                                      {u.countries.map((c) => (
                                        <span key={c} style={{ display: "inline-block", padding: "1px 6px", borderRadius: 10, fontSize: 9, fontWeight: 600, background: "rgba(142,68,173,0.10)", color: "#8e44ad", border: "1px solid rgba(142,68,173,0.25)", whiteSpace: "nowrap" }}>
                                          {c}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                ) : (
                                  u.country || "—"
                                )}
                              </td>
                              <td style={{ padding: "8px 12px" }}>
                                <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 12, fontSize: 10, fontWeight: 700, background: ROLE_COLORS[u.role] + "22", color: ROLE_COLORS[u.role], border: `1px solid ${ROLE_COLORS[u.role]}44` }}>
                                  {ROLE_LABELS[u.role] ?? u.role}
                                </span>
                              </td>
                              <td style={{ padding: "6px 12px", textAlign: "center" }}>
                                <button
                                  onClick={() => canToggle ? toggleDisabled(u) : undefined}
                                  disabled={!canToggle}
                                  title={!canToggle ? t("accountProtected") : isDisabled ? t("enableAccount") : t("disableAccount")}
                                  style={{
                                    padding: "4px 10px", borderRadius: 5, fontSize: 11, fontWeight: 700,
                                    cursor: canToggle ? "pointer" : "not-allowed",
                                    border: isDisabled ? "1px solid #dc2626" : "1px solid #16a34a",
                                    background: isDisabled ? "rgba(220,38,38,0.10)" : "rgba(22,163,74,0.10)",
                                    color: isDisabled ? "#dc2626" : "#16a34a",
                                    opacity: canToggle ? 1 : 0.4,
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {isDisabled ? t("statusDisabled") : t("statusActive")}
                                </button>
                              </td>
                              <td style={{ padding: "8px 12px" }}>
                                <code style={{ background: "var(--surface2)", padding: "2px 6px", borderRadius: 4, fontSize: 11, color: "var(--amber)", border: "1px solid var(--border)" }}>
                                  {u.devPassword}
                                </code>
                              </td>
                              <td style={{ padding: "6px 12px", textAlign: "center" }}>
                                <div style={{ display: "flex", gap: 5, justifyContent: "center", alignItems: "center" }}>
                                  <button onClick={() => isEditing ? cancelEdit() : startEdit(u)} style={{
                                    padding: "4px 10px", borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: "pointer",
                                    border: isEditing ? "1px solid var(--amber)" : "1px solid var(--forest2)",
                                    background: isEditing ? "rgba(240,165,0,0.1)" : "rgba(1,119,100,0.1)",
                                    color: isEditing ? "var(--amber)" : "var(--forest2)",
                                  }}>
                                    {isEditing ? t("btnCancelEdit") : t("btnEdit")}
                                  </button>
                                  {canToggle && deleteConfirm === u.username ? (
                                    <>
                                      <button onClick={() => deleteUser(u.username)} disabled={userDeleting} style={{
                                        padding: "4px 8px", borderRadius: 5, fontSize: 11, fontWeight: 700, cursor: userDeleting ? "not-allowed" : "pointer",
                                        border: "1px solid #dc2626", background: "rgba(220,38,38,0.15)", color: "#dc2626",
                                      }}>
                                        {t("confirmDeleteUser")}
                                      </button>
                                      <button onClick={() => setDeleteConfirm(null)} style={{
                                        padding: "4px 6px", borderRadius: 5, fontSize: 11, cursor: "pointer",
                                        border: "1px solid var(--border)", background: "var(--surface2)", color: "var(--ink3)",
                                      }}>✕</button>
                                    </>
                                  ) : canToggle && (
                                    <button onClick={() => setDeleteConfirm(u.username)} title={t("btnDeleteUser")} style={{
                                      padding: "4px 8px", borderRadius: 5, fontSize: 12, cursor: "pointer",
                                      border: "1px solid rgba(220,38,38,0.4)", background: "rgba(220,38,38,0.07)", color: "#dc2626",
                                    }}>
                                      🗑
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>

                            {/* Inline edit row */}
                            {isEditing && (
                              <tr key={`${u.username}-edit`} style={{ background: "rgba(1,119,100,0.04)", borderTop: "1px dashed var(--forest2)" }}>
                                <td colSpan={8} style={{ padding: "14px 16px" }}>
                                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
                                    <div>
                                      <label style={{ fontSize: 10, fontWeight: 700, color: "var(--forest2)", display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: ".05em" }}>{t("editUsername")}</label>
                                      <input type="text" value={editDraft.newUsername} onChange={(e) => setEditDraft((d) => ({ ...d, newUsername: e.target.value }))}
                                        style={{ width: "100%", padding: "6px 8px", border: "1px solid var(--forest2)", borderRadius: 5, fontSize: 12, background: "var(--bg2)", color: "var(--forest2)", boxSizing: "border-box", fontFamily: "monospace" }} />
                                    </div>
                                    <div>
                                      <label style={{ fontSize: 10, fontWeight: 700, color: "var(--ink3)", display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: ".05em" }}>{t("editDisplayName")}</label>
                                      <input type="text" value={editDraft.displayName} onChange={(e) => setEditDraft((d) => ({ ...d, displayName: e.target.value }))}
                                        style={{ width: "100%", padding: "6px 8px", border: "1px solid var(--border)", borderRadius: 5, fontSize: 12, background: "var(--bg2)", color: "var(--ink1)", boxSizing: "border-box" }} />
                                    </div>
                                    <div>
                                      <label style={{ fontSize: 10, fontWeight: 700, color: "var(--ink3)", display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: ".05em" }}>{t("editNewPassword")}</label>
                                      <input type="text" value={editDraft.devPassword} onChange={(e) => setEditDraft((d) => ({ ...d, devPassword: e.target.value }))}
                                        placeholder={t("editPasswordHint")}
                                        style={{ width: "100%", padding: "6px 8px", border: "1px solid var(--border)", borderRadius: 5, fontSize: 12, background: "var(--bg2)", color: "var(--ink1)", boxSizing: "border-box" }} />
                                    </div>
                                    <div>
                                      <label style={{ fontSize: 10, fontWeight: 700, color: "var(--ink3)", display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: ".05em" }}>{t("editRole")}</label>
                                      <select value={editDraft.role} onChange={(e) => setEditDraft((d) => ({ ...d, role: e.target.value as UserRole }))}
                                        style={{ width: "100%", padding: "6px 8px", border: "1px solid var(--border)", borderRadius: 5, fontSize: 12, background: "var(--bg2)", color: "var(--ink1)", boxSizing: "border-box" }}>
                                        <option value="admin">{t("roleAdministrator")}</option>
                                        <option value="focal_point">{t("roleFocalPointLabel")}</option>
                                        <option value="expert">{t("filterExpert")}</option>
                                        <option value="rsoo">{t("filterRsoo")}</option>
                                        <option value="observer">{t("roleObserver")}</option>
                                      </select>
                                    </div>
                                    <div>
                                      <label style={{ fontSize: 10, fontWeight: 700, color: "var(--ink3)", display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: ".05em" }}>{t("editCountry")}</label>
                                      <select value={editDraft.country} onChange={(e) => setEditDraft((d) => ({ ...d, country: e.target.value }))}
                                        style={{ width: "100%", padding: "6px 8px", border: "1px solid var(--border)", borderRadius: 5, fontSize: 12, background: "var(--bg2)", color: "var(--ink1)", boxSizing: "border-box" }}>
                                        <option value="">{t("editNoCountry")}</option>
                                        {AFRICAN_STATES.map((c) => <option key={c} value={c}>{c}</option>)}
                                      </select>
                                    </div>
                                  </div>

                                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <button onClick={saveUser} disabled={userSaving} style={{
                                      padding: "6px 18px", borderRadius: 6, fontWeight: 700, fontSize: 12, cursor: userSaving ? "not-allowed" : "pointer",
                                      background: "var(--forest2)", color: "#fff", border: "none", opacity: userSaving ? 0.7 : 1,
                                    }}>
                                      {userSaving ? t("btnSaving") : t("btnSaveChanges")}
                                    </button>
                                    <button onClick={cancelEdit} style={{ padding: "6px 14px", borderRadius: 6, fontWeight: 600, fontSize: 12, cursor: "pointer", background: "var(--surface2)", color: "var(--ink2)", border: "1px solid var(--border)" }}>
                                      {t("btnCancel")}
                                    </button>
                                    <span style={{ fontSize: 11, color: "var(--ink3)", marginLeft: 6 }}>
                                      {t("editingUser")} <strong style={{ color: "var(--forest2)" }}>{u.username}</strong>
                                    </span>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </>
                        );
                      })}
                      {filtered.length === 0 && (
                        <tr><td colSpan={8} style={{ padding: "24px", textAlign: "center", color: "var(--ink3)", fontSize: 13 }}>{t("noUsersFound")}</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            );
          })()}

          {/* ─────────────────── SESSIONS ─────────────────── */}
          {tab === "sessions" && role === "admin" && (
            <OnlineUsers />
          )}

          {/* ─────────────────── UPDATES LOG ─────────────────── */}
          {tab === "updates" && role === "admin" && (
            <div className="card">
              <div className="card-head">
                <span className="card-head-title">{t("adminTabUpdatesTitle")}</span>
                <span className="card-head-badge">{updateLogs.length} {t("pageSessions")}</span>
                <button
                  onClick={() => { setUpdatesLoaded(false); }}
                  style={{ marginLeft: 8, padding: "3px 10px", borderRadius: 4, border: "1px solid var(--border)", background: "var(--surface2)", cursor: "pointer", fontSize: 11, color: "var(--ink2)" }}
                >
                  ↺ {t("updatesRefresh")}
                </button>
              </div>
              <div className="card-body">
                {updatesLoading ? (
                  <div style={{ padding: 32, textAlign: "center", color: "var(--ink3)", fontSize: 13 }}>{t("sessionsLoading")}</div>
                ) : updateLogs.length === 0 ? (
                  <div style={{ padding: 32, textAlign: "center", color: "var(--ink3)", fontSize: 13 }}>{t("noUpdatesYet")}</div>
                ) : (
                  <div className="tbl-scroll">
                    <table className="dtable">
                      <thead>
                        <tr>
                          <th style={{ width: 36 }}>#</th>
                          <th>{t("colUser")}</th>
                          <th>{t("colCountry")}</th>
                          <th>{t("colDateTime")}</th>
                          <th style={{ textAlign: "center" }}>{t("colTargetsCount")}</th>
                          <th>{t("colTargetIds")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {updateLogs.map((log, i) => {
                          const dt = new Date(log.date);
                          const dateStr = dt.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
                          const timeStr = dt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
                          return (
                            <tr key={i}>
                              <td style={{ color: "var(--ink3)", fontSize: 11 }}>{updateLogs.length - i}</td>
                              <td>
                                <div style={{ fontWeight: 600, fontSize: 12 }}>{log.fullName || log.username}</div>
                                <div style={{ fontSize: 10, color: "var(--ink3)", fontFamily: "monospace" }}>{log.username}</div>
                              </td>
                              <td style={{ fontSize: 12, color: "var(--ink2)" }}>{log.country || "—"}</td>
                              <td>
                                <div style={{ fontSize: 12, fontWeight: 600 }}>{dateStr}</div>
                                <div style={{ fontSize: 10, color: "var(--ink3)" }}>{timeStr}</div>
                              </td>
                              <td style={{ textAlign: "center" }}>
                                <span style={{
                                  display: "inline-block", padding: "2px 8px", borderRadius: 10,
                                  background: log.targetsUpdated > 0 ? "#e6f4ea" : "var(--surface2)",
                                  color: log.targetsUpdated > 0 ? "#1a6b3c" : "var(--ink3)",
                                  fontWeight: 700, fontSize: 12,
                                }}>
                                  {log.targetsUpdated}
                                </span>
                              </td>
                              <td>
                                {log.targetIds && log.targetIds.length > 0 ? (
                                  <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                                    {log.targetIds.map(id => (
                                      <span key={id} style={{
                                        padding: "1px 6px", borderRadius: 4, fontSize: 10, fontWeight: 700,
                                        fontFamily: "'Barlow Condensed', monospace",
                                        background: "var(--navy)", color: "#fff",
                                      }}>{id}</span>
                                    ))}
                                  </div>
                                ) : (
                                  <span style={{ fontSize: 11, color: "var(--ink3)" }}>—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

        </main>
      </div>

      {/* ── BOTTOM ACTION BAR ── */}
      <div className="form-actions">
        <div className="fa-stats">
          <strong>{answeredTargets}</strong> / {targets.length} {t("adminTargetsPlural")}
          &nbsp;·&nbsp; {t("tabTargets")} : <strong>{t((NAV_ITEM_DEFS.find((n) => n.id === tab)?.labelKey ?? "navTargetsLabel") as Parameters<typeof t>[0])}</strong>
        </div>
        <Link href="/" className="btn btn-secondary-form">
          {t("btnCancel")}
        </Link>
        <button
          className="btn btn-primary-form"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? t("btnSaving") : t("btnSaveChanges")}
        </button>
      </div>

      {/* ── ADD USER MODAL ── */}
      {addUserOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={(e) => { if (e.target === e.currentTarget) setAddUserOpen(false); }}>
          <div style={{ background: "var(--bg1)", borderRadius: 12, boxShadow: "0 8px 40px rgba(0,0,0,0.35)", width: 520, maxWidth: "95vw", padding: 0, overflow: "hidden" }}>

            {/* Modal header */}
            <div style={{ background: "var(--forest)", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ color: "#fff", fontWeight: 700, fontSize: 15, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: ".03em" }}>
                  {t("btnAddUser")}
                </div>
                <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, marginTop: 2 }}>{t("addUserSubtitle")}</div>
              </div>
              <button onClick={() => setAddUserOpen(false)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.7)", fontSize: 20, cursor: "pointer", lineHeight: 1, padding: "0 4px" }}>✕</button>
            </div>

            {/* Modal body */}
            <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 14 }}>

              {/* Row 1: Display Name + Username */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 700, color: "var(--ink3)", display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: ".05em" }}>
                    {t("editDisplayName")} <span style={{ color: "#dc2626" }}>*</span>
                  </label>
                  <input type="text" value={addUserDraft.displayName}
                    onChange={(e) => setAddUserDraft((d) => ({ ...d, displayName: e.target.value }))}
                    placeholder={t("placeholderFullName")}
                    style={{ width: "100%", padding: "7px 10px", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12, background: "var(--bg2)", color: "var(--ink1)", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 700, color: "var(--ink3)", display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: ".05em" }}>
                    {t("colUsername")} <span style={{ color: "#dc2626" }}>*</span>
                  </label>
                  <input type="text" value={addUserDraft.username}
                    onChange={(e) => setAddUserDraft((d) => ({ ...d, username: e.target.value.toLowerCase().replace(/\s/g, ".") }))}
                    placeholder={t("placeholderNewUsername")}
                    style={{ width: "100%", padding: "7px 10px", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12, background: "var(--bg2)", color: "var(--ink1)", boxSizing: "border-box", fontFamily: "monospace" }} />
                </div>
              </div>

              {/* Row 2: Password + Role */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 700, color: "var(--ink3)", display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: ".05em" }}>
                    {t("editNewPassword")} <span style={{ color: "#dc2626" }}>*</span>
                  </label>
                  <input type="text" value={addUserDraft.devPassword}
                    onChange={(e) => setAddUserDraft((d) => ({ ...d, devPassword: e.target.value }))}
                    placeholder={t("placeholderPassword")}
                    style={{ width: "100%", padding: "7px 10px", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12, background: "var(--bg2)", color: "var(--ink1)", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 700, color: "var(--ink3)", display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: ".05em" }}>
                    {t("editRole")} <span style={{ color: "#dc2626" }}>*</span>
                  </label>
                  <select value={addUserDraft.role}
                    onChange={(e) => setAddUserDraft((d) => ({ ...d, role: e.target.value as UserRole }))}
                    style={{ width: "100%", padding: "7px 10px", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12, background: "var(--bg2)", color: "var(--ink1)", boxSizing: "border-box", cursor: "pointer" }}>
                    <option value="focal_point">{t("roleFocalPointLabel")}</option>
                    <option value="admin">{t("roleAdministrator")}</option>
                    <option value="expert">{t("filterExpert")}</option>
                    <option value="rsoo">{t("filterRsoo")}</option>
                    <option value="observer">{t("roleObserver")}</option>
                  </select>
                </div>
              </div>

              {/* Row 3: Country + Email */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 700, color: "var(--ink3)", display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: ".05em" }}>
                    {t("editCountry")}
                  </label>
                  <select value={addUserDraft.country}
                    onChange={(e) => setAddUserDraft((d) => ({ ...d, country: e.target.value }))}
                    style={{ width: "100%", padding: "7px 10px", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12, background: "var(--bg2)", color: "var(--ink1)", boxSizing: "border-box", cursor: "pointer" }}>
                    <option value="">{t("editNoCountry")}</option>
                    {AFRICAN_STATES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 700, color: "var(--ink3)", display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: ".05em" }}>Email</label>
                  <input type="email" value={addUserDraft.email}
                    onChange={(e) => setAddUserDraft((d) => ({ ...d, email: e.target.value }))}
                    placeholder={t("placeholderEmail")}
                    style={{ width: "100%", padding: "7px 10px", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12, background: "var(--bg2)", color: "var(--ink1)", boxSizing: "border-box" }} />
                </div>
              </div>

              {/* Error */}
              {addUserError && (
                <div style={{ background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.3)", borderRadius: 6, padding: "8px 12px", fontSize: 12, color: "#dc2626" }}>
                  ⚠ {addUserError}
                </div>
              )}

              {/* Actions */}
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
                <button onClick={() => setAddUserOpen(false)} style={{ padding: "8px 18px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", background: "var(--surface2)", color: "var(--ink2)", border: "1px solid var(--border)" }}>
                  {t("btnCancel")}
                </button>
                <button onClick={createUser} disabled={addUserSaving} style={{ padding: "8px 22px", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: addUserSaving ? "not-allowed" : "pointer", background: "var(--forest2)", color: "#fff", border: "none", opacity: addUserSaving ? 0.7 : 1 }}>
                  {addUserSaving ? t("btnSaving") : t("btnCreateUser")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      <Toast msg={toast.msg} type={toast.type} visible={toastVisible} />
    </>
  );
}

