import { json, redirect, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useNavigate, useSearchParams, useFetcher, Form } from "@remix-run/react";
import { useState, useMemo, useEffect, useCallback, Fragment } from "react";
import { supabase } from "~/utils/supabase.server";
import { Range } from 'react-range';

// --- Componente Skeleton ---
const VehiculoCardSkeleton = () => (
  <div className="bg-white rounded-xl border border-brand-secondary shadow-md overflow-hidden animate-pulse">
    <div className="h-48 bg-gray-200" />
    <div className="p-4 space-y-4">
      <div className="h-6 bg-gray-200 rounded w-3/4" />
      <div className="flex items-center space-x-2">
        <div className="w-5 h-5 bg-gray-200 rounded-full" />
        <div className="h-4 bg-gray-200 rounded w-1/2" />
      </div>
      <div className="pt-3 border-t border-brand-secondary">
        <div className="h-8 bg-gray-200 rounded w-1/3" />
      </div>
      <div className="h-10 bg-gray-300 rounded w-full mt-2" />
    </div>
  </div>
);

// --- Funciones de consulta reutilizadas ---

// Función optimizada para obtener marcas desde vehiculos
async function getMarcasUnicas(): Promise<string[]> {
  const { data, error } = await supabase
    .from("vehiculos")
    .select("marca")
    .not("marca", 'is', null)
    .not("marca", 'eq', '')
    .order('marca');
  if (error) throw error;
  const uniqueValues = Array.from(new Set(data.map(row => row.marca).filter(Boolean)));
  return uniqueValues.sort();
}

// Función optimizada para obtener modelos únicos por marca
async function getModelosPorMarca(marca: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("vehiculos")
    .select("modelo")
    .eq("marca", marca)
    .not("modelo", 'is', null)
    .not("modelo", 'eq', '')
    .order('modelo');
  if (error) throw error;
  const uniqueValues = Array.from(new Set(data.map(row => row.modelo).filter(Boolean)));
  return uniqueValues.sort();
}

// Función optimizada para obtener años únicos por marca y modelo
async function getAniosPorModelo(marca: string, modelo: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("vehiculos")
    .select("anio")
    .eq("marca", marca)
    .eq("modelo", modelo)
    .not("anio", 'is', null)
    .order('anio', { ascending: false });
  if (error) throw error;
  const uniqueValues = Array.from(new Set(data.map(row => String(row.anio)).filter(Boolean)));
  return uniqueValues;
}

// Nueva función para obtener combustibles únicos
async function getCombustiblesUnicos(): Promise<string[]> {
  const { data, error } = await supabase
    .from("vehiculos")
    .select("combustible")
    .not("combustible", 'is', null)
    .not("combustible", 'eq', '')
    .order('combustible');
  if (error) throw error;
  const uniqueValues = Array.from(new Set(data.map(row => row.combustible).filter(Boolean)));
  return uniqueValues.sort();
}

// Nueva función para obtener transmisiones únicas
async function getTransmisionesUnicas(): Promise<string[]> {
  const { data, error } = await supabase
    .from("vehiculos")
    .select("transmision")
    .not("transmision", 'is', null)
    .not("transmision", 'eq', '')
    .order('transmision');
  if (error) throw error;
  const uniqueValues = Array.from(new Set(data.map(row => row.transmision).filter(Boolean)));
  return uniqueValues.sort();
}

// --- Tipos ---

export type VehiculoType = {
  uuid: string;
  marca: string | null;
  modelo: string | null;
  anio: number | null;
  km: number | null;
  precio: number | null;
  transmision: string | null;
  url_img: string | null;
};

type LoaderData = {
  vehiculos: VehiculoType[];
  marcas: string[];
  combustibles: string[];
  transmisiones: string[];
  filtrosActivos: {
    marca: string | null;
    modelo: string | null;
    anio: string | null;
    precioMin: string | null;
    precioMax: string | null;
    kmMin: string | null;
    kmMax: string | null;
    combustible: string | null;
    transmision: string | null;
  };
  error?: string;
  totalVehiculos: number;
  hasMore: boolean;
  offset: number;
  overallMinPrice: number;
  overallMaxPrice: number;
  overallMinKm: number;
  overallMaxKm: number;
};

type OptionsLoaderData = {
  modelos?: string[];
  anios?: string[];
  error?: string;
};

