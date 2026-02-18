"use client";

import { useState } from "react";
import Link from "next/link";

interface Ingestion {
  id: string;
  source_type: string;
  source_subject: string | null;
  source_from: string | null;
  status: string;
  grades_found: number;
  grades_matched: number;
  grades_unknown: number;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  processing: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
  partial: "bg-orange-100 text-orange-800",
};

export default function IngestionsPage() {
  const [ingestions, setIngestions] = useState<Ingestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPaste, setShowPaste] = useState(false);
  const [htmlInput, setHtmlInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [checkingGmail, setCheckingGmail] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function loadIngestions() {
    setLoading(true);
    try {
      const res = await fetch("/api/ingestions");
      const json = await res.json();
      setIngestions(json.data || []);
    } catch {
      setMessage({ type: "error", text: "Error al cargar ingestiones" });
    } finally {
      setLoading(false);
    }
  }

  async function checkGmail() {
    setCheckingGmail(true);
    setMessage(null);
    try {
      const res = await fetch("/api/gmail/check");
      const json = await res.json();
      if (res.ok) {
        const { emails } = json;
        if (emails?.processed > 0) {
          setMessage({ type: "success", text: `Gmail: ${emails.processed} email(s) nuevos procesados` });
          loadIngestions();
        } else {
          setMessage({ type: "success", text: "Gmail revisado - no hay emails nuevos con etiqueta COTIZAR" });
        }
      } else {
        setMessage({ type: "error", text: json.error || "Error al revisar Gmail" });
      }
    } catch {
      setMessage({ type: "error", text: "Error de conexion" });
    } finally {
      setCheckingGmail(false);
    }
  }

  async function submitHtml() {
    if (!htmlInput.trim()) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/ingestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawHtml: htmlInput }),
      });
      const json = await res.json();
      if (res.ok) {
        setMessage({
          type: "success",
          text: `Ingestion creada: ${json.parsed?.gradesExpanded || 0} grados encontrados`,
        });
        setHtmlInput("");
        setShowPaste(false);
        loadIngestions();
      } else {
        setMessage({ type: "error", text: json.error || "Error al procesar" });
      }
    } catch {
      setMessage({ type: "error", text: "Error de conexion" });
    } finally {
      setSubmitting(false);
    }
  }

  // Load on first render
  if (ingestions.length === 0 && !loading) {
    loadIngestions();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ingestiones de Precios</h1>
          <p className="text-sm text-gray-500 mt-1">Emails procesados con precios de proveedores</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={loadIngestions}
            disabled={loading}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            {loading ? "Cargando..." : "Actualizar"}
          </button>
          <button
            onClick={checkGmail}
            disabled={checkingGmail}
            className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
            </svg>
            {checkingGmail ? "Revisando..." : "Revisar Gmail"}
          </button>
          <button
            onClick={() => setShowPaste(!showPaste)}
            className="px-4 py-2 text-sm bg-[#1a365d] text-white rounded-lg hover:bg-[#2a4a7d]"
          >
            + Nueva Ingestion
          </button>
        </div>
      </div>

      {message && (
        <div
          className={`p-4 rounded-lg mb-4 text-sm ${
            message.type === "success" ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Paste HTML Form */}
      {showPaste && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-3">Pegar HTML del Email</h2>
          <p className="text-sm text-gray-500 mb-4">
            Copia el contenido HTML del email del proveedor con la tabla de precios.
          </p>
          <textarea
            value={htmlInput}
            onChange={(e) => setHtmlInput(e.target.value)}
            placeholder="<table>...<tr><td>JM-350</td><td>1,000</td></tr>...</table>"
            className="w-full h-48 p-4 border border-gray-300 rounded-lg font-mono text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex gap-3 mt-4">
            <button
              onClick={submitHtml}
              disabled={submitting || !htmlInput.trim()}
              className="px-6 py-2 bg-[#1a365d] text-white rounded-lg hover:bg-[#2a4a7d] disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              {submitting ? "Procesando..." : "Procesar Email"}
            </button>
            <button
              onClick={() => { setShowPaste(false); setHtmlInput(""); }}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Ingestions Table */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-6 py-3 font-medium text-gray-500">Fecha</th>
              <th className="text-left px-6 py-3 font-medium text-gray-500">Asunto</th>
              <th className="text-left px-6 py-3 font-medium text-gray-500">Remitente</th>
              <th className="text-center px-6 py-3 font-medium text-gray-500">Grados</th>
              <th className="text-center px-6 py-3 font-medium text-gray-500">Matched</th>
              <th className="text-center px-6 py-3 font-medium text-gray-500">Estado</th>
              <th className="text-right px-6 py-3 font-medium text-gray-500">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                  Cargando...
                </td>
              </tr>
            ) : ingestions.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                  No hay ingestiones. Usa &quot;Nueva Ingestion&quot; para empezar.
                </td>
              </tr>
            ) : (
              ingestions.map((ing) => (
                <tr key={ing.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-gray-600">
                    {new Date(ing.created_at).toLocaleDateString("es-PE", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="px-6 py-4 text-gray-900 font-medium">
                    {ing.source_subject || "Manual paste"}
                  </td>
                  <td className="px-6 py-4 text-gray-600">{ing.source_from || "-"}</td>
                  <td className="px-6 py-4 text-center">{ing.grades_found}</td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-green-600">{ing.grades_matched}</span>
                    {ing.grades_unknown > 0 && (
                      <span className="text-red-500 ml-1">/ {ing.grades_unknown} ?</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[ing.status] || "bg-gray-100 text-gray-800"}`}
                    >
                      {ing.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      href={`/ingestions/${ing.id}`}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      Ver detalle
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
