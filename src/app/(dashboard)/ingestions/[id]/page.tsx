"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";

interface PriceEntry {
  id: string;
  raw_grade_text: string;
  raw_price_text: string;
  price_usd: number | null;
  incoterm: string;
  port: string;
  is_matched: boolean;
  grade_id: string | null;
}

interface Ingestion {
  id: string;
  source_subject: string | null;
  source_from: string | null;
  status: string;
  grades_found: number;
  grades_matched: number;
  grades_unknown: number;
  created_at: string;
}

export default function IngestionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [ingestion, setIngestion] = useState<Ingestion | null>(null);
  const [entries, setEntries] = useState<PriceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [matching, setMatching] = useState(false);
  const [matchResult, setMatchResult] = useState<{
    quotationId?: string;
    matchResults?: Array<{
      gradeCode: string;
      priceUsd: number;
      status: string;
      recipientCount: number;
      warnings: string[];
    }>;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDetail();
  }, [id]);

  async function loadDetail() {
    setLoading(true);
    try {
      // Load ingestion and its price entries via a combined approach
      const res = await fetch(`/api/ingestions`);
      const json = await res.json();
      const found = (json.data || []).find((i: Ingestion) => i.id === id);
      setIngestion(found || null);

      // For price entries, we'd need an API route - for now show parsed data
    } catch {
      setError("Error al cargar detalle");
    } finally {
      setLoading(false);
    }
  }

  async function runMatching() {
    setMatching(true);
    setError(null);
    try {
      const res = await fetch(`/api/ingestions/${id}/match`, { method: "POST" });
      const json = await res.json();
      if (res.ok) {
        setMatchResult(json);
        loadDetail();
      } else {
        setError(json.error || "Error en matching");
      }
    } catch {
      setError("Error de conexion");
    } finally {
      setMatching(false);
    }
  }

  if (loading) {
    return <div className="text-center py-12 text-gray-400">Cargando...</div>;
  }

  if (!ingestion) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400 mb-4">Ingestion no encontrada</p>
        <Link href="/ingestions" className="text-blue-600 hover:text-blue-800">
          Volver a lista
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/ingestions" className="hover:text-blue-600">Ingestiones</Link>
        <span>/</span>
        <span className="text-gray-900">{ingestion.source_subject || "Manual"}</span>
      </div>

      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {ingestion.source_subject || "Ingestion Manual"}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {ingestion.source_from || "Paste directo"} &middot;{" "}
              {new Date(ingestion.created_at).toLocaleString("es-PE")}
            </p>
          </div>
          <div className="flex gap-3">
            {(ingestion.status === "pending" || ingestion.status === "processing") && (
              <button
                onClick={runMatching}
                disabled={matching}
                className="px-5 py-2 bg-[#1a365d] text-white rounded-lg hover:bg-[#2a4a7d] disabled:opacity-50 text-sm font-medium"
              >
                {matching ? "Ejecutando..." : "Ejecutar Matching"}
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 mt-6">
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">{ingestion.grades_found}</p>
            <p className="text-xs text-gray-500 mt-1">Grados encontrados</p>
          </div>
          <div className="bg-green-50 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-green-700">{ingestion.grades_matched}</p>
            <p className="text-xs text-gray-500 mt-1">Matched</p>
          </div>
          <div className="bg-red-50 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-red-600">{ingestion.grades_unknown}</p>
            <p className="text-xs text-gray-500 mt-1">Desconocidos</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-blue-700 capitalize">{ingestion.status}</p>
            <p className="text-xs text-gray-500 mt-1">Estado</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4 mb-6 text-sm">
          {error}
        </div>
      )}

      {/* Match Results */}
      {matchResult && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Resultados del Matching</h2>

          {matchResult.quotationId && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-green-800">
                Cotizacion creada:{" "}
                <Link
                  href={`/quotations/${matchResult.quotationId}`}
                  className="font-medium underline"
                >
                  Ver cotizacion
                </Link>
              </p>
            </div>
          )}

          <div className="space-y-3">
            {matchResult.matchResults?.map((mr, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    mr.status === "matched"
                      ? "border-green-200 bg-green-50"
                      : mr.status === "unknown"
                        ? "border-red-200 bg-red-50"
                        : "border-yellow-200 bg-yellow-50"
                  }`}
                >
                  <div>
                    <span className="font-mono font-medium">{mr.gradeCode}</span>
                    <span className="text-gray-500 ml-3">
                      USD {mr.priceUsd?.toLocaleString("en-US")}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-600">
                      {mr.recipientCount || 0} destinatarios
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${
                        mr.status === "matched"
                          ? "bg-green-200 text-green-800"
                          : mr.status === "unknown"
                            ? "bg-red-200 text-red-800"
                            : "bg-yellow-200 text-yellow-800"
                      }`}
                    >
                      {mr.status}
                    </span>
                  </div>
                </div>
              ),
            )}
          </div>
        </div>
      )}
    </div>
  );
}
