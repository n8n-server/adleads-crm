import { useState, useEffect, useMemo, useCallback, createContext, useContext } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://ieudjpicmrudhpfzpplg.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlldWRqcGljbXJ1ZGhwZnpwcGxnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0MDQyMDgsImV4cCI6MjA5Mjk4MDIwOH0.e3E-54mlfkTRQsb1W6gJeRZd02qn4BK7XpiKVjzDx4A";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── CONSTANTS ──────────────────────────────────────────────────────────────────
const SOURCES = ["Google", "Meta", "Site", "WhatsApp"];

const ACTIVITY_TYPES = {
  note:          { label: "Anotação",  dot: "#94A3B8" },
  call:          { label: "Ligação",   dot: "#10B981" },
  email:         { label: "Email",     dot: "#3B82F6" },
  meeting:       { label: "Reunião",   dot: "#8B5CF6" },
  whatsapp:      { label: "WhatsApp",  dot: "#25D366" },
  status_change: { label: "Status",    dot: "#F59E0B" },
  created:       { label: "Criado",    dot: "#0EA5E9" },
};

const SOURCE_COLORS = {
  Google:   { bg: "#DBEAFE", text: "#1E40AF" },
  Meta:     { bg: "#EDE9FE", text: "#5B21B6" },
  Site:     { bg: "#D1FAE5", text: "#065F46" },
  WhatsApp: { bg: "#DCFCE7", text: "#166534" },
};

const STAGE_PRESETS = [
  { bar: "#60A5FA", bg: "#EFF6FF", text_color: "#1D4ED8", border_color: "#BFDBFE" },
  { bar: "#FBBF24", bg: "#FFFBEB", text_color: "#B45309", border_color: "#FDE68A" },
  { bar: "#22D3EE", bg: "#ECFEFF", text_color: "#0E7490", border_color: "#A5F3FC" },
  { bar: "#8B5CF6", bg: "#F5F3FF", text_color: "#7C3AED", border_color: "#DDD6FE" },
  { bar: "#34D399", bg: "#ECFDF5", text_color: "#065F46", border_color: "#A7F3D0" },
  { bar: "#F87171", bg: "#FEF2F2", text_color: "#B91C1C", border_color: "#FECACA" },
  { bar: "#FB923C", bg: "#FFF7ED", text_color: "#C2410C", border_color: "#FED7AA" },
  { bar: "#F472B6", bg: "#FDF2F8", text_color: "#9D174D", border_color: "#F9A8D4" },
];

const LABEL_COLORS = [
  { bg: "#DCFCE7", text_color: "#166534" },
  { bg: "#DBEAFE", text_color: "#1E40AF" },
  { bg: "#FEF3C7", text_color: "#92400E" },
  { bg: "#F3E8FF", text_color: "#6B21A8" },
  { bg: "#FCE7F3", text_color: "#9D174D" },
  { bg: "#FFEDD5", text_color: "#7C2D12" },
  { bg: "#ECFEFF", text_color: "#155E75" },
  { bg: "#FEE2E2", text_color: "#991B1B" },
];

const DEFAULT_STAGES = [
  { name: "Novo",        position: 0, ...STAGE_PRESETS[0] },
  { name: "Contatado",   position: 1, ...STAGE_PRESETS[1] },
  { name: "Qualificado", position: 2, ...STAGE_PRESETS[2] },
  { name: "Proposta",    position: 3, ...STAGE_PRESETS[3] },
  { name: "Fechado",     position: 4, ...STAGE_PRESETS[4] },
  { name: "Perdido",     position: 5, ...STAGE_PRESETS[5] },
];

const TAG_PALETTE = [
  { bg: "#DBEAFE", text: "#1E40AF" }, { bg: "#D1FAE5", text: "#065F46" },
  { bg: "#FEF3C7", text: "#92400E" }, { bg: "#F3E8FF", text: "#6B21A8" },
  { bg: "#FCE7F3", text: "#9D174D" }, { bg: "#FFEDD5", text: "#7C2D12" },
  { bg: "#ECFEFF", text: "#155E75" }, { bg: "#F0FDF4", text: "#14532D" },
];
function hashTagColor(tag) {
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = tag.charCodeAt(i) + ((h << 5) - h);
  return TAG_PALETTE[Math.abs(h) % TAG_PALETTE.length];
}

function todayStr() { return new Date().toISOString().slice(0, 10); }

// ─── CONTEXTS ───────────────────────────────────────────────────────────────────
const StagesCtx      = createContext([]);
const LabelsCtx      = createContext([]);
const QuickRepliesCtx = createContext([]);
const ThemeCtx       = createContext({ dark: false, toggle: () => {} });

// ─── HELPERS ────────────────────────────────────────────────────────────────────
function initials(name) {
  if (!name) return "?";
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase();
}

function slugify(text) {
  const base = text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return base + "-" + Math.random().toString(36).slice(2, 7);
}

function exportCSV(leads) {
  const headers = ["Nome","Email","Telefone","Origem","Status","Tags","Follow-up","UTM Source","UTM Medium","UTM Campaign","Anúncio","Anotações","Data"];
  const rows = leads.map(l => [l.name,l.email,l.phone,l.source,l.status,(l.tags||[]).join(";"),l.follow_up_at||"",l.utm_source,l.utm_medium,l.utm_campaign,l.ad,l.notes,l.created_at?.slice(0,10)]);
  const csv = [headers,...rows].map(r => r.map(v => `"${String(v??'').replace(/"/g,'""')}"`).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = "leads.csv"; a.click();
}

function whatsappUrl(phone) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  return `https://wa.me/${digits.startsWith("55") ? digits : "55" + digits}`;
}

function gcalUrl({ title, date, time, durationMin, description }) {
  const [y, m, d] = date.split("-").map(Number);
  const [h, min] = time.split(":").map(Number);
  const start = new Date(y, m - 1, d, h, min);
  const end   = new Date(start.getTime() + durationMin * 60000);
  const fmt = (dt) =>
    dt.getFullYear() + String(dt.getMonth() + 1).padStart(2, "0") +
    String(dt.getDate()).padStart(2, "0") + "T" +
    String(dt.getHours()).padStart(2, "0") + String(dt.getMinutes()).padStart(2, "0") + "00";
  const p = new URLSearchParams({ action: "TEMPLATE", text: title, dates: `${fmt(start)}/${fmt(end)}`, details: description });
  return `https://calendar.google.com/calendar/render?${p}`;
}

// ─── FOLLOW-UP BADGE ────────────────────────────────────────────────────────────
function FollowUpBadge({ date }) {
  if (!date) return null;
  const today = todayStr();
  const overdue = date < today;
  const isToday = date === today;
  const label = isToday ? "Follow-up hoje" : overdue
    ? `Atrasado (${date.slice(5).replace("-", "/")})`
    : date.slice(5).replace("-", "/");
  const color = overdue ? "#EF4444" : isToday ? "#F59E0B" : "#94A3B8";
  return (
    <div className="flex items-center gap-1 mt-1.5 text-xs font-semibold" style={{ color }}>
      <span>📅</span>
      <span>{label}</span>
    </div>
  );
}

// ─── FORM FIELD ─────────────────────────────────────────────────────────────────
function Field({ label, value, onChange, type = "text", placeholder, onEnter }) {
  return (
    <div>
      <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        onKeyDown={e => e.key === "Enter" && onEnter?.()}
        className="w-full px-3 py-2.5 text-sm rounded-lg border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition" />
    </div>
  );
}

function PrimaryBtn({ onClick, disabled, loading, children }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="w-full py-3 rounded-xl text-white text-sm font-bold transition disabled:opacity-50 flex items-center justify-center gap-2"
      style={{ background: "linear-gradient(135deg,#0EA5E9,#6366F1)" }}>
      {loading && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
      {children}
    </button>
  );
}

