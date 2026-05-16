import { useState, useRef } from "react";
import axios from "axios";
import { Toaster } from "react-hot-toast";
import toast from "react-hot-toast";
import { UploadCloud, FileText, Loader2, Brain, BarChart2, Table, Sparkles, ArrowRight } from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend
} from "recharts";

const API = import.meta.env.VITE_API_URL ?? "";
const COLORS = ["#22c55e", "#3b82f6", "#f59e0b", "#ec4899", "#8b5cf6", "#06b6d4"];

const fmtNum = (v) => {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
  return String(v);
};

const truncate = (str, n = 12) => str?.length > n ? str.slice(0, n) + "…" : str;

const tooltipStyle = {
  background: "#111",
  border: "1px solid #222",
  borderRadius: 10,
  color: "#e5e7eb",
  fontSize: 12,
  padding: "8px 12px",
};

function StatCard({ label, value, delay = 0 }) {
  return (
    <div
      className="fade-up rounded-2xl p-6 flex flex-col gap-1"
      style={{
        animationDelay: `${delay}ms`,
        background: "linear-gradient(135deg, #111 0%, #0e0e0e 100%)",
        border: "1px solid #1c1c1c",
      }}
    >
      <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, letterSpacing: "0.08em", color: "#4b5563", textTransform: "uppercase" }}>{label}</p>
      <p style={{ fontFamily: "'Syne', sans-serif", fontSize: 32, fontWeight: 700, color: "#fff", lineHeight: 1.1 }}>{value}</p>
    </div>
  );
}

function ChartCard({ chart, delay = 0 }) {
  const data = chart.data.map(d => ({ ...d, name: truncate(String(d.name)) }));

  const renderChart = () => {
    if (chart.type === "bar" || chart.type === "histogram") {
      return (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 44 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#161616" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: "#4b5563", fontSize: 10, fontFamily: "Inter" }} angle={-35} textAnchor="end" interval={0} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#374151", fontSize: 10, fontFamily: "Inter" }} tickFormatter={fmtNum} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
            <Bar dataKey="value" fill="#22c55e" radius={[5, 5, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
      );
    }
    if (chart.type === "line") {
      return (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 44 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#161616" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: "#4b5563", fontSize: 10, fontFamily: "Inter" }} angle={-35} textAnchor="end" interval={0} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#374151", fontSize: 10, fontFamily: "Inter" }} tickFormatter={fmtNum} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={tooltipStyle} />
            <Line type="monotone" dataKey="value" stroke="#22c55e" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: "#22c55e" }} />
          </LineChart>
        </ResponsiveContainer>
      );
    }
    if (chart.type === "pie") {
      return (
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="45%" outerRadius={80} innerRadius={45} paddingAngle={2}>
              {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
            <Legend iconType="circle" iconSize={7} formatter={(v) => <span style={{ color: "#6b7280", fontSize: 11, fontFamily: "Inter" }}>{v}</span>} />
          </PieChart>
        </ResponsiveContainer>
      );
    }
    return null;
  };

  return (
    <div className="fade-up rounded-2xl p-5" style={{ animationDelay: `${delay}ms`, background: "#0e0e0e", border: "1px solid #1c1c1c" }}>
      <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 10, letterSpacing: "0.1em", color: "#374151", textTransform: "uppercase", fontWeight: 600, marginBottom: 16 }}>{chart.title}</p>
      {renderChart()}
    </div>
  );
}

