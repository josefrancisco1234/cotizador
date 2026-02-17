"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";

interface ClientDetail {
  id: string;
  client_code: string;
  business_name: string;
  ruc: string | null;
  zone: string | null;
  status: string;
  client_type: string | null;
  addresses: string[];
  manufacturing_sectors: string[];
  processes: string[];
  final_products: string[];
  observations: string | null;
  contacts: Array<{
    id: string;
    department: string;
    salutation: string | null;
    contact_name: string | null;
    full_name: string | null;
    channel: string;
    channel_value: string;
    priority: number;
    is_active: boolean;
  }>;
  preferences: Array<{
    id: string;
    uso: string | null;
    melt_index: number | null;
    additives: string | null;
    process: string | null;
    observations: string | null;
    family: { code: string; display_name: string };
  }>;
}

const DEPT_LABELS: Record<string, string> = {
  purchasing: "Compras",
  imports: "Importaciones",
  billing: "Cobranza",
};

export default function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/clients/${id}`)
      .then((r) => r.json())
      .then((json) => setClient(json.data || null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="text-center py-12 text-gray-400">Cargando...</div>;
  if (!client) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400 mb-4">Cliente no encontrado</p>
        <Link href="/clients" className="text-blue-600">Volver</Link>
      </div>
    );
  }

  // Group contacts by department
  const contactsByDept = new Map<string, typeof client.contacts>();
  for (const c of client.contacts) {
    if (!contactsByDept.has(c.department)) contactsByDept.set(c.department, []);
    contactsByDept.get(c.department)!.push(c);
  }

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/clients" className="hover:text-blue-600">Clientes</Link>
        <span>/</span>
        <span className="text-gray-900">{client.business_name}</span>
      </div>

      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{client.business_name}</h1>
            <p className="text-sm text-gray-500 mt-1">
              {client.client_code} | {client.zone || "Sin zona"} | RUC: {client.ruc || "-"}
            </p>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${client.status === "active" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}>
            {client.status}
          </span>
        </div>

        {(client.manufacturing_sectors.length > 0 || client.processes.length > 0) && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex flex-wrap gap-4 text-sm">
              {client.manufacturing_sectors.length > 0 && (
                <div>
                  <span className="text-gray-500">Rubros: </span>
                  <span className="text-gray-900">{client.manufacturing_sectors.join(", ")}</span>
                </div>
              )}
              {client.processes.length > 0 && (
                <div>
                  <span className="text-gray-500">Procesos: </span>
                  <span className="text-gray-900">{client.processes.join(", ")}</span>
                </div>
              )}
              {client.final_products.length > 0 && (
                <div>
                  <span className="text-gray-500">Productos: </span>
                  <span className="text-gray-900">{client.final_products.join(", ")}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Contacts */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Contactos ({client.contacts.length})</h2>
          <div className="space-y-4">
            {Array.from(contactsByDept.entries()).map(([dept, contacts]) => (
              <div key={dept}>
                <h3 className="text-xs font-medium text-gray-500 uppercase mb-2">
                  {DEPT_LABELS[dept] || dept}
                </h3>
                <div className="space-y-2">
                  {contacts.sort((a, b) => a.priority - b.priority).map((c) => (
                    <div key={c.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {c.contact_name || c.full_name || "Sin nombre"}
                        </p>
                        <p className="text-xs text-gray-500 font-mono">{c.channel_value}</p>
                      </div>
                      <span className={`text-xs font-medium ${c.channel === "whatsapp" ? "text-green-600" : "text-blue-600"}`}>
                        {c.channel === "whatsapp" ? "WhatsApp" : "Email"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Material Preferences */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Preferencias de Material ({client.preferences.length})</h2>
          <div className="space-y-2">
            {client.preferences.map((pref) => (
              <div key={pref.id} className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900">
                    {pref.family.code}
                  </span>
                  <span className="text-xs text-gray-500">{pref.family.display_name}</span>
                </div>
                {(pref.uso || pref.additives || pref.process) && (
                  <div className="flex gap-3 mt-1 text-xs text-gray-600">
                    {pref.uso && <span>Uso: {pref.uso}</span>}
                    {pref.additives && <span>ADD: {pref.additives}</span>}
                    {pref.process && <span>Proc: {pref.process}</span>}
                    {pref.melt_index && <span>MI: {pref.melt_index}</span>}
                  </div>
                )}
              </div>
            ))}
            {client.preferences.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">Sin preferencias registradas</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