type VehiculosResponse = {
  vehiculos: VehiculoType[];
  hasMore: boolean;
};

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const searchParams = url.searchParams;
  const forOptions = searchParams.get("forOptions");
  const offset = Number(searchParams.get("offset")) || 0;

  const marca = searchParams.get("marca");
  const modelo = searchParams.get("modelo");
  const anio = searchParams.get("anio");
  const precioMin = searchParams.get("precioMin");
  const precioMax = searchParams.get("precioMax");
  const kmMin = searchParams.get("kmMin");
  const kmMax = searchParams.get("kmMax");
  const combustible = searchParams.get("combustible");
  const transmision = searchParams.get("transmision");
  const sortBy = searchParams.get("sortBy");
  const sortOrder = searchParams.get("sortOrder");

  // Endpoint para opciones de filtro dinámicas
  try {
    if (forOptions === "modelos" && marca) {
      const modelos = await getModelosPorMarca(marca);
      return json({ modelos });
    }
    if (forOptions === "anios" && marca && modelo) {
      const anios = await getAniosPorModelo(marca, modelo);
      return json({ anios });
    }
  } catch (error: any) {
    return json({ error: "Error al cargar opciones de filtro" }, { status: 500 });
  }

  // Carga principal de la página
  const limit = 20;

  try {
    // 1. Obtener opciones iniciales para filtros
    const marcas = await getMarcasUnicas();
    const combustibles = await getCombustiblesUnicos();
    const transmisiones = await getTransmisionesUnicas();
    
    // Obtener rango de precios dinámico según los filtros activos (excepto precioMin/precioMax)
    let minPriceQuery = supabase.from('vehiculos').select('precio').not('precio', 'is', null);
    let maxPriceQuery = supabase.from('vehiculos').select('precio').not('precio', 'is', null);
    if (marca) { minPriceQuery = minPriceQuery.eq('marca', marca); maxPriceQuery = maxPriceQuery.eq('marca', marca); }
    if (modelo) { minPriceQuery = minPriceQuery.eq('modelo', modelo); maxPriceQuery = maxPriceQuery.eq('modelo', modelo); }
    if (anio) { minPriceQuery = minPriceQuery.eq('anio', anio); maxPriceQuery = maxPriceQuery.eq('anio', anio); }
    if (kmMin) { minPriceQuery = minPriceQuery.gte('km', Number(kmMin)); maxPriceQuery = maxPriceQuery.gte('km', Number(kmMin)); }
    if (kmMax) { minPriceQuery = minPriceQuery.lte('km', Number(kmMax)); maxPriceQuery = maxPriceQuery.lte('km', Number(kmMax)); }
    if (combustible) { minPriceQuery = minPriceQuery.eq('combustible', combustible); maxPriceQuery = maxPriceQuery.eq('combustible', combustible); }
    if (transmision) { minPriceQuery = minPriceQuery.eq('transmision', transmision); maxPriceQuery = maxPriceQuery.eq('transmision', transmision); }
    const { data: minPriceData } = await minPriceQuery.order('precio', { ascending: true }).limit(1).single();
    const { data: maxPriceData } = await maxPriceQuery.order('precio', { ascending: false }).limit(1).single();
    const overallMinPrice = minPriceData?.precio ?? 0;
    const overallMaxPrice = maxPriceData?.precio ?? 1000000000;

    // 2. Construir la consulta principal con filtros
    let query = supabase
      .from("vehiculos")
      .select("uuid, marca, modelo, anio, km, precio, transmision, url_img", { count: "exact" });
    
    // Aplicar filtros si existen
    if (marca) query = query.eq('marca', marca);
    if (modelo) query = query.eq('modelo', modelo);
    if (anio) query = query.eq('anio', anio);
    if (precioMin) query = query.gte('precio', Number(precioMin));
    if (precioMax) query = query.lte('precio', Number(precioMax));
    if (kmMin) query = query.gte('km', Number(kmMin));
    if (kmMax) query = query.lte('km', Number(kmMax));
    if (combustible) query = query.eq('combustible', combustible);
    if (transmision) query = query.eq('transmision', transmision);
    if (sortBy && sortOrder) {
      query = query.order(sortBy, { ascending: sortOrder === 'asc' });
    } else {
      query = query.order("anio", { ascending: false });
    }

    // 3. Ejecutar consulta paginada
    const { data: vehiculos, error, count } = await query
      .range(offset, offset + limit - 1);

    if (error) throw error;
    
    const totalVehiculos = count || 0;
    
    return json({
      vehiculos: vehiculos || [],
      marcas,
      combustibles,
      transmisiones,
      filtrosActivos: { marca, modelo, anio, precioMin, precioMax, kmMin, kmMax, combustible, transmision },
      totalVehiculos,
      hasMore: offset + (vehiculos?.length || 0) < totalVehiculos,
      offset,
      overallMinPrice,
      overallMaxPrice,
      overallMinKm: Number(kmMin) || 0,
      overallMaxKm: Number(kmMax) || 1000000,
    });
  } catch (error: any) {
    return json({
      vehiculos: [],
      marcas: [],
      combustibles: [],
      transmisiones: [],
      filtrosActivos: { marca: null, modelo: null, anio: null, precioMin: null, precioMax: null, kmMin: null, kmMax: null, combustible: null, transmision: null },
      error: error?.message || "Error desconocido",
      totalVehiculos: 0,
      hasMore: false,
      offset: 0,
      overallMinPrice: 0,
      overallMaxPrice: 1000000000,
      overallMinKm: 0,
      overallMaxKm: 1000000,
    });
  }
}

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  return debouncedValue;
}