// ─── AUTH SCREEN ─────────────────────────────────────────────────────────────────
function AuthScreen({ onAuth }) {
  const inviteToken = new URLSearchParams(window.location.search).get("invite");
  const [mode, setMode] = useState(inviteToken ? "register" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [pendingUser, setPendingUser] = useState(null);

  const handleForgotPassword = async () => {
    setLoading(true); setError(""); setSuccess("");
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
      if (error) throw error;
      setSuccess("Link enviado! Verifique sua caixa de entrada.");
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  const handleAuth = async () => {
    setLoading(true); setError("");
    try {
      if (mode === "register") {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        const u = data.user;
        if (inviteToken) {
          const { data: companyId, error: invErr } = await supabase.rpc("join_company_via_invite", {
            p_token: inviteToken, p_display_name: displayName || email.split("@")[0]
          });
          if (invErr) throw invErr;
          const { data: company } = await supabase.from("companies").select("*").eq("id", companyId).single();
          window.history.replaceState({}, "", window.location.pathname);
          onAuth(u, company);
        } else { setPendingUser(u); setMode("create_company"); }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        const u = data.user;
        if (inviteToken) {
          const { data: companyId, error: invErr } = await supabase.rpc("join_company_via_invite", {
            p_token: inviteToken, p_display_name: displayName || null
          });
          if (invErr) throw invErr;
          const { data: company } = await supabase.from("companies").select("*").eq("id", companyId).single();
          window.history.replaceState({}, "", window.location.pathname);
          onAuth(u, company);
        } else {
          const { data: members } = await supabase.from("company_members")
            .select("company_id, companies(*)").eq("user_id", u.id);
          if (!members?.length) { setPendingUser(u); setMode("create_company"); }
          else onAuth(u, members[0].companies);
        }
      }
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  const handleCreateCompany = async () => {
    setLoading(true); setError("");
    try {
      const { data, error } = await supabase.rpc("create_company_with_owner", {
        p_name: companyName, p_slug: slugify(companyName)
      });
      if (error) throw error;
      const { data: company } = await supabase.from("companies").select("*").eq("id", data).single();
      onAuth(pendingUser, company);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  const titles = {
    login: ["Bem-vinda de volta", "Entre com seu email e senha"],
    register: inviteToken ? ["Você foi convidada!", "Crie sua conta para acessar o CRM"] : ["Criar conta", "Preencha os dados para começar"],
    forgot_password: ["Recuperar senha", "Informe seu email para receber o link"],
    create_company: ["Configure sua empresa", "Como se chama sua empresa?"],
  };

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-5/12 xl:w-1/2 bg-slate-900 flex-col justify-between p-12 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-lg flex-shrink-0"
            style={{ background: "linear-gradient(135deg,#0EA5E9,#6366F1)" }}>A</div>
          <span className="text-white font-bold text-xl">AdLeads CRM</span>
        </div>
        <div>
          <h1 className="text-4xl font-black text-white leading-snug mb-4">Gerencie seus leads<br/>com inteligência.</h1>
          <p className="text-slate-400 text-base mb-10">Kanban, métricas e histórico para agências de performance.</p>
          <div className="space-y-3">
            {["Kanban e lista de leads","Dashboard com métricas","Multi-cliente isolado","Exportação CSV"].map(f => (
              <div key={f} className="flex items-center gap-3 text-slate-300 text-sm">
                <div className="w-5 h-5 rounded-full bg-sky-500/20 flex items-center justify-center text-sky-400 text-xs flex-shrink-0">✓</div>
                {f}
              </div>
            ))}
          </div>
        </div>
        <p className="text-slate-600 text-xs">© 2026 ADScelera · AdLeads CRM</p>
      </div>

      <div className="flex-1 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-3 justify-center mb-10">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-lg"
              style={{ background: "linear-gradient(135deg,#0EA5E9,#6366F1)" }}>A</div>
            <span className="text-slate-900 font-bold text-xl">AdLeads CRM</span>
          </div>
          <h2 className="text-2xl font-black text-slate-900 mb-1">{titles[mode][0]}</h2>
          <p className="text-slate-400 text-sm mb-8">{titles[mode][1]}</p>
          {error   && <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}
          {success && <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">{success}</div>}

          {mode === "forgot_password" && <>
            <div className="mb-5"><Field label="Email" type="email" value={email} onChange={setEmail} placeholder="voce@empresa.com" onEnter={handleForgotPassword} /></div>
            <PrimaryBtn onClick={handleForgotPassword} disabled={loading || !email} loading={loading}>Enviar link de recuperação</PrimaryBtn>
            <p className="mt-6 text-center text-sm text-slate-400">
              <button onClick={() => { setMode("login"); setError(""); setSuccess(""); }} className="text-sky-600 font-semibold hover:underline">Voltar ao login</button>
            </p>
          </>}

          {mode === "create_company" && <>
            <div className="mb-5"><Field label="Nome da empresa" value={companyName} onChange={setCompanyName} placeholder="Ex: Agência XYZ" onEnter={handleCreateCompany} /></div>
            <PrimaryBtn onClick={handleCreateCompany} disabled={loading || !companyName} loading={loading}>Criar empresa e entrar</PrimaryBtn>
          </>}

          {(mode === "login" || mode === "register") && <>
            <div className="space-y-4 mb-5">
              {mode === "register" && inviteToken && (
                <Field label="Seu nome" value={displayName} onChange={setDisplayName} placeholder="Como quer ser chamado(a)" />
              )}
              <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="voce@empresa.com" />
              <Field label="Senha" type="password" value={password} onChange={setPassword} placeholder="••••••••" onEnter={handleAuth} />
            </div>
            <PrimaryBtn onClick={handleAuth} disabled={loading || !email || !password} loading={loading}>
              {mode === "register" ? "Criar conta" : "Entrar"}
            </PrimaryBtn>
            {mode === "login" && (
              <p className="mt-3 text-center text-xs text-slate-400">
                <button onClick={() => { setMode("forgot_password"); setError(""); setSuccess(""); }} className="text-sky-600 hover:underline">Esqueci minha senha</button>
              </p>
            )}
            <p className="mt-6 text-center text-sm text-slate-400">
              {mode === "login" ? "Não tem conta? " : "Já tem conta? "}
              <button onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}
                className="text-sky-600 font-semibold hover:underline">
                {mode === "login" ? "Criar agora" : "Entrar"}
              </button>
            </p>
          </>}
        </div>
      </div>
    </div>
  );
}

// ─── BADGES ─────────────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const stages = useContext(StagesCtx);
  const stage = stages.find(s => s.name === status);
  const c = stage
    ? { bg: stage.bg, text: stage.text_color, border: stage.border_color }
    : { bg: "#F1F5F9", text: "#64748B", border: "#E2E8F0" };
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold"
      style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>{status}</span>
  );
}

function SourceBadge({ source }) {
  const c = SOURCE_COLORS[source] || { bg: "#F1F5F9", text: "#64748B" };
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold"
      style={{ background: c.bg, color: c.text }}>{source}</span>
  );
}

// ─── LABEL COMPONENTS ────────────────────────────────────────────────────────────
function TagPill({ tag, onRemove }) {
  const labels = useContext(LabelsCtx);
  const label = labels.find(l => l.name === tag);
  const c = label ? { bg: label.bg, text: label.text_color } : (() => {
    const p = hashTagColor(tag); return { bg: p.bg, text: p.text };
  })();
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: c.bg, color: c.text }}>
      {tag}
      {onRemove && (
        <button onClick={e => { e.stopPropagation(); onRemove(tag); }} className="leading-none hover:opacity-60 transition">×</button>
      )}
    </span>
  );
}

function LabelPicker({ tags, onChange, onManageLabels }) {
  const labels = useContext(LabelsCtx);
  const orphans = (tags || []).filter(t => !labels.find(l => l.name === t));
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5 items-center">
        {labels.map(label => {
          const isActive = (tags || []).includes(label.name);
          return (
            <button key={label.id} type="button"
              onClick={() => {
                if (isActive) onChange((tags || []).filter(t => t !== label.name));
                else onChange([...(tags || []), label.name]);
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-all"
              style={{
                background: label.bg, color: label.text_color,
                boxShadow: isActive ? `0 0 0 2px ${label.text_color}` : "none",
              }}>
              {isActive && <span>✓</span>}
              {label.name}
            </button>
          );
        })}
        <button type="button" onClick={onManageLabels}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs text-slate-400 hover:text-sky-600 transition border border-dashed border-slate-300 hover:border-sky-400 whitespace-nowrap">
          ⚙ {labels.length === 0 ? "Criar etiquetas" : "Gerenciar"}
        </button>
      </div>
      {orphans.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {orphans.map(t => <TagPill key={t} tag={t} onRemove={tag => onChange((tags || []).filter(x => x !== tag))} />)}
        </div>
      )}
    </div>
  );
}

