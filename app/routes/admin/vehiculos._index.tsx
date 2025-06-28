import { json, redirect, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useNavigate, useSearchParams } from "@remix-run/react";
import { useState, useMemo } from "react";
import { supabase } from "~/utils/supabase.server";

// Tipos para los datos de vehículos
export type VehiculoType = {
  uuid: string;
  marca: string | null;
  modelo: string | null;
  anio: number | null;
  km: number | null;
  precio: number | null;
  transmision: string | null;
  url_img: string | null;
  version?: string;
  combustible?: string;
};

type LoaderData = {
  vehiculos: VehiculoType[];
  error?: string;
  totalVehiculos: number;
  currentPage: number;
  limit: number;
};

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const searchParams = new URLSearchParams(url.search);
  const page = Number(searchParams.get("page")) || 1;
  const limit = 16;
  const offset = (page - 1) * limit;
  const to = offset + limit - 1;

  try {
    // Consulta paginada a la tabla vehiculos con todos los campos necesarios
    const { data: vehiculos, error, count } = await supabase
      .from("vehiculos")
      .select("uuid, marca, modelo, anio, km, precio, transmision, url_img, version, combustible", { count: "exact", head: false })
      .order("anio", { ascending: false })
      .range(offset, to);

    if (error) throw error;
    const totalVehiculos = count || 0;
    const totalPages = Math.ceil(totalVehiculos / limit);
    if (page > totalPages && totalVehiculos > 0) {
      const newParams = new URLSearchParams(searchParams);
      newParams.set("page", "1");
      return redirect(`/vehiculos?${newParams.toString()}`);
    }
    return json<LoaderData>({
      vehiculos: vehiculos || [],
      totalVehiculos,
      currentPage: page,
      limit,
    });
  } catch (error: any) {
    return json<LoaderData>({
      vehiculos: [],
      error: error?.message || "Error desconocido",
      totalVehiculos: 0,
      currentPage: 1,
      limit,
    });
  }
}

