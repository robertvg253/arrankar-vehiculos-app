import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  LiveReload,
  useLocation,
} from "@remix-run/react";
import type { LinksFunction } from "@remix-run/node";
import Sidebar from "./components/Sidebar";

import "./tailwind.css";

export const links: LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap",
  },
  {
    rel: "icon",
    href: "/images/favicon.ico",
    type: "image/x-icon",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="h-full font-sans" style={{ fontFamily: 'Poppins, sans-serif' }}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body className="h-full bg-white text-brand-text font-sans" style={{ fontFamily: 'Poppins, sans-serif' }}>
        {children}
        <ScrollRestoration />
        <Scripts />
        <LiveReload />
      </body>
    </html>
  );
}

export default function App() {
  const location = useLocation();
  const isLogin = location.pathname === "/login";
  const isRegister = location.pathname === "/register";
  const isCompletarPerfil = location.pathname === "/completar-perfil";
  return (
    <html lang="es" className="h-full font-sans" style={{ fontFamily: 'Poppins, sans-serif' }}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body className="h-full bg-white text-brand-text font-sans" style={{ fontFamily: 'Poppins, sans-serif' }}>
        {(isLogin || isRegister || isCompletarPerfil) ? (
          <main className="flex-1 overflow-y-auto bg-white p-4 pt-16 lg:p-8 lg:pt-8">
            <Outlet />
          </main>
        ) : (
          <div className="flex min-h-screen">
            <Sidebar />
            <main className="flex-1 overflow-y-auto bg-white p-4 pt-16 lg:p-8 lg:pt-8">
              <Outlet />
            </main>
          </div>
        )}
        <ScrollRestoration />
        <Scripts />
        <LiveReload />
      </body>
    </html>
  );
}

