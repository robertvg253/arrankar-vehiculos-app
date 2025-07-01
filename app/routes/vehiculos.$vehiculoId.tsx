import { json, redirect } from "@remix-run/node";
import { useLoaderData, Link, Form, useActionData, useNavigation } from "@remix-run/react";
import type { LoaderFunction, ActionFunction } from "@remix-run/node";
import { supabase } from "~/utils/supabase.server";
import { useState, useEffect } from "react";
import ImageGallery, { type ImageGalleryImage } from "~/components/ImageGallery";
import FormularioContactoVehiculo from "~/components/FormularioContactoVehiculo";

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

  // Obtener imágenes asociadas desde la nueva tabla 'images'
  const { data: imagesData, error: imagesError } = await supabase
    .from("images")
    .select("id, url, storage_id, order_index, destacada")
    .eq("vehicle_id", vehiculoId)

  if (imagesError) {
    console.error("Error al cargar imágenes:", imagesError);
    // Devuelve el vehículo pero con un array de imágenes vacío en caso de error
    return json({ vehiculo, images: [], pdfs: [] });
  }

  // Ordenar imágenes por 'order_index' numéricamente
  const images: ImageGalleryImage[] = (imagesData || [])
    .sort((a, b) => parseInt(a.order_index, 10) - parseInt(b.order_index, 10));

  // Obtener PDFs asociados desde la tabla documentos_vehiculo
  const { data: pdfsData, error: pdfsError } = await supabase
    .from("documentos_vehiculo")
    .select("id, nombre_archivo, url_documento, tipo_documento, uploaded_at")
    .eq("vehiculo_uuid", vehiculoId);

  if (pdfsError) {
    console.error("Error al cargar PDFs:", pdfsError);
    return json({ vehiculo, images, pdfs: [] });
  }

  return json({ vehiculo, images, pdfs: pdfsData || [] });
};

