import React, { useState, useEffect, useCallback } from "react";
import {
  json,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
  unstable_parseMultipartFormData,
  redirect,
  type UploadHandler,
} from "@remix-run/node";
import { useLoaderData, useFetcher, useSubmit, useActionData, useNavigate } from "@remix-run/react";
import { supabase } from "~/utils/supabase.server";
import { getSession } from "~/utils/session.server";
import ImageUploader, { type ImageUploaderChanges, type ImageMetadata } from "../components/ImageUploader";
import LoadingToast from "../components/LoadingToast";

// Cache simple en memoria para datos que no cambian frecuentemente
const cache = {
  marcas: null as string[] | null,
  anios: null as string[] | null,
  lastCacheTime: 0,
  CACHE_DURATION: 5 * 60 * 1000, // 5 minutos
};

// Función optimizada para obtener marcas desde marcas_unicas
async function getMarcasUnicas(): Promise<string[]> {
  const { data, error } = await supabase
    .from("marcas_unicas")
    .select("marca")
    .not("marca", 'is', null)
    .not("marca", 'eq', '');

  if (error) throw error;

  const marcas = data.map(row => row.marca).filter(Boolean);
  return marcas.sort();
}

// Función optimizada para obtener valores únicos usando SQL DISTINCT
async function getDistinctValues(column: string, filters: { column: string; value: string }[] = []): Promise<string[]> {
  let query = supabase
    .from("cotizador")
    .select(column)
    .not(column, 'is', null)
    .not(column, 'eq', '');

  // Aplicar filtros
  for (const { column: filterColumn, value } of filters) {
    query = query.eq(filterColumn, value);
  }

  const { data, error } = await query;
  if (error) throw error;

  // Extraer valores únicos y ordenar
  const uniqueValues = Array.from(new Set(data.map(row => (row as any)[column]).filter(Boolean)));
  return uniqueValues.sort();
}

// Función optimizada para obtener años únicos
async function getDistinctYears(filters: { column: string; value: string }[] = []): Promise<string[]> {
  let query = supabase
    .from("cotizador")
    .select("fecha")
    .not("fecha", 'is', null);

  // Aplicar filtros
  for (const { column, value } of filters) {
    query = query.eq(column, value);
  }

  const { data, error } = await query;
  if (error) throw error;

  // Extraer años únicos de las fechas
  const yearsSet = new Set<string>();
  data.forEach(row => {
    if (row.fecha) {
      const match = String(row.fecha).match(/^(\d{4})/);
      if (match) yearsSet.add(match[1]);
    }
  });

  return Array.from(yearsSet).sort((a, b) => Number(b) - Number(a));
}

// Función optimizada para obtener versiones filtradas por año
async function getVersionsByYear(marca: string, modelo: string, anio: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("cotizador")
    .select("version, fecha")
    .eq("marca", marca)
    .eq("modelo", modelo)
    .not("version", 'is', null)
    .not("version", 'eq', '');

  if (error) throw error;

  // Filtrar por año y extraer versiones únicas
  const versiones = Array.from(new Set(
    data
      .filter(row => {
        const match = String(row.fecha).match(/^(\d{4})/);
        return match && match[1] === anio;
      })
      .map(row => row.version)
      .filter(Boolean)
  )).sort();

  return versiones;
}

// Loader optimizado
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const marca = url.searchParams.get("marca");
  const modelo = url.searchParams.get("modelo");
  const anio = url.searchParams.get("anio");
  const forOptions = url.searchParams.get("forOptions");

  try {
    // Consultas filtradas para selectores anidados (usando cotizador)
    if (forOptions === "modelos" && marca) {
      const modelos = await getDistinctValues("modelo", [{ column: "marca", value: marca }]);
      return json({ modelos });
    }

    if (forOptions === "anios" && marca && modelo) {
      const anios = await getDistinctYears([
        { column: "marca", value: marca },
        { column: "modelo", value: modelo }
      ]);
      return json({ anios });
    }

    if (forOptions === "versiones" && marca && modelo && anio) {
      const versiones = await getVersionsByYear(marca, modelo, anio);
      return json({ versiones });
    }

    // Carga inicial con caché (marcas desde marcas_unicas, años desde cotizador)
    const now = Date.now();
    if (cache.marcas && cache.anios && (now - cache.lastCacheTime) < cache.CACHE_DURATION) {
      return json({ marcas: cache.marcas, anios: cache.anios });
    }

    // Cargar datos frescos en paralelo
    const [marcas, anios] = await Promise.all([
      getMarcasUnicas(), // Desde marcas_unicas
      getDistinctYears()  // Desde cotizador
    ]);

    // Actualizar caché
    cache.marcas = marcas;
    cache.anios = anios;
    cache.lastCacheTime = now;

    return json({ marcas, anios });

  } catch (error: any) {
    console.error("Error en loader:", error);
    return json({ 
      marcas: cache.marcas || [], 
      anios: cache.anios || [], 
      error: error?.message || "Error al consultar datos" 
    }, { status: 500 });
  }
};

