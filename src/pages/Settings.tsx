import { useState } from "react";
import {
  User, Mail, Key, Smartphone, Globe, Bell, Volume2,
  Moon, Sun, Eye, Wifi, EyeOff, MessageSquare, Download,
  HardDrive, Shield, Lock, HelpCircle, FileText, Info,
  Trash2, LogOut, ChevronRight, Pencil, Check, X,
  AlertTriangle, ArrowLeft,
} from "lucide-react";

/* ── tiny design tokens ── */
const dark = {
  bg: "#0f1117",
  surface: "#1a1d27",
  border: "#2a2d3a",
  text: "#e8eaf0",
  muted: "#6b7280",
  accent: "#6c8fff",
  danger: "#ff5c72",
};

/* ── sidebar sections ── */
const SECTIONS = [
  {
    label: "Account",
    items: [
      { id: "profile",      icon: User,         label: "Profile" },
      { id: "account",      icon: Key,           label: "Account" },
    ],
  },
  {
    label: "Preferences",
    items: [
      { id: "appearance",   icon: Moon,          label: "Appearance" },
      { id: "notifications",icon: Bell,          label: "Notifications" },
      { id: "chat",         icon: MessageSquare, label: "Chat" },
    ],
  },
  {
    label: "Privacy & Security",
    items: [
      { id: "privacy",      icon: Eye,           label: "Privacy" },
      { id: "security",     icon: Shield,        label: "Security" },
    ],
  },
  {
    label: "More",
    items: [
      { id: "storage",      icon: HardDrive,     label: "Storage" },
      { id: "help",         icon: HelpCircle,    label: "Help" },
      { id: "danger",       icon: AlertTriangle, label: "Danger Zone", danger: true },
    ],
  },
];