export const action: ActionFunction = async ({ request, params }) => {
  const formData = await request.formData();
  const method = formData.get("_method") as string;

  // --- NUEVO: Manejo de formulario de contacto ---
  const nombre = formData.get("nombre") as string | null;
  const email = formData.get("email") as string | null;
  const mensaje = formData.get("mensaje") as string | null;
  const vehiculo_uuid = formData.get("vehiculo_uuid") as string | null;

  // Si vienen los campos del formulario de contacto, procesar esa lógica
  if (nombre !== null && email !== null && mensaje !== null && vehiculo_uuid !== null) {
    const errors: Record<string, string> = {};
    if (!nombre.trim()) errors.nombre = "Por favor, introduce tu nombre.";
    if (!email.trim()) {
      errors.email = "Por favor, introduce tu correo electrónico.";
    } else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      errors.email = "El correo electrónico no es válido.";
    }
    if (!mensaje.trim()) errors.mensaje = "El mensaje no puede estar vacío.";
    if (!vehiculo_uuid) errors.form = "Falta el identificador del vehículo.";

    if (Object.keys(errors).length > 0) {
      return json({ errors });
    }

    // Insertar en la tabla solicitud_contacto
    const { error } = await supabase
      .from("solicitud_contacto")
      .insert([
        {
          nombre,
          email,
          mensaje,
          vehiculo_uuid,
        },
      ]);

    if (error) {
      console.error("Error al guardar solicitud de contacto:", error);
      return json({ errors: { form: "Ocurrió un error al enviar tu solicitud. Por favor, inténtalo de nuevo más tarde." } });
    }

    return json({ success: "¡Tu solicitud ha sido enviada con éxito! Te contactaremos pronto." });
  }
  // --- FIN NUEVO ---

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
  const { vehiculo, message, images = [], pdfs = [] } = useLoaderData<{ vehiculo?: Vehiculo; message?: string; images?: ImageGalleryImage[]; pdfs?: any[] }>();
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
      <div className="min-h-screen bg-brand-bg flex items-center justify-center p-4">
        <div className="text-center bg-white rounded-2xl border border-gray-200 shadow-sm p-8 max-w-md">
          <h1 className="mb-4 text-2xl font-bold text-brand-title">
            {message}
          </h1>
          <p className="mb-6 text-brand-text">
            El vehículo que buscas no existe o no se pudo cargar.
          </p>
          <Link
            to="/vehiculos"
            className="inline-flex items-center rounded-lg bg-brand-primary px-4 py-2 text-sm font-medium text-brand-title hover:bg-brand-highlight focus:outline-none focus:ring-2 focus:ring-brand-highlight focus:ring-offset-2 transition-colors"
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
    <div className="min-h-screen bg-brand-bg flex flex-col gap-6 p-4 md:p-8">
      {/* Header con navegación */}
      <div className="mb-2">
        {/* Mobile: Botón regresar y año en fila, nombre debajo */}
        <div className="flex flex-col gap-2 md:hidden">
          <div className="flex items-center gap-2 w-full">
            <Link
              to="/vehiculos"
              className="inline-flex items-center text-sm text-brand-highlight hover:text-brand-primary transition-colors"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Volver a vehículos
            </Link>
            <span className="inline-block bg-brand-primary text-white text-xs font-semibold rounded-full px-3 py-1 ml-auto">
              {vehiculo.anio || 'N/A'}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-brand-title w-full text-left">
            {vehiculo.marca} {vehiculo.modelo}
          </h1>
        </div>
        {/* Desktop: Todo en una fila */}
        <div className="hidden md:flex items-center gap-4 justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/vehiculos"
              className="inline-flex items-center text-sm text-brand-highlight hover:text-brand-primary transition-colors"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Volver a vehículos
            </Link>
            <h1 className="text-3xl font-bold text-brand-title">
              {vehiculo.marca} {vehiculo.modelo}
            </h1>
            <span className="inline-block bg-brand-primary text-white text-sm font-semibold rounded-full px-3 py-1">
              {vehiculo.anio || 'N/A'}
            </span>
          </div>
          <button
            onClick={() => setIsDeleteModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 text-white font-semibold px-4 py-2 shadow-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition w-full sm:w-auto text-base sm:text-base"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Eliminar Vehículo
          </button>
        </div>
      </div>

      {/* Tarjetas de Métricas */}
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 sm:grid sm:grid-cols-4 sm:gap-4 sm:overflow-visible sm:pb-0 sm:mx-0">
        <div className="bg-white rounded-lg shadow-md p-3 min-w-[170px] flex flex-col items-start justify-center sm:p-6">
          <span className="text-xs text-brand-text font-semibold mb-1">Precio</span>
          <span className="text-lg font-bold text-brand-title">{formatPrice(vehiculo.precio)}</span>
          <span className="flex items-center text-green-600 text-xs mt-0.5">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12l5 5L20 7" />
            </svg>
            Disponible
          </span>
        </div>
        <div className="bg-white rounded-lg shadow-md p-3 min-w-[170px] flex flex-col items-start justify-center sm:p-6">
          <span className="text-xs text-brand-text font-semibold mb-1">Kilometraje</span>
          <span className="text-lg font-bold text-brand-title">{formatMileage(vehiculo.km)}</span>
          <span className="flex items-center text-blue-600 text-xs mt-0.5">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {vehiculo.transmision || 'N/A'}
          </span>
        </div>
        <div className="bg-white rounded-lg shadow-md p-3 min-w-[170px] flex flex-col items-start justify-center sm:p-6">
          <span className="text-xs text-brand-text font-semibold mb-1">Combustible</span>
          <span className="text-lg font-bold text-brand-title">{vehiculo.combustible || 'N/A'}</span>
          <span className="flex items-center text-purple-600 text-xs mt-0.5">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            {vehiculo.color || 'N/A'}
          </span>
        </div>
        <div className="bg-white rounded-lg shadow-md p-3 min-w-[170px] flex flex-col items-start justify-center sm:p-6">
          <span className="text-xs text-brand-text font-semibold mb-1">Cuota Mensual</span>
          <span className="text-lg font-bold text-brand-title">{calculateMonthlyPayment(vehiculo.precio)}</span>
          <span className="flex items-center text-orange-600 text-xs mt-0.5">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
            </svg>
            Estimada
          </span>
        </div>
      </div>

      {/* Contenido principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna principal - Imagen */}
        <div className="lg:col-span-2">
          {/* Galería de imágenes */}
          <ImageGallery images={images} />
        </div>

        {/* Sidebar - Resumen y acciones */}
        <div className="space-y-6">
          {/* Resumen del vehículo y formulario de contacto */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <div className="space-y-2">
              {/* Información principal */}
              <div className="text-center">
                <h3 className="text-base font-semibold text-brand-title">
                  {vehiculo.marca} {vehiculo.modelo}
                </h3>
                <p className="text-xs text-brand-text">{vehiculo.anio} • {vehiculo.transmision}</p>
              </div>
              {/* Precio pequeño */}
              <div className="text-center pt-2">
                <p className="text-xs text-brand-text">Precio</p>
                <p className="text-lg font-bold text-brand-primary">
                  {formatPrice(vehiculo.precio)}
                </p>
              </div>
            </div>
            {/* Formulario de contacto */}
            <div className="mt-6">
              <FormularioContactoVehiculo vehiculo_uuid={vehiculo.uuid} />
            </div>
          </div>
        </div>
      </div>

      {/* Características detalladas - Ancho completo */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
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

      {/* Documentos PDF adjuntos */}
      {pdfs && pdfs.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mt-6">
          <h2 className="text-lg font-bold text-brand-title mb-4 flex items-center gap-2">
            <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Documentos Adjuntos
          </h2>
          <div className="flex flex-wrap gap-4">
            {pdfs.map((pdf) => (
              <a
                key={pdf.id}
                href={pdf.url_documento}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 bg-gray-50 hover:bg-brand-primary-light border border-gray-200 rounded-lg px-4 py-3 shadow transition cursor-pointer min-w-[220px] max-w-xs w-full"
                title={pdf.nombre_archivo}
              >
                <svg className="w-7 h-7 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M19.5 6.75v10.5A2.25 2.25 0 0 1 17.25 19.5h-10.5A2.25 2.25 0 0 1 4.5 17.25V6.75A2.25 2.25 0 0 1 6.75 4.5h7.5a.75.75 0 0 1 .53.22l4.5 4.5a.75.75 0 0 1 .22.53zM12 15.75a.75.75 0 0 0 .75-.75v-3a.75.75 0 0 0-1.5 0v3a.75.75 0 0 0 .75.75zm0-6a.75.75 0 0 0-.75.75v.5a.75.75 0 0 0 1.5 0v-.5A.75.75 0 0 0 12 9.75z"/></svg>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-brand-title text-sm truncate">{pdf.nombre_archivo}</div>
                  <div className="text-xs text-gray-500 truncate">PDF adjunto</div>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Formulario de Edición - Ancho completo */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
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
                className="mt-1 block w-full rounded-lg border border-gray-200 px-3 py-2 shadow-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary bg-white text-brand-title"
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
                className="mt-1 block w-full rounded-lg border border-gray-200 px-3 py-2 shadow-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary bg-white text-brand-title"
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
                className="mt-1 block w-full rounded-lg border border-gray-200 px-3 py-2 shadow-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary bg-white text-brand-title"
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
                className="mt-1 block w-full rounded-lg border border-gray-200 px-3 py-2 shadow-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary bg-white text-brand-title"
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
                className="mt-1 block w-full rounded-lg border border-gray-200 px-3 py-2 shadow-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary bg-white text-brand-title"
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
                className="mt-1 block w-full rounded-lg border border-gray-200 px-3 py-2 shadow-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary bg-white text-brand-title"
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
              className="inline-flex justify-center rounded-lg border border-transparent bg-brand-primary px-4 py-2 text-sm font-medium text-brand-title shadow-sm hover:bg-brand-highlight focus:outline-none focus:ring-2 focus:ring-brand-highlight focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors duration-200"
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