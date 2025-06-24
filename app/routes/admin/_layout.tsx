import { Outlet } from "@remix-run/react";

export default function AdminLayout() {
  return (
    <div className="admin-layout-wrapper">
      {/* Aquí podrías poner un encabezado de admin, menú de navegación, etc. */}
      <nav className="p-4 bg-gray-800 text-white">
        <h1 className="text-xl font-bold">Panel de Administración</h1>
        {/* Ejemplo: <Link to="/admin/vehiculos">Vehículos</Link> */}
      </nav>
      <main className="p-4">
        <Outlet /> {/* ESTO ES CRUCIAL: Aquí se renderizarán las rutas hijas */}
      </main>
    </div>
  );
}