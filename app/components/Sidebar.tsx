import { NavLink } from "@remix-run/react";
import { useState, useEffect, useMemo } from "react";

export default function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    // Detecta si hay sesión leyendo la cookie (simple, no seguro, pero suficiente para navegación UI)
    setHasSession(document.cookie.includes("concesionario_id"));
  }, []);

  const dashboardTo = useMemo(() => (hasSession ? "/dashboard" : "/login"), [hasSession]);

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed z-50 p-2 text-brand-title lg:hidden ${
          isOpen ? "right-4 top-4" : "left-4 top-4"
        }`}
      >
        <svg
          className="h-6 w-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d={isOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"}
          />
        </svg>
      </button>

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-brand-title/40 backdrop-blur-sm lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 transform flex-col bg-white border-r border-gray-200 shadow-md transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 font-sans ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo and Title */}
        <div className="flex h-16 items-center justify-center px-6">
          <img src="/images/logo-arrankar.png" alt="Arrankar Logo" className="h-12" />
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-4">
          <NavLink
            to={dashboardTo}
            className={({ isActive }) =>
              `flex items-center rounded-lg px-4 py-2 text-sm font-medium transition-colors font-sans ` +
              (isActive
                ? "bg-brand-primary text-brand-title"
                : "text-brand-text hover:bg-brand-secondary hover:text-brand-title")
            }
            onClick={() => setIsOpen(false)}
          >
            <svg
              className="mr-3 h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0h6"
              />
            </svg>
            Panel
          </NavLink>
          <NavLink
            to="/vehiculos"
            className={({ isActive }) =>
              `flex items-center rounded-lg px-4 py-2 text-sm font-medium transition-colors font-sans ` +
              (isActive
                ? "bg-brand-primary text-brand-title"
                : "text-brand-text hover:bg-brand-secondary hover:text-brand-title")
            }
            onClick={() => setIsOpen(false)}
          >
            <svg
              className="mr-3 h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
              />
            </svg>
            Vehículos
          </NavLink>
        </nav>
      </aside>
    </>
  );
} 