function ColumnBadge({ type }) {
  const map = {
    numeric:     { bg: "rgba(34,197,94,0.08)", color: "#22c55e", border: "rgba(34,197,94,0.15)" },
    categorical: { bg: "rgba(59,130,246,0.08)", color: "#60a5fa", border: "rgba(59,130,246,0.15)" },
    date:        { bg: "rgba(139,92,246,0.08)", color: "#a78bfa", border: "rgba(139,92,246,0.15)" },
  };
  const s = map[type] || { bg: "rgba(107,114,128,0.08)", color: "#6b7280", border: "rgba(107,114,128,0.15)" };
  return (
    <span style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}`, fontSize: 10, fontFamily: "Inter", fontWeight: 600, letterSpacing: "0.05em", padding: "2px 8px", borderRadius: 99 }}>
      {type}
    </span>
  );
}

function AIInsights({ text }) {
  if (!text) return null;
  const lines = text.split("\n").filter(l => l.trim());
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {lines.map((line, i) => {
        const clean = line.replace(/\*\*/g, "").trim();
        if (clean.match(/^#+\s/) || (clean.endsWith(":") && clean.length < 60)) {
          return (
            <p key={i} style={{ fontFamily: "'Syne', sans-serif", fontSize: 13, fontWeight: 700, color: "#fff", marginTop: i > 0 ? 8 : 0 }}>
              {clean.replace(/^#+\s/, "")}
            </p>
          );
        }
        if (clean.match(/^[-•*]\s/) || clean.match(/^\d+\.\s/)) {
          return (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#22c55e", marginTop: 6, flexShrink: 0 }} />
              <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: "#9ca3af", lineHeight: 1.6 }}>
                {clean.replace(/^[-•*\d.]\s+/, "")}
              </p>
            </div>
          );
        }
        return <p key={i} style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: "#6b7280", lineHeight: 1.7 }}>{clean}</p>;
      })}
    </div>
  );
}

export default function App() {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const inputRef = useRef(null);

  const analyze = async (file) => {
    if (!file || !file.name.toLowerCase().endsWith(".csv")) {
      toast.error("Solo se aceptan archivos CSV");
      return;
    }
    setLoading(true);
    setResult(null);
    const form = new FormData();
    form.append("file", file);
    try {
      const { data } = await axios.post(`${API}/analyze`, form);
      setResult(data);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al analizar el archivo");
    } finally {
      setLoading(false);
    }
  };

  const onDrop = (e) => { e.preventDefault(); setDragging(false); analyze(e.dataTransfer.files[0]); };
  const onFileChange = (e) => analyze(e.target.files[0]);
  const reset = () => { setResult(null); if (inputRef.current) inputRef.current.value = ""; };

  const loadSample = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/sample.csv");
      const blob = await res.blob();
      const file = new File([blob], "ventas-2024.csv", { type: "text/csv" });
      const form = new FormData();
      form.append("file", file);
      const { data } = await axios.post(`${API}/analyze`, form);
      setResult(data);
    } catch {
      toast.error("Error cargando los datos de ejemplo");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#060606" }}>
      <Toaster position="top-right" toastOptions={{ style: { background: "#111", color: "#f1f5f9", border: "1px solid #222", borderRadius: 12, fontSize: 13, fontFamily: "Inter" } }} />

      {/* Header */}
      <header style={{ borderBottom: "1px solid #111", padding: "16px 40px", display: "flex", alignItems: "center", gap: 12, position: "sticky", top: 0, background: "rgba(6,6,6,0.92)", backdropFilter: "blur(12px)", zIndex: 10 }}>
        <div style={{ width: 32, height: 32, background: "#22c55e", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Brain size={15} color="#000" />
        </div>
        <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 16, color: "#fff", letterSpacing: "-0.02em" }}>
          DataAnalytic <span style={{ color: "#22c55e" }}>IA</span>
        </span>
        <span style={{ marginLeft: "auto", fontFamily: "Inter", fontSize: 11, color: "#374151", letterSpacing: "0.05em" }}>POWERED BY GEMINI</span>
      </header>

      <main style={{ maxWidth: 900, margin: "0 auto", padding: "0 24px 80px" }}>

        {/* Upload */}
        {!result && !loading && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "80vh", textAlign: "center" }}>
            <div className="fade-up" style={{ marginBottom: 48 }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(34,197,94,0.08)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.15)", borderRadius: 99, padding: "6px 14px", fontSize: 11, fontFamily: "Inter", fontWeight: 600, letterSpacing: "0.08em", marginBottom: 28 }}>
                <Sparkles size={11} /> ANÁLISIS CON INTELIGENCIA ARTIFICIAL
              </div>
              <h1 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 52, lineHeight: 1.05, letterSpacing: "-0.03em", color: "#fff", marginBottom: 16 }}>
                Sube tu CSV.<br />
                <span style={{ color: "#1f2937" }}>La IA hace el resto.</span>
              </h1>
              <p style={{ fontFamily: "Inter", fontSize: 14, color: "#374151", maxWidth: 380, margin: "0 auto", lineHeight: 1.7 }}>
                Gráficas automáticas, estadísticas e insights generados por Gemini en segundos.
              </p>
            </div>

            <div
              className="fade-up-d1"
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              style={{
                width: "100%", maxWidth: 480, borderRadius: 20, padding: "56px 40px", cursor: "pointer", transition: "all 0.2s",
                border: dragging ? "2px dashed #22c55e" : "2px dashed #1a1a1a",
                background: dragging ? "rgba(34,197,94,0.04)" : "#0a0a0a",
              }}
            >
              <input ref={inputRef} type="file" accept=".csv" style={{ display: "none" }} onChange={onFileChange} />
              <UploadCloud size={36} color={dragging ? "#22c55e" : "#1f2937"} style={{ margin: "0 auto 16px", display: "block" }} />
              <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: 600, fontSize: 15, color: "#d1d5db", marginBottom: 6 }}>Arrastra tu CSV aquí</p>
              <p style={{ fontFamily: "Inter", fontSize: 12, color: "#374151" }}>o haz clic para seleccionar</p>
              <div style={{ display: "flex", justifyContent: "center", gap: 20, marginTop: 24 }}>
                {["Ventas", "Gastos", "Cualquier dataset"].map(t => (
                  <span key={t} style={{ fontFamily: "Inter", fontSize: 11, color: "#1f2937" }}>✓ {t}</span>
                ))}
              </div>
            </div>

            <button
              className="fade-up-d2"
              onClick={loadSample}
              style={{ marginTop: 20, background: "none", border: "none", cursor: "pointer", fontFamily: "Inter", fontSize: 12, color: "#374151", display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 99, transition: "color 0.2s" }}
              onMouseEnter={e => e.currentTarget.style.color = "#22c55e"}
              onMouseLeave={e => e.currentTarget.style.color = "#374151"}
            >
              <Sparkles size={11} /> Probar con datos de ejemplo
            </button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "80vh", gap: 16 }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Loader2 size={20} color="#22c55e" className="animate-spin" />
            </div>
            <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: 600, fontSize: 16, color: "#d1d5db" }}>Analizando dataset...</p>
            <p style={{ fontFamily: "Inter", fontSize: 12, color: "#374151" }}>Gemini está generando los insights</p>
          </div>
        )}

        {/* Results */}
        {result && (
          <div style={{ paddingTop: 40, display: "flex", flexDirection: "column", gap: 24 }}>

            {/* File bar */}
            <div className="fade-up" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#0a0a0a", border: "1px solid #161616", borderRadius: 16, padding: "14px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 36, height: 36, background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.15)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <FileText size={15} color="#22c55e" />
                </div>
                <div>
                  <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: 600, fontSize: 13, color: "#fff" }}>{result.filename}</p>
                  <p style={{ fontFamily: "Inter", fontSize: 11, color: "#374151", marginTop: 1 }}>{result.rows.toLocaleString()} filas · {result.cols} columnas</p>
                </div>
              </div>
              <button onClick={reset} style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "Inter", fontSize: 12, color: "#4b5563", background: "#111", border: "1px solid #1a1a1a", borderRadius: 10, padding: "8px 14px", cursor: "pointer" }}>
                Analizar otro <ArrowRight size={12} />
              </button>
            </div>

            {/* Stats */}
            <div className="fade-up-d1" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              <StatCard label="Total filas" value={result.rows.toLocaleString()} />
              <StatCard label="Columnas" value={result.cols} delay={60} />
              <StatCard label="Campos vacíos" value={result.columns.reduce((a, c) => a + c.nulls, 0).toLocaleString()} delay={120} />
            </div>

            {/* Charts */}
            {result.charts.length > 0 && (
              <div className="fade-up-d2">
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                  <BarChart2 size={13} color="#22c55e" />
                  <p style={{ fontFamily: "Inter", fontSize: 10, fontWeight: 600, color: "#374151", letterSpacing: "0.1em", textTransform: "uppercase" }}>Visualizaciones</p>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
                  {result.charts.map((c, i) => <ChartCard key={i} chart={c} delay={i * 50} />)}
                </div>
              </div>
            )}

            {/* AI Insights */}
            <div className="fade-up-d3" style={{ background: "#0a0a0a", border: "1px solid #161616", borderRadius: 20, padding: 28 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
                <div style={{ width: 28, height: 28, background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.15)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Sparkles size={12} color="#22c55e" />
                </div>
                <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 14, color: "#fff" }}>Insights de IA</p>
                <span style={{ fontFamily: "Inter", fontSize: 10, color: "#1f2937", marginLeft: 4, letterSpacing: "0.05em" }}>— GEMINI</span>
              </div>
              <AIInsights text={result.ai_insights} />
            </div>

            {/* Columns table */}
            <div className="fade-up-d3">
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <Table size={13} color="#22c55e" />
                <p style={{ fontFamily: "Inter", fontSize: 10, fontWeight: 600, color: "#374151", letterSpacing: "0.1em", textTransform: "uppercase" }}>Columnas del dataset</p>
              </div>
              <div style={{ background: "#0a0a0a", border: "1px solid #161616", borderRadius: 16, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #111" }}>
                      {["Nombre", "Tipo", "Únicos", "Nulos"].map((h, i) => (
                        <th key={h} style={{ padding: "12px 20px", textAlign: i >= 2 ? "right" : "left", fontFamily: "Inter", fontSize: 10, fontWeight: 600, color: "#1f2937", letterSpacing: "0.08em", textTransform: "uppercase" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.columns.map((col, i) => (
                      <tr key={col.name} style={{ borderBottom: i < result.columns.length - 1 ? "1px solid rgba(255,255,255,0.03)" : "none" }}>
                        <td style={{ padding: "12px 20px", fontFamily: "'Syne', sans-serif", fontSize: 13, fontWeight: 600, color: "#e5e7eb" }}>{col.name}</td>
                        <td style={{ padding: "12px 20px" }}><ColumnBadge type={col.type} /></td>
                        <td style={{ padding: "12px 20px", textAlign: "right", fontFamily: "Inter", fontSize: 12, color: "#4b5563", fontVariantNumeric: "tabular-nums" }}>{col.unique.toLocaleString()}</td>
                        <td style={{ padding: "12px 20px", textAlign: "right", fontFamily: "Inter", fontSize: 12, fontVariantNumeric: "tabular-nums", color: col.nulls > 0 ? "#f59e0b" : "#1f2937" }}>{col.nulls.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Preview */}
            <div className="fade-up-d3">
              <p style={{ fontFamily: "Inter", fontSize: 10, fontWeight: 600, color: "#1f2937", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>Vista previa — primeras 5 filas</p>
              <div style={{ background: "#0a0a0a", border: "1px solid #161616", borderRadius: 16, overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #111" }}>
                      {result.columns.map(c => (
                        <th key={c.name} style={{ padding: "10px 16px", textAlign: "left", fontFamily: "Inter", fontSize: 10, fontWeight: 600, color: "#1f2937", whiteSpace: "nowrap", letterSpacing: "0.05em" }}>{c.name}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.preview.map((row, i) => (
                      <tr key={i} style={{ borderBottom: i < 4 ? "1px solid rgba(255,255,255,0.02)" : "none" }}>
                        {result.columns.map(c => (
                          <td key={c.name} style={{ padding: "10px 16px", fontFamily: "Inter", fontSize: 11, color: "#374151", whiteSpace: "nowrap" }}>
                            {row[c.name] == null ? <span style={{ color: "#1a1a1a" }}>—</span> : String(row[c.name])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}
      </main>

      <footer style={{ borderTop: "1px solid #0d0d0d", padding: "20px 40px", textAlign: "center", fontFamily: "Inter", fontSize: 11, color: "#1a1a1a", letterSpacing: "0.05em" }}>
        DATAANALYTIC IA — CAMILO CALDERÓN · 2026
      </footer>
    </div>
  );
}