export default function VehiculosPage() {
  const { vehiculos, error, totalVehiculos, currentPage, limit } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Calcular el total de páginas
  const totalPages = Math.max(1, Math.ceil(totalVehiculos / limit));

  // Función para construir la URL de paginación
  const getPageUrl = (page: number) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", page.toString());
    return `?${params.toString()}`;
  };

  // Función para formatear precio como moneda
  const formatPrice = (price: number | null) => {
    if (!price) return "-";
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  // Función para formatear kilometraje
  const formatMileage = (km: number | null) => {
    if (!km) return "-";
    return new Intl.NumberFormat('es-CO').format(km) + " km";
  };

  return (
    <div className="container mx-auto px-4 py-8 font-sans bg-brand-bg min-h-screen overflow-y-auto">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-title">
            Listado de Vehículos
          </h1>
        </div>
        <button
          type="button"
          className="inline-flex items-center rounded-md border border-transparent bg-brand-primary px-4 py-2 text-sm font-medium text-brand-title shadow-sm hover:bg-brand-secondary focus:outline-none focus:ring-2 focus:ring-brand-highlight focus:ring-offset-2"
          onClick={() => navigate('/vehiculos/nuevo')}
        >
          <svg
            className="mr-2 h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 6v6m0 0v6m0-6h6m-6 0H6"
            />
          </svg>
          Agregar Vehículo
        </button>
      </div>

      {error ? (
        <div className="rounded-md bg-red-100 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-red-400"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                Error al cargar los vehículos
              </h3>
              <div className="mt-2 text-sm text-red-700">
                {error}
              </div>
            </div>
          </div>
        </div>
      ) : vehiculos.length > 0 ? (
        <>
          {/* Lista vertical de vehículos */}
          <div className="divide-y divide-brand-secondary rounded-xl bg-white shadow-md">
            {vehiculos.map((vehiculo) => (
              <div
                key={vehiculo.uuid}
                className="flex items-center gap-4 p-4 hover:bg-brand-secondary transition cursor-pointer"
                onClick={() => navigate(`/vehiculos/${vehiculo.uuid}`)}
              >
                {/* Imagen pequeña */}
                <img
                  src={vehiculo.url_img || '/images/placeholder.png'}
                  alt={`${vehiculo.marca || 'Vehículo'} ${vehiculo.modelo || ''}`}
                  className="w-12 h-12 object-cover rounded border border-brand-secondary bg-brand-bg flex-shrink-0"
                />
                {/* Info principal */}
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-brand-title truncate">
                    {vehiculo.marca || '-'} {vehiculo.modelo || ''} {vehiculo.anio ? `(${vehiculo.anio})` : ''}
                  </div>
                  {vehiculo.version && (
                    <div className="text-xs text-brand-text truncate">{vehiculo.version}</div>
                  )}
                  <div className="text-sm text-brand-text truncate">
                    {formatPrice(vehiculo.precio)}
                    {vehiculo.combustible ? ` • ${vehiculo.combustible}` : ''}
                    {vehiculo.km !== null ? ` • ${formatMileage(vehiculo.km)}` : ''}
                  </div>

                </div>
                {/* Botón Editar */}
                <button
                  type="button"
                  className="ml-4 px-4 py-2 bg-brand-primary text-brand-title rounded-md font-medium text-sm shadow-sm hover:bg-brand-highlight transition"
                  onClick={e => {
                    e.stopPropagation();
                    navigate(`/vehiculos/${vehiculo.uuid}`);
                  }}
                >
                  Editar
                </button>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="rounded-md bg-brand-bg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-brand-highlight"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-brand-title">
                No se encontraron vehículos
              </h3>
              <div className="mt-2 text-sm text-brand-text">
                Esta tabla está vacía
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Controles de Paginación */}
      <div className="mt-6 flex items-center justify-between border-t border-brand-secondary bg-brand-bg px-4 py-3 sm:px-6">
        <div className="flex flex-1 justify-between sm:hidden">
          <button
            onClick={() => {
              const newPage = Math.max(1, currentPage - 1);
              navigate(getPageUrl(newPage));
            }}
            disabled={currentPage === 1}
            className="relative inline-flex items-center rounded-md border border-brand-secondary bg-brand-bg px-4 py-2 text-sm font-medium text-brand-text hover:bg-brand-secondary focus:outline-none focus:ring-2 focus:ring-brand-highlight focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Anterior
          </button>
          <button
            onClick={() => {
              const newPage = currentPage + 1;
              navigate(getPageUrl(newPage));
            }}
            disabled={currentPage === totalPages}
            className="relative ml-3 inline-flex items-center rounded-md border border-brand-secondary bg-brand-bg px-4 py-2 text-sm font-medium text-brand-text hover:bg-brand-secondary focus:outline-none focus:ring-2 focus:ring-brand-highlight focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Siguiente
          </button>
        </div>
        <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-brand-text">
              Mostrando {" "}
              <span className="font-medium text-brand-title">
                {totalVehiculos > 0 ? (currentPage - 1) * limit + 1 : 0}
              </span>{" "}
              a {" "}
              <span className="font-medium text-brand-title">
                {Math.min(currentPage * limit, totalVehiculos)}
              </span>{" "}
              de {" "}
              <span className="font-medium text-brand-title">{totalVehiculos}</span>{" "}
              resultados
            </p>
          </div>
          <div>
            <nav
              className="isolate inline-flex -space-x-px rounded-md shadow-sm"
              aria-label="Pagination"
            >
              <button
                onClick={() => {
                  const newPage = Math.max(1, currentPage - 1);
                  navigate(getPageUrl(newPage));
                }}
                disabled={currentPage === 1}
                className="relative inline-flex items-center rounded-l-md px-2 py-2 text-brand-highlight ring-1 ring-inset ring-brand-secondary hover:bg-brand-secondary focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="sr-only">Anterior</span>
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
              <span className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-brand-title ring-1 ring-inset ring-brand-secondary focus:z-20 focus:outline-offset-0">
                Página {currentPage} de {totalPages}
              </span>
              <button
                onClick={() => {
                  const newPage = currentPage + 1;
                  navigate(getPageUrl(newPage));
                }}
                disabled={currentPage === totalPages}
                className="relative inline-flex items-center rounded-r-md px-2 py-2 text-brand-highlight ring-1 ring-inset ring-brand-secondary hover:bg-brand-secondary focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="sr-only">Siguiente</span>
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </nav>
          </div>
        </div>
      </div>
    </div>
  );
}

