"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const PASSWORD = "maricarmen";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (password.toLowerCase() === PASSWORD) {
      // sessionStorage: cleared when the tab/browser closes or on F5 hard reload
      sessionStorage.setItem("icd_auth", "1");
      router.push("/ingestions");
    } else {
      setError("Contraseña incorrecta. Intentalo de nuevo.");
      setPassword("");
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0d2340] to-[#1a365d] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-10">

        {/* ICD Enterprise Logo */}
        <div className="flex flex-col items-center mb-10">
          <svg width="200" height="72" viewBox="0 0 200 72" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="0" y="10" width="6" height="52" rx="3" fill="#c8a96e"/>
            <text x="20" y="50" fontFamily="Georgia, serif" fontSize="42" fontWeight="700" fill="#1a365d" letterSpacing="3">ICD</text>
            <text x="20" y="66" fontFamily="Arial, sans-serif" fontSize="12" fontWeight="400" fill="#c8a96e" letterSpacing="5">ENTERPRISE</text>
          </svg>
        </div>

        <p className="text-center text-gray-400 text-xs mb-8 tracking-widest uppercase">
          Sistema de Cotizaciones B2B
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••"
              autoFocus
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900
                         focus:outline-none focus:ring-2 focus:ring-[#1a365d] focus:border-transparent text-base"
            />
          </div>

          {error && (
            <p className="text-red-600 text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full py-3 bg-[#1a365d] hover:bg-[#2a4a7d] text-white font-semibold rounded-lg
                       transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-base"
          >
            {loading ? "Verificando..." : "Ingresar"}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-8">
          ICD Enterprise &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
