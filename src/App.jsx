import { useState, useEffect, useMemo, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

// =============================================
// CONFIG — substitua com suas credenciais do Supabase
// =============================================
const SUPABASE_URL = "https://ieudjpicmrudhpfzpplg.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlldWRqcGljbXJ1ZGhwZnpwcGxnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0MDQyMDgsImV4cCI6MjA5Mjk4MDIwOH0.e3E-54mlfkTRQsb1W6gJeRZd02qn4BK7XpiKVjzDx4A";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// =============================================
// CONSTANTS
// =============================================
const SOURCES = ["Google", "Meta", "Site"];
const STATUSES = ["Novo", "Contatado", "Proposta", "Fechado", "Perdido"];
const STATUS_COLORS = {
  Novo:      { bg: "#e8f4fd", text: "#1565c0", border: "#90caf9" },
  Contatado: { bg: "#fff8e1", text: "#b8860b", border: "#ffe082" },
  Proposta:  { bg: "#f3e5f5", text: "#7b1fa2", border: "#ce93d8" },
  Fechado:   { bg: "#e8f5e9", text: "#2e7d32", border: "#a5d6a7" },
  Perdido:   { bg: "#fce4ec", text: "#c62828", border: "#ef9a9a" },
};
const SOURCE_COLORS = {
  Google: { bg: "#e8f0fe", text: "#1a73e8" },
  Meta:   { bg: "#e7f3ff", text: "#1877f2" },
  Site:   { bg: "#f0fdf4", text: "#16a34a" },
};

// =============================================
// HELPERS
// =============================================
function slugify(text) {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function exportCSV(leads) {
  const headers = ["Nome","Email","Telefone","Origem","Status","UTM Source","UTM Medium","UTM Campaign","Anúncio","Anotações","Data"];
  const rows = leads.map(l => [l.name,l.email,l.phone,l.source,l.status,l.utm_source,l.utm_medium,l.utm_campaign,l.ad,l.notes,l.created_at?.slice(0,10)]);
  const csv = [headers,...rows].map(r => r.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv],{type:"text/csv"}));
  a.download = "leads.csv"; a.click();
}

// =============================================
// UI ATOMS
// =============================================
const inputCss = {
  width:"100%", padding:"9px 12px", borderRadius:8,
  border:"1.5px solid #e2e8f0", fontSize:13, outline:"none",
  fontFamily:"inherit", boxSizing:"border-box", background:"#f8fafc",
  color:"#1e293b", transition:"border 0.2s",
};
const btnPrimary = {
  padding:"10px 22px", borderRadius:9, border:"none",
  background:"linear-gradient(135deg,#0ea5e9,#6366f1)",
  color:"#fff", cursor:"pointer", fontSize:13, fontWeight:700,
  letterSpacing:0.2,
};
const btnSecondary = {
  padding:"9px 18px", borderRadius:9,
  border:"1.5px solid #e2e8f0", background:"#fff",
  cursor:"pointer", fontSize:13, fontWeight:600, color:"#64748b",
};

function Badge({ label, colors }) {
  return (
    <span style={{ display:"inline-block", padding:"2px 10px", borderRadius:999,
      fontSize:11, fontWeight:700, letterSpacing:0.3,
      background:colors.bg, color:colors.text, border:`1px solid ${colors.border||colors.bg}` }}>
      {label}
    </span>
  );
}

function Spinner() {
  return <div style={{ display:"flex", justifyContent:"center", padding:48 }}>
    <div style={{ width:32, height:32, border:"3px solid #e2e8f0",
      borderTop:"3px solid #0ea5e9", borderRadius:"50%",
      animation:"spin 0.8s linear infinite" }} />
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
  </div>;
}

