"use client";

import { useState, useEffect } from "react";

interface ParsedRow {
  grade: string;
  expandedGrades: string[];
  price: number | null;
  rawPrice: string;
  incoterm: string;
  port: string;
}

interface FormatExample {
  id: string;
  supplier_name: string;
  raw_text: string;
  verified_rows: ParsedRow[];
  notes: string;
  created_at: string;
}

export default function FormatsPage() {
  const [examples, setExamples] = useState<FormatExample[]>([]);
  const [loading, setLoading] = useState(true);

  // Test area state
  const [testText, setTestText] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [notes, setNotes] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parsedRows, setParsedRows] = useState<ParsedRow[] | null>(null);
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    loadExamples();
  }, []);

  async function loadExamples() {
    setLoading(true);
    const res = await fetch("/api/formats");
    const json = await res.json();
    setExamples(json.data || []);
    setLoading(false);
  }

  async function parseText() {
    if (!testText.trim()) return;
    setParsing(true);
    setParsedRows(null);
    setParseWarnings([]);
    setMessage(null);
    try {
      const res = await fetch("/api/formats/parse-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: testText }),
      });
      const json = await res.json();
      if (res.ok) {
        setParsedRows(json.rows || []);
        setParseWarnings(json.warnings || []);
      } else {
        setMessage({ type: "error", text: json.error });
      }
    } finally {
      setParsing(false);
    }
  }

  async function saveExample() {
    if (!testText.trim() || !parsedRows) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/formats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierName,
          rawText: testText,
          verifiedRows: parsedRows,
          notes,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: "Ejemplo guardado en el banco." });
        setTestText("");
        setSupplierName("");
        setNotes("");
        setParsedRows(null);
        loadExamples();
      } else {
        setMessage({ type: "error", text: json.error });
      }
    } finally {
      setSaving(false);
    }
  }

  async function deleteExample(id: string) {
    if (!confirm("¿Eliminar este ejemplo del banco?")) return;
    setDeleting(id);
    const res = await fetch(`/api/formats?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      setExamples((prev) => prev.filter((e) => e.id !== id));
    }
    setDeleting(null);
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Banco de Formatos</h1>
        <p className="text-sm text-gray-500 mt-1">
          Pega ejemplos de correos de proveedores para probar el parser y guardarlos como referencia.
        </p>
      </div>

      {message && (
        <div className={`p-4 rounded-lg mb-5 text-sm ${message.type === "success" ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"}`}>
          {message.text}
        </div>
      )}

      {/* ── TEST AREA ──────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6 shadow-sm">
        <h2 className="text-base font-semibold text-gray-900 mb-1">Probar Parser</h2>
        <p className="text-xs text-gray-500 mb-4">
          Pega el texto o HTML del correo del proveedor. El sistema extrae los grados y precios.
        </p>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Proveedor (opcional)</label>
            <input
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              placeholder="ej. Nhat Huy, Sinopec, LG Chem..."
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Notas (opcional)</label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="ej. formato tabla con 4 columnas, o líneas con @"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <textarea
          value={testText}
          onChange={(e) => setTestText(e.target.value)}
          placeholder={`Pega aquí el texto del correo. Por ejemplo:\n\nBlue PC Sinopec PC02-20UR @ US $1985/mt CFR PECLL\nTransparent PC Sinopec PC02-30 @ US $1985/mt CFR PECLL\n\nO pega directamente el HTML del email.`}
          className="w-full h-44 p-4 border border-gray-300 rounded-lg font-mono text-xs resize-y focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
        />

        <button
          onClick={parseText}
          disabled={parsing || !testText.trim()}
          className="px-5 py-2 bg-[#1a365d] text-white rounded-lg hover:bg-[#2a4a7d] disabled:opacity-50 text-sm font-medium"
        >
          {parsing ? "Parseando..." : "Parsear"}
        </button>

        {/* Parse result */}
        {parsedRows !== null && (
          <div className="mt-5">
            {parseWarnings.length > 0 && (
              <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                {parseWarnings.map((w, i) => (
                  <p key={i} className="text-xs text-yellow-800">{w}</p>
                ))}
              </div>
            )}

            {parsedRows.length === 0 ? (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                No se extrajeron grados ni precios. Intenta con otro formato o ajusta el texto.
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-gray-700">
                    {parsedRows.length} grado(s) extraído(s)
                    <span className="ml-2 text-xs text-gray-400 font-normal">— revisa que sean correctos antes de guardar</span>
                  </p>
                  <button
                    onClick={saveExample}
                    disabled={saving}
                    className="px-4 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-xs font-medium disabled:opacity-50"
                  >
                    {saving ? "Guardando..." : "Guardar en banco"}
                  </button>
                </div>

                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Grado (raw)</th>
                        <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Expandidos</th>
                        <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">Precio USD</th>
                        <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Incoterm</th>
                        <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Puerto</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {parsedRows.map((row, i) => (
                        <tr key={i} className={row.price ? "" : "bg-red-50"}>
                          <td className="px-4 py-2 font-mono text-xs text-gray-800">{row.grade}</td>
                          <td className="px-4 py-2 text-xs text-gray-500">
                            {row.expandedGrades.join(", ")}
                          </td>
                          <td className="px-4 py-2 text-right font-bold text-blue-700">
                            {row.price ? `$${row.price.toLocaleString("en-US", { minimumFractionDigits: 0 })}` : <span className="text-red-400 font-normal">—</span>}
                          </td>
                          <td className="px-4 py-2 text-xs text-gray-500">{row.incoterm}</td>
                          <td className="px-4 py-2 text-xs text-gray-500">{row.port}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── EXAMPLE BANK ───────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Banco de Ejemplos</h2>
            <p className="text-xs text-gray-500 mt-0.5">{examples.length} formato(s) guardado(s)</p>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Cargando...</div>
        ) : examples.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">
            Aún no hay ejemplos guardados. Prueba un formato arriba y guárdalo.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {examples.map((ex) => (
              <div key={ex.id} className="px-6 py-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <p className="font-medium text-gray-900 text-sm">
                        {ex.supplier_name || <span className="text-gray-400 italic">Sin nombre</span>}
                      </p>
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                        {ex.verified_rows.length} grado(s)
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(ex.created_at).toLocaleDateString("es-PE")}
                      </span>
                    </div>
                    {ex.notes && (
                      <p className="text-xs text-gray-500 mb-2">{ex.notes}</p>
                    )}

                    {/* Toggle raw text */}
                    <button
                      onClick={() => setExpandedId(expandedId === ex.id ? null : ex.id)}
                      className="text-xs text-blue-600 hover:underline mb-2"
                    >
                      {expandedId === ex.id ? "Ocultar texto" : "Ver texto original"}
                    </button>
                    {expandedId === ex.id && (
                      <pre className="text-xs bg-gray-50 border border-gray-200 rounded p-3 whitespace-pre-wrap font-mono text-gray-700 mb-2 max-h-40 overflow-auto">
                        {ex.raw_text}
                      </pre>
                    )}

                    {/* Verified rows summary */}
                    {ex.verified_rows.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {ex.verified_rows.map((row, i) => (
                          <span key={i} className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                            <span className="font-mono font-medium">{row.grade}</span>
                            <span className="text-gray-400">→</span>
                            <span className="text-blue-700 font-semibold">
                              ${row.price?.toLocaleString("en-US") ?? "?"}
                            </span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => deleteExample(ex.id)}
                    disabled={deleting === ex.id}
                    className="ml-4 p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-40"
                    title="Eliminar ejemplo"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800 space-y-1">
        <p className="font-semibold">Formatos que el parser entiende actualmente:</p>
        <p>• <strong>Tabla HTML con columna "Grade"</strong> — detecta automáticamente por header (Nhat Huy, CPI, etc.)</p>
        <p>• <strong>Texto con @</strong> — <code className="bg-blue-100 px-1 rounded">GRADO @ US $PRECIO/mt CFR PECLL</code></p>
        <p>• <strong>Texto con separador</strong> — <code className="bg-blue-100 px-1 rounded">GRADO — PRECIO</code> o <code className="bg-blue-100 px-1 rounded">GRADO: PRECIO</code></p>
        <p className="pt-1 text-blue-600">Si un formato no funciona, pégalo aquí, reportá qué extrajo mal, y ajustamos el parser.</p>
      </div>
    </div>
  );
}
