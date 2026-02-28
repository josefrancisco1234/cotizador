"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const NAV_ITEMS = [
  { href: "/ingestions", label: "Ingestiones", icon: "📥" },
  { href: "/quotations", label: "Cotizaciones", icon: "📋" },
  { href: "/clients", label: "Clientes", icon: "👥" },
  { href: "/grades", label: "Biblia Tecnica", icon: "📚" },
  { href: "/formats", label: "Formatos Email", icon: "🧪" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    // Check sessionStorage on every mount (cleared on F5 / new tab)
    const auth = sessionStorage.getItem("icd_auth");
    if (!auth) {
      router.replace("/login");
    } else {
      setChecked(true);
    }
  }, [router]);

  function handleLogout() {
    sessionStorage.removeItem("icd_auth");
    router.replace("/login");
  }

  // Don't render dashboard until auth is confirmed
  if (!checked) return null;

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-[#1a365d] text-white flex flex-col shrink-0">
        <div className="p-6 border-b border-white/10">
          <h1 className="text-xl font-bold">Cotizador B2B</h1>
          <p className="text-sm text-white/60 mt-1">Resinas Plasticas</p>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-white/15 text-white"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-white/10 space-y-3">
          <p className="text-xs text-white/40">ICD Enterprise &copy; 2026</p>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-xs text-white/50 hover:text-white/90 transition-colors w-full"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1" />
            </svg>
            Cerrar sesion
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto p-8">{children}</div>
      </main>
    </div>
  );
}