/* ── shared primitives ── */
const Row = ({ icon: Icon, label, description = "", right = null, onClick = null, danger = false, last = false }) => (
  <div
    onClick={onClick}
    style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "11px 16px",
      borderBottom: last ? "none" : `1px solid ${dark.border}`,
      cursor: onClick ? "pointer" : "default",
      transition: "background 0.15s",
    }}
    onMouseEnter={e => onClick && (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
    onMouseLeave={e => onClick && (e.currentTarget.style.background = "transparent")}
  >
    <div style={{
      width: 34, height: 34, borderRadius: 10, flexShrink: 0,
      background: danger ? "rgba(255,92,114,0.12)" : "rgba(108,143,255,0.1)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <Icon size={15} color={danger ? dark.danger : dark.accent} />
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <p style={{ fontSize: 13.5, fontWeight: 500, color: danger ? dark.danger : dark.text, margin: 0 }}>
        {label}
      </p>
      {description && (
        <p style={{ fontSize: 11.5, color: dark.muted, margin: "2px 0 0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {description}
        </p>
      )}
    </div>
    {right && <div style={{ flexShrink: 0 }}>{right}</div>}
    {onClick && !right && <ChevronRight size={14} color={dark.muted} />}
  </div>
);

const Toggle = ({ checked, onChange }) => (
  <div
    onClick={() => onChange(!checked)}
    style={{
      width: 40, height: 22, borderRadius: 11, cursor: "pointer",
      background: checked ? dark.accent : dark.border,
      position: "relative", transition: "background 0.2s", flexShrink: 0,
    }}
  >
    <div style={{
      position: "absolute", top: 3, left: checked ? 21 : 3,
      width: 16, height: 16, borderRadius: "50%",
      background: "#fff", transition: "left 0.2s",
    }} />
  </div>
);

const ToggleRow = ({ icon, label, description, checked, onChange, last = false }) => (
  <Row
    icon={icon} label={label} description={description} last={last}
    right={<Toggle checked={checked} onChange={onChange} />}
  />
);

const Card = ({ children }) => (
  <div style={{ background: dark.surface, borderRadius: 14, border: `1px solid ${dark.border}`, overflow: "hidden", marginBottom: 16 }}>
    {children}
  </div>
);

const SectionTitle = ({ children }) => (
  <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: dark.muted, margin: "20px 0 8px 2px" }}>
    {children}
  </p>
);

/* ── content panels ── */
const panels = {
  profile: ({ user }) => (
    <div>
      <SectionTitle>Profile</SectionTitle>
      <Card>
        <div style={{ padding: "20px 16px", borderBottom: `1px solid ${dark.border}`, display: "flex", gap: 16, alignItems: "center" }}>
          <div style={{ width: 60, height: 60, borderRadius: "50%", background: `linear-gradient(135deg, ${dark.accent}, #a78bfa)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
            {(user?.name?.[0] ?? "?").toUpperCase()}
          </div>
          <div>
            <p style={{ fontWeight: 600, fontSize: 16, color: dark.text, margin: 0 }}>{user?.name || "Your Name"}</p>
            <p style={{ fontSize: 12, color: dark.muted, margin: "3px 0 6px" }}>{user?.email || "your@email.com"}</p>
            <span style={{ fontSize: 10, fontWeight: 700, background: "rgba(108,143,255,0.15)", color: dark.accent, padding: "3px 8px", borderRadius: 20 }}>Free Plan</span>
          </div>
        </div>
        <Row icon={User} label="Edit Profile" description="Name, bio, profile photo" onClick={() => {}} />
        <Row icon={Mail} label="Email Address" description={user?.email || "Not set"} onClick={() => {}} last />
      </Card>
    </div>
  ),

  account: () => (
    <div>
      <SectionTitle>Account</SectionTitle>
      <Card>
        <Row icon={Key} label="Change Password" description="Update your login password" onClick={() => {}} />
        <Row icon={Smartphone} label="Linked Devices" description="Manage active sessions" right={<span style={{ fontSize: 11, color: dark.muted }}>2 devices</span>} onClick={() => {}} />
        <Row icon={Globe} label="Language" description="App display language" right={<span style={{ fontSize: 11, color: dark.muted }}>English</span>} onClick={() => {}} last />
      </Card>
    </div>
  ),

  appearance: ({ theme, toggleTheme }) => (
    <div>
      <SectionTitle>Appearance</SectionTitle>
      <Card>
        <ToggleRow
          icon={theme === "dark" ? Moon : Sun}
          label="Dark Mode"
          description={theme === "dark" ? "Using dark theme" : "Using light theme"}
          checked={theme === "dark"}
          onChange={toggleTheme}
          last
        />
      </Card>
    </div>
  ),

  notifications: ({ state, set }) => (
    <div>
      <SectionTitle>Notifications</SectionTitle>
      <Card>
        <ToggleRow icon={Bell} label="Push Notifications" description="New messages and activity" checked={state.notifications} onChange={v => set("notifications", v)} />
        <ToggleRow icon={Volume2} label="Sound Alerts" description="Play sound on new messages" checked={state.soundAlerts} onChange={v => set("soundAlerts", v)} last />
      </Card>
    </div>
  ),

  chat: ({ state, set }) => (
    <div>
      <SectionTitle>Chat Settings</SectionTitle>
      <Card>
        <ToggleRow icon={MessageSquare} label="Enter to Send" description="Shift+Enter for new line" checked={state.enterToSend} onChange={v => set("enterToSend", v)} />
        <Row icon={Globe} label="Chat Backup" description="Back up chats to cloud" onClick={() => {}} last />
      </Card>
    </div>
  ),

  privacy: ({ state, set }) => (
    <div>
      <SectionTitle>Privacy</SectionTitle>
      <Card>
        <ToggleRow icon={Eye} label="Read Receipts" description="Let others see when you've read" checked={state.readReceipts} onChange={v => set("readReceipts", v)} />
        <ToggleRow icon={Wifi} label="Online Status" description="Show when you're active" checked={state.onlineStatus} onChange={v => set("onlineStatus", v)} />
        <Row icon={EyeOff} label="Blocked Users" description="Manage blocked contacts" right={<span style={{ fontSize: 11, color: dark.muted }}>0 blocked</span>} onClick={() => {}} last />
      </Card>
    </div>
  ),

  security: () => (
    <div>
      <SectionTitle>Security</SectionTitle>
      <Card>
        <Row icon={Shield} label="Two-Factor Authentication" description="Add an extra layer of security" right={<span style={{ fontSize: 11, fontWeight: 700, color: "#f59e0b" }}>Off</span>} onClick={() => {}} />
        <Row icon={Lock} label="Active Sessions" description="Review login activity" onClick={() => {}} last />
      </Card>
    </div>
  ),

  storage: ({ state, set }) => (
    <div>
      <SectionTitle>Storage & Data</SectionTitle>
      <Card>
        <ToggleRow icon={Download} label="Auto-download Media" description="Download images automatically" checked={state.mediaAutoDownload} onChange={v => set("mediaAutoDownload", v)} />
        <Row icon={HardDrive} label="Storage Usage" description="Manage cached data" right={<span style={{ fontSize: 11, color: dark.muted }}>42 MB</span>} onClick={() => {}} last />
      </Card>
    </div>
  ),

  help: () => (
    <div>
      <SectionTitle>Help & Support</SectionTitle>
      <Card>
        <Row icon={HelpCircle} label="Help Center" description="FAQs and guides" onClick={() => {}} />
        <Row icon={FileText} label="Terms of Service" description="" onClick={() => {}} />
        <Row icon={Info} label="App Version" description="Chatify for Web" right={<span style={{ fontSize: 11, color: dark.muted }}>v2.4.1</span>} last />
      </Card>
    </div>
  ),

  danger: ({ onClear, onLogout }) => (
    <div>
      <SectionTitle>Danger Zone</SectionTitle>
      <Card>
        <Row icon={Trash2} label="Clear All Chats" description="Permanently delete all messages" danger onClick={onClear} />
        <Row icon={LogOut} label="Logout" description="Sign out of your account" danger onClick={onLogout} last />
      </Card>
    </div>
  ),
};

/* ── main component ── */
export default function Settings() {
  const [active, setActive] = useState("profile");
  const [theme, setTheme] = useState("dark");
  const [toggles, setToggles] = useState({
    notifications: true, soundAlerts: true, readReceipts: true,
    onlineStatus: true, enterToSend: true, mediaAutoDownload: false,
  });

  const user = { name: "Alex Johnson", email: "alex@example.com" };
  const set = (key, val) => setToggles(p => ({ ...p, [key]: val }));

  const Panel = panels[active];

  const panelProps = {
    user,
    theme,
    toggleTheme: () => setTheme(t => t === "dark" ? "light" : "dark"),
    state: toggles,
    set,
    onClear: () => alert("All chats cleared"),
    onLogout: () => alert("Logging out…"),
  };

  return (
    <div style={{
      display: "flex", height: "100vh", background: dark.bg,
      fontFamily: "'DM Sans', system-ui, sans-serif", color: dark.text,
      overflow: "hidden",
    }}>
      {/* ── SIDEBAR ── */}
      <div style={{
        width: 220, flexShrink: 0, borderRight: `1px solid ${dark.border}`,
        background: dark.surface, display: "flex", flexDirection: "column",
        overflowY: "auto",
      }}>
        {/* header */}
        <div style={{ padding: "20px 16px 12px", borderBottom: `1px solid ${dark.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: dark.text }}>
              <ArrowLeft size={14} />
            </button>
            <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.02em" }}>Settings</span>
          </div>
        </div>

        {/* nav */}
        <nav style={{ padding: "8px 8px 24px", flex: 1 }}>
          {SECTIONS.map(sec => (
            <div key={sec.label}>
              <p style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: dark.muted, padding: "14px 8px 4px" }}>
                {sec.label}
              </p>
              {sec.items.map(({ id, icon: Icon, label, danger }) => {
                const isActive = active === id;
                return (
                  <button
                    key={id}
                    onClick={() => setActive(id)}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", gap: 10,
                      padding: "8px 10px", borderRadius: 9, border: "none", cursor: "pointer",
                      background: isActive ? (danger ? "rgba(255,92,114,0.12)" : "rgba(108,143,255,0.12)") : "transparent",
                      color: isActive ? (danger ? dark.danger : dark.accent) : (danger ? dark.danger : dark.muted),
                      transition: "all 0.15s", marginBottom: 1,
                      fontFamily: "inherit", fontSize: 13, fontWeight: isActive ? 600 : 400,
                    }}
                    onMouseEnter={e => !isActive && (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
                    onMouseLeave={e => !isActive && (e.currentTarget.style.background = "transparent")}
                  >
                    <Icon size={14} />
                    {label}
                    {isActive && <div style={{ marginLeft: "auto", width: 5, height: 5, borderRadius: "50%", background: danger ? dark.danger : dark.accent }} />}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
      </div>

      {/* ── CONTENT PANEL ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 32px 32px" }}>
        <div style={{ maxWidth: 520, margin: "0 auto" }}>
          <Panel {...panelProps} />
        </div>
      </div>
    </div>
  );
}