// ─── QUICK REPLIES PANEL ─────────────────────────────────────────────────────────
function QuickRepliesPanel({ leadName, onClose }) {
  const quickReplies = useContext(QuickRepliesCtx);
  const [copiedId, setCopiedId] = useState(null);

  const copy = (qr) => {
    const text = qr.body.replace(/\{\{nome\}\}/g, leadName || "Lead");
    navigator.clipboard.writeText(text);
    setCopiedId(qr.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="mx-5 mb-2 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
      <div className="px-3 py-2.5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
        <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Respostas Rápidas</span>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition text-sm w-5 h-5 flex items-center justify-center">✕</button>
      </div>
      <div className="max-h-52 overflow-y-auto divide-y divide-slate-50">
        {quickReplies.length === 0 ? (
          <div className="px-3 py-5 text-xs text-slate-400 text-center">
            Nenhuma resposta salva. Crie em Configurações → Respostas Rápidas.
          </div>
        ) : quickReplies.map(qr => (
          <div key={qr.id} className="px-3 py-2.5 hover:bg-slate-50 transition">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-slate-700">{qr.title}</div>
                <div className="text-xs text-slate-400 mt-0.5 line-clamp-2 whitespace-pre-wrap">
                  {qr.body.replace(/\{\{nome\}\}/g, leadName || "Lead")}
                </div>
              </div>
              <button onClick={() => copy(qr)}
                className={`flex-shrink-0 px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                  copiedId === qr.id
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-sky-50 text-sky-600 hover:bg-sky-100"
                }`}>
                {copiedId === qr.id ? "✓ Copiado!" : "Copiar"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── WHATSAPP BUTTON ─────────────────────────────────────────────────────────────
function WaBtn({ phone, small }) {
  const url = whatsappUrl(phone);
  if (!url) return null;
  if (small) return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      onClick={e => e.stopPropagation()} title="Abrir WhatsApp"
      className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-black transition hover:opacity-80 flex-shrink-0"
      style={{ background: "#25D366" }}>W</a>
  );
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition hover:opacity-90 whitespace-nowrap"
      style={{ background: "#25D366" }}>
      WhatsApp
    </a>
  );
}

// ─── MEMBER NAME EDITOR ──────────────────────────────────────────────────────────
function MemberNameEditor({ user, currentMember }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(currentMember?.display_name || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => { setName(currentMember?.display_name || ""); }, [currentMember?.display_name]);

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    await supabase.from("company_members").update({ display_name: name.trim() }).eq("user_id", user.id);
    setSaving(false); setEditing(false);
    window.location.reload();
  };

  if (editing) return (
    <div className="flex gap-2 items-center">
      <input autoFocus
        className="flex-1 px-2 py-1 rounded-lg bg-slate-800 border border-slate-600 text-white text-xs focus:outline-none focus:border-sky-400"
        value={name} onChange={e => setName(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
        placeholder="Seu nome" />
      <button onClick={save} disabled={saving || !name.trim()}
        className="px-2 py-1 rounded-lg bg-sky-500 text-white text-xs font-bold disabled:opacity-50">
        {saving ? "..." : "OK"}
      </button>
    </div>
  );

  return (
    <button onClick={() => setEditing(true)}
      className="w-full flex items-center gap-2.5 rounded-lg hover:bg-slate-800 p-1 transition text-left group">
      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
        style={{ background: "linear-gradient(135deg,#0EA5E9,#6366F1)" }}>
        {initials(currentMember?.display_name || user?.email?.split("@")[0] || "")}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-white text-xs font-semibold truncate flex items-center gap-1">
          {currentMember?.display_name || user?.email}
          <span className="text-slate-600 group-hover:text-slate-400 text-xs transition">✎</span>
        </div>
        <div className="text-slate-500 text-xs">{currentMember?.role === "owner" ? "Administrador" : "Membro"}</div>
      </div>
    </button>
  );
}

// ─── SIDEBAR ─────────────────────────────────────────────────────────────────────
function Sidebar({ company, user, tab, setTab, onLogout, team, onInvite, currentMember, onSettings, dark, onToggleTheme }) {
  const nav = [
    { id: "dashboard", label: "Dashboard", icon: "◧" },
    { id: "leads",     label: "Leads",     icon: "◈" },
    { id: "julia",     label: "Julia",     icon: "🤖" },
  ];
  const btnBase = "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left";
  return (
    <aside className="w-60 bg-slate-900 flex flex-col h-screen sticky top-0 flex-shrink-0">
      <div className="px-4 py-5 border-b border-slate-800 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-base flex-shrink-0"
          style={{ background: "linear-gradient(135deg,#0EA5E9,#6366F1)" }}>A</div>
        <div className="min-w-0">
          <div className="text-white font-bold text-sm leading-tight truncate">AdLeads CRM</div>
          <div className="text-slate-500 text-xs truncate">{company?.name}</div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {nav.map(item => (
          <button key={item.id} onClick={() => setTab(item.id)}
            className={btnBase}
            style={tab === item.id ? { background: "#0EA5E9", color: "#fff" } : { color: "#94A3B8" }}
            onMouseEnter={e => { if (tab !== item.id) { e.currentTarget.style.background="#1E293B"; e.currentTarget.style.color="#fff"; }}}
            onMouseLeave={e => { if (tab !== item.id) { e.currentTarget.style.background=""; e.currentTarget.style.color="#94A3B8"; }}}>
            <span className="text-base w-5 text-center">{item.icon}</span>
            {item.label}
          </button>
        ))}

        <button onClick={onSettings} className={btnBase} style={{ color: "#94A3B8" }}
          onMouseEnter={e => { e.currentTarget.style.background="#1E293B"; e.currentTarget.style.color="#fff"; }}
          onMouseLeave={e => { e.currentTarget.style.background=""; e.currentTarget.style.color="#94A3B8"; }}>
          <span className="text-base w-5 text-center">⚙</span>
          Configurações
        </button>

        <div className="pt-4 mt-2 border-t border-slate-800">
          <div className="px-3 mb-2 flex items-center justify-between">
            <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Equipe</span>
            <button onClick={onInvite} title="Convidar membro"
              className="w-5 h-5 rounded flex items-center justify-center text-slate-500 hover:text-white hover:bg-slate-700 transition text-sm leading-none">+</button>
          </div>
          {team.map(m => (
            <div key={m.user_id} className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg">
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                style={{ background: m.user_id === user?.id ? "#0EA5E9" : "#475569" }}>
                {initials(m.display_name || m.email)}
              </div>
              <div className="min-w-0">
                <div className="text-slate-300 text-xs font-medium truncate">
                  {m.display_name || m.email.split("@")[0]}
                  {m.user_id === user?.id && <span className="text-slate-500"> (você)</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </nav>

      <div className="p-4 border-t border-slate-800">
        <MemberNameEditor user={user} currentMember={currentMember} />
        <button onClick={onToggleTheme}
          className="w-full py-1.5 rounded-lg text-xs font-semibold text-slate-500 hover:bg-slate-800 hover:text-white transition mt-2 flex items-center justify-center gap-1.5">
          <span>{dark ? "☀" : "☾"}</span>
          {dark ? "Modo claro" : "Modo escuro"}
        </button>
        <button onClick={onLogout}
          className="w-full py-1.5 rounded-lg text-xs font-semibold text-slate-500 hover:bg-slate-800 hover:text-white transition mt-1">
          Sair da conta
        </button>
      </div>
    </aside>
  );
}

// ─── SETTINGS MODAL ──────────────────────────────────────────────────────────────
function SettingsModal({ company, leads, onClose, onRefreshLabels, onRefreshStages, onRefreshReplies }) {
  const [tab, setTab] = useState("labels");
  const labels      = useContext(LabelsCtx);
  const stages      = useContext(StagesCtx);
  const quickReplies = useContext(QuickRepliesCtx);

  const [newLabelName, setNewLabelName]   = useState("");
  const [newLabelColor, setNewLabelColor] = useState(0);
  const [savingLabel, setSavingLabel]     = useState(false);

  const [newStageName, setNewStageName]   = useState("");
  const [newStageColor, setNewStageColor] = useState(6);
  const [savingStage, setSavingStage]     = useState(false);

  const [newReplyTitle, setNewReplyTitle] = useState("");
  const [newReplyBody, setNewReplyBody]   = useState("");
  const [savingReply, setSavingReply]     = useState(false);

  const inp = "w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 transition placeholder:text-slate-400";

  const createLabel = async () => {
    if (!newLabelName.trim()) return;
    setSavingLabel(true);
    const c = LABEL_COLORS[newLabelColor];
    await supabase.from("labels").insert({ company_id: company.id, name: newLabelName.trim(), bg: c.bg, text_color: c.text_color, position: labels.length });
    setNewLabelName(""); setSavingLabel(false); onRefreshLabels();
  };

  const deleteLabel = async (id) => {
    const label = labels.find(l => l.id === id);
    const inUse = leads.filter(l => (l.tags || []).includes(label?.name)).length;
    if (inUse > 0 && !window.confirm(`Esta etiqueta está em ${inUse} lead(s). Remover mesmo assim?`)) return;
    await supabase.from("labels").delete().eq("id", id); onRefreshLabels();
  };

  const createStage = async () => {
    if (!newStageName.trim()) return;
    setSavingStage(true);
    const c = STAGE_PRESETS[newStageColor];
    await supabase.from("pipeline_stages").insert({ company_id: company.id, name: newStageName.trim(), bar: c.bar, bg: c.bg, text_color: c.text_color, border_color: c.border_color, position: stages.length });
    setNewStageName(""); setSavingStage(false); onRefreshStages();
  };

  const deleteStage = async (id) => {
    if (stages.length <= 1) { window.alert("Você precisa ter pelo menos 1 estágio."); return; }
    const stage = stages.find(s => s.id === id);
    const inUse = leads.filter(l => l.status === stage?.name).length;
    if (inUse > 0) { window.alert(`Não é possível remover "${stage.name}" — ${inUse} lead(s) estão neste estágio. Mova-os primeiro.`); return; }
    await supabase.from("pipeline_stages").delete().eq("id", id); onRefreshStages();
  };

  const createReply = async () => {
    if (!newReplyTitle.trim() || !newReplyBody.trim()) return;
    setSavingReply(true);
    await supabase.from("quick_replies").insert({ company_id: company.id, title: newReplyTitle.trim(), body: newReplyBody.trim(), position: quickReplies.length });
    setNewReplyTitle(""); setNewReplyBody(""); setSavingReply(false); onRefreshReplies();
  };

  const deleteReply = async (id) => {
    await supabase.from("quick_replies").delete().eq("id", id); onRefreshReplies();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md z-10 flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100 flex-shrink-0">
          <h3 className="text-base font-black text-slate-900">Configurações</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 transition text-lg">✕</button>
        </div>

        <div className="flex border-b border-slate-100 px-2 flex-shrink-0 overflow-x-auto">
          {[["labels","🏷 Etiquetas"],["stages","📋 Estágios"],["replies","💬 Respostas"]].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`px-4 py-2.5 text-xs font-bold border-b-2 transition whitespace-nowrap ${
                tab === k ? "border-sky-500 text-sky-600" : "border-transparent text-slate-400 hover:text-slate-600"
              }`}>{l}</button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {tab === "labels" && (
            <>
              <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                <div className="text-xs font-black text-slate-500 uppercase tracking-widest">Nova etiqueta</div>
                <input className={inp} placeholder="Nome (ex: Urgente, VIP...)"
                  value={newLabelName} onChange={e => setNewLabelName(e.target.value)} onKeyDown={e => e.key === "Enter" && createLabel()} />
                <div className="flex gap-2 flex-wrap">
                  {LABEL_COLORS.map((c, i) => (
                    <button key={i} type="button" onClick={() => setNewLabelColor(i)}
                      className="w-8 h-8 rounded-full transition-all flex items-center justify-center text-xs font-bold"
                      style={{ background: c.bg, color: c.text_color, border: newLabelColor === i ? `2px solid ${c.text_color}` : "2px solid transparent", boxShadow: newLabelColor === i ? `0 0 0 2px ${c.text_color}40` : "none" }}>
                      {newLabelColor === i ? "✓" : ""}
                    </button>
                  ))}
                </div>
                {newLabelName.trim() && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">Prévia:</span>
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold"
                      style={{ background: LABEL_COLORS[newLabelColor].bg, color: LABEL_COLORS[newLabelColor].text_color }}>
                      {newLabelName.trim()}
                    </span>
                  </div>
                )}
                <button onClick={createLabel} disabled={savingLabel || !newLabelName.trim()}
                  className="w-full py-2 rounded-lg text-white text-xs font-bold disabled:opacity-40 transition"
                  style={{ background: "linear-gradient(135deg,#0EA5E9,#6366F1)" }}>
                  {savingLabel ? "Criando..." : "+ Criar etiqueta"}
                </button>
              </div>
              {labels.length > 0 ? (
                <div className="space-y-1.5">
                  {labels.map(label => (
                    <div key={label.id} className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 bg-white">
                      <div className="flex items-center gap-2.5">
                        <div className="w-5 h-5 rounded-full flex-shrink-0" style={{ background: label.bg, border: `2px solid ${label.text_color}50` }} />
                        <span className="text-sm font-semibold text-slate-700">{label.name}</span>
                        <span className="text-xs text-slate-400">{leads.filter(l => (l.tags||[]).includes(label.name)).length} lead(s)</span>
                      </div>
                      <button onClick={() => deleteLabel(label.id)}
                        className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-300 hover:text-red-400 hover:bg-red-50 transition text-sm">✕</button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-6 text-slate-300">
                  <div className="text-4xl mb-2">🏷</div>
                  <div className="text-sm">Nenhuma etiqueta ainda.</div>
                </div>
              )}
            </>
          )}

          {tab === "stages" && (
            <>
              <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                <div className="text-xs font-black text-slate-500 uppercase tracking-widest">Novo estágio</div>
                <input className={inp} placeholder="Nome (ex: Negociação, Análise...)"
                  value={newStageName} onChange={e => setNewStageName(e.target.value)} onKeyDown={e => e.key === "Enter" && createStage()} />
                <div className="flex gap-2 flex-wrap">
                  {STAGE_PRESETS.map((c, i) => (
                    <button key={i} type="button" onClick={() => setNewStageColor(i)}
                      className="w-8 h-8 rounded-lg transition-all flex items-center justify-center text-xs font-bold text-white"
                      style={{ background: c.bar, border: newStageColor === i ? `3px solid ${c.text_color}` : "3px solid transparent", boxShadow: newStageColor === i ? `0 0 0 2px ${c.bar}60` : "none" }}>
                      {newStageColor === i ? "✓" : ""}
                    </button>
                  ))}
                </div>
                <button onClick={createStage} disabled={savingStage || !newStageName.trim()}
                  className="w-full py-2 rounded-lg text-white text-xs font-bold disabled:opacity-40 transition"
                  style={{ background: "linear-gradient(135deg,#0EA5E9,#6366F1)" }}>
                  {savingStage ? "Criando..." : "+ Criar estágio"}
                </button>
              </div>
              <div className="space-y-1.5">
                {stages.map(stage => (
                  <div key={stage.id} className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 bg-white">
                    <div className="flex items-center gap-2.5">
                      <div className="w-2 h-6 rounded-full flex-shrink-0" style={{ background: stage.bar }} />
                      <span className="text-sm font-semibold text-slate-700">{stage.name}</span>
                      <span className="text-xs text-slate-400">{leads.filter(l => l.status === stage.name).length} leads</span>
                    </div>
                    <button onClick={() => deleteStage(stage.id)}
                      className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-300 hover:text-red-400 hover:bg-red-50 transition text-sm">✕</button>
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-400 text-center">Estágios com leads não podem ser removidos.</p>
            </>
          )}

          {tab === "replies" && (
            <>
              <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                <div className="text-xs font-black text-slate-500 uppercase tracking-widest">Nova resposta rápida</div>
                <input className={inp} placeholder="Título (ex: Boas-vindas, Proposta...)"
                  value={newReplyTitle} onChange={e => setNewReplyTitle(e.target.value)} />
                <textarea className={`${inp} resize-none`} rows={4}
                  placeholder={"Texto da mensagem...\n\nUse {{nome}} para inserir o nome do lead."}
                  value={newReplyBody} onChange={e => setNewReplyBody(e.target.value)} />
                <p className="text-xs text-slate-400">
                  💡 Use <code className="bg-slate-200 px-1 rounded">{"{{nome}}"}</code> para o nome do lead ser inserido automaticamente.
                </p>
                <button onClick={createReply} disabled={savingReply || !newReplyTitle.trim() || !newReplyBody.trim()}
                  className="w-full py-2 rounded-lg text-white text-xs font-bold disabled:opacity-40 transition"
                  style={{ background: "linear-gradient(135deg,#0EA5E9,#6366F1)" }}>
                  {savingReply ? "Criando..." : "+ Criar resposta"}
                </button>
              </div>
              {quickReplies.length > 0 ? (
                <div className="space-y-2">
                  {quickReplies.map(qr => (
                    <div key={qr.id} className="p-3 rounded-xl border border-slate-100 bg-white">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-bold text-slate-700">{qr.title}</div>
                          <div className="text-xs text-slate-400 mt-0.5 line-clamp-2 whitespace-pre-wrap">{qr.body}</div>
                        </div>
                        <button onClick={() => deleteReply(qr.id)}
                          className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-300 hover:text-red-400 hover:bg-red-50 transition text-sm flex-shrink-0">✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-6 text-slate-300">
                  <div className="text-4xl mb-2">💬</div>
                  <div className="text-sm">Nenhuma resposta rápida ainda.</div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── KANBAN ──────────────────────────────────────────────────────────────────────
function KanbanView({ leads, onEdit, team, onMove }) {
  const stages = useContext(StagesCtx);
  const [draggingId, setDraggingId] = useState(null);
  const [dragOver, setDragOver]     = useState(null);

  const handleDragStart = (e, lead) => {
    setDraggingId(lead.id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("leadId", lead.id);
    e.dataTransfer.setData("fromStatus", lead.status);
  };

  const handleDrop = (e, toStatus) => {
    e.preventDefault();
    const leadId     = e.dataTransfer.getData("leadId");
    const fromStatus = e.dataTransfer.getData("fromStatus");
    setDragOver(null); setDraggingId(null);
    if (leadId && fromStatus !== toStatus) onMove(leadId, toStatus, fromStatus);
  };

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {stages.map(stage => {
        const col = leads.filter(l => l.status === stage.name);
        const isOver = dragOver === stage.name;
        return (
          <div key={stage.id}
            className="flex-shrink-0 w-52 rounded-xl border flex flex-col transition-all duration-150"
            style={{ borderTop: `3px solid ${stage.bar}`, background: isOver ? stage.bg : "#F8FAFC", borderColor: isOver ? stage.bar : "#E2E8F0", boxShadow: isOver ? `0 0 0 2px ${stage.bar}40` : undefined }}
            onDragOver={e => { e.preventDefault(); setDragOver(stage.name); }}
            onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(null); }}
            onDrop={e => handleDrop(e, stage.name)}>

            <div className="px-3 pt-3 pb-2 flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wide" style={{ color: stage.text_color }}>{stage.name}</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: stage.bg, color: stage.text_color }}>{col.length}</span>
            </div>

            <div className="flex flex-col gap-2 p-2 overflow-y-auto" style={{ maxHeight: "calc(100vh - 260px)", minHeight: 60 }}>
              {col.map(lead => {
                const isDragging = draggingId === lead.id;
                const m = team?.find(x => x.user_id === lead.assigned_to);
                return (
                  <div key={lead.id} draggable
                    onDragStart={e => handleDragStart(e, lead)}
                    onDragEnd={() => { setDraggingId(null); setDragOver(null); }}
                    onClick={() => !isDragging && onEdit(lead)}
                    className="bg-white rounded-xl p-3 shadow-sm border border-slate-100 cursor-grab active:cursor-grabbing transition-all duration-150 hover:shadow-md hover:-translate-y-0.5 select-none"
                    style={{ opacity: isDragging ? 0.4 : 1 }}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                        style={{ background: stage.bar }}>{initials(lead.name)}</div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 truncate">{lead.name}</div>
                        <div className="text-xs text-slate-400 truncate">{lead.phone || lead.email || "—"}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <SourceBadge source={lead.source} />
                      <WaBtn phone={lead.phone} small />
                    </div>
                    {lead.tags?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {lead.tags.map(t => <TagPill key={t} tag={t} />)}
                      </div>
                    )}
                    <FollowUpBadge date={lead.follow_up_at} />
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-xs text-slate-300">{lead.created_at?.slice(0, 10)}</span>
                      {m && (
                        <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                          style={{ background: "#475569" }} title={m.display_name || m.email}>
                          {initials(m.display_name || m.email)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {col.length === 0 && (
                <div className={`flex items-center justify-center py-8 text-xs rounded-lg border-2 border-dashed transition-colors ${
                  isOver ? "border-current text-current" : "border-slate-200 text-slate-300"
                }`} style={isOver ? { color: stage.bar, borderColor: stage.bar } : {}}>
                  {isOver ? "Soltar aqui" : "Vazio"}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── TABLE ───────────────────────────────────────────────────────────────────────
function TableView({ leads, onEdit, onDelete }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b-2 border-slate-100">
            {["Lead","Contato","Origem","Status","Etiquetas","Follow-up","Data",""].map(h => (
              <th key={h} className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {leads.map(lead => (
            <tr key={lead.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <div>
                    <div className="font-semibold text-slate-900 text-sm">{lead.name}</div>
                    <div className="text-xs text-slate-400">{lead.email || "—"}</div>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3 text-slate-500 text-xs">{lead.phone || "—"}</td>
              <td className="px-4 py-3"><SourceBadge source={lead.source} /></td>
              <td className="px-4 py-3"><StatusBadge status={lead.status} /></td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1">
                  {lead.tags?.length > 0 ? lead.tags.map(t => <TagPill key={t} tag={t} />) : <span className="text-slate-300 text-xs">—</span>}
                </div>
              </td>
              <td className="px-4 py-3">
                {lead.follow_up_at ? <FollowUpBadge date={lead.follow_up_at} /> : <span className="text-slate-300 text-xs">—</span>}
              </td>
              <td className="px-4 py-3 text-slate-300 text-xs whitespace-nowrap">{lead.created_at?.slice(0, 10)}</td>
              <td className="px-4 py-3">
                <div className="flex gap-2 items-center">
                  <WaBtn phone={lead.phone} />
                  <button onClick={() => onEdit(lead)} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition">Editar</button>
                  <button onClick={() => onDelete(lead.id)} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 transition">✕</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {leads.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-slate-300">
          <div className="text-5xl mb-3">◈</div>
          <div className="text-sm">Nenhum lead encontrado.</div>
        </div>
      )}
    </div>
  );
}

// ─── DASHBOARD ───────────────────────────────────────────────────────────────────
function Dashboard({ leads }) {
  const stages = useContext(StagesCtx);
  const total = leads.length;
  const byStatus = {};
  stages.forEach(s => { byStatus[s.name] = leads.filter(l => l.status === s.name).length; });
  const bySource = SOURCES.reduce((a, s) => ({ ...a, [s]: leads.filter(l => l.source === s).length }), {});
  const closedCount = byStatus["Fechado"] || 0;
  const lostCount   = byStatus["Perdido"] || 0;
  const conversion  = total ? ((closedCount / total) * 100).toFixed(1) : "0.0";
  const inProgress  = Object.entries(byStatus).filter(([k]) => k !== "Fechado" && k !== "Perdido" && k !== "Novo").reduce((s, [, v]) => s + v, 0);
  const today = todayStr();
  const followUpsHoje = leads.filter(l => l.follow_up_at && l.follow_up_at <= today).length;

  const metrics = [
    { label: "Total de Leads", value: total,         sub: "todos os status",       color: "#0EA5E9" },
    { label: "Fechados",       value: closedCount,   sub: `${conversion}% conversão`, color: "#10B981" },
    { label: "Em andamento",   value: inProgress,    sub: "meio do funil",          color: "#F59E0B" },
    { label: "Follow-ups hoje",value: followUpsHoje, sub: "pendentes e atrasados",  color: "#EF4444" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {metrics.map(m => (
          <div key={m.label} className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm">
            <div className="text-3xl font-black mb-1" style={{ color: m.color }}>{m.value}</div>
            <div className="text-sm font-semibold text-slate-700">{m.label}</div>
            <div className="text-xs text-slate-400 mt-0.5">{m.sub}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm">
          <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-5">Por origem</h3>
          {SOURCES.map(s => {
            const v = bySource[s] || 0;
            const pct = total ? (v / total) * 100 : 0;
            const c = SOURCE_COLORS[s];
            return (
              <div key={s} className="mb-4">
                <div className="flex justify-between text-xs font-semibold text-slate-500 mb-1.5"><span>{s}</span><span>{v}</span></div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: c?.text }} />
                </div>
              </div>
            );
          })}
        </div>
        <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm">
          <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-5">Por estágio</h3>
          {stages.map(s => {
            const v = byStatus[s.name] || 0;
            const pct = total ? (v / total) * 100 : 0;
            return (
              <div key={s.id} className="mb-4">
                <div className="flex justify-between text-xs font-semibold text-slate-500 mb-1.5"><span>{s.name}</span><span>{v}</span></div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: s.bar }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── TIMELINE ────────────────────────────────────────────────────────────────────
function Timeline({ leadId, companyId, userId }) {
  const [activities, setActivities] = useState([]);
  const [type, setType]     = useState("note");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from("activities")
      .select("*").eq("lead_id", leadId).order("created_at", { ascending: false });
    setActivities(data || []);
  }, [leadId]);

  useEffect(() => { load(); }, [load]);

  const addActivity = async () => {
    if (!content.trim()) return;
    setSaving(true);
    await supabase.from("activities").insert({ lead_id: leadId, company_id: companyId, type, content: content.trim(), created_by: userId });
    setContent(""); setSaving(false); load();
  };

  const fmt = (iso) => {
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-slate-100 bg-slate-50">
        <div className="flex gap-2 mb-2 flex-wrap">
          {Object.entries(ACTIVITY_TYPES).filter(([k]) => !["created","status_change"].includes(k)).map(([k, v]) => (
            <button key={k} onClick={() => setType(k)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition border ${type === k ? "border-transparent text-white" : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"}`}
              style={type === k ? { background: v.dot } : {}}>
              {v.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <textarea
            className="flex-1 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 resize-none focus:outline-none focus:ring-2 focus:ring-sky-500 transition placeholder:text-slate-400"
            rows={2} value={content} onChange={e => setContent(e.target.value)}
            placeholder={`Registrar ${ACTIVITY_TYPES[type]?.label.toLowerCase()}...`}
            onKeyDown={e => { if (e.key === "Enter" && e.metaKey) addActivity(); }} />
          <button onClick={addActivity} disabled={saving || !content.trim()}
            className="px-3 rounded-lg text-white text-xs font-bold disabled:opacity-40 transition hover:opacity-90 self-stretch"
            style={{ background: "linear-gradient(135deg,#0EA5E9,#6366F1)" }}>
            {saving ? "..." : "Salvar"}
          </button>
        </div>
        <p className="text-xs text-slate-400 mt-1">⌘ + Enter para salvar</p>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-slate-300">
            <div className="text-3xl mb-2">◎</div>
            <div className="text-xs">Nenhuma atividade ainda.</div>
          </div>
        ) : (
          <div className="relative">
            <div className="absolute left-[11px] top-0 bottom-0 w-px bg-slate-100" />
            <div className="space-y-4">
              {activities.map(a => {
                const t = ACTIVITY_TYPES[a.type] || ACTIVITY_TYPES.note;
                return (
                  <div key={a.id} className="flex gap-3 relative">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 z-10 ring-2 ring-white" style={{ background: t.dot }} />
                    <div className="flex-1 bg-white rounded-xl border border-slate-100 shadow-sm p-3 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold" style={{ color: t.dot }}>{t.label}</span>
                        <span className="text-xs text-slate-300">{fmt(a.created_at)}</span>
                      </div>
                      <p className="text-sm text-slate-700 whitespace-pre-wrap break-words">{a.content}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── SCHEDULE MODAL ───────────────────────────────────────────────────────────────
function ScheduleModal({ lead, companyId, userId, onClose }) {
  const today = new Date().toISOString().slice(0, 10);
  const [title, setTitle]       = useState(`Reunião com ${lead.name || "Lead"}`);
  const [date, setDate]         = useState(today);
  const [time, setTime]         = useState("09:00");
  const [duration, setDuration] = useState(60);
  const [notes, setNotes]       = useState(
    [lead.phone && `WhatsApp: ${lead.phone}`, lead.email && `Email: ${lead.email}`, lead.notes && `Obs: ${lead.notes}`].filter(Boolean).join("\n")
  );
  const [saving, setSaving] = useState(false);

  const schedule = async () => {
    setSaving(true);
    const url = gcalUrl({ title, date, time, durationMin: Number(duration), description: notes });
    window.open(url, "_blank");
    if (lead.id) {
      const [h, min] = time.split(":");
      const label = `${date.split("-").reverse().join("/")} às ${h}h${min !== "00" ? min : ""} (${duration >= 60 ? duration/60+"h" : duration+"min"})`;
      await supabase.from("activities").insert({ lead_id: lead.id, company_id: companyId, type: "meeting", content: `Reunião agendada: ${title} — ${label}`, created_by: userId });
    }
    setSaving(false); onClose();
  };

  const inp = "w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 transition";
  const lbl = "block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm z-10">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-black text-slate-900">Agendar Reunião</h3>
            <p className="text-xs text-slate-400 mt-0.5">Abre no Google Calendar</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 transition text-lg">✕</button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div><label className={lbl}>Título</label><input className={inp} value={title} onChange={e => setTitle(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>Data</label><input type="date" className={inp} value={date} onChange={e => setDate(e.target.value)} /></div>
            <div><label className={lbl}>Horário</label><input type="time" className={inp} value={time} onChange={e => setTime(e.target.value)} /></div>
          </div>
          <div>
            <label className={lbl}>Duração</label>
            <select className={inp} value={duration} onChange={e => setDuration(e.target.value)}>
              <option value={30}>30 minutos</option>
              <option value={60}>1 hora</option>
              <option value={90}>1h30</option>
              <option value={120}>2 horas</option>
            </select>
          </div>
          <div><label className={lbl}>Descrição</label><textarea className={`${inp} resize-none`} rows={3} value={notes} onChange={e => setNotes(e.target.value)} /></div>
        </div>
        <div className="flex gap-3 px-6 pb-5">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition">Cancelar</button>
          <button onClick={schedule} disabled={saving || !title || !date || !time}
            className="flex-1 py-2.5 rounded-lg text-white text-sm font-bold transition disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: "#1a73e8" }}>
            {saving ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin inline-block" /> : "📅"}
            Google Calendar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── SCHEDULED FOLLOW-UPS LIST ───────────────────────────────────────────────────
function ScheduledFollowUps({ leadId }) {
  const [items, setItems] = useState([]);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("scheduled_followups")
      .select("id,phone,message,scheduled_at,status")
      .eq("lead_id", leadId)
      .order("scheduled_at", { ascending: true });
    setItems(data || []);
  }, [leadId]);

  useEffect(() => { load(); }, [load]);

  const cancel = async (id) => {
    await supabase.from("scheduled_followups").update({ status: "cancelled" }).eq("id", id);
    load();
  };

  const fmt = (iso) => {
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR") + " às " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };

  const S = {
    pending:   { label: "Agendado",  color: "#F59E0B", bg: "#FFFBEB" },
    sent:      { label: "Enviado",   color: "#10B981", bg: "#ECFDF5" },
    cancelled: { label: "Cancelado", color: "#94A3B8", bg: "#F1F5F9" },
    failed:    { label: "Falhou",    color: "#EF4444", bg: "#FEF2F2" },
  };

  if (items.length === 0) return (
    <p className="text-xs text-slate-300 text-center py-2">Nenhum agendado.</p>
  );

  return (
    <div className="space-y-2">
      {items.map(item => {
        const s = S[item.status] || S.pending;
        return (
          <div key={item.id} className="flex items-start gap-2 p-2.5 rounded-xl border border-slate-100 bg-white">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                <span className="px-2 py-0.5 rounded-full text-xs font-bold"
                  style={{ background: s.bg, color: s.color }}>{s.label}</span>
                <span className="text-xs text-slate-400">{fmt(item.scheduled_at)}</span>
              </div>
              <p className="text-xs text-slate-600 line-clamp-2">{item.message}</p>
            </div>
            {item.status === "pending" && (
              <button onClick={() => cancel(item.id)}
                className="flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-slate-300 hover:text-red-400 hover:bg-red-50 transition text-sm">
                ✕
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── WA FOLLOW-UP MODAL ───────────────────────────────────────────────────────────
function WaFollowUpModal({ lead, companyId, userId, onClose, onSaved }) {
  const quickReplies = useContext(QuickRepliesCtx);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [phone, setPhone]     = useState(lead.phone || "");
  const [date, setDate]       = useState(tomorrow.toISOString().slice(0, 10));
  const [time, setTime]       = useState("09:00");
  const [message, setMessage] = useState("");
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState("");

  const resolveMsg = (text) => text.replace(/\{\{nome\}\}/gi, lead.name || "");

  const save = async () => {
    if (!phone || !date || !time || !message.trim()) return;
    setSaving(true); setError("");
    try {
      const digits = phone.replace(/\D/g, "");
      const phoneCC = digits.startsWith("55") ? digits : "55" + digits;
      const scheduled_at = new Date(`${date}T${time}:00`).toISOString();
      const resolved = resolveMsg(message.trim());
      const { error: err } = await supabase.from("scheduled_followups").insert({
        lead_id: lead.id, company_id: companyId,
        phone: phoneCC, message: resolved,
        scheduled_at, created_by: userId,
      });
      if (err) throw err;
      const label = `${date.split("-").reverse().join("/")} às ${time}`;
      await supabase.from("activities").insert({
        lead_id: lead.id, company_id: companyId, type: "whatsapp",
        content: `Follow-up WA agendado para ${label}: "${resolved.slice(0, 80)}${resolved.length > 80 ? "..." : ""}"`,
        created_by: userId,
      });
      onSaved?.(); onClose();
    } catch (e) { setError(e.message); }
    setSaving(false);
  };

  const inp = "w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition";
  const lbl = "block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm z-10 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100 flex-shrink-0">
          <div>
            <h3 className="text-base font-black text-slate-900">Agendar Follow-up WA</h3>
            <p className="text-xs text-slate-400 mt-0.5">Mensagem automática via WhatsApp</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 transition text-lg">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {error && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">{error}</div>}
          <div>
            <label className={lbl}>Telefone</label>
            <input className={inp} value={phone} onChange={e => setPhone(e.target.value)} placeholder="(00) 00000-0000" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>Data</label><input type="date" className={inp} value={date} onChange={e => setDate(e.target.value)} /></div>
            <div><label className={lbl}>Horário</label><input type="time" className={inp} value={time} onChange={e => setTime(e.target.value)} /></div>
          </div>
          <div>
            <label className={lbl}>Mensagem</label>
            <textarea className={`${inp} resize-none`} rows={5}
              value={message} onChange={e => setMessage(e.target.value)}
              placeholder={"Olá {{nome}}, tudo bem?\n\nPassando para retomar nossa conversa..."} />
            <p className="text-xs text-slate-400 mt-1">
              Use <code className="bg-slate-100 px-1 rounded">{"{{nome}}"}</code> — substituído por <strong>{lead.name || "nome do lead"}</strong>.
            </p>
          </div>
          {quickReplies.length > 0 && (
            <div>
              <label className={lbl}>Usar resposta rápida</label>
              <div className="flex flex-wrap gap-1.5">
                {quickReplies.map(qr => (
                  <button key={qr.id} type="button" onClick={() => setMessage(qr.body)}
                    className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 transition">
                    {qr.title}
                  </button>
                ))}
              </div>
            </div>
          )}
          {message && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
              <div className="text-xs font-bold text-emerald-700 mb-1">Prévia:</div>
              <div className="text-xs text-emerald-900 whitespace-pre-wrap">{resolveMsg(message)}</div>
            </div>
          )}
        </div>
        <div className="flex gap-3 px-6 py-4 border-t border-slate-100 flex-shrink-0">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition">Cancelar</button>
          <button onClick={save} disabled={saving || !phone || !date || !time || !message.trim()}
            className="flex-1 py-2.5 rounded-lg text-white text-sm font-bold transition disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: "#25D366" }}>
            {saving ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin inline-block" /> : "💬"}
            Agendar envio
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── LEAD PANEL ───────────────────────────────────────────────────────────────────
function LeadModal({ lead, companyId, userId, onClose, onSaved, team, onManageLabels }) {
  const stages      = useContext(StagesCtx);
  const quickReplies = useContext(QuickRepliesCtx);
  const blank = { name:"", email:"", phone:"", source:"Google", status: stages[0]?.name || "Novo",
    utm_source:"", utm_medium:"", utm_campaign:"", utm_content:"", ad:"", notes:"", tags:[], assigned_to:"", follow_up_at:"" };
  const [form, setForm]         = useState({ ...(lead || blank), tags: lead?.tags || [], follow_up_at: lead?.follow_up_at || "" });
  const [panelTab, setPanelTab] = useState("dados");
  const [loading, setLoading]   = useState(false);
  const [scheduling, setScheduling]     = useState(false);
  const [waFollowUp, setWaFollowUp]     = useState(false);
  const [showReplies, setShowReplies]   = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const isEdit = !!lead?.id;

  const currentStage = stages.find(s => s.name === form.status) || stages[0];
  const barColor = currentStage?.bar || "#60A5FA";

  const [juliaPaused, setJuliaPaused] = useState(false);

  const handleWhatsApp = async () => {
    const url = whatsappUrl(form.phone);
    if (!url) return;
    const digits = form.phone.replace(/\D/g, "");
    if (digits) {
      const phoneWithCC = digits.startsWith("55") ? digits : "55" + digits;
      fetch(JULIA_API + "?action=pause&phone=" + phoneWithCC).catch(() => {});
      setJuliaPaused(true);
    }
    window.open(url, "_blank");
  };

  const save = async () => {
    setLoading(true);
    const payload = {
      ...form,
      company_id: companyId,
      follow_up_at: form.follow_up_at || null,
      assigned_to: form.assigned_to || null,
    };
    delete payload.id; delete payload.created_at; delete payload.updated_at;
    if (isEdit) {
      const { error } = await supabase.from("leads").update(payload).eq("id", lead.id);
      if (error) { alert("Erro ao salvar: " + error.message); setLoading(false); return; }
      if (lead.status !== form.status) {
        await supabase.from("activities").insert({ lead_id: lead.id, company_id: companyId, type: "status_change", content: `Status alterado de "${lead.status}" para "${form.status}"`, created_by: userId });
      }
    } else {
      const { data, error } = await supabase.from("leads").insert(payload).select().single();
      if (error) { alert("Erro ao criar lead: " + error.message); setLoading(false); return; }
      if (data?.id) {
        await supabase.from("activities").insert({ lead_id: data.id, company_id: companyId, type: "created", content: "Lead criado via CRM.", created_by: userId });
      }
    }
    setLoading(false); onSaved();
  };

  const inp   = "w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition";
  const smInp = "w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500 transition";
  const lbl   = "block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5";

  return (
    <>
      {scheduling && <ScheduleModal lead={form} companyId={companyId} userId={userId} onClose={() => setScheduling(false)} />}
      {waFollowUp && <WaFollowUpModal lead={{ ...form, id: lead?.id }} companyId={companyId} userId={userId} onClose={() => setWaFollowUp(false)} onSaved={onSaved} />}

      <div className="fixed inset-0 z-50 flex">
        <div className="flex-1 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
        <div className="w-full max-w-lg bg-white h-full flex flex-col shadow-2xl">

          {/* Top bar */}
          <div className="flex items-center gap-4 px-5 py-4 border-b border-slate-100">
            <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-black text-sm flex-shrink-0" style={{ background: barColor }}>
              {initials(form.name)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-black text-slate-900 text-base leading-tight truncate">
                {form.name || (isEdit ? "Editar Lead" : "Novo Lead")}
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <StatusBadge status={form.status} />
                <SourceBadge source={form.source} />
                {lead?.created_at && <span className="text-xs text-slate-400">{lead.created_at.slice(0,10)}</span>}
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 transition text-lg flex-shrink-0">✕</button>
          </div>

          {/* Action toolbar */}
          {isEdit && (
            <div className="flex items-stretch gap-2 px-5 py-3 bg-slate-50 border-b border-slate-100">
              {form.phone && (
                <button onClick={handleWhatsApp}
                  className="flex-1 flex flex-col items-center justify-center gap-1 py-3 rounded-xl text-white font-semibold text-xs transition hover:opacity-90"
                  style={{ background: juliaPaused ? "#16A34A" : "#25D366" }}>
                  <span className="text-xl leading-none">💬</span>
                  {juliaPaused ? "Julia pausada ✓" : "WhatsApp"}
                </button>
              )}
              <button onClick={() => { setShowReplies(v => !v); }}
                className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 rounded-xl font-semibold text-xs transition hover:opacity-90 ${showReplies ? "ring-2 ring-sky-400" : ""}`}
                style={{ background: "#F1F5F9", color: "#0EA5E9" }}>
                <span className="text-xl leading-none">⚡</span>Resp. Rápidas
                {quickReplies.length > 0 && (
                  <span className="text-xs opacity-60">{quickReplies.length}</span>
                )}
              </button>
              <button onClick={() => setScheduling(true)}
                className="flex-1 flex flex-col items-center justify-center gap-1 py-3 rounded-xl text-white font-semibold text-xs transition hover:opacity-90"
                style={{ background: "#1a73e8" }}>
                <span className="text-xl leading-none">📅</span>Agendar
              </button>
              {form.phone && (
                <button onClick={() => setWaFollowUp(true)}
                  className="flex-1 flex flex-col items-center justify-center gap-1 py-3 rounded-xl font-semibold text-xs transition hover:opacity-90"
                  style={{ background: "#DCFCE7", color: "#166534" }}>
                  <span className="text-xl leading-none">🔔</span>Follow-up WA
                </button>
              )}
              {form.email && (
                <a href={`mailto:${form.email}`}
                  className="flex-1 flex flex-col items-center justify-center gap-1 py-3 rounded-xl font-semibold text-xs transition hover:opacity-90"
                  style={{ background: "#F1F5F9", color: "#475569" }}>
                  <span className="text-xl leading-none">✉️</span>Email
                </a>
              )}
            </div>
          )}

          {/* Quick replies dropdown */}
          {isEdit && showReplies && (
            <QuickRepliesPanel leadName={form.name} onClose={() => setShowReplies(false)} />
          )}

          {/* Labels bar */}
          {isEdit && (
            <div className="px-5 py-2.5 border-b border-slate-100 bg-white">
              <LabelPicker tags={form.tags || []} onChange={v => set("tags", v)} onManageLabels={onManageLabels} />
            </div>
          )}

          {/* Tabs */}
          <div className="flex border-b border-slate-100 px-5">
            {(isEdit ? [["dados","Dados"],["historico","Histórico"]] : [["dados","Dados"]]).map(([k, l]) => (
              <button key={k} onClick={() => setPanelTab(k)}
                className={`px-4 py-2.5 text-xs font-bold border-b-2 transition ${panelTab === k ? "border-sky-500 text-sky-600" : "border-transparent text-slate-400 hover:text-slate-600"}`}>
                {l}
              </button>
            ))}
          </div>

          {/* Body */}
          {panelTab === "historico" ? (
            <div className="flex-1 overflow-hidden flex flex-col">
              <Timeline leadId={lead.id} companyId={companyId} userId={userId} />
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                <div>
                  <label className={lbl}>Nome *</label>
                  <input className={inp} value={form.name} onChange={e => set("name", e.target.value)} placeholder="Nome completo" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lbl}>Email</label>
                    <input className={inp} type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="email@ex.com" />
                  </div>
                  <div>
                    <label className={lbl}>Telefone</label>
                    <input className={inp} value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="(00) 00000-0000" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lbl}>Origem</label>
                    <select className={inp} value={form.source} onChange={e => set("source", e.target.value)}>
                      {SOURCES.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={lbl}>Estágio</label>
                    <select className={inp} value={form.status} onChange={e => set("status", e.target.value)}>
                      {stages.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                    </select>
                  </div>
                </div>

                {team?.length > 0 && (
                  <div>
                    <label className={lbl}>Responsável</label>
                    <select className={inp} value={form.assigned_to || ""} onChange={e => set("assigned_to", e.target.value || null)}>
                      <option value="">Sem responsável</option>
                      {team.map(m => (
                        <option key={m.user_id} value={m.user_id}>
                          {m.display_name || m.email.split("@")[0]}{m.user_id === userId ? " (você)" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Follow-up date */}
                <div>
                  <label className={lbl}>Próximo follow-up</label>
                  <div className="flex gap-2 items-center">
                    <input type="date" className={inp} value={form.follow_up_at || ""}
                      onChange={e => set("follow_up_at", e.target.value || "")} />
                    {form.follow_up_at && (
                      <button onClick={() => set("follow_up_at", "")}
                        className="px-2 py-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-50 transition text-sm flex-shrink-0">✕</button>
                    )}
                  </div>
                  {form.follow_up_at && <FollowUpBadge date={form.follow_up_at} />}
                </div>

                {!isEdit && (
                  <div>
                    <label className={lbl}>Etiquetas</label>
                    <LabelPicker tags={form.tags || []} onChange={v => set("tags", v)} onManageLabels={onManageLabels} />
                  </div>
                )}

                {isEdit && (
                  <div>
                    <label className={lbl}>Follow-ups WhatsApp Agendados</label>
                    <ScheduledFollowUps leadId={lead.id} />
                  </div>
                )}

                <div>
                  <label className={lbl}>Anotações</label>
                  <textarea className={`${inp} resize-none`} rows={3}
                    value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Observações sobre o lead..." />
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-3">
                  <div className="text-xs font-black text-slate-400 uppercase tracking-widest">Rastreamento UTM</div>
                  <div className="grid grid-cols-3 gap-2">
                    {[["utm_source","Source"],["utm_medium","Medium"],["utm_campaign","Campaign"]].map(([k, l]) => (
                      <div key={k}>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">{l}</label>
                        <input className={smInp} value={form[k]} onChange={e => set(k, e.target.value)} placeholder={k.replace("utm_","")} />
                      </div>
                    ))}
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Anúncio</label>
                    <input className={smInp} value={form.ad} onChange={e => set("ad", e.target.value)} placeholder="Nome do anúncio" />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 px-5 py-4 border-t border-slate-100">
                <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition">Cancelar</button>
                <button onClick={save} disabled={loading || !form.name}
                  className="flex-1 py-2.5 rounded-lg text-white text-sm font-bold transition disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg,#0EA5E9,#6366F1)" }}>
                  {loading ? "Salvando..." : "Salvar Lead"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ─── JULIA VIEW ──────────────────────────────────────────────────────────────────
const JULIA_API = "https://fluxo.adscelera.xyz/webhook/admin-leads";

const JULIA_STAGE_LABELS = {
  NEW: "Novo", COLLECTING_INFO: "Coletando", QUALIFYING_INTENT: "Qualificando",
  HANDOFF: "Handoff", NURTURING: "Nurturing",
};
const JULIA_STAGE_COLORS = {
  NEW:                { bg: "#DBEAFE", text: "#1D4ED8" },
  COLLECTING_INFO:    { bg: "#FEF3C7", text: "#92400E" },
  QUALIFYING_INTENT:  { bg: "#EDE9FE", text: "#5B21B6" },
  HANDOFF:            { bg: "#D1FAE5", text: "#065F46" },
  NURTURING:          { bg: "#DCFCE7", text: "#14532D" },
};

function JuliaView({ company }) {
  const [juliaLeads, setJuliaLeads] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState("");
  const [filter, setFilter]         = useState("all");
  const [search, setSearch]         = useState("");
  const [openHist, setOpenHist]     = useState({});
  const [working, setWorking]       = useState({});
  const [imported, setImported]     = useState({});
  const [importingAll, setImportingAll] = useState(false);
  const [importMsg, setImportMsg]   = useState("");
  const stages = useContext(StagesCtx);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res = await fetch(JULIA_API + "?action=list");
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      setJuliaLeads(data.leads || []);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const togglePause = async (phone, pause) => {
    setWorking(p => ({ ...p, [phone]: true }));
    try {
      await fetch(JULIA_API + "?action=" + (pause ? "pause" : "reactivate") + "&phone=" + phone);
      await load();
    } finally { setWorking(p => ({ ...p, [phone]: false })); }
  };

  const buildPayload = (jl) => {
    const crmStatus = jl.stage === "HANDOFF" && stages.find(s => s.name === "Qualificado")
      ? "Qualificado" : (stages[0]?.name || "Novo");
    const notes = [
      jl.company && "Empresa: " + jl.company,
      jl.city    && "Cidade: "  + jl.city,
      jl.keyword && "Keyword: " + jl.keyword,
    ].filter(Boolean).join("\n");
    return { name: jl.name || "Lead WhatsApp", phone: jl.phone, source: "WhatsApp", status: crmStatus, notes };
  };

  const importAll = async () => {
    setImportingAll(true); setImportMsg("");
    let created = 0; let updated = 0;
    for (const jl of juliaLeads) {
      try {
        const { data: existing } = await supabase.from("leads")
          .select("id").eq("company_id", company.id).eq("phone", jl.phone).maybeSingle();
        const payload = buildPayload(jl);
        if (existing) {
          await supabase.from("leads").update(payload).eq("id", existing.id);
          updated++;
        } else {
          await supabase.from("leads").insert({ ...payload, company_id: company.id });
          created++;
        }
      } catch { /* pula se falhar individualmente */ }
    }
    setImportingAll(false);
    setImportMsg(`${created} lead(s) criado(s), ${updated} atualizado(s) no CRM.`);
    setTimeout(() => setImportMsg(""), 6000);
  };

  const importLead = async (jl) => {
    setWorking(p => ({ ...p, ["imp_" + jl.phone]: true }));
    try {
      const { data: existing } = await supabase.from("leads")
        .select("id").eq("company_id", company.id).eq("phone", jl.phone).maybeSingle();
      const payload = buildPayload(jl);
      if (existing) {
        await supabase.from("leads").update(payload).eq("id", existing.id);
      } else {
        await supabase.from("leads").insert({ ...payload, company_id: company.id });
      }
      setImported(p => ({ ...p, [jl.phone]: true }));
      setTimeout(() => setImported(p => ({ ...p, [jl.phone]: false })), 3000);
    } finally { setWorking(p => ({ ...p, ["imp_" + jl.phone]: false })); }
  };

  const byStage = {};
  juliaLeads.forEach(l => { byStage[l.stage] = (byStage[l.stage] || 0) + 1; });
  const pausedCount = juliaLeads.filter(l => l.paused).length;

  const filtered = juliaLeads.filter(l => {
    if (filter !== "all") {
      if (filter === "paused" && !l.paused) return false;
      if (filter !== "paused" && l.stage !== filter) return false;
    }
    if (search) {
      const q = search.toLowerCase();
      if (!(l.name + " " + l.phone + " " + (l.company || "") + " " + (l.city || "") + " " + (l.keyword || "")).toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const fmt = (ts) => {
    if (!ts) return "";
    const d = new Date(ts);
    return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Total",      value: juliaLeads.length,               color: "#6366F1" },
          { label: "Novos",      value: byStage["NEW"] || 0,             color: "#38BDF8" },
          { label: "Coletando",  value: byStage["COLLECTING_INFO"] || 0, color: "#FB923C" },
          { label: "Qualific.",  value: byStage["QUALIFYING_INTENT"]||0, color: "#A78BFA" },
          { label: "Handoff",    value: (byStage["HANDOFF"]||0)+(byStage["NURTURING"]||0), color: "#4ADE80" },
          { label: "Pausados",   value: pausedCount,                     color: "#F87171" },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm text-center">
            <div className="text-2xl font-black" style={{ color: s.color }}>{s.value}</div>
            <div className="text-xs text-slate-400 mt-0.5 font-medium">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Search + actions */}
      <div className="flex gap-3">
        <input
          className="flex-1 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 transition"
          placeholder="Buscar nome, telefone, empresa, cidade..."
          value={search} onChange={e => setSearch(e.target.value)} />
        <button onClick={load}
          className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-600 hover:bg-slate-50 transition font-semibold whitespace-nowrap">
          ↻ Atualizar
        </button>
        {juliaLeads.length > 0 && (
          <button onClick={importAll}
            disabled={importingAll}
            className="px-4 py-2 rounded-lg text-white text-sm font-bold transition disabled:opacity-60 whitespace-nowrap flex items-center gap-2"
            style={{ background: "linear-gradient(135deg,#6366F1,#8B5CF6)" }}>
            {importingAll
              ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin inline-block" /> Importando...</>
              : `⬇ Importar todos (${juliaLeads.length})`}
          </button>
        )}
      </div>
      {importMsg && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">
          ✓ {importMsg}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {[["all","Todos"],["NEW","Novo"],["COLLECTING_INFO","Coletando"],["QUALIFYING_INTENT","Qualificando"],["HANDOFF","Handoff"],["NURTURING","Nurturing"],["paused","Pausados"]].map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition border ${
              filter === k ? "bg-indigo-500 border-indigo-500 text-white" : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
            }`}>{l}</button>
        ))}
      </div>

      {/* Content */}
      {loading && (
        <div className="flex items-center justify-center py-16 bg-white rounded-xl border border-slate-100">
          <div className="w-8 h-8 border-4 border-slate-200 border-t-indigo-500 rounded-full animate-spin" />
        </div>
      )}

      {error && !loading && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          <div className="font-bold mb-1">Não foi possível conectar à Julia</div>
          <div className="text-xs text-red-500">{error}</div>
          <div className="text-xs text-red-400 mt-2">Verifique se o n8n está rodando no VPS.</div>
        </div>
      )}

      {!loading && !error && (
        <div className="space-y-3">
          {filtered.length === 0 && (
            <div className="bg-white rounded-xl border border-slate-100 p-12 text-center text-slate-300">
              <div className="text-4xl mb-3">🤖</div>
              <div className="text-sm">Nenhum lead encontrado.</div>
            </div>
          )}
          {filtered.map(jl => {
            const sc = JULIA_STAGE_COLORS[jl.stage] || { bg: "#F1F5F9", text: "#64748B" };
            const histOpen = openHist[jl.phone];
            return (
              <div key={jl.phone}
                className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden"
                style={{ borderLeft: jl.paused ? "3px solid #F87171" : jl.stage === "HANDOFF" ? "3px solid #4ADE80" : undefined }}>
                <div className="flex items-start gap-4 p-4">
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                    style={{ background: "linear-gradient(135deg,#6366F1,#8B5CF6)" }}>
                    {(jl.name || "L")[0].toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-900 text-sm truncate">{jl.name || "Sem nome"}</span>
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold"
                        style={{ background: sc.bg, color: sc.text }}>
                        {JULIA_STAGE_LABELS[jl.stage] || jl.stage}
                      </span>
                      {jl.paused && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-600">⏸ Pausado</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-slate-400">
                      <span>📱 {jl.phone}</span>
                      {jl.company && <span>🏢 {jl.company}</span>}
                      {jl.city    && <span>📍 {jl.city}</span>}
                      {jl.keyword && <span>🔑 {jl.keyword}</span>}
                    </div>
                    {jl.updated_at && (
                      <div className="text-xs text-slate-300 mt-0.5">{fmt(jl.updated_at)}</div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    <button
                      onClick={() => importLead(jl)}
                      disabled={working["imp_" + jl.phone]}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                        imported[jl.phone]
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
                      } disabled:opacity-50`}>
                      {working["imp_" + jl.phone] ? "..." : imported[jl.phone] ? "✓ Importado" : "⬇ Importar"}
                    </button>
                    <button
                      onClick={() => togglePause(jl.phone, !jl.paused)}
                      disabled={working[jl.phone]}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition disabled:opacity-50 ${
                        jl.paused
                          ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                          : "bg-red-50 text-red-600 hover:bg-red-100"
                      }`}>
                      {working[jl.phone] ? "..." : jl.paused ? "▶ Reativar Julia" : "⏸ Pausar Julia"}
                    </button>
                    {jl.history?.length > 0 && (
                      <button
                        onClick={() => setOpenHist(p => ({ ...p, [jl.phone]: !p[jl.phone] }))}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition">
                        💬 {histOpen ? "Fechar" : "Conversa"}
                      </button>
                    )}
                  </div>
                </div>

                {/* Conversation history */}
                {histOpen && jl.history?.length > 0 && (
                  <div className="border-t border-slate-100 px-4 pb-4">
                    <div className="text-xs font-black text-slate-400 uppercase tracking-widest py-3">Histórico de conversa</div>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {jl.history.map((m, i) => (
                        <div key={i} className={`flex ${m.role === "julia" ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[80%] px-3 py-2 rounded-xl text-xs leading-relaxed ${
                            m.role === "julia"
                              ? "bg-emerald-50 text-emerald-900 rounded-br-sm"
                              : "bg-slate-100 text-slate-700 rounded-bl-sm"
                          }`}>
                            <div>{m.text}</div>
                            <div className="text-xs opacity-50 mt-1 flex items-center gap-1">
                              {m.role === "julia" ? "🤖 Julia" : "👤 Lead"}
                              {m.ts && <span>· {fmt(m.ts)}</span>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── APP ─────────────────────────────────────────────────────────────────────────
export default function App() {
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem("theme");
    if (saved) return saved === "dark";
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);

  const [user, setUser]         = useState(null);
  const [company, setCompany]   = useState(null);
  const [leads, setLeads]       = useState([]);
  const [team, setTeam]         = useState([]);
  const [stages, setStages]     = useState([]);
  const [labels, setLabels]     = useState([]);
  const [quickReplies, setQuickReplies] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState("leads");
  const [view, setView]         = useState("kanban");
  const [modal, setModal]       = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [inviteMsg, setInviteMsg]       = useState("");
  const [filters, setFilters] = useState({ search: "", source: "", status: "", label: "", myLeads: false, followUpToday: false });

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session?.user) {
        const { data: members } = await supabase.from("company_members")
          .select("company_id, companies(*)").eq("user_id", data.session.user.id);
        if (members?.length) { setUser(data.session.user); setCompany(members[0].companies); }
      }
      setLoading(false);
    });
  }, []);

  const fetchLeads = useCallback(async () => {
    if (!company) return;
    const { data } = await supabase.from("leads").select("*").eq("company_id", company.id).order("created_at", { ascending: false });
    setLeads(data || []);
  }, [company]);

  const fetchTeam = useCallback(async () => {
    if (!company) return;
    const { data } = await supabase.rpc("get_team_members", { p_company_id: company.id });
    setTeam(data || []);
  }, [company]);

  const fetchStages = useCallback(async () => {
    if (!company) return;
    try {
      const { data, error } = await supabase.from("pipeline_stages").select("*").eq("company_id", company.id).order("position");
      if (error) throw error;
      if (data?.length) { setStages(data); }
      else {
        const toInsert = DEFAULT_STAGES.map(s => ({ ...s, company_id: company.id }));
        const { data: inserted } = await supabase.from("pipeline_stages").insert(toInsert).select("*").order("position");
        setStages(inserted?.length ? inserted : DEFAULT_STAGES.map((s, i) => ({ ...s, id: `d-${i}` })));
      }
    } catch { setStages(DEFAULT_STAGES.map((s, i) => ({ ...s, id: `d-${i}`, company_id: company?.id }))); }
  }, [company]);

  const fetchLabels = useCallback(async () => {
    if (!company) return;
    try {
      const { data } = await supabase.from("labels").select("*").eq("company_id", company.id).order("position");
      setLabels(data || []);
    } catch { setLabels([]); }
  }, [company]);

  const fetchQuickReplies = useCallback(async () => {
    if (!company) return;
    try {
      const { data } = await supabase.from("quick_replies").select("*").eq("company_id", company.id).order("position");
      setQuickReplies(data || []);
    } catch { setQuickReplies([]); }
  }, [company]);

  useEffect(() => {
    fetchLeads(); fetchTeam(); fetchStages(); fetchLabels(); fetchQuickReplies();
  }, [fetchLeads, fetchTeam, fetchStages, fetchLabels, fetchQuickReplies]);

  const currentMember = team.find(m => m.user_id === user?.id);

  const handleAuth   = (u, c) => { setUser(u); setCompany(c); };
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null); setCompany(null); setLeads([]); setTeam([]); setStages([]); setLabels([]); setQuickReplies([]);
  };
  const handleDelete = async (id) => {
    if (!window.confirm("Remover este lead?")) return;
    await supabase.from("leads").delete().eq("id", id); fetchLeads();
  };
  const handleMove = async (leadId, toStatus, fromStatus) => {
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: toStatus } : l));
    await supabase.from("leads").update({ status: toStatus }).eq("id", leadId);
    await supabase.from("activities").insert({ lead_id: leadId, company_id: company.id, type: "status_change", content: `Status alterado de "${fromStatus}" para "${toStatus}"`, created_by: user.id });
  };
  const handleInvite = async () => {
    const { data, error } = await supabase.from("company_invites").insert({ company_id: company.id, created_by: user.id }).select("token").single();
    if (error || !data) { window.alert("Erro ao gerar convite"); return; }
    const link = `${window.location.origin}?invite=${data.token}`;
    await navigator.clipboard.writeText(link);
    setInviteMsg("Link copiado! Envie para o novo membro. Expira em 7 dias.");
    setTimeout(() => setInviteMsg(""), 5000);
  };

  const setFilter = (k, v) => setFilters(f => ({ ...f, [k]: v }));
  const today = todayStr();
  const filtered = useMemo(() => leads.filter(l => {
    const s = filters.search.toLowerCase();
    if (s && !l.name?.toLowerCase().includes(s) && !l.email?.toLowerCase().includes(s) && !l.phone?.includes(s)) return false;
    if (filters.source && l.source !== filters.source) return false;
    if (filters.status && l.status !== filters.status) return false;
    if (filters.label && !(l.tags || []).includes(filters.label)) return false;
    if (filters.myLeads && l.assigned_to !== user?.id) return false;
    if (filters.followUpToday && (!l.follow_up_at || l.follow_up_at > today)) return false;
    return true;
  }), [leads, filters, user, today]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-8 h-8 border-4 border-slate-200 border-t-sky-500 rounded-full animate-spin" />
    </div>
  );
  if (!user || !company) return <AuthScreen onAuth={handleAuth} />;

  const pendingFollowUps = leads.filter(l => l.follow_up_at && l.follow_up_at <= today).length;
  const sel = "px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500 transition";

  return (
    <StagesCtx.Provider value={stages}>
      <LabelsCtx.Provider value={labels}>
        <QuickRepliesCtx.Provider value={quickReplies}>
          <div className="flex h-screen overflow-hidden app-bg">
            <Sidebar company={company} user={user} tab={tab} setTab={setTab}
              onLogout={handleLogout} team={team} onInvite={handleInvite}
              currentMember={currentMember} onSettings={() => setSettingsOpen(true)}
              dark={dark} onToggleTheme={() => setDark(d => !d)} />

            <div className="flex-1 flex flex-col overflow-hidden">
              <header className="h-14 bg-white border-b border-slate-100 flex items-center justify-between px-6 flex-shrink-0">
                <h1 className="text-xs font-black text-slate-500 uppercase tracking-widest">
                  {tab === "dashboard" ? "Dashboard" : tab === "julia" ? "🤖 Painel Julia" : "Leads"}
                </h1>
                <div className="flex items-center gap-3">
                  {tab === "leads" && pendingFollowUps > 0 && (
                    <button onClick={() => setFilter("followUpToday", !filters.followUpToday)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                        filters.followUpToday ? "bg-orange-500 text-white" : "bg-orange-50 text-orange-600 hover:bg-orange-100"
                      }`}>
                      📅 {pendingFollowUps} follow-up{pendingFollowUps > 1 ? "s" : ""}
                    </button>
                  )}
                  {tab === "leads" && (
                    <button onClick={() => setModal({})}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-bold transition hover:opacity-90"
                      style={{ background: "linear-gradient(135deg,#0EA5E9,#6366F1)" }}>
                      + Novo Lead
                    </button>
                  )}
                </div>
              </header>

              {inviteMsg && (
                <div className="mx-6 mt-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm flex items-center gap-2">
                  ✓ {inviteMsg}
                </div>
              )}

              <main className="flex-1 overflow-y-auto p-6">
                {tab === "dashboard" && <Dashboard leads={leads} />}

                {tab === "julia" && <JuliaView company={company} />}

                {tab === "leads" && (
                  <div>
                    <div className="flex gap-3 flex-wrap items-center mb-5">
                      <input
                        className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 transition min-w-[200px]"
                        placeholder="Buscar nome, email, telefone..."
                        value={filters.search} onChange={e => setFilter("search", e.target.value)} />

                      <select className={sel} value={filters.source} onChange={e => setFilter("source", e.target.value)}>
                        <option value="">Todas as origens</option>
                        {SOURCES.map(s => <option key={s}>{s}</option>)}
                      </select>

                      <select className={sel} value={filters.status} onChange={e => setFilter("status", e.target.value)}>
                        <option value="">Todos os estágios</option>
                        {stages.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                      </select>

                      {labels.length > 0 && (
                        <select className={sel} value={filters.label} onChange={e => setFilter("label", e.target.value)}>
                          <option value="">Todas as etiquetas</option>
                          {labels.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}
                        </select>
                      )}

                      <button onClick={() => setFilter("myLeads", !filters.myLeads)}
                        className={`px-3 py-2 rounded-lg border text-xs font-bold transition whitespace-nowrap ${
                          filters.myLeads ? "bg-sky-500 border-sky-500 text-white" : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                        }`}>
                        Meus leads
                      </button>

                      <button onClick={() => setFilter("followUpToday", !filters.followUpToday)}
                        className={`px-3 py-2 rounded-lg border text-xs font-bold transition whitespace-nowrap ${
                          filters.followUpToday ? "bg-orange-500 border-orange-500 text-white" : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                        }`}>
                        📅 Follow-up pendente
                      </button>

                      <div className="ml-auto flex items-center gap-3">
                        <span className="text-xs text-slate-400 font-medium">{filtered.length} leads</span>
                        <button onClick={() => exportCSV(filtered)}
                          className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:bg-slate-50 transition whitespace-nowrap">
                          ⬇ Exportar CSV
                        </button>
                        <div className="flex bg-slate-100 rounded-lg p-0.5">
                          {[["kanban","⬛ Kanban"],["table","☰ Lista"]].map(([v, l]) => (
                            <button key={v} onClick={() => setView(v)}
                              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                                view === v ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                              }`}>{l}</button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className={`bg-white rounded-xl border border-slate-100 shadow-sm ${view === "kanban" ? "p-4" : ""}`}>
                      {view === "kanban"
                        ? <KanbanView leads={filtered} onEdit={setModal} team={team} onMove={handleMove} />
                        : <TableView leads={filtered} onEdit={setModal} onDelete={handleDelete} team={team} />}
                    </div>
                  </div>
                )}
              </main>
            </div>

            {modal !== null && (
              <LeadModal
                lead={modal?.id ? modal : null}
                companyId={company.id}
                userId={user.id}
                team={team}
                onClose={() => setModal(null)}
                onSaved={() => { setModal(null); fetchLeads(); }}
                onManageLabels={() => setSettingsOpen(true)}
              />
            )}

            {settingsOpen && (
              <SettingsModal
                company={company} leads={leads}
                onClose={() => setSettingsOpen(false)}
                onRefreshLabels={fetchLabels}
                onRefreshStages={fetchStages}
                onRefreshReplies={fetchQuickReplies}
              />
            )}
          </div>
        </QuickRepliesCtx.Provider>
      </LabelsCtx.Provider>
    </StagesCtx.Provider>
  );
}
