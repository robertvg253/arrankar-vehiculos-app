import { json, redirect, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, Form } from "@remix-run/react";
import { sessionStorage } from "~/utils/session.server";
import { supabase } from "~/utils/supabase.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await sessionStorage.getSession(request.headers.get("Cookie"));
  const concesionario_id = session.get("concesionario_id");
  const user_id = session.get("user_id");
  if (!concesionario_id || !user_id) {
    return redirect("/login");
  }
  
  // Buscar datos del usuario en la tabla users
  const { data: user, error } = await supabase
    .from("users")
    .select("email, name, concesionario_id")
    .eq("auth_id", user_id)
    .single();
  if (error || !user) {
    return redirect("/login");
  }

  // Buscar datos del concesionario
  const { data: concesionario, error: concesionarioError } = await supabase
    .from("concesionario")
    .select("nombre, logo, email")
    .eq("id", concesionario_id)
    .single();

  // Estadísticas de vehículos del concesionario
  const { data: vehiculos, error: vehiculosError } = await supabase
    .from("vehiculos")
    .select("uuid, precio, marca, modelo, anio")
    .eq("concesionario_id", concesionario_id);

  // Calcular métricas
  const totalVehiculos = vehiculos?.length || 0;
  const totalValorInventario = vehiculos?.reduce((sum, v) => sum + (v.precio || 0), 0) || 0;
  const promedioPrecio = totalVehiculos > 0 ? totalValorInventario / totalVehiculos : 0;
  
  // Vehículos por marca (top 5)
  const marcasCount = vehiculos?.reduce((acc, v) => {
    if (v.marca) {
      acc[v.marca] = (acc[v.marca] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>) || {};
  
  const topMarcas = Object.entries(marcasCount)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5);

  // Vehículos por año (últimos 5 años)
  const aniosCount = vehiculos?.reduce((acc, v) => {
    if (v.anio) {
      acc[v.anio] = (acc[v.anio] || 0) + 1;
    }
    return acc;
  }, {} as Record<number, number>) || {};
  
  const topAnios = Object.entries(aniosCount)
    .sort(([a], [b]) => Number(b) - Number(a))
    .slice(0, 5);

  return json({ 
    user, 
    concesionario: concesionario || { nombre: 'Sin nombre', logo: '', email: 'Sin email' },
    stats: {
      totalVehiculos,
      totalValorInventario,
      promedioPrecio,
      topMarcas,
      topAnios
    }
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const session = await sessionStorage.getSession(request.headers.get("Cookie"));
  return redirect("/login", {
    headers: {
      "Set-Cookie": await sessionStorage.destroySession(session),
    },
  });
}

export default function Dashboard() {
  const { user, concesionario, stats } = useLoaderData<typeof loader>();

  // Función para formatear precio como moneda
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  return (
    <div className="min-h-screen bg-brand-bg flex flex-col gap-6 p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-2">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold text-brand-title">Panel de Administración</h1>
          <span className="inline-block bg-brand-primary text-white text-sm font-semibold rounded-full px-3 py-1">
            {concesionario.nombre}
          </span>
        </div>
        <Form method="post">
          <button 
            type="submit" 
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 text-white font-semibold px-4 py-2 shadow-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Cerrar Sesión
          </button>
        </Form>
      </div>

      {/* Información del Usuario */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <h2 className="text-xl font-bold text-brand-title mb-4">Información del Usuario</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-xs font-normal text-brand-text mb-2">Datos Personales</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-7 h-7 bg-brand-primary-light rounded-lg flex items-center justify-center">
                  <svg className="w-3.5 h-3.5 text-brand-primary" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-normal text-brand-text">Nombre</p>
                  <p className="text-xs font-medium text-brand-title">{user.name || 'Sin nombre'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-7 h-7 bg-brand-primary-light rounded-lg flex items-center justify-center">
                  <svg className="w-3.5 h-3.5 text-brand-primary" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                    <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-normal text-brand-text">Email</p>
                  <p className="text-xs font-medium text-brand-title">{user.email}</p>
                </div>
              </div>
            </div>
          </div>
          <div>
            <h3 className="text-xs font-normal text-brand-text mb-2">Datos del Concesionario</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-7 h-7 bg-brand-primary-light rounded-lg flex items-center justify-center">
                  <svg className="w-3.5 h-3.5 text-brand-primary" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-normal text-brand-text">Concesionario</p>
                  <p className="text-xs font-medium text-brand-title">{concesionario.nombre}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-7 h-7 bg-brand-primary-light rounded-lg flex items-center justify-center">
                  <svg className="w-3.5 h-3.5 text-brand-primary" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                    <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-normal text-brand-text">Email</p>
                  {concesionario.email ? (
                    <a href={`mailto:${concesionario.email}`} className="text-xs font-medium text-brand-title underline">{concesionario.email}</a>
                  ) : (
                    <p className="text-xs font-medium text-brand-title">Sin email</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-7 h-7 bg-brand-primary-light rounded-lg flex items-center justify-center">
                  <svg className="w-3.5 h-3.5 text-brand-primary" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm0 2h12v10H4V5zm6 2a3 3 0 110 6 3 3 0 010-6z" />
                  </svg>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-xs font-normal text-brand-text">Logo</p>
                  {concesionario.logo ? (
                    <img src={concesionario.logo} alt="Logo concesionario" className="w-7 h-7 rounded-full border border-gray-200 bg-white object-contain" />
                  ) : (
                    <span className="text-xs font-medium text-brand-title">Sin logo</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tarjetas de Métricas */}
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 sm:grid sm:grid-cols-4 sm:gap-4 sm:overflow-visible sm:pb-0 sm:mx-0">
        <div className="bg-white rounded-lg shadow-md p-3 min-w-[170px] flex flex-col items-start justify-center sm:p-6">
          <span className="text-xs text-brand-text font-semibold mb-1">Total Vehículos</span>
          <span className="text-lg font-bold text-brand-title">{stats.totalVehiculos}</span>
          <span className="flex items-center text-green-600 text-xs mt-0.5">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12l5 5L20 7" />
            </svg>
            En inventario
          </span>
        </div>
        <div className="bg-white rounded-lg shadow-md p-3 min-w-[170px] flex flex-col items-start justify-center sm:p-6">
          <span className="text-xs text-brand-text font-semibold mb-1">Valor Total</span>
          <span className="text-lg font-bold text-brand-title">{formatPrice(stats.totalValorInventario)}</span>
          <span className="flex items-center text-blue-600 text-xs mt-0.5">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
            </svg>
            Inventario
          </span>
        </div>
        <div className="bg-white rounded-lg shadow-md p-3 min-w-[170px] flex flex-col items-start justify-center sm:p-6">
          <span className="text-xs text-brand-text font-semibold mb-1">Precio Promedio</span>
          <span className="text-lg font-bold text-brand-title">{formatPrice(stats.promedioPrecio)}</span>
          <span className="flex items-center text-purple-600 text-xs mt-0.5">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Por vehículo
          </span>
        </div>
        <div className="bg-white rounded-lg shadow-md p-3 min-w-[170px] flex flex-col items-start justify-center sm:p-6">
          <span className="text-xs text-brand-text font-semibold mb-1">Marcas Diferentes</span>
          <span className="text-lg font-bold text-brand-title">{stats.topMarcas.length}</span>
          <span className="flex items-center text-orange-600 text-xs mt-0.5">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            En catálogo
          </span>
        </div>
      </div>

      {/* Estadísticas Detalladas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Marcas */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-xl font-bold text-brand-title mb-4">Vehículos por Marca</h2>
          <div className="space-y-3">
            {stats.topMarcas.map(([marca, count], index) => (
              <div key={marca} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-brand-text w-6">{index + 1}.</span>
                  <span className="text-sm font-semibold text-brand-title">{marca}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-20 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-brand-primary h-2 rounded-full" 
                      style={{ width: `${(count / stats.totalVehiculos) * 100}%` }}
                    ></div>
                  </div>
                  <span className="text-sm font-bold text-brand-primary w-8 text-right">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Años */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-xl font-bold text-brand-title mb-4">Vehículos por Año</h2>
          <div className="space-y-3">
            {stats.topAnios.map(([anio, count], index) => (
              <div key={anio} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-brand-text w-6">{index + 1}.</span>
                  <span className="text-sm font-semibold text-brand-title">{anio}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-20 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-brand-highlight h-2 rounded-full" 
                      style={{ width: `${(count / stats.totalVehiculos) * 100}%` }}
                    ></div>
                  </div>
                  <span className="text-sm font-bold text-brand-highlight w-8 text-right">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Acciones Rápidas */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <h2 className="text-xl font-bold text-brand-title mb-4">Acciones Rápidas</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <a 
            href="/vehiculos" 
            className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <div className="flex-shrink-0 w-10 h-10 bg-brand-primary-light rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-brand-primary" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-brand-title">Ver Vehículos</p>
              <p className="text-xs text-brand-text">Gestionar inventario</p>
            </div>
          </a>
          <a 
            href="/vehiculos/nuevo" 
            className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <div className="flex-shrink-0 w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-brand-title">Agregar Vehículo</p>
              <p className="text-xs text-brand-text">Nuevo en inventario</p>
            </div>
          </a>
          <a 
            href="/clientes" 
            className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-brand-title">Gestionar Clientes</p>
              <p className="text-xs text-brand-text">Base de datos</p>
            </div>
          </a>
        </div>
      </div>
    </div>
  );
} 