// =============================================
// AUTH SCREEN
// =============================================
function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState("login"); // login | register | create_company
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pendingUser, setPendingUser] = useState(null);

  const handleAuth = async () => {
    setLoading(true); setError("");
    try {
      if (mode === "register") {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setPendingUser(data.user);
        setMode("create_company");
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        const { data: members } = await supabase.from("company_members").select("company_id, companies(*)").eq("user_id", data.user.id);
        if (!members?.length) { setPendingUser(data.user); setMode("create_company"); }
        else onAuth(data.user, members[0].companies);
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

  return (
    <div style={{ minHeight:"100vh", background:"linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#0f172a 100%)",
      display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'DM Sans',sans-serif" }}>
      <div style={{ background:"#fff", borderRadius:20, padding:"36px 40px", width:400,
        maxWidth:"92vw", boxShadow:"0 24px 80px #0007" }}>
        <div style={{ textAlign:"center", marginBottom:28 }}>
          <div style={{ width:48, height:48, borderRadius:14, margin:"0 auto 12px",
            background:"linear-gradient(135deg,#0ea5e9,#6366f1)",
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:22, fontWeight:900, color:"#fff" }}>A</div>
          <h1 style={{ margin:0, fontSize:22, fontWeight:900, color:"#0f172a", letterSpacing:-0.5 }}>AdLeads CRM</h1>
          <p style={{ margin:"6px 0 0", fontSize:13, color:"#94a3b8" }}>
            {mode === "create_company" ? "Configure sua empresa" : mode === "login" ? "Entre na sua conta" : "Crie sua conta"}
          </p>
        </div>

        {error && <div style={{ background:"#fef2f2", border:"1px solid #fecaca", borderRadius:8,
          padding:"10px 14px", fontSize:12, color:"#dc2626", marginBottom:16 }}>{error}</div>}

        {mode === "create_company" ? (
          <>
            <label style={{ fontSize:11, fontWeight:700, color:"#94a3b8", textTransform:"uppercase", letterSpacing:0.5 }}>Nome da Empresa</label>
            <input style={{ ...inputCss, marginTop:4, marginBottom:16 }} value={companyName}
              onChange={e => setCompanyName(e.target.value)} placeholder="Ex: Agência XYZ" />
            <button onClick={handleCreateCompany} disabled={loading || !companyName}
              style={{ ...btnPrimary, width:"100%", opacity: loading || !companyName ? 0.6 : 1 }}>
              {loading ? "Criando..." : "Criar Empresa e Entrar"}
            </button>
          </>
        ) : (
          <>
            <label style={{ fontSize:11, fontWeight:700, color:"#94a3b8", textTransform:"uppercase", letterSpacing:0.5 }}>Email</label>
            <input style={{ ...inputCss, marginTop:4, marginBottom:12 }} type="email" value={email}
              onChange={e => setEmail(e.target.value)} placeholder="voce@empresa.com" />
            <label style={{ fontSize:11, fontWeight:700, color:"#94a3b8", textTransform:"uppercase", letterSpacing:0.5 }}>Senha</label>
            <input style={{ ...inputCss, marginTop:4, marginBottom:20 }} type="password" value={password}
              onChange={e => setPassword(e.target.value)} placeholder="••••••••"
              onKeyDown={e => e.key === "Enter" && handleAuth()} />
            <button onClick={handleAuth} disabled={loading || !email || !password}
              style={{ ...btnPrimary, width:"100%", opacity: loading || !email || !password ? 0.6 : 1 }}>
              {loading ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar Conta"}
            </button>
            <p style={{ textAlign:"center", marginTop:16, fontSize:13, color:"#94a3b8" }}>
              {mode === "login" ? "Não tem conta?" : "Já tem conta?"}{" "}
              <span onClick={() => { setMode(mode==="login"?"register":"login"); setError(""); }}
                style={{ color:"#0ea5e9", cursor:"pointer", fontWeight:700 }}>
                {mode === "login" ? "Criar conta" : "Entrar"}
              </span>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

// =============================================
// LEAD MODAL
// =============================================
function LeadModal({ lead, companyId, onClose, onSaved }) {
  const blank = { name:"", email:"", phone:"", source:"Google", status:"Novo",
    utm_source:"", utm_medium:"", utm_campaign:"", utm_content:"", ad:"", notes:"" };
  const [form, setForm] = useState(lead || blank);
  const [loading, setLoading] = useState(false);
  const set = (k,v) => setForm(f => ({ ...f, [k]:v }));

  const save = async () => {
    setLoading(true);
    const payload = { ...form, company_id: companyId };
    delete payload.id; delete payload.created_at; delete payload.updated_at;
    let error;
    if (lead?.id) {
      ({ error } = await supabase.from("leads").update(payload).eq("id", lead.id));
    } else {
      ({ error } = await supabase.from("leads").insert(payload));
    }
    setLoading(false);
    if (!error) onSaved();
  };

  const labelCss = { fontSize:11, fontWeight:700, color:"#94a3b8", marginBottom:4,
    display:"block", textTransform:"uppercase", letterSpacing:0.5 };

  return (
    <div style={{ position:"fixed", inset:0, background:"#0007", zIndex:1000,
      display:"flex", alignItems:"center", justifyContent:"center" }}
      onClick={e => e.target===e.currentTarget && onClose()}>
      <div style={{ background:"#fff", borderRadius:18, padding:28, width:500,
        maxWidth:"95vw", maxHeight:"90vh", overflowY:"auto",
        boxShadow:"0 12px 60px #0004", fontFamily:"'DM Sans',sans-serif" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:22 }}>
          <h2 style={{ margin:0, fontSize:18, fontWeight:800, color:"#0f172a" }}>
            {lead?.id ? "Editar Lead" : "Novo Lead"}
          </h2>
          <button onClick={onClose} style={{ background:"none", border:"none", fontSize:20, cursor:"pointer", color:"#94a3b8" }}>✕</button>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
          <div style={{ gridColumn:"1/-1" }}>
            <label style={labelCss}>Nome *</label>
            <input style={inputCss} value={form.name} onChange={e=>set("name",e.target.value)} placeholder="Nome completo" />
          </div>
          <div>
            <label style={labelCss}>Email</label>
            <input style={inputCss} type="email" value={form.email} onChange={e=>set("email",e.target.value)} placeholder="email@exemplo.com" />
          </div>
          <div>
            <label style={labelCss}>Telefone</label>
            <input style={inputCss} value={form.phone} onChange={e=>set("phone",e.target.value)} placeholder="(00) 00000-0000" />
          </div>
          <div>
            <label style={labelCss}>Origem</label>
            <select style={inputCss} value={form.source} onChange={e=>set("source",e.target.value)}>
              {SOURCES.map(s=><option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label style={labelCss}>Status</label>
            <select style={inputCss} value={form.status} onChange={e=>set("status",e.target.value)}>
              {STATUSES.map(s=><option key={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div style={{ margin:"16px 0 0", padding:"14px 16px", background:"#f8fafc",
          borderRadius:10, border:"1px solid #e2e8f0" }}>
          <div style={{ fontSize:11, fontWeight:800, color:"#94a3b8", letterSpacing:1,
            marginBottom:12, textTransform:"uppercase" }}>Rastreamento UTM</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
            {[["utm_source","UTM Source"],["utm_medium","UTM Medium"],["utm_campaign","UTM Campaign"]].map(([k,l])=>(
              <div key={k}>
                <label style={labelCss}>{l}</label>
                <input style={{ ...inputCss, background:"#fff" }} value={form[k]} onChange={e=>set(k,e.target.value)} placeholder={k} />
              </div>
            ))}
          </div>
          <div style={{ marginTop:10 }}>
            <label style={labelCss}>Anúncio / Criativo</label>
            <input style={{ ...inputCss, background:"#fff" }} value={form.ad} onChange={e=>set("ad",e.target.value)} placeholder="Nome do anúncio" />
          </div>
        </div>

        <div style={{ marginTop:14 }}>
          <label style={labelCss}>Anotações</label>
          <textarea style={{ ...inputCss, minHeight:72, resize:"vertical" }}
            value={form.notes} onChange={e=>set("notes",e.target.value)} placeholder="Observações sobre o lead..." />
        </div>

        <div style={{ display:"flex", gap:10, marginTop:22, justifyContent:"flex-end" }}>
          <button onClick={onClose} style={btnSecondary}>Cancelar</button>
          <button onClick={save} disabled={loading || !form.name}
            style={{ ...btnPrimary, opacity: loading || !form.name ? 0.6 : 1 }}>
            {loading ? "Salvando..." : "Salvar Lead"}
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================
// KANBAN
// =============================================
function KanbanView({ leads, onEdit }) {
  return (
    <div style={{ display:"flex", gap:12, overflowX:"auto", paddingBottom:8 }}>
      {STATUSES.map(status => {
        const cols = leads.filter(l => l.status === status);
        const c = STATUS_COLORS[status];
        return (
          <div key={status} style={{ minWidth:210, flex:1, background:"#f8fafc",
            borderRadius:14, padding:14, border:"1.5px solid #e2e8f0" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
              <span style={{ fontWeight:800, fontSize:12, color:c.text }}>{status}</span>
              <span style={{ background:c.bg, color:c.text, borderRadius:999, fontSize:11,
                fontWeight:700, padding:"2px 8px", border:`1px solid ${c.border}` }}>{cols.length}</span>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:9 }}>
              {cols.map(lead => (
                <div key={lead.id} onClick={()=>onEdit(lead)}
                  style={{ background:"#fff", borderRadius:10, padding:"12px 14px",
                    boxShadow:"0 1px 6px #0001", cursor:"pointer",
                    border:"1.5px solid #f1f5f9", transition:"all 0.15s" }}
                  onMouseEnter={e=>{e.currentTarget.style.boxShadow="0 4px 18px #0002";e.currentTarget.style.transform="translateY(-2px)"}}
                  onMouseLeave={e=>{e.currentTarget.style.boxShadow="0 1px 6px #0001";e.currentTarget.style.transform="none"}}>
                  <div style={{ fontWeight:700, fontSize:13, color:"#0f172a", marginBottom:3 }}>{lead.name}</div>
                  <div style={{ fontSize:11, color:"#94a3b8", marginBottom:7 }}>{lead.email}</div>
                  <div style={{ display:"flex", gap:5, flexWrap:"wrap", alignItems:"center" }}>
                    <Badge label={lead.source} colors={SOURCE_COLORS[lead.source]||{bg:"#f1f5f9",text:"#64748b"}} />
                    {lead.utm_campaign && <span style={{ fontSize:10, color:"#94a3b8" }}>📌 {lead.utm_campaign}</span>}
                  </div>
                </div>
              ))}
              {cols.length===0 && <div style={{ textAlign:"center", color:"#cbd5e1", fontSize:12, padding:"20px 0" }}>Vazio</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// =============================================
// TABLE
// =============================================
function TableView({ leads, onEdit, onDelete }) {
  return (
    <div style={{ overflowX:"auto" }}>
      <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
        <thead>
          <tr style={{ background:"#f8fafc" }}>
            {["Nome","Email","Telefone","Origem","Status","Campaign","Criativo","Data",""].map(h=>(
              <th key={h} style={{ padding:"10px 14px", textAlign:"left", fontWeight:700,
                fontSize:11, color:"#94a3b8", textTransform:"uppercase", letterSpacing:0.5,
                borderBottom:"2px solid #e2e8f0", whiteSpace:"nowrap" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {leads.map(lead=>(
            <tr key={lead.id} style={{ borderBottom:"1px solid #f1f5f9" }}
              onMouseEnter={e=>e.currentTarget.style.background="#f8fafc"}
              onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
              <td style={{ padding:"10px 14px", fontWeight:600, color:"#0f172a" }}>{lead.name}</td>
              <td style={{ padding:"10px 14px", color:"#64748b" }}>{lead.email}</td>
              <td style={{ padding:"10px 14px", color:"#64748b" }}>{lead.phone}</td>
              <td style={{ padding:"10px 14px" }}><Badge label={lead.source} colors={SOURCE_COLORS[lead.source]||{bg:"#f1f5f9",text:"#64748b"}} /></td>
              <td style={{ padding:"10px 14px" }}><Badge label={lead.status} colors={STATUS_COLORS[lead.status]} /></td>
              <td style={{ padding:"10px 14px", color:"#94a3b8", fontSize:12 }}>{lead.utm_campaign||"—"}</td>
              <td style={{ padding:"10px 14px", color:"#94a3b8", fontSize:12 }}>{lead.ad||"—"}</td>
              <td style={{ padding:"10px 14px", color:"#cbd5e1", fontSize:11 }}>{lead.created_at?.slice(0,10)}</td>
              <td style={{ padding:"10px 14px" }}>
                <div style={{ display:"flex", gap:6 }}>
                  <button onClick={()=>onEdit(lead)} style={{ ...btnSecondary, padding:"4px 10px", fontSize:11 }}>Editar</button>
                  <button onClick={()=>onDelete(lead.id)} style={{ padding:"4px 10px", borderRadius:6, border:"none",
                    background:"#fef2f2", cursor:"pointer", fontSize:11, fontWeight:600, color:"#dc2626" }}>✕</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {leads.length===0 && <div style={{ textAlign:"center", padding:48, color:"#cbd5e1", fontSize:14 }}>Nenhum lead encontrado.</div>}
    </div>
  );
}

// =============================================
// DASHBOARD
// =============================================
function Dashboard({ leads }) {
  const total = leads.length;
  const byStatus = STATUSES.reduce((a,s)=>({...a,[s]:leads.filter(l=>l.status===s).length}),{});
  const bySource = SOURCES.reduce((a,s)=>({...a,[s]:leads.filter(l=>l.source===s).length}),{});
  const conversion = total ? ((byStatus["Fechado"]/total)*100).toFixed(1) : 0;

  const MetricCard = ({label, value, sub, color}) => (
    <div style={{ background:"#fff", borderRadius:14, padding:"18px 22px",
      boxShadow:"0 1px 8px #0001", border:"1px solid #f1f5f9", flex:1, minWidth:130 }}>
      <div style={{ fontSize:28, fontWeight:900, color:color||"#0f172a",
        fontFamily:"'DM Mono',monospace", letterSpacing:-1 }}>{value}</div>
      <div style={{ fontSize:13, color:"#64748b", fontWeight:600, marginTop:2 }}>{label}</div>
      {sub && <div style={{ fontSize:11, color:"#94a3b8", marginTop:2 }}>{sub}</div>}
    </div>
  );

  const BarChart = ({title, data, colors}) => (
    <div style={{ background:"#fff", borderRadius:14, padding:20,
      boxShadow:"0 1px 8px #0001", border:"1px solid #f1f5f9" }}>
      <div style={{ fontWeight:800, fontSize:13, marginBottom:14, color:"#0f172a" }}>{title}</div>
      {Object.entries(data).map(([k,v])=>{
        const pct = total ? (v/total*100) : 0;
        const c = colors?.[k] || { text:"#64748b" };
        return (
          <div key={k} style={{ marginBottom:12 }}>
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:12,
              fontWeight:600, color:"#64748b", marginBottom:4 }}>
              <span>{k}</span><span>{v}</span>
            </div>
            <div style={{ height:7, background:"#f1f5f9", borderRadius:99 }}>
              <div style={{ height:"100%", borderRadius:99, width:`${pct}%`,
                background:c.text, transition:"width 0.6s" }} />
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div>
      <h2 style={{ margin:"0 0 20px", fontSize:17, fontWeight:800, color:"#0f172a" }}>Visão Geral</h2>
      <div style={{ display:"flex", gap:14, flexWrap:"wrap", marginBottom:24 }}>
        <MetricCard label="Total de Leads" value={total} color="#0ea5e9" />
        <MetricCard label="Fechados" value={byStatus["Fechado"]} sub={`${conversion}% conversão`} color="#16a34a" />
        <MetricCard label="Em Andamento" value={byStatus["Contatado"]+byStatus["Proposta"]} color="#b8860b" />
        <MetricCard label="Perdidos" value={byStatus["Perdido"]} color="#dc2626" />
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, maxWidth:720 }}>
        <BarChart title="📍 Por Origem" data={bySource} colors={SOURCE_COLORS} />
        <BarChart title="🔄 Por Status" data={byStatus} colors={Object.fromEntries(STATUSES.map(s=>[s,{text:STATUS_COLORS[s].text}]))} />
      </div>
    </div>
  );
}

// =============================================
// MAIN APP
// =============================================
export default function App() {
  const [user, setUser] = useState(null);
  const [company, setCompany] = useState(null);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("leads");
  const [view, setView] = useState("kanban");
  const [modal, setModal] = useState(null); // null | {} | lead object
  const [filters, setFilters] = useState({ search:"", source:"", status:"", utm_campaign:"" });

  // Check session on mount
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session?.user) {
        const { data: members } = await supabase.from("company_members")
          .select("company_id, companies(*)").eq("user_id", data.session.user.id);
        if (members?.length) {
          setUser(data.session.user);
          setCompany(members[0].companies);
        }
      }
      setLoading(false);
    });
  }, []);

  const fetchLeads = useCallback(async () => {
    if (!company) return;
    const { data } = await supabase.from("leads")
      .select("*").eq("company_id", company.id).order("created_at", { ascending:false });
    setLeads(data || []);
  }, [company]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const handleAuth = (u, c) => { setUser(u); setCompany(c); };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null); setCompany(null); setLeads([]);
  };

  const handleDelete = async (id) => {
    if (!confirm("Remover este lead?")) return;
    await supabase.from("leads").delete().eq("id", id);
    fetchLeads();
  };

  const setFilter = (k,v) => setFilters(f=>({...f,[k]:v}));

  const filtered = useMemo(() => leads.filter(l => {
    const s = filters.search.toLowerCase();
    if (s && !l.name?.toLowerCase().includes(s) && !l.email?.toLowerCase().includes(s) && !l.phone?.includes(s)) return false;
    if (filters.source && l.source !== filters.source) return false;
    if (filters.status && l.status !== filters.status) return false;
    if (filters.utm_campaign && !l.utm_campaign?.toLowerCase().includes(filters.utm_campaign.toLowerCase())) return false;
    return true;
  }), [leads, filters]);

  if (loading) return <div style={{ minHeight:"100vh", display:"flex", alignItems:"center",
    justifyContent:"center", background:"#f8fafc", fontFamily:"'DM Sans',sans-serif" }}><Spinner /></div>;

  if (!user || !company) return <AuthScreen onAuth={handleAuth} />;

  const tabBtn = (t, label) => (
    <button onClick={()=>setTab(t)} style={{ padding:"10px 20px", borderRadius:8, border:"none",
      cursor:"pointer", fontSize:13, fontWeight:700,
      background: tab===t ? "#0f172a" : "transparent",
      color: tab===t ? "#fff" : "#94a3b8", transition:"all 0.2s" }}>{label}</button>
  );

  return (
    <div style={{ fontFamily:"'DM Sans','Segoe UI',sans-serif", background:"#f1f5f9", minHeight:"100vh" }}>
      {/* Header */}
      <div style={{ background:"#0f172a", color:"#fff", padding:"14px 28px",
        display:"flex", justifyContent:"space-between", alignItems:"center",
        boxShadow:"0 2px 12px #0004" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ width:38, height:38, borderRadius:11,
            background:"linear-gradient(135deg,#0ea5e9,#6366f1)",
            display:"flex", alignItems:"center", justifyContent:"center",
            fontWeight:900, fontSize:18, color:"#fff" }}>A</div>
          <div>
            <div style={{ fontWeight:900, fontSize:16, letterSpacing:-0.3 }}>AdLeads CRM</div>
            <div style={{ fontSize:11, color:"#64748b" }}>{company.name}</div>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:14 }}>
          <button onClick={()=>setModal({})} style={btnPrimary}>+ Novo Lead</button>
          <button onClick={handleLogout} style={{ ...btnSecondary, background:"transparent",
            border:"1px solid #334155", color:"#94a3b8", fontSize:12 }}>Sair</button>
        </div>
      </div>

      {/* Nav */}
      <div style={{ background:"#fff", borderBottom:"1px solid #e2e8f0",
        padding:"0 28px", display:"flex", gap:4 }}>
        {tabBtn("leads","📋 Leads")}
        {tabBtn("dashboard","📊 Dashboard")}
      </div>

      <div style={{ padding:"24px 28px" }}>
        {tab === "dashboard" && <Dashboard leads={leads} />}

        {tab === "leads" && (
          <div>
            <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom:16, alignItems:"center" }}>
              <input style={{ ...inputCss, minWidth:200, maxWidth:260 }}
                placeholder="🔍 Buscar nome, email..."
                value={filters.search} onChange={e=>setFilter("search",e.target.value)} />
              <select style={{ ...inputCss, width:"auto" }}
                value={filters.source} onChange={e=>setFilter("source",e.target.value)}>
                <option value="">Todas as origens</option>
                {SOURCES.map(s=><option key={s}>{s}</option>)}
              </select>
              <select style={{ ...inputCss, width:"auto" }}
                value={filters.status} onChange={e=>setFilter("status",e.target.value)}>
                <option value="">Todos os status</option>
                {STATUSES.map(s=><option key={s}>{s}</option>)}
              </select>
              <input style={{ ...inputCss, maxWidth:200 }}
                placeholder="Filtrar campaign..."
                value={filters.utm_campaign} onChange={e=>setFilter("utm_campaign",e.target.value)} />
              <div style={{ marginLeft:"auto", display:"flex", gap:8, alignItems:"center" }}>
                <button onClick={()=>exportCSV(filtered)} style={{ ...btnSecondary, fontSize:12 }}>⬇ CSV</button>
                <div style={{ display:"flex", background:"#f1f5f9", borderRadius:8, padding:3, gap:2 }}>
                  {[["kanban","⬛ Kanban"],["table","☰ Tabela"]].map(([v,l])=>(
                    <button key={v} onClick={()=>setView(v)} style={{ padding:"5px 14px", borderRadius:6,
                      border:"none", cursor:"pointer", fontSize:12, fontWeight:700,
                      background: view===v ? "#fff" : "transparent",
                      color: view===v ? "#0f172a" : "#94a3b8",
                      boxShadow: view===v ? "0 1px 4px #0001" : "none", transition:"all 0.2s" }}>{l}</button>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ fontSize:12, color:"#94a3b8", marginBottom:12 }}>{filtered.length} leads</div>

            <div style={{ background:"#fff", borderRadius:14, overflow:"hidden",
              boxShadow:"0 1px 8px #0001", border:"1px solid #e2e8f0",
              padding: view==="kanban" ? 16 : 0 }}>
              {view === "kanban"
                ? <KanbanView leads={filtered} onEdit={setModal} />
                : <TableView leads={filtered} onEdit={setModal} onDelete={handleDelete} />}
            </div>
          </div>
        )}
      </div>

      {modal !== null && (
        <LeadModal
          lead={modal?.id ? modal : null}
          companyId={company.id}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); fetchLeads(); }}
        />
      )}
    </div>
  );
}