const uploadHandler: UploadHandler = async ({ name, filename, data }) => {
  // Para campos de formulario que no son archivos
  if (!filename) {
    const chunks = [];
    for await (const chunk of data) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks).toString();
  }

  // Para archivos
  const chunks = [];
  for await (const chunk of data) {
    chunks.push(chunk);
  }

  const buffer = Buffer.concat(chunks);
  const { fileTypeFromBuffer } = await import("file-type");
  const type = await fileTypeFromBuffer(buffer);

  return new File([buffer], filename, { type: type?.mime });
};

export async function action({ request }: ActionFunctionArgs) {
  const contentType = request.headers.get("Content-Type");
  let formData: FormData;

  // Manejo robusto de Content-Type
  if (contentType?.startsWith("multipart/form-data")) {
    formData = await unstable_parseMultipartFormData(request, uploadHandler);
  } else {
    formData = await request.formData();
  }

  // Manejo de "No-Op" (_clearFetcher)
  if (formData.get("_clearFetcher") === "true") {
    return json({ ok: true });
  }

  try {
    // Obtener sesión y extraer IDs
    const session = await getSession(request);
    const concesionario_id = session.get("concesionario_id");
    const auth_id = session.get("user_id");
    if (!concesionario_id || !auth_id) {
      return json({ error: "No se encontró información de usuario/concesionario en la sesión. Por favor, inicia sesión nuevamente." }, { status: 401 });
    }

    // Buscar el uuid del usuario en la tabla users usando el auth_id
    const { data: userRow, error: userLookupError } = await supabase
      .from("users")
      .select("uuid")
      .eq("auth_id", auth_id)
      .single();
    if (userLookupError || !userRow?.uuid) {
      return json({ error: "No se encontró el usuario en la base de datos. Por favor, revisa tu sesión." }, { status: 401 });
    }
    const user_id = userRow.uuid;

    // Extraer todos los campos del formulario
    const marca = formData.get('marca') as string;
    const modelo = formData.get('modelo') as string;
    const anioRaw = formData.get('anio');
    const anio = Number(anioRaw);
    const version = formData.get('version') as string;
    const puertasRaw = formData.get('puertas');
    const puertas = Number(puertasRaw);
    const combustible = formData.get('combustible') as string;
    const color = formData.get('color') as string;
    const placa = formData.get('placa') as string;
    const kmRaw = formData.get('km');
    const km = Number(kmRaw);
    const precioRaw = formData.get('precio');
    const precio = Number(precioRaw);
    const transmision = formData.get('transmision') as string;
    const carroceria = formData.get('carroceria') as string;
    const traccion = formData.get('traccion') as string;
    const cilindrajeRaw = formData.get('cilindraje');
    const cilindraje = Number(cilindrajeRaw);

    // Validación de campos requeridos
    const errors: Record<string, string> = {};
    if (!marca) errors.marca = "Marca es requerida";
    if (!modelo) errors.modelo = "Modelo es requerido";
    if (anioRaw === null || anioRaw === "" || isNaN(anio)) errors.anio = "Año es requerido";
    if (!version) errors.version = "Versión es requerida";
    if (puertasRaw === null || puertasRaw === "" || isNaN(puertas)) errors.puertas = "Puertas es requerido";
    if (!combustible) errors.combustible = "Combustible es requerido";
    if (!color) errors.color = "Color es requerido";
    if (!placa?.trim()) errors.placa = "Placa es requerida";
    if (kmRaw === null || kmRaw === "" || isNaN(km)) errors.km = "Kilometraje es requerido";
    if (precioRaw === null || precioRaw === "" || isNaN(precio)) errors.precio = "Precio es requerido";
    if (!transmision) errors.transmision = "Transmisión es requerida";
    if (!carroceria) errors.carroceria = "Carrocería es requerida";
    if (!traccion) errors.traccion = "Tracción es requerida";
    if (cilindrajeRaw === null || cilindrajeRaw === "" || isNaN(cilindraje)) errors.cilindraje = "Cilindraje es requerido";

    if (Object.keys(errors).length > 0) {
      return json({ errors }, { status: 400 });
    }

    // Extraer datos de imágenes
    const orderedImagesMetadata: ImageMetadata[] = JSON.parse(formData.get("orderedImagesMetadata") as string || "[]");
    const imageIdsToDelete: {id: string, storage_id: string}[] = JSON.parse(formData.get("imageIdsToDelete") as string || "[]");

    console.log("=== DEBUG IMÁGENES ===");
    console.log("orderedImagesMetadata:", orderedImagesMetadata);
    console.log("imageIdsToDelete:", imageIdsToDelete);

    // 1. Insertar el vehículo principal
    const { data: vehicleData, error: vehicleError } = await supabase
      .from('vehiculos')
      .insert([{
        marca,
        modelo,
        anio,
        version,
        puertas,
        combustible,
        color,
        placa: placa.trim(),
        km,
        precio,
        transmision,
        carroceria,
        traccion,
        cilindraje,
        concesionario_id,
        user_id,
      }])
      .select('id, uuid')
      .single();

    if (vehicleError) throw vehicleError;
    const vehicleId = vehicleData.id;
    const vehicleUuid = vehicleData.uuid;

    console.log("=== DEBUG IMÁGENES ===");
    console.log("orderedImagesMetadata:", orderedImagesMetadata);
    console.log("imageIdsToDelete:", imageIdsToDelete);
    console.log("vehicleId:", vehicleId);
    console.log("vehicleUuid:", vehicleUuid);

    // 2. Procesar imágenes nuevas
    const imageUploadPromises = orderedImagesMetadata
      .filter((meta) => meta.isNew)
      .map(async (meta) => {
        console.log("Procesando imagen nueva:", meta);
        const file = formData.get(meta.storage_id) as File;
        console.log("Archivo encontrado:", file ? "SÍ" : "NO", file?.name);
        if (!file || !(file instanceof File)) {
          console.log("Archivo inválido, saltando...");
          return;
        }

        // El path debe usar el id numérico (vehicleId) para coincidir con el storage
        const filePath = `${vehicleId}/${meta.storage_id}`; // vehicleId es int8, así se ve en el bucket
        console.log("Subiendo a path:", filePath, "(vehicleId:", vehicleId, ", storage_id:", meta.storage_id, ")");
        
        // Verificar que el bucket existe antes de subir
        const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
        if (bucketsError) {
          console.error("Error listando buckets:", bucketsError);
          throw bucketsError;
        }
        
        const bucketExists = buckets?.some(bucket => bucket.name === 'imagen-vehiculo');
        if (!bucketExists) {
          console.error("Bucket 'imagen-vehiculo' no existe. Buckets disponibles:", buckets?.map(b => b.name));
          throw new Error("Bucket 'imagen-vehiculo' no existe. Por favor, créalo en Supabase Storage.");
        }
        
        console.log("Bucket 'imagen-vehiculo' existe. Intentando subir archivo...");
        
        const { error: uploadError } = await supabase.storage
          .from('imagen-vehiculo')
          .upload(filePath, file, { cacheControl: '3600', upsert: false });
        
        if (uploadError) {
          console.error("Error subiendo archivo:", uploadError);
          throw uploadError;
        }

        console.log("Archivo subido exitosamente");

        const { data: urlData } = supabase.storage.from('imagen-vehiculo').getPublicUrl(filePath);
        console.log("URL pública generada:", urlData.publicUrl);

        // Insertar en la tabla images usando vehicle_id = vehicleUuid
        const insertResult = await supabase.from('images').insert({
          vehicle_id: vehicleUuid, // <-- usar uuid del vehículo
          url: urlData.publicUrl,
          order_index: String(meta.order_index),
          storage_id: meta.storage_id,
          destacada: meta.destacada ? 'true' : 'false',
          id_v: String(vehicleId), // opcional, solo referencia
        });

        if (insertResult.error) {
          console.error("Error insertando en BD images:", insertResult.error);
          throw insertResult.error;
        }

        console.log("Resultado inserción en BD images:", insertResult);
        return insertResult;
      });

    // 3. Actualizar orden y estado 'destacada' de imágenes existentes
    const updateOrderPromises = orderedImagesMetadata
      .filter((meta) => !meta.isNew)
      .map(async (meta) => {
        return supabase
          .from('images')
          .update({ 
            order_index: String(meta.order_index),
            destacada: meta.destacada ? 'true' : 'false'
          })
          .eq('id', meta.id);
      });

    // 4. Eliminar imágenes marcadas
    const deletePromises = imageIdsToDelete.map(async (imageToDelete) => {
      // La ruta en storage se reconstruye con el id de vehículo y el storage_id de la imagen
      // Nota: Asumimos que el vehicleId (int) está disponible. 
      // En un formulario de EDICIÓN real, este ID debería ser parte del formulario o cargado.
      // Para 'nuevo', esta lógica no debería ejecutarse, pero la refactorizamos como se pidió.
      const storagePath = `${vehicleId}/${imageToDelete.storage_id}`;
      
      // Eliminar del storage
      await supabase.storage
        .from('imagen-vehiculo')
        .remove([storagePath]);

      // Eliminar de la base de datos
      return supabase
        .from('images')
        .delete()
        .eq('id', imageToDelete.id);
    });

    // Ejecutar todas las operaciones de imágenes en paralelo
    await Promise.allSettled([
      ...imageUploadPromises,
      ...updateOrderPromises,
      ...deletePromises
    ]);

    // 5. Actualizar url_img en vehiculos con la imagen destacada
    console.log("[vehiculos.nuevo.tsx - action] Buscando imagen destacada para actualizar url_img...");
    
    // Buscar la imagen destacada entre las imágenes procesadas
    const featuredImage = orderedImagesMetadata.find(meta => meta.destacada === true);
    
    if (featuredImage) {
      let featuredImageUrl: string;
      
      if (featuredImage.isNew) {
        // Para imágenes nuevas, construir la URL pública
        const filePath = `${vehicleId}/${featuredImage.storage_id}`;
        const { data: urlData } = supabase.storage.from('imagen-vehiculo').getPublicUrl(filePath);
        featuredImageUrl = urlData.publicUrl;
      } else {
        // Para imágenes existentes, usar la URL almacenada
        featuredImageUrl = featuredImage.url || '';
      }
      
      if (featuredImageUrl) {
        console.log(`[vehiculos.nuevo.tsx - action] Actualizando url_img con: ${featuredImageUrl}`);
        
        const { error: updateUrlError } = await supabase
          .from('vehiculos')
          .update({ url_img: featuredImageUrl })
          .eq('uuid', vehicleUuid);
          
        if (updateUrlError) {
          console.error("[vehiculos.nuevo.tsx - action] Error actualizando url_img:", updateUrlError);
          // No lanzar error aquí para no fallar toda la operación
        } else {
          console.log("[vehiculos.nuevo.tsx - action] url_img actualizada exitosamente");
        }
      }
    } else {
      console.log("[vehiculos.nuevo.tsx - action] No se encontró imagen destacada, url_img permanece sin cambios");
    }

    console.log("[vehiculos.nuevo.tsx - action] Action finished successfully, redirecting...");
    return redirect('/vehiculos');

  } catch (error: any) {
    console.error("Error en la action:", error);
    return json({ error: error.message }, { status: 500 });
  }
}

