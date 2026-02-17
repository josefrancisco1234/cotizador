"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";

interface QuotationDetail {
  id: string;
  title: string | null;
  status: string;
  payment_terms: string | null;
  shipment_terms: string | null;
  total_recipients: number;
  total_dispatched: number;
  approved_at: string | null;
  created_at: string;
  items: Array<{
    id: string;
    price_usd: number;
    grade: {
      grade_code: string;
      uso: string;
      brand: string;
      manufacturer: string;
      attributes: string;
      family: { code: string; display_name: string };
    };
  }>;
  recipients: Array<{
    id: string;
    channel: string;
    dispatch_status: string;
    dispatched_at: string | null;
    error_message: string | null;
    retry_count: number;
    client: { client_code: string; business_name: string };
    contact: { contact_name: string; channel_value: string };
  }>;
}

const DISPATCH_COLORS: Record<string, string> = {
  pending: "bg-gray-100 text-gray-700",
  queued: "bg-blue-100 text-blue-700",
  sent: "bg-green-100 text-green-700",
  delivered: "bg-green-200 text-green-800",
  read: "bg-emerald-200 text-emerald-800",
  failed: "bg-red-100 text-red-700",
  skipped: "bg-gray-100 text-gray-500",
};

export default function QuotationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [quotation, setQuotation] = useState<QuotationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    loadDetail();
  }, [id]);

  async function loadDetail() {
    setLoading(true);
    try {
      const res = await fetch(`/api/quotations/${id}`);
      const json = await res.json();
      setQuotation(json.data || null);
    } finally {
      setLoading(false);
    }
  }

  async function approve() {
    setActing(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/quotations/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentTerms: quotation?.payment_terms || "CAD / 30 dias",
          shipmentTerms: quotation?.shipment_terms || "4-6 semanas",
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: `Cotizacion aprobada. ${json.recipientsQueued} destinatarios en cola.` });
        loadDetail();
      } else {
        setMessage({ type: "error", text: json.error });
      }
    } finally {
      setActing(false);
    }
  }

  async function dispatch() {
    setActing(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/quotations/${id}/dispatch`, { method: "POST" });
      const json = await res.json();
      if (res.ok) {
        setMessage({
          type: "success",
          text: `Dispatch: ${json.result.sent} enviados, ${json.result.failed} fallidos`,
        });
        loadDetail();
      } else {
        setMessage({ type: "error", text: json.error });
      }
    } finally {
      setActing(false);
    }
  }

  if (loading) {
    return <div className="text-center py-12 text-gray-400">Cargando...</div>;
  }

  if (!quotation) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400 mb-4">Cotizacion no encontrada</p>
        <Link href="/quotations" className="text-blue-600">Volver</Link>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/quotations" className="hover:text-blue-600">Cotizaciones</Link>
        <span>/</span>
        <span className="text-gray-900">{quotation.title || "Detalle"}</span>
      </div>

      {message && (
        <div className={`p-4 rounded-lg mb-4 text-sm ${message.type === "success" ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"}`}>
          {message.text}
        </div>
      )}

      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{quotation.title || "Cotizacion"}</h1>
            <p className="text-sm text-gray-500 mt-1">
              Creada: {new Date(quotation.created_at).toLocaleString("es-PE")}
              {quotation.approved_at && ` | Aprobada: ${new Date(quotation.approved_at).toLocaleString("es-PE")}`}
            </p>
          </div>
          <div className="flex gap-3">
            {quotation.status === "draft" && (
              <button
                onClick={approve}
                disabled={acting}
                className="px-5 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium"
              >
                {acting ? "..." : "Aprobar y Encolar"}
              </button>
            )}
            {(quotation.status === "approved" || quotation.status === "sending") && (
              <button
                onClick={dispatch}
                disabled={acting}
                className="px-5 py-2 bg-[#1a365d] text-white rounded-lg hover:bg-[#2a4a7d] disabled:opacity-50 text-sm font-medium"
              >
                {acting ? "Enviando..." : "Enviar Ahora"}
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 mt-6">
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold">{quotation.items.length}</p>
            <p className="text-xs text-gray-500 mt-1">Items</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-blue-700">{quotation.total_recipients}</p>
            <p className="text-xs text-gray-500 mt-1">Destinatarios</p>
          </div>
          <div className="bg-green-50 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-green-700">{quotation.total_dispatched}</p>
            <p className="text-xs text-gray-500 mt-1">Enviados</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <p className="text-lg font-bold capitalize">{quotation.status}</p>
            <p className="text-xs text-gray-500 mt-1">Estado</p>
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Materiales Cotizados</h2>
        <div className="space-y-3">
          {quotation.items.map((item) => (
            <div key={item.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">
                  {item.grade.family.display_name} - {item.grade.grade_code}
                </p>
                <p className="text-sm text-gray-500">
                  {item.grade.brand} ({item.grade.manufacturer}) | {item.grade.uso} | {item.grade.attributes}
                </p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-blue-700">
                  USD {item.price_usd.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-gray-500">por TM CFR Callao</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recipients */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-6 pb-0">
          <h2 className="text-lg font-semibold mb-4">Destinatarios ({quotation.recipients.length})</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-y border-gray-200">
            <tr>
              <th className="text-left px-6 py-3 font-medium text-gray-500">Cliente</th>
              <th className="text-left px-6 py-3 font-medium text-gray-500">Contacto</th>
              <th className="text-left px-6 py-3 font-medium text-gray-500">Canal</th>
              <th className="text-left px-6 py-3 font-medium text-gray-500">Destino</th>
              <th className="text-center px-6 py-3 font-medium text-gray-500">Estado</th>
              <th className="text-left px-6 py-3 font-medium text-gray-500">Error</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {quotation.recipients.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-6 py-3">
                  <p className="font-medium text-gray-900">{r.client.business_name}</p>
                  <p className="text-xs text-gray-400">{r.client.client_code}</p>
                </td>
                <td className="px-6 py-3 text-gray-600">{r.contact.contact_name || "-"}</td>
                <td className="px-6 py-3">
                  <span className={`text-xs font-medium ${r.channel === "whatsapp" ? "text-green-600" : "text-blue-600"}`}>
                    {r.channel === "whatsapp" ? "WhatsApp" : "Email"}
                  </span>
                </td>
                <td className="px-6 py-3 text-gray-500 text-xs font-mono">{r.contact.channel_value}</td>
                <td className="px-6 py-3 text-center">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${DISPATCH_COLORS[r.dispatch_status] || "bg-gray-100"}`}>
                    {r.dispatch_status}
                  </span>
                </td>
                <td className="px-6 py-3 text-xs text-red-500 max-w-[200px] truncate">
                  {r.error_message || ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
