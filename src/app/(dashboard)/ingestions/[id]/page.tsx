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
  match_confidence: number | null;
  grade: { grade_code: string; family: { code: string; display_name: string } } | null;
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
  raw_html: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  processing: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
};

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
  const [reparsing, setReparsing] = useState(false);
  const [matchResult, setMatchResult] = useState<{
    quotationId?: string;
    matched: number;
    unknown: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDetail();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadDetail() {
    setLoading(true);
    try {
      const res = await fetch(`/api/ingestions/${id}`);
      const json = await res.json();
      if (res.ok) {
        setIngestion(json.ingestion);
        setEntries(json.entries || []);
      } else {
        setError("Ingestion no encontrada");
      }
    } catch {
      setError("Error al cargar detalle");
    } finally {
      setLoading(false);
    }
  }

  async function reparse() {
    setReparsing(true);
    setError(null);
    try {
      const res = await fetch(`/api/ingestions/${id}/reparse`, { method: "POST" });
      const json = await res.json();
      if (res.ok) {
        await loadDetail();
      } else {
        setError(json.error || "Error al re-parsear");
      }
    } catch {
      setError("Error de conexion");
    } finally {
      setReparsing(false);
    }
  }

  async function runMatching() {
    setMatching(true);
    setError(null);
    try {
      const res = await fetch(`/api/ingestions/${id}/match`, { method: "POST" });
      const json = await res.json();
      if (res.ok) {
        setMatchResult({
          quotationId: json.quotationId,
          matched: json.matched,
          unknown: json.unknown,
        });
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
        <Link href="/ingestions" className="text-blue-600 hover:text-blue-800">Volver</Link>
      </div>
    );
  }

  const canMatch = ingestion.status === "pending" || ingestion.status === "processing";

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/ingestions" className="hover:text-blue-600">Ingestiones</Link>
        <span>/</span>
        <span className="text-gray-900 truncate">{ingestion.source_subject || "Manual"}</span>
      </div>

      {/* Header Card */}
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
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[ingestion.status] || "bg-gray-100 text-gray-800"}`}>
              {ingestion.status}
            </span>
            <button
              onClick={reparse}
              disabled={reparsing || matching}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 text-sm font-medium"
            >
              {reparsing ? "Re-parseando..." : "Re-parsear"}
            </button>
            {canMatch && (
              <button
                onClick={runMatching}
                disabled={matching || reparsing}
                className="px-5 py-2 bg-[#1a365d] text-white rounded-lg hover:bg-[#2a4a7d] disabled:opacity-50 text-sm font-medium"
              >
                {matching ? "Ejecutando..." : "Ejecutar Matching"}
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mt-6">
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">{ingestion.grades_found || entries.length}</p>
            <p className="text-xs text-gray-500 mt-1">Grados encontrados</p>
          </div>
          <div className="bg-green-50 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-green-700">{ingestion.grades_matched}</p>
            <p className="text-xs text-gray-500 mt-1">Matched en biblia</p>
          </div>
          <div className="bg-red-50 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-red-600">{ingestion.grades_unknown}</p>
            <p className="text-xs text-gray-500 mt-1">No encontrados</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4 mb-6 text-sm">
          {error}
        </div>
      )}

      {/* Match result banner */}
      {matchResult && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
          <p className="text-sm text-green-800 font-medium">
            Matching completado: {matchResult.matched} grados matcheados, {matchResult.unknown} desconocidos.
            {matchResult.quotationId && (
              <>
                {" "}Cotizacion creada:{" "}
                <Link href={`/quotations/${matchResult.quotationId}`} className="underline font-semibold">
                  Ver cotizacion →
                </Link>
              </>
            )}
          </p>
        </div>
      )}

      {/* Price Entries Table */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">
            Tabla de Precios Extraida
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Grados y precios detectados en el email del proveedor
          </p>
        </div>

        {entries.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-400 text-sm">
            No se extrajeron grados de este email.
            {ingestion.status === "pending" && " Ejecuta el matching para procesarlo."}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Grado (raw)</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Biblia</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Familia</th>
                <th className="text-right px-6 py-3 font-medium text-gray-500">Precio USD</th>
                <th className="text-center px-6 py-3 font-medium text-gray-500">Incoterm</th>
                <th className="text-center px-6 py-3 font-medium text-gray-500">Puerto</th>
                <th className="text-center px-6 py-3 font-medium text-gray-500">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {entries.map((entry) => (
                <tr key={entry.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3 font-mono font-medium text-gray-900">
                    {entry.raw_grade_text}
                  </td>
                  <td className="px-6 py-3 font-mono text-gray-600">
                    {entry.grade?.grade_code || (
                      <span className="text-red-400 text-xs">No encontrado</span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-gray-600">
                    {entry.grade?.family?.display_name || "-"}
                  </td>
                  <td className="px-6 py-3 text-right font-semibold text-gray-900">
                    {entry.price_usd != null
                      ? `$${entry.price_usd.toLocaleString("en-US", { minimumFractionDigits: 0 })}`
                      : entry.raw_price_text || "-"}
                  </td>
                  <td className="px-6 py-3 text-center text-gray-600">{entry.incoterm}</td>
                  <td className="px-6 py-3 text-center text-gray-600">{entry.port}</td>
                  <td className="px-6 py-3 text-center">
                    {entry.is_matched ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        ✓ Matched
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        ? Desconocido
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
