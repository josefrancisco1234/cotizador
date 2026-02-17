"use client";

import { useState } from "react";

interface Grade {
  id: string;
  grade_code: string;
  uso: string | null;
  process: string | null;
  brand: string | null;
  manufacturer: string | null;
  attributes: string | null;
  melt_index_label: string | null;
  family: { code: string; display_name: string };
}

export default function GradesPage() {
  const [grades, setGrades] = useState<Grade[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  async function doSearch() {
    if (!search.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const res = await fetch(`/api/grades/search?q=${encodeURIComponent(search)}`);
      const json = await res.json();
      setGrades(json.data || []);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Biblia Tecnica</h1>
        <p className="text-sm text-gray-500 mt-1">Busqueda de grados en la tabla tecnica de resinas</p>
      </div>

      {/* Search */}
      <div className="flex gap-3 mb-6">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && doSearch()}
          placeholder="Buscar grado... (ej: CL9010, 3470, JM-350)"
          className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={doSearch}
          disabled={loading}
          className="px-6 py-3 bg-[#1a365d] text-white rounded-lg text-sm font-medium hover:bg-[#2a4a7d] disabled:opacity-50"
        >
          {loading ? "Buscando..." : "Buscar"}
        </button>
      </div>

      {/* Results */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Buscando...</div>
      ) : grades.length > 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Grado</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Familia</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Uso</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">MI</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Marca</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Fabricante</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Atributos</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Proceso</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {grades.map((g) => (
                <tr key={g.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3 font-mono font-medium text-gray-900">{g.grade_code}</td>
                  <td className="px-6 py-3">
                    <span className="inline-block px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-medium">
                      {(g.family as { code: string }).code}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-gray-600">{g.uso || "-"}</td>
                  <td className="px-6 py-3 text-gray-600 text-xs">{g.melt_index_label || "-"}</td>
                  <td className="px-6 py-3 text-gray-600">{g.brand || "-"}</td>
                  <td className="px-6 py-3 text-gray-600">{g.manufacturer || "-"}</td>
                  <td className="px-6 py-3 text-gray-500 text-xs max-w-[200px] truncate">{g.attributes || "-"}</td>
                  <td className="px-6 py-3 text-gray-600">{g.process || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : searched ? (
        <div className="text-center py-12 bg-white border border-gray-200 rounded-xl">
          <p className="text-gray-400">No se encontraron grados para &quot;{search}&quot;</p>
        </div>
      ) : (
        <div className="text-center py-16 bg-white border border-gray-200 rounded-xl">
          <p className="text-gray-400 text-lg mb-2">Busca un grado para empezar</p>
          <p className="text-gray-300 text-sm">Ingresa un codigo de grado parcial o completo</p>
        </div>
      )}
    </div>
  );
}