function PriceRangeFilter({
  minSlider,
  maxSlider,
  priceRange,
  setPriceRange,
  setMinPrice,
  setMaxPrice,
  setPrecioRango,
  formatPrice
}: {
  minSlider: number,
  maxSlider: number,
  priceRange: [number, number],
  setPriceRange: (v: [number, number]) => void,
  setMinPrice: (v: string) => void,
  setMaxPrice: (v: string) => void,
  setPrecioRango: (v: string | null) => void,
  formatPrice: (v: number) => string
}) {
  return (
    <div className="mt-4 w-full flex flex-col items-center">
      <Range
        step={100000}
        min={minSlider}
        max={maxSlider}
        values={priceRange}
        onChange={values => {
          setPriceRange(values as [number, number]);
          setMinPrice(values[0].toString());
          setMaxPrice(values[1].toString());
          setPrecioRango(null);
        }}
        renderTrack={({ props, children }) => (
          <div
            {...props}
            className="w-full h-2 bg-gray-200 rounded-full"
            style={{ ...props.style, width: '100%' }}
          >
            <div
              className="h-2 bg-brand-primary rounded-full"
              style={{
                position: 'absolute',
                left: `${((priceRange[0] - minSlider) / (maxSlider - minSlider)) * 100}%`,
                right: `${100 - ((priceRange[1] - minSlider) / (maxSlider - minSlider)) * 100}%`,
                top: 0,
                bottom: 0,
              }}
            />
            {children}
          </div>
        )}
        renderThumb={({ props }) => (
          <div
            {...props}
            className="w-5 h-5 bg-brand-primary rounded-full border-2 border-white shadow flex items-center justify-center cursor-pointer"
            style={{ ...props.style, zIndex: 10 }}
          />
        )}
      />
      <div className="w-full flex justify-between text-xs mt-2">
        <span>Min: {formatPrice(priceRange[0])}</span>
        <span>Max: {formatPrice(priceRange[1])}</span>
      </div>
    </div>
  );
}