export default function NuevoVehiculo() {
  const loaderData = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const actionData = useActionData<typeof action>();
  const navigate = useNavigate();
  const marcas = 'marcas' in loaderData ? loaderData.marcas : [];
  const aniosGlobal = 'anios' in loaderData ? loaderData.anios : [];
  const error = (loaderData as any).error;

  // Estados locales para los selectores anidados
  const [marcaSeleccionada, setMarcaSeleccionada] = useState("");
  const [modeloSeleccionado, setModeloSeleccionado] = useState("");
  const [anioSeleccionado, setAnioSeleccionado] = useState("");
  const [versionSeleccionada, setVersionSeleccionada] = useState("");
  const [currentStep, setCurrentStep] = useState(1);

  // Fetchers para modelos, años y versiones
  const modelosFetcher = useFetcher();
  const aniosFetcher = useFetcher();
  const versionesFetcher = useFetcher();

  // Opciones de modelos
  const modelos = (modelosFetcher.data && typeof modelosFetcher.data === 'object' && Array.isArray((modelosFetcher.data as any).modelos)) ? (modelosFetcher.data as any).modelos : [];
  // Opciones de años (filtrados por marca y modelo)
  const anios = (aniosFetcher.data && typeof aniosFetcher.data === 'object' && Array.isArray((aniosFetcher.data as any).anios))
    ? (aniosFetcher.data as any).anios
    : (marcaSeleccionada && modeloSeleccionado ? [] : aniosGlobal);
  // Opciones de versiones
  const versiones = (versionesFetcher.data && typeof versionesFetcher.data === 'object' && Array.isArray((versionesFetcher.data as any).versiones)) ? (versionesFetcher.data as any).versiones : [];

  // Estados para campos del Paso 2
  const [puertas, setPuertas] = useState("");
  const [combustible, setCombustible] = useState("");
  const [color, setColor] = useState("");
  const [placa, setPlaca] = useState("");
  const [km, setKm] = useState("");
  const [precio, setPrecio] = useState("");
  const [transmision, setTransmision] = useState("");
  const [carroceria, setCarroceria] = useState("");
  const [traccion, setTraccion] = useState("");
  const [cilindraje, setCilindraje] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [ubicacion, setUbicacion] = useState("");

  const [imageUploaderData, setImageUploaderData] = useState<ImageUploaderChanges | null>(null);

  // Estado para el toast de loading
  const [showLoadingToast, setShowLoadingToast] = useState(false);

  const handleImagesChange = useCallback((changes: ImageUploaderChanges) => {
    setImageUploaderData(changes);
  }, []);

  // Validación robusta para habilitar el botón Siguiente en Paso 2
  const paso2Completo =
    puertas !== "" &&
    combustible !== "" &&
    color !== "" &&
    placa.trim() !== "" &&
    transmision !== "" &&
    carroceria !== "" &&
    traccion !== "" &&
    km !== null && km !== undefined && km !== "" && !isNaN(Number(km)) &&
    precio !== null && precio !== undefined && precio !== "" && !isNaN(Number(precio)) &&
    cilindraje !== null && cilindraje !== undefined && cilindraje !== "" && !isNaN(Number(cilindraje));

  const paso3Completo = imageUploaderData && imageUploaderData.orderedImagesMetadata.length > 0;

  // Cuando cambia la marca, cargar modelos
  useEffect(() => {
    setModeloSeleccionado("");
    setAnioSeleccionado("");
    setVersionSeleccionada("");
    if (marcaSeleccionada) {
      modelosFetcher.load(`/vehiculos/nuevo?forOptions=modelos&marca=${encodeURIComponent(marcaSeleccionada)}`);
    }
  }, [marcaSeleccionada]);

  // Cuando cambia el modelo, cargar años
  useEffect(() => {
    setAnioSeleccionado("");
    setVersionSeleccionada("");
    if (marcaSeleccionada && modeloSeleccionado) {
      aniosFetcher.load(`/vehiculos/nuevo?forOptions=anios&marca=${encodeURIComponent(marcaSeleccionada)}&modelo=${encodeURIComponent(modeloSeleccionado)}`);
    }
  }, [marcaSeleccionada, modeloSeleccionado]);

  // Cuando cambia el año, cargar versiones
  useEffect(() => {
    setVersionSeleccionada("");
    if (marcaSeleccionada && modeloSeleccionado && anioSeleccionado) {
      versionesFetcher.load(`/vehiculos/nuevo?forOptions=versiones&marca=${encodeURIComponent(marcaSeleccionada)}&modelo=${encodeURIComponent(modeloSeleccionado)}&anio=${encodeURIComponent(anioSeleccionado)}`);
    }
  }, [marcaSeleccionada, modeloSeleccionado, anioSeleccionado]);

  // Validación simple para habilitar el botón Siguiente en Paso 1
  const paso1Completo = !!(marcaSeleccionada && modeloSeleccionado && anioSeleccionado && versionSeleccionada);

  // Opciones estáticas para los selectores del Paso 2
  const opcionesPuertas = [2, 3, 4, 5];
  const opcionesCombustible = ["Gasolina", "EV Electrico", "Hibrido Gasolina", "Diesel"];
  const opcionesColor = ["Blanco", "Azul", "Plateado", "Negro", "Rojo", "Verde", "Gris", "Zircón Arena", "Beige"];
  const opcionesTransmision = ["Automática", "Manual"];
  const opcionesCarroceria = ["Camioneta", "Sedan", "Hatchback", "Coupe", "Pick Up", "SUV"];
  const opcionesTraccion = ["4x2", "4x4", "4X3"];

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!imageUploaderData) return;

    // Mostrar el toast de loading
    setShowLoadingToast(true);

    const formData = new FormData();
    
    // Añadir datos del Paso 1
    formData.append("marca", marcaSeleccionada);
    formData.append("modelo", modeloSeleccionado);
    formData.append("anio", anioSeleccionado);
    formData.append("version", versionSeleccionada);
    
    // Añadir datos del Paso 2
    formData.append("puertas", puertas);
    formData.append("combustible", combustible);
    formData.append("color", color);
    formData.append("placa", placa);
    formData.append("km", km);
    formData.append("precio", precio);
    formData.append("transmision", transmision);
    formData.append("carroceria", carroceria);
    formData.append("traccion", traccion);
    formData.append("cilindraje", cilindraje);
    
    // Añadir datos del Paso 3 (imágenes)
    formData.append("orderedImagesMetadata", JSON.stringify(imageUploaderData.orderedImagesMetadata));
    formData.append("imageIdsToDelete", JSON.stringify(imageUploaderData.imageIdsToDelete));

    for (const [storage_id, file] of imageUploaderData.filesToUpload.entries()) {
      formData.append(storage_id, file);
    }
    
    submit(formData, { method: "post", encType: "multipart/form-data", replace: true });
  };

  // Manejar la finalización del toast
  const handleToastComplete = () => {
    setShowLoadingToast(false);
    // Redirigir a /vehiculos después de que el toast desaparezca
    setTimeout(() => {
      navigate('/vehiculos');
    }, 500);
  };

  return (
    <>
      <form className="max-w-3xl mx-auto p-8 bg-white rounded-xl shadow-lg font-sans" onSubmit={handleSubmit} method="post" encType="multipart/form-data">
        <h1 className="text-3xl font-bold text-brand-title mb-8 text-center">
          Publicar Nuevo Vehículo
        </h1>

        {actionData && 'error' in actionData && actionData.error && (
          <div className="mb-6 rounded bg-red-100 p-4 text-red-700 text-center">
            Error al guardar: {String(actionData.error)}
          </div>
        )}

        {actionData && 'errors' in actionData && actionData.errors && (
          <div className="mb-6 rounded bg-red-100 p-4 text-red-700">
            <h3 className="font-semibold mb-2">Errores de validación:</h3>
            <ul className="list-disc list-inside">
              {Object.entries(actionData.errors).map(([field, message]) => (
                <li key={field}>{String(message)}</li>
              ))}
            </ul>
          </div>
        )}

        {error && (
          <div className="mb-6 rounded bg-red-100 p-4 text-red-700 text-center">
            {error}
          </div>
        )}

        {/* Paso 1 */}
        {currentStep === 1 && (
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-brand-title mb-2">Paso 1: Información Básica</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Selector de Marca */}
              <div>
                <label htmlFor="marca" className="block text-sm font-medium text-brand-title mb-1">Marca</label>
                <select
                  id="marca"
                  name="marca"
                  className="w-full rounded border border-brand-secondary px-3 py-2 bg-white text-brand-title"
                  value={marcaSeleccionada}
                  onChange={e => setMarcaSeleccionada(e.target.value)}
                >
                  <option value="">Seleccione Marca</option>
                  {Array.isArray(marcas) && marcas.map((marca: string) => (
                    <option key={marca} value={marca}>{marca}</option>
                  ))}
                </select>
              </div>
              {/* Selector de Modelo */}
              <div>
                <label htmlFor="modelo" className="block text-sm font-medium text-brand-title mb-1">Modelo</label>
                <select
                  id="modelo"
                  name="modelo"
                  className="w-full rounded border border-brand-secondary px-3 py-2 bg-white text-brand-title"
                  value={modeloSeleccionado}
                  onChange={e => setModeloSeleccionado(e.target.value)}
                  disabled={!marcaSeleccionada || modelosFetcher.state === "loading"}
                >
                  <option value="">Seleccione Modelo</option>
                  {Array.isArray(modelos) && modelos.map((modelo: string) => (
                    <option key={modelo} value={modelo}>{modelo}</option>
                  ))}
                </select>
              </div>
              {/* Selector de Año */}
              <div>
                <label htmlFor="anio" className="block text-sm font-medium text-brand-title mb-1">Año</label>
                <select
                  id="anio"
                  name="anio"
                  className="w-full rounded border border-brand-secondary px-3 py-2 bg-white text-brand-title"
                  value={anioSeleccionado}
                  onChange={e => setAnioSeleccionado(e.target.value)}
                  disabled={(!marcaSeleccionada || !modeloSeleccionado) && anios !== aniosGlobal}
                >
                  <option value="">Seleccione Año</option>
                  {Array.isArray(anios) && anios.map((anio: string) => (
                    <option key={anio} value={anio}>{anio}</option>
                  ))}
                </select>
              </div>
              {/* Selector de Versión */}
              <div>
                <label htmlFor="version" className="block text-sm font-medium text-brand-title mb-1">Versión</label>
                <select
                  id="version"
                  name="version"
                  className="w-full rounded border border-brand-secondary px-3 py-2 bg-white text-brand-title"
                  value={versionSeleccionada}
                  onChange={e => setVersionSeleccionada(e.target.value)}
                  disabled={!marcaSeleccionada || !modeloSeleccionado || !anioSeleccionado || versionesFetcher.state === "loading"}
                >
                  <option value="">Seleccione Versión</option>
                  {Array.isArray(versiones) && versiones.map((version: string) => (
                    <option key={version} value={version}>{version}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-8 flex justify-end">
              <button
                type="button"
                className="inline-flex items-center rounded-md bg-brand-primary px-6 py-2 text-brand-title font-semibold shadow hover:bg-brand-secondary focus:outline-none focus:ring-2 focus:ring-brand-highlight focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => setCurrentStep(2)}
                disabled={!paso1Completo}
              >
                Siguiente
              </button>
            </div>
          </section>
        )}

        {/* Paso 2 */}
        {currentStep === 2 && (
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-brand-title mb-2">Paso 2: Características del Vehículo</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Puertas */}
              <div>
                <label htmlFor="puertas" className="block text-sm font-medium text-brand-title mb-1">Puertas</label>
                <select id="puertas" name="puertas" className="w-full rounded border border-brand-secondary px-3 py-2 bg-white text-brand-title" value={puertas} onChange={e => setPuertas(e.target.value)}>
                  <option value="">Seleccione...</option>
                  {opcionesPuertas.map((op) => (
                    <option key={op} value={op}>{op}</option>
                  ))}
                </select>
              </div>
              {/* Combustible */}
              <div>
                <label htmlFor="combustible" className="block text-sm font-medium text-brand-title mb-1">Combustible</label>
                <select id="combustible" name="combustible" className="w-full rounded border border-brand-secondary px-3 py-2 bg-white text-brand-title" value={combustible} onChange={e => setCombustible(e.target.value)}>
                  <option value="">Seleccione...</option>
                  {opcionesCombustible.map((op) => (
                    <option key={op} value={op}>{op}</option>
                  ))}
                </select>
              </div>
              {/* Color */}
              <div>
                <label htmlFor="color" className="block text-sm font-medium text-brand-title mb-1">Color</label>
                <select id="color" name="color" className="w-full rounded border border-brand-secondary px-3 py-2 bg-white text-brand-title" value={color} onChange={e => setColor(e.target.value)}>
                  <option value="">Seleccione...</option>
                  {opcionesColor.map((op) => (
                    <option key={op} value={op}>{op}</option>
                  ))}
                </select>
              </div>
              {/* Placa */}
              <div>
                <label htmlFor="placa" className="block text-sm font-medium text-brand-title mb-1">Placa</label>
                <input type="text" id="placa" name="placa" className="w-full rounded border border-brand-secondary px-3 py-2 bg-white text-brand-title" value={placa} onChange={e => setPlaca(e.target.value)} />
              </div>
              {/* Kilometraje */}
              <div>
                <label htmlFor="km" className="block text-sm font-medium text-brand-title mb-1">Kilometraje (km)</label>
                <input type="number" id="km" name="km" className="w-full rounded border border-brand-secondary px-3 py-2 bg-white text-brand-title" value={km} onChange={e => setKm(e.target.value)} placeholder="0.00" step="0.01" />
              </div>
              {/* Precio */}
              <div>
                <label htmlFor="precio" className="block text-sm font-medium text-brand-title mb-1">Precio</label>
                <input type="number" id="precio" name="precio" className="w-full rounded border border-brand-secondary px-3 py-2 bg-white text-brand-title" value={precio} onChange={e => setPrecio(e.target.value)} placeholder="0.00" step="0.01" />
              </div>
              {/* Transmisión */}
              <div>
                <label htmlFor="transmision" className="block text-sm font-medium text-brand-title mb-1">Transmisión</label>
                <select id="transmision" name="transmision" className="w-full rounded border border-brand-secondary px-3 py-2 bg-white text-brand-title" value={transmision} onChange={e => setTransmision(e.target.value)}>
                  <option value="">Seleccione...</option>
                  {opcionesTransmision.map((op) => (
                    <option key={op} value={op}>{op}</option>
                  ))}
                </select>
              </div>
              {/* Carrocería */}
              <div>
                <label htmlFor="carroceria" className="block text-sm font-medium text-brand-title mb-1">Carrocería</label>
                <select id="carroceria" name="carroceria" className="w-full rounded border border-brand-secondary px-3 py-2 bg-white text-brand-title" value={carroceria} onChange={e => setCarroceria(e.target.value)}>
                  <option value="">Seleccione...</option>
                  {opcionesCarroceria.map((op) => (
                    <option key={op} value={op}>{op}</option>
                  ))}
                </select>
              </div>
              {/* Tracción */}
              <div>
                <label htmlFor="traccion" className="block text-sm font-medium text-brand-title mb-1">Tracción</label>
                <select id="traccion" name="traccion" className="w-full rounded border border-brand-secondary px-3 py-2 bg-white text-brand-title" value={traccion} onChange={e => setTraccion(e.target.value)}>
                  <option value="">Seleccione...</option>
                  {opcionesTraccion.map((op) => (
                    <option key={op} value={op}>{op}</option>
                  ))}
                </select>
              </div>
              {/* Cilindraje */}
              <div>
                <label htmlFor="cilindraje" className="block text-sm font-medium text-brand-title mb-1">Cilindraje</label>
                <input type="number" id="cilindraje" name="cilindraje" className="w-full rounded border border-brand-secondary px-3 py-2 bg-white text-brand-title" value={cilindraje} onChange={e => setCilindraje(e.target.value)} />
              </div>
            </div>
            <div className="mt-8 flex justify-between">
              <button
                type="button"
                className="inline-flex items-center rounded-md bg-brand-secondary px-6 py-2 text-brand-title font-semibold shadow hover:bg-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-highlight focus:ring-offset-2"
                onClick={() => setCurrentStep(1)}
              >
                Anterior
              </button>
              <button
                type="button"
                className="inline-flex items-center rounded-md bg-brand-primary px-6 py-2 text-brand-title font-semibold shadow hover:bg-brand-secondary focus:outline-none focus:ring-2 focus:ring-brand-highlight focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => setCurrentStep(3)}
                disabled={!paso2Completo}
              >
                Siguiente
              </button>
            </div>
          </section>
        )}

        {/* Paso 3 */}
        {currentStep === 3 && (
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-brand-title mb-2">Paso 3: Detalles Adicionales y Contacto</h2>
            <ImageUploader onImagesChange={handleImagesChange} />
            <div className="mt-8 flex justify-between">
              <button
                type="button"
                className="inline-flex items-center rounded-md bg-brand-secondary px-6 py-2 text-brand-title font-semibold shadow hover:bg-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-highlight focus:ring-offset-2"
                onClick={() => setCurrentStep(2)}
              >
                Anterior
              </button>
              <button
                type="submit"
                className="inline-flex items-center rounded-md bg-brand-primary px-6 py-2 text-brand-title font-semibold shadow hover:bg-brand-secondary focus:outline-none focus:ring-2 focus:ring-brand-highlight focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!paso1Completo || !paso2Completo || !paso3Completo}
              >
                Publicar Vehículo
              </button>
            </div>
          </section>
        )}
      </form>

      {/* Toast de Loading */}
      <LoadingToast
        message="Creando vehículo..."
        isVisible={showLoadingToast}
        onComplete={handleToastComplete}
      />
    </>
  );
} 