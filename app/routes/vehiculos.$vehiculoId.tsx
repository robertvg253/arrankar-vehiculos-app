import { json, redirect } from "@remix-run/node";
import { useLoaderData, Link, Form, useActionData, useNavigation } from "@remix-run/react";
import type { LoaderFunction, ActionFunction } from "@remix-run/node";
import { supabase } from "~/utils/supabase.server";
import { useState, useEffect } from "react";

type Vehiculo = {
  uuid: string;
  marca: string | null;
  modelo: string | null;
  anio: number | null;
  km: number | null;
  precio: number | null;
  transmision: string | null;
  url_img: string | null;
  version: string | null;
  puertas: number | null;
  combustible: string | null;
  color: string | null;
  placa: string | null;
  carroceria: string | null;
  traccion: string | null;
  cilindraje: number | null;
};

type ActionData = {
  errors?: {
    marca?: string;
    modelo?: string;
    anio?: string;
    km?: string;
    precio?: string;
    transmision?: string;
    form?: string;
  };
};

export const loader: LoaderFunction = async ({ params }) => {
  const vehiculoId = params.vehiculoId;

  if (!vehiculoId) {
    return json(
      { message: "ID de vehículo no proporcionado" },
      { status: 400 }
    );
  }

  const { data: vehiculo, error } = await supabase
    .from("vehiculos")
    .select("*")
    .eq("uuid", vehiculoId)
    .single();

  if (error) {
    console.error("Error al cargar vehículo:", error);
    return json(
      { message: "Error al cargar el vehículo" },
      { status: 500 }
    );
  }

  if (!vehiculo) {
    return json(
      { message: "Vehículo no encontrado" },
      { status: 404 }
    );
  }

  return json({ vehiculo });
};

export const action: ActionFunction = async ({ request, params }) => {
  const formData = await request.formData();
  const method = formData.get("_method") as string;

  if (method === "delete") {
    const vehiculoId = params.vehiculoId;

    try {
      const { error } = await supabase
        .from("vehiculos")
        .delete()
        .eq("uuid", vehiculoId);

      if (error) {
        console.error("Error al eliminar vehículo:", error);
        return json<ActionData>({
          errors: {
            form: "Error al eliminar el vehículo. Por favor intenta de nuevo.",
          },
        });
      }

      return redirect("/vehiculos");
    } catch (error) {
      console.error("Error inesperado al eliminar:", error);
      return json<ActionData>({
        errors: {
          form: "Error inesperado al eliminar el vehículo.",
        },
      });
    }
  }

  // Si no es delete, es una actualización
  const marca = formData.get("marca") as string;
  const modelo = formData.get("modelo") as string;
  const anio = Number(formData.get("anio"));
  const km = Number(formData.get("km"));
  const precio = Number(formData.get("precio"));
  const transmision = formData.get("transmision") as string;

  // Validación
  const errors: ActionData["errors"] = {};
  if (!marca) errors.marca = "La marca es requerida";
  if (!modelo) errors.modelo = "El modelo es requerido";
  if (!anio || isNaN(anio)) errors.anio = "El año es requerido";
  if (!km || isNaN(km)) errors.km = "El kilometraje es requerido";
  if (!precio || isNaN(precio)) errors.precio = "El precio es requerido";
  if (!transmision) errors.transmision = "La transmisión es requerida";
  
  if (Object.keys(errors).length > 0) {
    return json<ActionData>({ errors });
  }

  try {
    const { error } = await supabase
      .from("vehiculos")
      .update({ marca, modelo, anio, km, precio, transmision })
      .eq("uuid", params.vehiculoId)
      .select()
      .single();

    if (error) {
      console.error("Error al actualizar vehículo:", error);
      return json<ActionData>({
        errors: {
          form: "Error al actualizar el vehículo. Por favor intenta de nuevo.",
        },
      });
    }

    return redirect(`/vehiculos/${params.vehiculoId}`);
  } catch (error) {
    console.error("Error inesperado:", error);
    return json<ActionData>({
      errors: {
        form: "Error inesperado al actualizar el vehículo.",
      },
    });
  }
};

