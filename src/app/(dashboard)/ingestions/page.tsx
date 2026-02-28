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
  const [showWaPaste, setShowWaPaste] = useState(false);
  const [htmlInput, setHtmlInput] = useState("");
  const [waInput, setWaInput] = useState("");
  const [waFrom, setWaFrom] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [checkingGmail, setCheckingGmail] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

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

  async function deleteIngestion(id: string) {
    if (!confirm("¿Eliminar esta ingestion y todos sus datos (cotizacion, destinatarios)? Esta accion no se puede deshacer.")) return;
    setDeleting(id);
    setMessage(null);
    try {
      const res = await fetch(`/api/ingestions/${id}`, { method: "DELETE" });
      if (res.ok) {
        setMessage({ type: "success", text: "Ingestion eliminada correctamente." });
        setIngestions((prev) => prev.filter((i) => i.id !== id));
      } else {
        const json = await res.json();
        setMessage({ type: "error", text: json.error || "Error al eliminar" });
      }
    } catch {
      setMessage({ type: "error", text: "Error de conexion" });
    } finally {
      setDeleting(null);
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

  async function submitWhatsApp() {
    if (!waInput.trim()) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/ingestions/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: waInput, from: waFrom }),
      });
      const json = await res.json();
      if (res.ok && !json.skipped) {
        setMessage({ type: "success", text: json.message });
        setWaInput("");
        setWaFrom("");
        setShowWaPaste(false);
        loadIngestions();
      } else if (json.skipped) {
        setMessage({ type: "error", text: json.message });
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
            onClick={() => { setShowWaPaste(!showWaPaste); setShowPaste(false); }}
            className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            Pegar WhatsApp
          </button>
          <button
            onClick={() => { setShowPaste(!showPaste); setShowWaPaste(false); }}
            className="px-4 py-2 text-sm bg-[#1a365d] text-white rounded-lg hover:bg-[#2a4a7d]"
          >
            + Email HTML
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

      {/* WhatsApp Paste Form */}
      {showWaPaste && (
        <div className="bg-white border border-green-200 rounded-xl p-6 mb-6 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <svg className="w-5 h-5 text-green-600" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            <h2 className="text-lg font-semibold text-gray-900">Pegar mensaje de WhatsApp</h2>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Copia el texto del mensaje del proveedor y pégalo aquí. Sin LLM — costo cero.
          </p>
          <input
            value={waFrom}
            onChange={(e) => setWaFrom(e.target.value)}
            placeholder="Teléfono o nombre del proveedor (opcional, ej. +51999999999)"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 mb-3"
          />
          <textarea
            value={waInput}
            onChange={(e) => setWaInput(e.target.value)}
            placeholder={"Pega el mensaje aquí, ej:\n3x40FT GP5500 US$ 1245 CFR 25KG Org bags\nShipment: Feb 2026"}
            className="w-full h-36 p-4 border border-gray-300 rounded-lg font-mono text-sm resize-y focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <div className="flex gap-3 mt-4">
            <button
              onClick={submitWhatsApp}
              disabled={submitting || !waInput.trim()}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium"
            >
              {submitting ? "Procesando..." : "Procesar mensaje"}
            </button>
            <button
              onClick={() => { setShowWaPaste(false); setWaInput(""); setWaFrom(""); }}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
          </div>
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
                    <div className="flex items-center gap-2">
                      {ing.source_type === "whatsapp" ? (
                        <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                          </svg>
                          WA
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">✉</span>
                      )}
                      {ing.source_subject || (ing.source_type === "whatsapp" ? "WhatsApp" : "Manual paste")}
                    </div>
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
                    <div className="flex items-center justify-end gap-3">
                      <Link
                        href={`/ingestions/${ing.id}`}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        Ver detalle
                      </Link>
                      <button
                        onClick={() => deleteIngestion(ing.id)}
                        disabled={deleting === ing.id}
                        className="text-red-500 hover:text-red-700 disabled:opacity-40"
                        title="Eliminar ingestion"
                      >
                        {deleting === ing.id ? (
                          <span className="text-xs">...</span>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        )}
                      </button>
                    </div>
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
