"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Quotation {
  id: string;
  title: string | null;
  status: string;
  payment_terms: string | null;
  total_recipients: number;
  total_dispatched: number;
  approved_at: string | null;
  created_at: string;
  ingestion: { source_subject: string | null } | null;
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
              <th className="text-left px-6 py-3 font-medium text-gray-500">Fecha</th>
              <th className="text-left px-6 py-3 font-medium text-gray-500">Titulo</th>
              <th className="text-center px-6 py-3 font-medium text-gray-500">Destinatarios</th>
              <th className="text-center px-6 py-3 font-medium text-gray-500">Enviados</th>
              <th className="text-center px-6 py-3 font-medium text-gray-500">Estado</th>
              <th className="text-right px-6 py-3 font-medium text-gray-500">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-400">Cargando...</td>
              </tr>
            ) : quotations.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                  No hay cotizaciones. Procesa una ingestion para generar cotizaciones.
                </td>
              </tr>
            ) : (
              quotations.map((q) => (
                <tr key={q.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-gray-600">
                    {new Date(q.created_at).toLocaleDateString("es-PE", {
                      day: "2-digit", month: "short", year: "numeric",
                    })}
                  </td>
                  <td className="px-6 py-4 text-gray-900 font-medium">
                    {q.title || q.ingestion?.source_subject || "Sin titulo"}
                  </td>
                  <td className="px-6 py-4 text-center">{q.total_recipients}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={q.total_dispatched > 0 ? "text-green-600 font-medium" : ""}>
                      {q.total_dispatched}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[q.status] || "bg-gray-100"}`}>
                      {STATUS_LABELS[q.status] || q.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      href={`/quotations/${q.id}`}
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