// Componente encapsulado para el contenido de los filtros
const FiltrosContent = ({
  loaderData,
  marca, setMarca,
  modelo, setModelo,
  anio, setAnio,
  modelosFetcher, aniosFetcher,
  modelos, anios,
  precioRango, handlePrecioRangoClick,
  minSlider, maxSlider,
  priceRange, setPriceRange,
  setMinPrice, setMaxPrice,
  setPrecioRango, formatPrice,
  handleClearFilters,
  combustible, setCombustible,
  combustibles,
  transmision, setTransmision,
  transmisiones,
}: any) => (
  <Fragment>
    <div className="space-y-6">
      {/* Filtro por Marca */}
      <div>
        <h3 className="font-semibold text-brand-title mb-2">Marca</h3>
        <div className="max-h-48 overflow-y-auto space-y-0.5 pr-2">
          {loaderData.marcas.map((m: string) => (
            <button
              key={m}
              onClick={() => {
                setMarca(m === marca ? "" : m);
                setModelo("");
                setAnio("");
              }}
              className={`w-full text-left px-2 py-1 rounded text-xs transition-colors ${
                marca === m 
                  ? 'bg-brand-primary text-white font-semibold shadow' 
                  : 'text-brand-text hover:bg-brand-secondary'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Filtro por Modelo */}
      {marca && (
        <div>
          <h3 className="font-semibold text-brand-title mb-2">Modelo</h3>
          {modelosFetcher.state === "loading" ? (
            <p className="text-sm text-brand-text">Cargando...</p>
          ) : (
            <div className="max-h-48 overflow-y-auto space-y-0.5 pr-2">
              {modelos.map((m: string) => (
                <button
                  key={m}
                  onClick={() => {
                    setModelo(m === modelo ? "" : m);
                    setAnio("");
                  }}
                  className={`w-full text-left px-2 py-1 rounded text-xs transition-colors ${
                    modelo === m
                      ? 'bg-brand-primary text-white font-semibold shadow'
                      : 'text-brand-text hover:bg-brand-secondary'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Filtro por Año */}
      {modelo && (
        <div>
          <h3 className="font-semibold text-brand-title mb-2">Año</h3>
          {aniosFetcher.state === "loading" ? (
            <p className="text-sm text-brand-text">Cargando...</p>
          ) : (
            <div className="max-h-48 overflow-y-auto space-y-0.5 pr-2">
              {anios.map((a: string) => (
                <button
                  key={a}
                  onClick={() => setAnio(a === anio ? "" : a)}
                  className={`w-full text-left px-2 py-1 rounded text-xs transition-colors ${
                    anio === a
                      ? 'bg-brand-primary text-white font-semibold shadow'
                      : 'text-brand-text hover:bg-brand-secondary'
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Filtro por Precio */}
      <div>
        <h3 className="font-semibold text-brand-title mb-2">Precio</h3>
        <div className="space-y-1">
          <button onClick={() => handlePrecioRangoClick('low', '', '20000000')} className={`w-full text-left px-2 py-1 rounded text-xs transition-colors ${precioRango === 'low' ? 'bg-brand-primary text-white font-semibold shadow' : 'text-brand-text hover:bg-brand-secondary'}`}>
            &lt; $20M
          </button>
          <button onClick={() => handlePrecioRangoClick('mid', '20000000', '50000000')} className={`w-full text-left px-2 py-1 rounded text-xs transition-colors ${precioRango === 'mid' ? 'bg-brand-primary text-white font-semibold shadow' : 'text-brand-text hover:bg-brand-secondary'}`}>
            $20M - $50M
          </button>
          <button onClick={() => handlePrecioRangoClick('high', '50000000', '')} className={`w-full text-left px-2 py-1 rounded text-xs transition-colors ${precioRango === 'high' ? 'bg-brand-primary text-white font-semibold shadow' : 'text-brand-text hover:bg-brand-secondary'}`}>
            &gt; $50M
          </button>
        </div>
        <PriceRangeFilter
          minSlider={minSlider}
          maxSlider={maxSlider}
          priceRange={priceRange}
          setPriceRange={setPriceRange}
          setMinPrice={setMinPrice}
          setMaxPrice={setMaxPrice}
          setPrecioRango={setPrecioRango}
          formatPrice={formatPrice}
        />
      </div>

      {/* Filtro por Combustible */}
      <div>
        <h3 className="font-semibold text-brand-title mb-2">Combustible</h3>
        <div className="max-h-48 overflow-y-auto space-y-0.5 pr-2">
          {combustibles.map((c: string) => (
            <button
              key={c}
              onClick={() => setCombustible(c === combustible ? "" : c)}
              className={`w-full text-left px-2 py-1 rounded text-xs transition-colors ${combustible === c ? 'bg-brand-primary text-white font-semibold shadow' : 'text-brand-text hover:bg-brand-secondary'}`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Filtro por Transmisión */}
      <div>
        <h3 className="font-semibold text-brand-title mb-2">Transmisión</h3>
        <div className="max-h-48 overflow-y-auto space-y-0.5 pr-2">
          {transmisiones.map((t: string) => (
            <button
              key={t}
              onClick={() => setTransmision(t === transmision ? "" : t)}
              className={`w-full text-left px-2 py-1 rounded text-xs transition-colors ${transmision === t ? 'bg-brand-primary text-white font-semibold shadow' : 'text-brand-text hover:bg-brand-secondary'}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
    </div>

    {/* Botón Limpiar Filtros */}
    <div className="mt-8 pt-4 border-t border-brand-secondary">
      <button
        type="button"
        onClick={handleClearFilters}
        className="w-full inline-flex justify-center rounded-md border border-brand-secondary px-4 py-2 text-sm font-medium text-brand-text bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-highlight focus:ring-offset-2"
      >
        Limpiar Filtros
      </button>
    </div>
  </Fragment>
);

export default function VehiculosPage() {
  const loaderData = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const fetcher = useFetcher<typeof loader>();
  const navigate = useNavigate();
  const [modalFiltrosOpen, setModalFiltrosOpen] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [modalOrdenOpen, setModalOrdenOpen] = useState(false);
  const [isOrdenModalVisible, setIsOrdenModalVisible] = useState(false);

  // Efecto para controlar la animación de entrada del modal de filtros
  useEffect(() => {
    if (modalFiltrosOpen) {
      setIsModalVisible(true);
    }
  }, [modalFiltrosOpen]);

  // Efecto para animación del modal de ordenamiento
  useEffect(() => {
    if (modalOrdenOpen) {
      setIsOrdenModalVisible(true);
    }
  }, [modalOrdenOpen]);

  const closeModal = () => {
    setIsModalVisible(false);
    setTimeout(() => {
      setModalFiltrosOpen(false);
    }, 500); // Coincide con la duración de la animación
  };

  const closeOrdenModal = () => {
    setIsOrdenModalVisible(false);
    setTimeout(() => {
      setModalOrdenOpen(false);
    }, 500);
  };

  // Type guard para saber si tenemos los datos principales o solo opciones
  const isMainData = (data: any): data is LoaderData => 'vehiculos' in data;
  
  // Estados para la lista de vehículos y scroll
  const [items, setItems] = useState(isMainData(loaderData) ? loaderData.vehiculos : []);
  const [hasMore, setHasMore] = useState(isMainData(loaderData) ? loaderData.hasMore : false);
  const [totalResultados, setTotalResultados] = useState(isMainData(loaderData) ? loaderData.totalVehiculos : 0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Estados locales para los filtros
  const [marca, setMarca] = useState(isMainData(loaderData) ? loaderData.filtrosActivos.marca || "" : "");
  const [modelo, setModelo] = useState(isMainData(loaderData) ? loaderData.filtrosActivos.modelo || "" : "");
  const [anio, setAnio] = useState(isMainData(loaderData) ? loaderData.filtrosActivos.anio || "" : "");
  const [precioRango, setPrecioRango] = useState<string | null>(null);
  const [minPrice, setMinPrice] = useState(isMainData(loaderData) ? loaderData.filtrosActivos.precioMin || "" : "");
  const [maxPrice, setMaxPrice] = useState(isMainData(loaderData) ? loaderData.filtrosActivos.precioMax || "" : "");
  const [combustible, setCombustible] = useState(isMainData(loaderData) ? loaderData.filtrosActivos.combustible || "" : "");
  const [transmision, setTransmision] = useState(isMainData(loaderData) ? loaderData.filtrosActivos.transmision || "" : "");

  const debouncedMinPrice = useDebounce(minPrice, 500);
  const debouncedMaxPrice = useDebounce(maxPrice, 500);
  const debouncedCombustible = useDebounce(combustible, 500);
  const debouncedTransmision = useDebounce(transmision, 500);

  // Fetchers para opciones dinámicas
  const modelosFetcher = useFetcher<OptionsLoaderData>();
  const aniosFetcher = useFetcher<OptionsLoaderData>();
  
  // Referencia para el último elemento (infinite scroll)
  const lastItemRef = useCallback((node: HTMLDivElement) => {
    if (fetcher.state === 'loading' || !hasMore) return;
    if (node) {
      const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
          setIsLoadingMore(true);
          const newOffset = items.length;
          const params = new URLSearchParams(searchParams);
          params.set("offset", String(newOffset));
          fetcher.load(`/vehiculosAdminGrid?${params.toString()}`);
        }
      });
      observer.observe(node);
      return () => observer.disconnect();
    }
  }, [fetcher.state, hasMore, items.length, searchParams]);
  
  // Cargar modelos cuando la marca cambia
  useEffect(() => {
    if (marca) {
      modelosFetcher.load(`/vehiculosAdminGrid?forOptions=modelos&marca=${encodeURIComponent(marca)}`);
    }
  }, [marca]);
  
  // Cargar años cuando el modelo cambia
  useEffect(() => {
    if (marca && modelo) {
      aniosFetcher.load(`/vehiculosAdminGrid?forOptions=anios&marca=${encodeURIComponent(marca)}&modelo=${encodeURIComponent(modelo)}`);
    }
  }, [marca, modelo]);

  // Estados para ordenamiento
  const [selectedSortBy, setSelectedSortBy] = useState(() => searchParams.get("sortBy") || "");
  const [selectedSortOrder, setSelectedSortOrder] = useState(() => searchParams.get("sortOrder") || "");

  // Sincronizar estado de filtros con searchParams y disparar recarga
  useEffect(() => {
    const params = new URLSearchParams();
    if (marca) params.set("marca", marca);
    if (modelo) params.set("modelo", modelo);
    if (anio) params.set("anio", anio);
    if (debouncedMinPrice) params.set("precioMin", debouncedMinPrice);
    if (debouncedMaxPrice) params.set("precioMax", debouncedMaxPrice);
    if (debouncedCombustible) params.set("combustible", debouncedCombustible);
    if (debouncedTransmision) params.set("transmision", debouncedTransmision);
    if (selectedSortBy) params.set("sortBy", selectedSortBy);
    if (selectedSortOrder) params.set("sortOrder", selectedSortOrder);
    
    // Comparamos solo la parte de filtros, no el offset
    const currentFilterParams = new URLSearchParams(searchParams);
    currentFilterParams.delete("offset");

    if (params.toString() !== currentFilterParams.toString()) {
      setItems([]); // Limpiar items para una nueva búsqueda
      params.set("offset", "0"); // Reiniciar paginación
      fetcher.load(`/vehiculosAdminGrid?${params.toString()}`);
      setSearchParams(params, { replace: true });
    }
  }, [marca, modelo, anio, debouncedMinPrice, debouncedMaxPrice, debouncedCombustible, debouncedTransmision, selectedSortBy, selectedSortOrder, searchParams, setSearchParams]);

  // Actualizar la lista de items cuando el fetcher trae nuevos datos
  useEffect(() => {
    const data = fetcher.data;
    if (data && isMainData(data)) {
      if (data.offset === 0) {
        setItems(data.vehiculos);
      } else {
        setItems(prevItems => {
          // Evita duplicados por uuid
          const existingUuids = new Set(prevItems.map(v => v.uuid));
          const nuevos = data.vehiculos.filter(v => !existingUuids.has(v.uuid));
          const merged = [...prevItems, ...nuevos];
          // Nunca mostrar más de totalVehiculos
          return merged.slice(0, data.totalVehiculos);
        });
      }
      setHasMore(data.hasMore);
      setTotalResultados(data.totalVehiculos);
      setIsLoadingMore(false);
    }
  }, [fetcher.data]);

  const handleClearFilters = () => {
    setMarca("");
    setModelo("");
    setAnio("");
    setPrecioRango(null);
    setMinPrice("");
    setMaxPrice("");
    setCombustible("");
    setTransmision("");
    setSearchParams({}, { replace: true });
  };
  
  const handlePrecioRangoClick = (rango: string, min: string, max: string) => {
    if (precioRango === rango) {
      setPrecioRango(null);
      setMinPrice("");
      setMaxPrice("");
    } else {
      setPrecioRango(rango);
      setMinPrice(min);
      setMaxPrice(max);
    }
  };

  const modelos = modelosFetcher.data?.modelos || [];
  const anios = aniosFetcher.data?.anios || [];
  const combustibles = isMainData(loaderData) ? loaderData.combustibles : [];
  const transmisiones = isMainData(loaderData) ? loaderData.transmisiones : [];

  const formatPrice = (price: number | null) => {
    if (!price) return "-";
    return new Intl.NumberFormat('es-CO', {
      style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0,
    }).format(price);
  };

  const formatMileage = (km: number | null) => {
    if (!km) return "-";
    return new Intl.NumberFormat('es-CO').format(km) + " km";
  };
  
  // Justo después de const loaderData = useLoaderData<typeof loader>();
  const isMain = isMainData(loaderData);
  const overallMinPrice = isMain ? loaderData.overallMinPrice : 0;
  const overallMaxPrice = isMain ? loaderData.overallMaxPrice : 1000000000;

  // Estado para el slider de precio (dinámico y reactivo a los filtros)
  const [priceRange, setPriceRange] = useState<[number, number]>([overallMinPrice, overallMaxPrice]);
  useEffect(() => {
    setPriceRange([overallMinPrice, overallMaxPrice]);
    setMinPrice("");
    setMaxPrice("");
  }, [overallMinPrice, overallMaxPrice]);

  const commonFilterProps = {
    loaderData,
    marca, setMarca,
    modelo, setModelo,
    anio, setAnio,
    modelosFetcher, aniosFetcher,
    modelos, anios,
    precioRango, handlePrecioRangoClick,
    minSlider: overallMinPrice,
    maxSlider: overallMaxPrice,
    priceRange, setPriceRange,
    setMinPrice, setMaxPrice,
    setPrecioRango, formatPrice,
    handleClearFilters,
    combustible, setCombustible,
    combustibles,
    transmision, setTransmision,
    transmisiones,
  };

  if (!isMain) {
    // Si no es la carga principal, no renderizar el componente completo.
    // Esto previene errores en el cliente cuando el loader devuelve solo opciones.
    return null;
  }
  
  return (
    <div className="flex font-sans bg-brand-bg min-h-screen">
      {/* Sidebar de Filtros (Desktop) */}
      <aside className="w-64 p-6 bg-white border-r border-brand-secondary flex-shrink-0 hidden lg:block">
        <h2 className="text-xl font-bold text-brand-title mb-6">Filtros</h2>
        <FiltrosContent {...commonFilterProps} />
      </aside>

      {/* Contenido Principal */}
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2 sm:gap-0 sm:flex-row sm:items-center">
            <h1 className="text-2xl font-bold text-brand-title">
              Listado de Vehículos ({totalResultados})
            </h1>
          </div>
          {/* Selector de ordenamiento - Desktop visible, Mobile oculto */}
          <div className="hidden lg:block ml-auto">
            <label htmlFor="sort-select" className="font-medium text-brand-title mr-2">Ordenar por:</label>
            <select
              id="sort-select"
              value={`${selectedSortBy}|${selectedSortOrder}`}
              onChange={e => {
                const [by, order] = e.target.value.split('|');
                setSelectedSortBy(by);
                setSelectedSortOrder(order);
              }}
              className="bg-white border border-brand-secondary rounded-md px-3 py-2 text-brand-title shadow-sm w-auto focus:outline-none focus:ring-2 focus:ring-brand-highlight"
            >
              <option value="precio|asc">Precio: Menor a Mayor</option>
              <option value="precio|desc">Precio: Mayor a Menor</option>
              <option value="anio|desc">Año: Más Nuevo</option>
              <option value="anio|asc">Año: Más Antiguo</option>
              <option value="km|asc">Kilometraje: Menor a Mayor</option>
              <option value="km|desc">Kilometraje: Mayor a Menor</option>
            </select>
          </div>
        </div>
        {/* Selector de ordenamiento - Mobile visible, Desktop oculto */}
        <div className="flex items-center justify-between mb-4 lg:hidden">
          <button
            type="button"
            onClick={() => setModalFiltrosOpen(true)}
            className="inline-flex items-center rounded-md border border-brand-secondary bg-white px-4 py-2 text-sm font-medium text-brand-text shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-highlight focus:ring-offset-2"
          >
            <svg className="-ml-1 mr-2 h-5 w-5 text-brand-text" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zM2 10a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 10zm0 5.25a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75z" clipRule="evenodd" />
            </svg>
            Filtros
          </button>
          <button
            type="button"
            onClick={() => setModalOrdenOpen(true)}
            className="inline-flex items-center rounded-md border border-brand-secondary bg-white px-4 py-2 text-sm font-medium text-brand-title shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-highlight ml-4 flex-1 justify-center"
          >
            <svg className="-ml-1 mr-2 h-5 w-5 text-brand-title" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M3 7a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h8a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h4a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
            </svg>
            Ordenar
          </button>
        </div>
        
        {loaderData.error ? (
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
                  {loaderData.error}
                </div>
              </div>
            </div>
          </div>
        ) : fetcher.state === 'loading' && !isLoadingMore ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => <VehiculoCardSkeleton key={i} />)}
            </div>
        ) : items.length > 0 ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6">
              {items.map((vehiculo: VehiculoType, index: number) => (
                <div
                  key={`${vehiculo.uuid}-${index}`}
                  ref={index === items.length - 1 ? lastItemRef : null}
                  className="bg-white rounded-xl border border-brand-secondary shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden group cursor-pointer"
                  onClick={() => navigate(`/vehiculos/${vehiculo.uuid}`)}
                >
                  {/* Imagen del vehículo */}
                  <div className="relative h-48 overflow-hidden">
                    {vehiculo.url_img ? (
                      <img 
                        src={vehiculo.url_img} 
                        alt={`${vehiculo.marca || 'Vehículo'} ${vehiculo.modelo || ''}`} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-brand-bg text-brand-highlight">
                        <svg className="w-12 h-12 opacity-50" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                    {/* Overlay con año y transmisión */}
                    <div className="absolute top-3 left-3 bg-black bg-opacity-75 text-white px-2 py-1 rounded-md text-xs font-medium">
                      {vehiculo.anio || '-'} • {vehiculo.transmision || '-'}
                    </div>
                  </div>

                  {/* Contenido de la tarjeta */}
                  <div className="p-4 space-y-3">
                    {/* Marca y Modelo */}
                    <div>
                      <h3 className="text-lg font-bold text-brand-title leading-tight">
                        {vehiculo.marca || '-'} {vehiculo.modelo || ''}
                      </h3>
                    </div>

                    {/* Kilometraje */}
                    <div className="flex items-center text-sm text-brand-text">
                      <svg className="w-4 h-4 mr-2 text-brand-highlight" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                        <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                      </svg>
                      <span>{formatMileage(vehiculo.km)}</span>
                    </div>

                    {/* Precio */}
                    <div className="pt-2 border-t border-brand-secondary">
                      <div className="text-xl font-bold text-brand-primary">
                        {formatPrice(vehiculo.precio)}
                      </div>
                    </div>

                    {/* Botón Ver más */}
                    <button
                      type="button"
                      className="w-full mt-3 inline-flex items-center justify-center rounded-md border border-transparent bg-brand-primary px-4 py-2 text-sm font-medium text-brand-title shadow-sm hover:bg-brand-secondary focus:outline-none focus:ring-2 focus:ring-brand-highlight focus:ring-offset-2 transition-colors duration-200"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/vehiculos/${vehiculo.uuid}`);
                      }}
                    >
                      Ver más
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {isLoadingMore && (
              <div className="text-center p-4 text-brand-text">Cargando más vehículos...</div>
            )}
            {!hasMore && items.length > 0 && (
              <div className="text-center p-4 text-brand-text">No hay más resultados.</div>
            )}
          </>
        ) : (
          <div className="text-center p-12 rounded-lg bg-gray-50 border border-gray-200">
            <div className="flex flex-col items-center justify-center">
                <svg className="h-12 w-12 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <h3 className="mt-4 text-lg font-semibold text-brand-title">
                    No se encontraron vehículos
                </h3>
                <p className="mt-1 text-sm text-brand-text">
                    Intenta ajustar los filtros para encontrar lo que buscas.
                </p>
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="mt-6 inline-flex items-center rounded-md border border-transparent bg-brand-primary px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-brand-highlight focus:ring-offset-2"
                >
                  Limpiar filtros y empezar de nuevo
                </button>
            </div>
          </div>
        )}
      </main>

      {/* Modal de Filtros (Mobile) */}
      {modalFiltrosOpen && (
        <div
          className={`fixed inset-0 bg-black z-40 lg:hidden transition-opacity duration-500 ease-in-out ${isModalVisible ? 'bg-opacity-50' : 'bg-opacity-0'}`}
          onClick={closeModal}
          aria-modal="true"
        >
          <div
            className={`fixed bottom-0 left-0 right-0 h-[90vh] max-h-[90vh] bg-white rounded-t-xl shadow-lg flex flex-col transition-transform duration-500 ease-in-out transform ${isModalVisible ? 'translate-y-0' : 'translate-y-full'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center p-6 border-b border-brand-secondary">
              <h2 className="text-xl font-bold text-brand-title">Filtros</h2>
              <button
                type="button"
                onClick={closeModal}
                className="p-1 rounded-full text-brand-text hover:bg-gray-100"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 flex-grow overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden max-h-full">
              <FiltrosContent {...commonFilterProps} />
            </div>
            <div className="p-6 border-t border-brand-secondary bg-white">
              <button
                type="button"
                onClick={closeModal}
                className="w-full inline-flex justify-center rounded-md border border-transparent bg-brand-primary px-4 py-2 text-base font-medium text-brand-title shadow-sm hover:bg-brand-secondary focus:outline-none focus:ring-2 focus:ring-brand-highlight focus:ring-offset-2"
              >
                Aplicar Filtros
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Ordenamiento (Mobile) */}
      {modalOrdenOpen && (
        <div
          className={`fixed inset-0 bg-black z-40 lg:hidden transition-opacity duration-500 ease-in-out ${isOrdenModalVisible ? 'bg-opacity-50' : 'bg-opacity-0'}`}
          onClick={closeOrdenModal}
          aria-modal="true"
        >
          <div
            className={`fixed bottom-0 left-0 right-0 h-auto bg-white rounded-t-xl shadow-lg flex flex-col transition-transform duration-500 ease-in-out transform ${isOrdenModalVisible ? 'translate-y-0' : 'translate-y-full'}`}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center p-6 border-b border-brand-secondary">
              <h2 className="text-xl font-bold text-brand-title">Ordenar por</h2>
              <button
                type="button"
                onClick={closeOrdenModal}
                className="p-1 rounded-full text-brand-text hover:bg-gray-100"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 flex flex-col gap-2">
              <button
                className={`w-full text-left px-4 py-3 rounded-md text-base transition-colors ${selectedSortBy === 'precio' && selectedSortOrder === 'asc' ? 'bg-brand-primary text-white font-semibold shadow' : 'text-brand-title hover:bg-brand-secondary'}`}
                onClick={() => { setSelectedSortBy('precio'); setSelectedSortOrder('asc'); closeOrdenModal(); }}
              >
                Precio: Menor a Mayor
              </button>
              <button
                className={`w-full text-left px-4 py-3 rounded-md text-base transition-colors ${selectedSortBy === 'precio' && selectedSortOrder === 'desc' ? 'bg-brand-primary text-white font-semibold shadow' : 'text-brand-title hover:bg-brand-secondary'}`}
                onClick={() => { setSelectedSortBy('precio'); setSelectedSortOrder('desc'); closeOrdenModal(); }}
              >
                Precio: Mayor a Menor
              </button>
              <button
                className={`w-full text-left px-4 py-3 rounded-md text-base transition-colors ${selectedSortBy === 'anio' && selectedSortOrder === 'desc' ? 'bg-brand-primary text-white font-semibold shadow' : 'text-brand-title hover:bg-brand-secondary'}`}
                onClick={() => { setSelectedSortBy('anio'); setSelectedSortOrder('desc'); closeOrdenModal(); }}
              >
                Año: Más Nuevo
              </button>
              <button
                className={`w-full text-left px-4 py-3 rounded-md text-base transition-colors ${selectedSortBy === 'anio' && selectedSortOrder === 'asc' ? 'bg-brand-primary text-white font-semibold shadow' : 'text-brand-title hover:bg-brand-secondary'}`}
                onClick={() => { setSelectedSortBy('anio'); setSelectedSortOrder('asc'); closeOrdenModal(); }}
              >
                Año: Más Antiguo
              </button>
              <button
                className={`w-full text-left px-4 py-3 rounded-md text-base transition-colors ${selectedSortBy === 'km' && selectedSortOrder === 'asc' ? 'bg-brand-primary text-white font-semibold shadow' : 'text-brand-title hover:bg-brand-secondary'}`}
                onClick={() => { setSelectedSortBy('km'); setSelectedSortOrder('asc'); closeOrdenModal(); }}
              >
                Kilometraje: Menor a Mayor
              </button>
              <button
                className={`w-full text-left px-4 py-3 rounded-md text-base transition-colors ${selectedSortBy === 'km' && selectedSortOrder === 'desc' ? 'bg-brand-primary text-white font-semibold shadow' : 'text-brand-title hover:bg-brand-secondary'}`}
                onClick={() => { setSelectedSortBy('km'); setSelectedSortOrder('desc'); closeOrdenModal(); }}
              >
                Kilometraje: Mayor a Menor
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
