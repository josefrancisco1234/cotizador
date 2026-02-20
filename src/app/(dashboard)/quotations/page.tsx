"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface QuotationItem {
  price_usd: number;
  grade: {
    grade_code: string;
    uso: string | null;
    family: { code: string; display_name: string };
  } | null;
}

interface Quotation {
  id: string;
  title: string | null;
  status: string;
  total_recipients: number;
  total_dispatched: number;
  created_at: string;
  ingestion: {
    source_subject: string | null;
    source_from: string | null;
    created_at: string | null;
  } | null;
  items: QuotationItem[];
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800",
  approved: "bg-blue-100 text-blue-800",
  sending: "bg-yellow-100 text-yellow-800",
  sent: "bg-green-100 text-green-800",
  partially_sent: "bg-orange-100 text-orange-800",
  failed: "bg-red-100 text-red-800",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Borrador",
  approved: "Aprobada",
  sending: "Enviando",
  sent: "Enviada",
  partially_sent: "Parcial",
  failed: "Fallida",
};

/** Build a deduplicated list of "Familia (Uso)" tags for the items */
function buildMaterialTags(items: QuotationItem[]): { label: string; uso: string }[] {
  const seen = new Set<string>();
  const tags: { label: string; uso: string }[] = [];
  for (const item of items) {
    if (!item.grade) continue;
    const family = item.grade.family.display_name;
    const uso = item.grade.uso || "";
    const key = `${family}|${uso}`;
    if (!seen.has(key)) {
      seen.add(key);
      tags.push({ label: family, uso });
    }
  }
  return tags;
}

/** Shorten email sender to just the name part */
function senderName(from: string | null): string {
  if (!from) return "";
  // "Angelica Gutierrez <angelica@icdgroup.com>" → "Angelica Gutierrez"
  const match = from.match(/^([^<]+)</);
  return match ? match[1].trim() : from.split("@")[0];
}

export default function QuotationsPage() {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadQuotations();
  }, []);

  async function loadQuotations() {
    setLoading(true);
    try {
      const res = await fetch("/api/quotations");
      const json = await res.json();
      setQuotations(json.data || []);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cotizaciones</h1>
          <p className="text-sm text-gray-500 mt-1">Cotizaciones generadas por el motor de matching</p>
        </div>
        <button
          onClick={loadQuotations}
          className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Actualizar
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Fecha</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Email origen</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Materiales / Uso</th>
              <th className="text-center px-4 py-3 font-medium text-gray-500">Dest.</th>
              <th className="text-center px-4 py-3 font-medium text-gray-500">Enviados</th>
              <th className="text-center px-4 py-3 font-medium text-gray-500">Estado</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-400">Cargando...</td>
              </tr>
            ) : quotations.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                  No hay cotizaciones. Procesa una ingestion para generar cotizaciones.
                </td>
              </tr>
            ) : (
              quotations.map((q) => {
                const tags = buildMaterialTags(q.items || []);
                return (
                  <tr key={q.id} className="hover:bg-gray-50">

                    {/* Fecha */}
                    <td className="px-4 py-4 text-gray-500 whitespace-nowrap text-xs">
                      {new Date(q.created_at).toLocaleDateString("es-PE", {
                        day: "2-digit", month: "short", year: "numeric",
                      })}
                    </td>

                    {/* Email origen */}
                    <td className="px-4 py-4 max-w-[220px]">
                      {q.ingestion ? (
                        <>
                          <p className="font-medium text-gray-900 text-xs truncate" title={q.ingestion.source_subject || ""}>
                            {q.ingestion.source_subject || "Manual"}
                          </p>
                          <p className="text-xs text-gray-400 truncate" title={q.ingestion.source_from || ""}>
                            {senderName(q.ingestion.source_from)}
                            {q.ingestion.created_at && (
                              <span className="ml-1 text-gray-300">
                                · {new Date(q.ingestion.created_at).toLocaleDateString("es-PE", { day: "2-digit", month: "short" })}
                              </span>
                            )}
                          </p>
                        </>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>

                    {/* Materiales / Uso */}
                    <td className="px-4 py-4 max-w-[260px]">
                      <div className="flex flex-wrap gap-1">
                        {tags.length === 0 ? (
                          <span className="text-gray-400 text-xs">—</span>
                        ) : (
                          tags.map((t, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-50 text-blue-700 border border-blue-100"
                            >
                              {t.label}
                              {t.uso && (
                                <span className="ml-1 text-blue-400">({t.uso})</span>
                              )}
                            </span>
                          ))
                        )}
                      </div>
                    </td>

                    {/* Destinatarios */}
                    <td className="px-4 py-4 text-center text-gray-700">{q.total_recipients}</td>

                    {/* Enviados */}
                    <td className="px-4 py-4 text-center">
                      <span className={q.total_dispatched > 0 ? "text-green-600 font-medium" : "text-gray-400"}>
                        {q.total_dispatched}
                      </span>
                    </td>

                    {/* Estado */}
                    <td className="px-4 py-4 text-center">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[q.status] || "bg-gray-100"}`}>
                        {STATUS_LABELS[q.status] || q.status}
                      </span>
                    </td>

                    {/* Acciones */}
                    <td className="px-4 py-4 text-right">
                      <Link
                        href={`/quotations/${q.id}`}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        Ver detalle
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