function DeleteModal({ 
  isOpen, 
  onClose, 
  vehiculoInfo,
  isDeleting 
}: { 
  isOpen: boolean; 
  onClose: () => void;
  vehiculoInfo: string;
  isDeleting: boolean;
}) {
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      setIsAnimating(true);
    } else {
      setIsAnimating(false);
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isVisible && !isOpen) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 md:bottom-4 md:left-auto md:right-4">
      <div 
        className={`transform transition-all duration-500 ease-in-out ${
          isAnimating 
            ? 'translate-y-0 opacity-100 md:translate-x-0' 
            : 'translate-y-full opacity-0 md:translate-y-0 md:translate-x-full'
        }`}
      >
        <div className="mx-auto max-w-sm rounded-t-lg border border-gray-200 bg-white p-4 shadow-lg dark:border-gray-700 dark:bg-gray-800 md:rounded-lg">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg
                className="h-6 w-6 text-red-600 dark:text-red-400"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="1.5"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Eliminar Vehículo
              </h3>
              <div className="mt-2">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  ¿Estás seguro de que deseas eliminar el vehículo "{vehiculoInfo}"? Esta acción no se puede deshacer.
                </p>
              </div>
            </div>
          </div>
          <div className="mt-4 flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => {
                setIsAnimating(false);
                setTimeout(onClose, 500);
              }}
              disabled={isDeleting}
              className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 dark:focus:ring-offset-gray-800"
            >
              Cancelar
            </button>
            <Form method="post">
              <input type="hidden" name="_method" value="delete" />
              <button
                type="submit"
                disabled={isDeleting}
                className="inline-flex justify-center rounded-md border border-transparent bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:focus:ring-offset-gray-800"
              >
                {isDeleting ? "Eliminando..." : "Eliminar"}
              </button>
            </Form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function VehiculoDetallePage() {
  const { vehiculo, message } = useLoaderData<{ vehiculo?: Vehiculo; message?: string }>();
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

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

  // Función para calcular cuota mensual estimada (ejemplo)
  const calculateMonthlyPayment = (price: number | null) => {
    if (!price) return "-";
    const monthlyRate = 0.02; // 2% mensual (ejemplo)
    const months = 60; // 5 años
    const monthlyPayment = (price * monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1);
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(monthlyPayment);
  };

  if (message) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <h1 className="mb-4 text-2xl font-bold text-brand-title">
            {message}
          </h1>
          <p className="mb-4 text-brand-text">
            El vehículo que buscas no existe o no se pudo cargar.
          </p>
          <Link
            to="/vehiculos"
            className="inline-flex items-center rounded-md bg-brand-primary px-4 py-2 text-sm font-medium text-brand-title hover:bg-brand-secondary focus:outline-none focus:ring-2 focus:ring-brand-highlight focus:ring-offset-2"
          >
            Volver a la lista de vehículos
          </Link>
        </div>
      </div>
    );
  }

  if (!vehiculo) {
    return null;
  }

  const vehiculoInfo = `${vehiculo.marca || ''} ${vehiculo.modelo || ''}`.trim() || 'Sin información';

  return (
    <div className="container mx-auto px-4 py-8 font-sans bg-brand-bg min-h-screen">
      {/* Header con navegación */}
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <Link
            to="/vehiculos"
            className="inline-flex items-center text-sm text-brand-highlight hover:text-brand-primary mb-2"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Volver a vehículos
          </Link>
          <h1 className="text-3xl font-bold text-brand-title">
            {vehiculo.marca} {vehiculo.modelo}
          </h1>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setIsDeleteModalOpen(true)}
            className="inline-flex items-center rounded-lg border border-brand-secondary bg-white px-4 py-2 text-sm font-medium text-brand-text shadow-sm hover:bg-brand-bg focus:outline-none focus:ring-2 focus:ring-brand-highlight focus:ring-offset-2"
          >
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Eliminar
          </button>
        </div>
      </div>

      {/* Contenido principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Columna principal - Imagen */}
        <div className="lg:col-span-2">
          {/* Imagen principal */}
          <div className="bg-white rounded-xl border border-brand-secondary shadow-md overflow-hidden">
            {vehiculo.url_img ? (
              <img 
                src={vehiculo.url_img} 
                alt={`${vehiculo.marca || 'Vehículo'} ${vehiculo.modelo || ''}`} 
                className="w-full h-96 object-cover" 
              />
            ) : (
              <div className="w-full h-96 flex items-center justify-center bg-brand-bg text-brand-highlight">
                <svg className="w-16 h-16 opacity-50" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                </svg>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar - Resumen y acciones */}
        <div className="space-y-6">
          {/* Resumen del vehículo */}
          <div className="bg-white rounded-xl border border-brand-secondary shadow-md p-6 h-96 flex flex-col justify-between">
            <div className="space-y-4">
              {/* Información principal */}
              <div className="text-center">
                <h3 className="text-lg font-bold text-brand-title">
                  {vehiculo.marca} {vehiculo.modelo}
                </h3>
                <p className="text-sm text-brand-text">{vehiculo.anio} • {vehiculo.transmision}</p>
              </div>

              {/* Precio */}
              <div className="text-center pt-4 border-t border-brand-secondary">
                <p className="text-sm text-brand-text">Precio</p>
                <p className="text-2xl font-bold text-brand-primary">
                  {formatPrice(vehiculo.precio)}
                </p>
                <p className="text-xs text-brand-text mt-1">
                  Cuota desde {calculateMonthlyPayment(vehiculo.precio)}/mes
                </p>
              </div>
            </div>

            {/* Botones de acción */}
            <div className="space-y-3">
              <button className="w-full bg-brand-primary text-brand-title font-semibold py-3 px-4 rounded-lg hover:bg-brand-secondary transition-colors duration-200">
                Sepárelo
              </button>
              <button className="w-full bg-brand-secondary text-brand-title font-semibold py-3 px-4 rounded-lg hover:bg-brand-primary transition-colors duration-200">
                Llévalo a Crédito
              </button>
              <a
                href={`https://wa.me/573001234567?text=Hola, estoy interesado en el ${vehiculo.marca} ${vehiculo.modelo} ${vehiculo.anio}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full bg-green-600 text-white font-semibold py-3 px-4 rounded-lg hover:bg-green-700 transition-colors duration-200 flex items-center justify-center"
              >
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488"/>
                </svg>
                WhatsApp
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Características detalladas - Ancho completo */}
      <div className="mt-8 bg-white rounded-xl border border-brand-secondary shadow-md p-6">
        <h2 className="text-xl font-bold text-brand-title mb-6">Características del Vehículo</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Año */}
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0 w-8 h-8 bg-brand-primary-light rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-brand-primary" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-brand-text">Año</p>
              <p className="text-sm font-semibold text-brand-title">{vehiculo.anio || "-"}</p>
            </div>
          </div>

          {/* Versión */}
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0 w-8 h-8 bg-brand-primary-light rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-brand-primary" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-brand-text">Versión</p>
              <p className="text-sm font-semibold text-brand-title">{vehiculo.version || "-"}</p>
            </div>
          </div>

          {/* Kilometraje */}
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0 w-8 h-8 bg-brand-primary-light rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-brand-primary" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-brand-text">Kilometraje</p>
              <p className="text-sm font-semibold text-brand-title">{formatMileage(vehiculo.km)}</p>
            </div>
          </div>

          {/* Combustible */}
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0 w-8 h-8 bg-brand-primary-light rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-brand-primary" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-brand-text">Combustible</p>
              <p className="text-sm font-semibold text-brand-title">{vehiculo.combustible || "-"}</p>
            </div>
          </div>

          {/* Transmisión */}
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0 w-8 h-8 bg-brand-primary-light rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-brand-primary" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-brand-text">Transmisión</p>
              <p className="text-sm font-semibold text-brand-title">{vehiculo.transmision || "-"}</p>
            </div>
          </div>

          {/* Color */}
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0 w-8 h-8 bg-brand-primary-light rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-brand-primary" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-brand-text">Color</p>
              <p className="text-sm font-semibold text-brand-title">{vehiculo.color || "-"}</p>
            </div>
          </div>

          {/* Puertas */}
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0 w-8 h-8 bg-brand-primary-light rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-brand-primary" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-brand-text">Puertas</p>
              <p className="text-sm font-semibold text-brand-title">{vehiculo.puertas || "-"}</p>
            </div>
          </div>

          {/* Carrocería */}
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0 w-8 h-8 bg-brand-primary-light rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-brand-primary" fill="currentColor" viewBox="0 0 20 20">
                <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-brand-text">Carrocería</p>
              <p className="text-sm font-semibold text-brand-title">{vehiculo.carroceria || "-"}</p>
            </div>
          </div>

          {/* Tracción */}
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0 w-8 h-8 bg-brand-primary-light rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-brand-primary" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-brand-text">Tracción</p>
              <p className="text-sm font-semibold text-brand-title">{vehiculo.traccion || "-"}</p>
            </div>
          </div>

          {/* Cilindraje */}
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0 w-8 h-8 bg-brand-primary-light rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-brand-primary" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-brand-text">Cilindraje</p>
              <p className="text-sm font-semibold text-brand-title">{vehiculo.cilindraje || "-"}</p>
            </div>
          </div>

          {/* Placa */}
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0 w-8 h-8 bg-brand-primary-light rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-brand-primary" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-brand-text">Placa</p>
              <p className="text-sm font-semibold text-brand-title">{vehiculo.placa || "-"}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Formulario de Edición - Ancho completo */}
      <div className="mt-8 bg-white rounded-xl border border-brand-secondary shadow-md p-6">
        <h2 className="text-xl font-bold text-brand-title mb-6">Editar Vehículo</h2>

        <Form method="post" className="space-y-6">
          {actionData?.errors?.form && (
            <div className="rounded-md bg-red-50 p-4 text-sm text-red-700 dark:bg-red-900/50 dark:text-red-200">
              {actionData.errors.form}
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <label
                htmlFor="marca"
                className="block text-sm font-medium text-brand-text"
              >
                Marca
              </label>
              <input
                type="text"
                name="marca"
                id="marca"
                defaultValue={vehiculo.marca || ""}
                className="mt-1 block w-full rounded-lg border border-brand-secondary px-3 py-2 shadow-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary bg-white text-brand-title"
              />
              {actionData?.errors?.marca && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {actionData.errors.marca}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="modelo"
                className="block text-sm font-medium text-brand-text"
              >
                Modelo
              </label>
              <input
                type="text"
                name="modelo"
                id="modelo"
                defaultValue={vehiculo.modelo || ""}
                className="mt-1 block w-full rounded-lg border border-brand-secondary px-3 py-2 shadow-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary bg-white text-brand-title"
              />
              {actionData?.errors?.modelo && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {actionData.errors.modelo}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="anio"
                className="block text-sm font-medium text-brand-text"
              >
                Año
              </label>
              <input
                type="number"
                name="anio"
                id="anio"
                defaultValue={vehiculo.anio || ""}
                className="mt-1 block w-full rounded-lg border border-brand-secondary px-3 py-2 shadow-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary bg-white text-brand-title"
              />
              {actionData?.errors?.anio && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {actionData.errors.anio}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="km"
                className="block text-sm font-medium text-brand-text"
              >
                Kilometraje
              </label>
              <input
                type="number"
                name="km"
                id="km"
                defaultValue={vehiculo.km || ""}
                className="mt-1 block w-full rounded-lg border border-brand-secondary px-3 py-2 shadow-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary bg-white text-brand-title"
              />
              {actionData?.errors?.km && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {actionData.errors.km}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="precio"
                className="block text-sm font-medium text-brand-text"
              >
                Precio
              </label>
              <input
                type="number"
                name="precio"
                id="precio"
                defaultValue={vehiculo.precio || ""}
                className="mt-1 block w-full rounded-lg border border-brand-secondary px-3 py-2 shadow-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary bg-white text-brand-title"
              />
              {actionData?.errors?.precio && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {actionData.errors.precio}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="transmision"
                className="block text-sm font-medium text-brand-text"
              >
                Transmisión
              </label>
              <select
                name="transmision"
                id="transmision"
                defaultValue={vehiculo.transmision || ""}
                className="mt-1 block w-full rounded-lg border border-brand-secondary px-3 py-2 shadow-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary bg-white text-brand-title"
              >
                <option value="">Seleccione...</option>
                <option value="Manual">Manual</option>
                <option value="Automática">Automática</option>
              </select>
              {actionData?.errors?.transmision && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {actionData.errors.transmision}
                </p>
              )}
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex justify-center rounded-lg border border-transparent bg-brand-primary px-4 py-2 text-sm font-medium text-brand-title shadow-sm hover:bg-brand-secondary focus:outline-none focus:ring-2 focus:ring-brand-highlight focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors duration-200"
            >
              {isSubmitting ? "Guardando..." : "Guardar Cambios"}
            </button>
          </div>
        </Form>
      </div>

      <DeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        vehiculoInfo={vehiculoInfo}
        isDeleting={isSubmitting}
      />
    </div>
  );
} 