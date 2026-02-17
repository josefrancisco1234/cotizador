"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Client {
  id: string;
  client_code: string;
  business_name: string;
  zone: string | null;
  status: string;
  client_type: string | null;
  preferences: Array<{
    id: string;
    uso: string | null;
    family: { code: string; display_name: string };
  }>;
}

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  prospect: "bg-yellow-100 text-yellow-800",
  inactive: "bg-gray-100 text-gray-500",
};

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");

  useEffect(() => {
    loadClients();
  }, [statusFilter]);

  async function loadClients() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (search) params.set("q", search);
      const res = await fetch(`/api/clients?${params}`);
      const json = await res.json();
      setClients(json.data || []);
    } finally {
      setLoading(false);
    }
  }

  function handleSearch() {
    loadClients();
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
        <p className="text-sm text-gray-500 mt-1">Base de clientes con preferencias de material</p>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <div className="flex-1 flex gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Buscar por nombre..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleSearch}
            className="px-4 py-2 bg-[#1a365d] text-white rounded-lg text-sm hover:bg-[#2a4a7d]"
          >
            Buscar
          </button>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todos</option>
          <option value="active">Activos</option>
          <option value="prospect">Prospectos</option>
          <option value="inactive">Inactivos</option>
        </select>
      </div>

      {/* Client cards */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-12 text-gray-400">Cargando...</div>
        ) : clients.length === 0 ? (
          <div className="text-center py-12 text-gray-400">No se encontraron clientes</div>
        ) : (
          clients.map((client) => {
            // Group preferences by family
            const families = new Map<string, string[]>();
            for (const pref of client.preferences) {
              const code = pref.family.code;
              if (!families.has(code)) families.set(code, []);
              if (pref.uso) families.get(code)!.push(pref.uso);
            }

            return (
              <Link
                key={client.id}
                href={`/clients/${client.id}`}
                className="block bg-white border border-gray-200 rounded-xl p-5 hover:border-blue-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-400 font-mono">{client.client_code}</span>
                      <h3 className="font-semibold text-gray-900">{client.business_name}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[client.status] || ""}`}>
                        {client.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      {client.zone || "Sin zona"} {client.client_type ? `| ${client.client_type}` : ""}
                    </p>
                  </div>
                </div>

                {families.size > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {Array.from(families.entries()).map(([code, usos]) => (
                      <span
                        key={code}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-md text-xs font-medium"
                      >
                        {code}
                        {usos.length > 0 && (
                          <span className="text-blue-500">({usos.join(", ")})</span>
                        )}
                      </span>
                    ))}
                  </div>
                )}
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
