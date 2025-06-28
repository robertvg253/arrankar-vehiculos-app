import { json, redirect, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useNavigate, useSearchParams, useFetcher } from "@remix-run/react";
import { useState, useMemo, Fragment, useEffect } from "react";
import { supabase } from "~/utils/supabase.server";
import { getSession } from "~/utils/session.server";
import { Range } from 'react-range';
import React from "react";

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
  marcas: string[];
  combustibles: string[];
  transmisiones: string[];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const searchParams = url.searchParams;
  const session = await getSession(request);
  const concesionario_id = session.get("concesionario_id");
  const page = Number(searchParams.get("page")) || 1;
  const limit = 16;
  const offset = (page - 1) * limit;
  const to = offset + limit - 1;

  // --- ENDPOINTS PARA SELECTS ANIDADOS DEL MODAL ---
  const forOptions = searchParams.get("forOptions");
  if (forOptions === "modelos" && searchParams.get("marca")) {
    const { data, error } = await supabase
      .from("vehiculos")
      .select("modelo")
      .eq("marca", searchParams.get("marca"))
      .not("modelo", "is", null)
      .not("modelo", "eq", "")
      .order("modelo");
    if (error) return json({ modelos: [] });
    const modelos = Array.from(new Set((data || []).map((row: any) => row.modelo).filter(Boolean)));
    return json({ modelos });
  }
  if (forOptions === "anios" && searchParams.get("marca") && searchParams.get("modelo")) {
    const { data, error } = await supabase
      .from("vehiculos")
      .select("anio")
      .eq("marca", searchParams.get("marca"))
      .eq("modelo", searchParams.get("modelo"))
      .not("anio", "is", null)
      .order("anio", { ascending: false });
    if (error) return json({ anios: [] });
    const anios = Array.from(new Set((data || []).map((row: any) => String(row.anio)).filter(Boolean)));
    return json({ anios });
  }

  // --- OPCIONES PARA FILTROS (MARCAS, COMBUSTIBLES, TRANSMISIONES) ---
  const { data: marcasData } = await supabase
    .from("vehiculos")
    .select("marca")
    .not("marca", "is", null)
    .not("marca", "eq", "")
    .order("marca");
  const marcas = Array.from(new Set((marcasData || []).map((row: any) => row.marca).filter(Boolean)));

  const { data: combustiblesData } = await supabase
    .from("vehiculos")
    .select("combustible")
    .not("combustible", "is", null)
    .not("combustible", "eq", "")
    .order("combustible");
  const combustibles = Array.from(new Set((combustiblesData || []).map((row: any) => row.combustible).filter(Boolean)));

  const { data: transmisionesData } = await supabase
    .from("vehiculos")
    .select("transmision")
    .not("transmision", "is", null)
    .not("transmision", "eq", "")
    .order("transmision");
  const transmisiones = Array.from(new Set((transmisionesData || []).map((row: any) => row.transmision).filter(Boolean)));

  try {
    // Consulta paginada a la tabla vehiculos con todos los campos necesarios
    let query = supabase
      .from("vehiculos")
      .select("uuid, marca, modelo, anio, km, precio, transmision, url_img, version, combustible", { count: "exact", head: false });
    if (concesionario_id) query = query.eq('concesionario_id', concesionario_id);
    if (searchParams.get("marca")) query = query.eq('marca', searchParams.get("marca"));
    if (searchParams.get("modelo")) query = query.eq('modelo', searchParams.get("modelo"));
    if (searchParams.get("anio")) query = query.eq('anio', Number(searchParams.get("anio")));
    if (searchParams.get("precioMin")) query = query.gte('precio', Number(searchParams.get("precioMin")));
    if (searchParams.get("precioMax")) query = query.lte('precio', Number(searchParams.get("precioMax")));
    if (searchParams.get("kmMin")) query = query.gte('km', Number(searchParams.get("kmMin")));
    if (searchParams.get("kmMax")) query = query.lte('km', Number(searchParams.get("kmMax")));
    if (searchParams.get("combustible")) query = query.eq('combustible', searchParams.get("combustible"));
    if (searchParams.get("search")) query = query.or(`marca.ilike.%${searchParams.get("search")}%,modelo.ilike.%${searchParams.get("search")}%,version.ilike.%${searchParams.get("search")}%`);
    const { data: vehiculos, error, count } = await query
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
      marcas,
      combustibles,
      transmisiones,
    });
  } catch (error: any) {
    return json<LoaderData>({
      vehiculos: [],
      error: error?.message || "Error desconocido",
      totalVehiculos: 0,
      currentPage: 1,
      limit,
      marcas,
      combustibles,
      transmisiones,
    });
  }
}

// --- PriceRangeFilter ---
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

// --- FiltrosContent ---
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
      {/* Filtro por Precio (OCULTO TEMPORALMENTE) */}
      {/*
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
      */}
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
  const loaderData = useLoaderData<any>();
  // Type guard para saber si loaderData es LoaderData
  const isMainData = (data: any): data is LoaderData => data && Array.isArray(data.vehiculos);

  // Estados para la lista principal (solo si loaderData es LoaderData)
  const vehiculos = isMainData(loaderData) ? loaderData.vehiculos : [];
  const error = isMainData(loaderData) ? loaderData.error : undefined;
  const totalVehiculos = isMainData(loaderData) ? loaderData.totalVehiculos : 0;
  const currentPage = isMainData(loaderData) ? loaderData.currentPage : 1;
  const limit = isMainData(loaderData) ? loaderData.limit : 16;
  const marcas = isMainData(loaderData) ? loaderData.marcas : [];
  const combustibles = isMainData(loaderData) ? loaderData.combustibles : [];
  const transmisiones = isMainData(loaderData) ? loaderData.transmisiones : [];

  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [modalOrdenOpen, setModalOrdenOpen] = useState(false);
  const [modalFiltrosOpen, setModalFiltrosOpen] = useState(false);

  // --- ESTADOS Y FETCHERS PARA LA BARRA DE FILTROS (DESKTOP/TABLET) ---
  const [marcaBarra, setMarcaBarra] = useState<string>(searchParams.get('marca') || "");
  const [modeloBarra, setModeloBarra] = useState<string>(searchParams.get('modelo') || "");
  const [anioBarra, setAnioBarra] = useState<string>(searchParams.get('anio') || "");
  const [combustibleBarra, setCombustibleBarra] = useState<string>(searchParams.get('combustible') || "");
  const [transmisionBarra, setTransmisionBarra] = useState<string>(searchParams.get('transmision') || "");
  const [searchBarra, setSearchBarra] = useState<string>(searchParams.get('search') || "");
  const modelosBarraFetcher = useFetcher<any>();
  const aniosBarraFetcher = useFetcher<any>();
  const modelosBarra = modelosBarraFetcher.data?.modelos || [];
  const aniosBarra = aniosBarraFetcher.data?.anios || [];

  // Efectos para cargar modelos/anios dinámicamente (desktop/tablet)
  useEffect(() => {
    if (marcaBarra) {
      modelosBarraFetcher.load(`?forOptions=modelos&marca=${encodeURIComponent(marcaBarra)}`);
      setModeloBarra("");
      setAnioBarra("");
    }
  }, [marcaBarra]);
  useEffect(() => {
    if (marcaBarra && modeloBarra) {
      aniosBarraFetcher.load(`?forOptions=anios&marca=${encodeURIComponent(marcaBarra)}&modelo=${encodeURIComponent(modeloBarra)}`);
      setAnioBarra("");
    }
  }, [marcaBarra, modeloBarra]);

  // Sincronizar filtros con searchParams (desktop/tablet)
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    if (marcaBarra) params.set("marca", marcaBarra); else params.delete("marca");
    if (modeloBarra) params.set("modelo", modeloBarra); else params.delete("modelo");
    if (anioBarra) params.set("anio", anioBarra); else params.delete("anio");
    if (combustibleBarra) params.set("combustible", combustibleBarra); else params.delete("combustible");
    if (transmisionBarra) params.set("transmision", transmisionBarra); else params.delete("transmision");
    if (searchBarra) params.set("search", searchBarra); else params.delete("search");
    setSearchParams(params, { replace: true });
  }, [marcaBarra, modeloBarra, anioBarra, combustibleBarra, transmisionBarra, searchBarra]);

  // --- ESTADOS Y FETCHERS PARA EL MODAL DE FILTROS (MOBILE) ---
  // Estados locales del modal
  const [modalMarca, setModalMarca] = useState<string>(searchParams.get('marca') || "");
  const [modalModelo, setModalModelo] = useState<string>(searchParams.get('modelo') || "");
  const [modalAnio, setModalAnio] = useState<string>(searchParams.get('anio') || "");
  const [modalCombustible, setModalCombustible] = useState<string>(searchParams.get('combustible') || "");
  const [modalTransmision, setModalTransmision] = useState<string>(searchParams.get('transmision') || "");
  const [modalSearch, setModalSearch] = useState<string>(searchParams.get('search') || "");
  const [modalPrecioRango, setModalPrecioRango] = useState<string | null>(null);
  const [modalMinPrice, setModalMinPrice] = useState<string>("");
  const [modalMaxPrice, setModalMaxPrice] = useState<string>("");
  const [modalPriceRange, setModalPriceRange] = useState<[number, number]>([0, 1000000000]);

  // Fetchers para selects anidados
  const modalModelosFetcher = useFetcher<any>();
  const modalAniosFetcher = useFetcher<any>();
  const modelos = modalModelosFetcher.data?.modelos || [];
  const anios = modalAniosFetcher.data?.anios || [];

  // Efectos para cargar modelos/anios dinámicamente
  useEffect(() => {
    if (modalMarca) {
      modalModelosFetcher.load(`?forOptions=modelos&marca=${encodeURIComponent(modalMarca)}`);
      setModalModelo("");
      setModalAnio("");
    }
  }, [modalMarca]);
  useEffect(() => {
    if (modalMarca && modalModelo) {
      modalAniosFetcher.load(`?forOptions=anios&marca=${encodeURIComponent(modalMarca)}&modelo=${encodeURIComponent(modalModelo)}`);
      setModalAnio("");
    }
  }, [modalMarca, modalModelo]);

  // Limpiar filtros del modal
  const handleModalClearFilters = () => {
    setModalMarca("");
    setModalModelo("");
    setModalAnio("");
    setModalCombustible("");
    setModalTransmision("");
    setModalSearch("");
    setModalPrecioRango(null);
    setModalMinPrice("");
    setModalMaxPrice("");
    setModalPriceRange([0, 1000000000]);
    setSearchParams({}, { replace: true });
    setModalFiltrosOpen(false);
  };

  // Aplicar filtros del modal
  const handleModalApplyFilters = () => {
    const params = new URLSearchParams();
    if (modalMarca) params.set("marca", modalMarca);
    if (modalModelo) params.set("modelo", modalModelo);
    if (modalAnio) params.set("anio", modalAnio);
    if (modalCombustible) params.set("combustible", modalCombustible);
    if (modalTransmision) params.set("transmision", modalTransmision);
    if (modalSearch) params.set("search", modalSearch);
    if (modalMinPrice) params.set("precioMin", modalMinPrice);
    if (modalMaxPrice) params.set("precioMax", modalMaxPrice);
    setSearchParams(params, { replace: true });
    setModalFiltrosOpen(false);
  };

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

  // --- NUEVO LAYOUT UI ---
  return (
    <div className="min-h-screen bg-brand-bg flex flex-col gap-6 p-4 md:p-8">
      {/* Cabecera */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-2">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold text-brand-title">Listado de Vehículos</h1>
          <span className="inline-block bg-brand-primary text-white text-sm font-semibold rounded-full px-3 py-1">{totalVehiculos}</span>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg bg-brand-primary text-brand-title font-semibold px-4 py-2 shadow-md hover:bg-brand-highlight focus:outline-none focus:ring-2 focus:ring-brand-highlight focus:ring-offset-2 transition w-full sm:w-auto text-base sm:text-base"
          onClick={() => navigate('/vehiculos/nuevo')}
          style={{ minHeight: '40px', maxWidth: '100%' }}
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Agregar Vehículo
        </button>
      </div>

      {/* Tarjetas de Métricas */}
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:pb-0 sm:mx-0">
        <div className="bg-white rounded-lg shadow-md p-3 min-w-[170px] flex flex-col items-start justify-center sm:p-6">
          <span className="text-xs text-brand-text font-semibold mb-1">Total Vehículos</span>
          <span className="text-lg font-bold text-brand-title">{totalVehiculos}</span>
          <span className="flex items-center text-green-600 text-xs mt-0.5"><svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12l5 5L20 7" /></svg>+5% este mes</span>
        </div>
        <div className="bg-white rounded-lg shadow-md p-3 min-w-[170px] flex flex-col items-start justify-center sm:p-6">
          <span className="text-xs text-brand-text font-semibold mb-1">Vehículos Disponibles</span>
          <span className="text-lg font-bold text-brand-title">{totalVehiculos}</span>
          <span className="flex items-center text-green-600 text-xs mt-0.5"><svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12l5 5L20 7" /></svg>+2% este mes</span>
        </div>
        <div className="bg-white rounded-lg shadow-md p-3 min-w-[170px] flex flex-col items-start justify-center sm:p-6">
          <span className="text-xs text-brand-text font-semibold mb-1">Vehículos Vendidos</span>
          <span className="text-lg font-bold text-brand-title">0</span>
          <span className="flex items-center text-green-600 text-xs mt-0.5"><svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12l5 5L20 7" /></svg>+0% este mes</span>
        </div>
      </div>

      {/* Barra de búsqueda y filtros (solo mobile) */}
      <div className="block sm:hidden mb-4">
        <div className="flex items-center bg-gray-100 rounded-xl shadow px-3 py-2 gap-2">
          <span className="text-gray-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" /></svg>
          </span>
          <input
            type="search"
            value={searchParams.get('search') || ''}
            onChange={e => {
              const params = new URLSearchParams(searchParams);
              if (e.target.value) {
                params.set('search', e.target.value);
              } else {
                params.delete('search');
              }
              setSearchParams(params, { replace: true });
            }}
            placeholder="Buscar vehículo..."
            className="flex-1 bg-transparent outline-none text-sm text-brand-title placeholder:text-gray-400"
          />
          <button
            type="button"
            onClick={() => setModalOrdenOpen(true)}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-200 text-gray-500 hover:bg-gray-300 transition"
            title="Ordenar"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16 17l4-4m0 0l-4-4m4 4H7m-4 4V7a2 2 0 012-2h6" /></svg>
          </button>
          <button
            type="button"
            onClick={() => setModalFiltrosOpen(true)}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-200 text-gray-500 hover:bg-gray-300 transition"
            title="Filtros"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm0 6a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1v-2zm0 6a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1v-2z" /></svg>
          </button>
        </div>
      </div>

      {/* Barra de filtros horizontal (solo desktop/tablet) */}
      <div className="hidden sm:flex flex-col gap-2 mb-6">
        <div className="flex items-center gap-2 bg-white rounded-xl border border-gray-200 px-4 py-2 shadow-sm">
          {/* Input de búsqueda (sin funcionalidad por ahora) */}
          <div className="flex items-center flex-1">
            <svg className="w-5 h-5 text-gray-400 mr-2" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" /></svg>
            <input
              type="text"
              className="w-full bg-transparent outline-none text-sm text-brand-title placeholder:text-gray-400 focus:outline-none"
              placeholder="Buscar por marca, modelo o versión..."
              value={searchBarra}
              onChange={e => setSearchBarra(e.target.value)}
            />
          </div>
          {/* Select Marca */}
          <select
            className="ml-2 px-3 py-2 rounded-md border border-gray-200 bg-white text-sm text-brand-title focus:outline-none focus:ring-2 focus:ring-brand-highlight"
            value={marcaBarra}
            onChange={e => {
              setMarcaBarra(e.target.value);
              setModeloBarra("");
              setAnioBarra("");
            }}
          >
            <option value="">Marca</option>
            {marcas.map((m: string) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          {/* Select Modelo */}
          <select
            className="ml-2 px-3 py-2 rounded-md border border-gray-200 bg-white text-sm text-brand-title focus:outline-none focus:ring-2 focus:ring-brand-highlight"
            value={modeloBarra}
            onChange={e => {
              setModeloBarra(e.target.value);
              setAnioBarra("");
            }}
            disabled={!marcaBarra}
          >
            <option value="">Modelo</option>
            {modelosBarra.map((m: string) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          {/* Select Año */}
          <select
            className="ml-2 px-3 py-2 rounded-md border border-gray-200 bg-white text-sm text-brand-title focus:outline-none focus:ring-2 focus:ring-brand-highlight"
            value={anioBarra}
            onChange={e => setAnioBarra(e.target.value)}
            disabled={!marcaBarra || !modeloBarra}
          >
            <option value="">Año</option>
            {aniosBarra.map((a: string) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          {/* Select Combustible */}
          <select
            className="ml-2 px-3 py-2 rounded-md border border-gray-200 bg-white text-sm text-brand-title focus:outline-none focus:ring-2 focus:ring-brand-highlight"
            value={combustibleBarra}
            onChange={e => setCombustibleBarra(e.target.value)}
          >
            <option value="">Combustible</option>
            {combustibles.map((c: string) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          {/* Select Transmisión */}
          <select
            className="ml-2 px-3 py-2 rounded-md border border-gray-200 bg-white text-sm text-brand-title focus:outline-none focus:ring-2 focus:ring-brand-highlight"
            value={transmisionBarra}
            onChange={e => setTransmisionBarra(e.target.value)}
          >
            <option value="">Transmisión</option>
            {transmisiones.map((t: string) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          {/* Botón Limpiar filtros */}
          <button
            type="button"
            className="ml-4 px-4 py-2 rounded-md border border-gray-200 bg-gray-50 text-sm text-brand-title hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-highlight"
            onClick={() => {
              setMarcaBarra("");
              setModeloBarra("");
              setAnioBarra("");
              setCombustibleBarra("");
              setTransmisionBarra("");
              setSearchBarra("");
              setSearchParams({}, { replace: true });
            }}
          >
            Limpiar filtros
          </button>
        </div>
      </div>

      {/* Lista de Vehículos como tabla moderna */}
      <div className="overflow-x-auto w-full">
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm min-w-[700px]">
          {/* Fila de títulos de columna */}
          <div className="grid grid-cols-[64px_1.5fr_0.8fr_0.7fr_0.9fr_0.9fr_0.7fr] items-center px-4 py-2 text-xs font-medium text-brand-text bg-gray-50 rounded-t-2xl">
            <div className="flex items-center">Foto</div>
            <div className="ml-6">Vehículo</div>
            <div className="text-right">Precio</div>
            <div className="text-center">Año</div>
            <div className="text-center">Km</div>
            <div className="text-center">Combustible</div>
            <div className="text-center">Acciones</div>
          </div>
          <div className="divide-y divide-gray-100">
            {vehiculos.map((vehiculo, idx) => (
              <div
                key={vehiculo.uuid}
                className={`grid grid-cols-[64px_1.5fr_0.8fr_0.7fr_0.9fr_0.9fr_0.7fr] items-center px-4 py-2 text-sm hover:bg-gray-50 transition cursor-pointer ${idx === vehiculos.length - 1 ? 'rounded-b-2xl' : ''}`}
                onClick={() => navigate(`/vehiculos/${vehiculo.uuid}`)}
              >
                {/* Imagen */}
                <img
                  src={vehiculo.url_img || '/images/placeholder.png'}
                  alt={`${vehiculo.marca || 'Vehículo'} ${vehiculo.modelo || ''}`}
                  className="w-16 h-10 object-cover rounded-md border border-gray-200 bg-brand-bg flex-shrink-0"
                />
                {/* Info principal */}
                <div className="ml-6 flex flex-col justify-center min-w-0">
                  <span className="font-normal text-brand-title truncate text-sm">
                    {vehiculo.marca || '-'} {vehiculo.modelo || ''}
                  </span>
                  {vehiculo.version && <span className="text-xs text-brand-text truncate">{vehiculo.version}</span>}
                </div>
                {/* Precio */}
                <div className="text-right">
                  <span className="text-black font-normal text-xs">{formatPrice(vehiculo.precio)}</span>
                </div>
                {/* Año */}
                <div className="text-center text-xs text-brand-text">
                  {vehiculo.anio || '-'}
                </div>
                {/* Km */}
                <div className="text-center text-xs text-brand-text">
                  {vehiculo.km !== null ? formatMileage(vehiculo.km) : '-'}
                </div>
                {/* Combustible */}
                <div className="text-center text-xs text-brand-text">
                  {vehiculo.combustible || '-'}
                </div>
                {/* Acciones */}
                <div className="flex gap-2 justify-center">
                  <button
                    type="button"
                    className="p-2 rounded-md hover:bg-gray-100 text-gray-400 transition"
                    onClick={e => {
                      e.stopPropagation();
                      navigate(`/vehiculos/${vehiculo.uuid}`);
                    }}
                    title="Editar"
                  >
                    {/* Icono lápiz */}
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 5.487l1.65-1.65a1.875 1.875 0 112.652 2.652l-12.1 12.1a4.5 4.5 0 01-1.897 1.13l-2.516.754.754-2.516a4.5 4.5 0 011.13-1.897l12.1-12.1z" /></svg>
                  </button>
                  <button
                    type="button"
                    className="p-2 rounded-md hover:bg-gray-100 text-gray-400 transition"
                    title="Eliminar"
                    disabled
                  >
                    {/* Icono papelera */}
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 7h12M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3m2 0v14a2 2 0 01-2 2H8a2 2 0 01-2-2V7h12z" /></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Controles de Paginación */}
      <div className="mt-6 flex items-center justify-between bg-white rounded-2xl shadow-sm border border-gray-200 px-4 py-3">
        <div className="flex flex-1 justify-between sm:hidden">
          <button
            onClick={() => {
              const newPage = Math.max(1, currentPage - 1);
              navigate(getPageUrl(newPage));
            }}
            disabled={currentPage === 1}
            className="relative inline-flex items-center rounded-md border border-gray-200 bg-gray-50 px-4 py-2 text-xs font-medium text-brand-text hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-highlight focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Anterior
          </button>
          <button
            onClick={() => {
              const newPage = currentPage + 1;
              navigate(getPageUrl(newPage));
            }}
            disabled={currentPage === totalPages}
            className="relative ml-3 inline-flex items-center rounded-md border border-gray-200 bg-gray-50 px-4 py-2 text-xs font-medium text-brand-text hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-highlight focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Siguiente
          </button>
        </div>
        <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
          <div>
            <p className="text-xs text-brand-text">
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
              className="isolate inline-flex -space-x-px rounded-2xl shadow-sm border border-gray-200 bg-white"
              aria-label="Pagination"
            >
              <button
                onClick={() => {
                  const newPage = Math.max(1, currentPage - 1);
                  navigate(getPageUrl(newPage));
                }}
                disabled={currentPage === 1}
                className="relative inline-flex items-center rounded-l-2xl px-3 py-2 text-xs font-medium text-brand-text border border-gray-200 bg-gray-50 hover:bg-gray-100 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="sr-only">Anterior</span>
                <svg
                  className="h-4 w-4"
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
              <span className="relative inline-flex items-center px-4 py-2 text-xs font-semibold text-brand-title border-t border-b border-gray-200 bg-white focus:z-20 focus:outline-offset-0">
                Página {currentPage} de {totalPages}
              </span>
              <button
                onClick={() => {
                  const newPage = currentPage + 1;
                  navigate(getPageUrl(newPage));
                }}
                disabled={currentPage === totalPages}
                className="relative inline-flex items-center rounded-r-2xl px-3 py-2 text-xs font-medium text-brand-text border border-gray-200 bg-gray-50 hover:bg-gray-100 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="sr-only">Siguiente</span>
                <svg
                  className="h-4 w-4"
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

      {/* Modal de Filtros (Mobile) */}
      {modalFiltrosOpen && (
        <div
          className={`fixed inset-0 bg-black z-40 sm:hidden transition-opacity duration-500 ease-in-out ${modalFiltrosOpen ? 'bg-opacity-50' : 'bg-opacity-0'}`}
          onClick={() => setModalFiltrosOpen(false)}
          aria-modal="true"
        >
          <div
            className={`fixed bottom-0 left-0 right-0 h-[90vh] max-h-[90vh] bg-white rounded-t-xl shadow-lg flex flex-col transition-transform duration-500 ease-in-out transform ${modalFiltrosOpen ? 'translate-y-0' : 'translate-y-full'}`}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center p-6 border-b border-brand-secondary">
              <h2 className="text-xl font-bold text-brand-title">Filtros</h2>
              <button
                type="button"
                onClick={() => setModalFiltrosOpen(false)}
                className="p-1 rounded-full text-brand-text hover:bg-gray-100"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 flex-grow overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden max-h-full">
              {/* Input de búsqueda en el modal */}
              <div className="mb-6">
                <div className="flex items-center bg-gray-100 rounded-xl px-3 py-2">
                  <svg className="w-5 h-5 text-gray-400 mr-2" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
                  </svg>
                  <input
                    type="text"
                    className="w-full bg-transparent outline-none text-sm text-brand-title placeholder:text-gray-400"
                    placeholder="Buscar por marca, modelo o versión..."
                    value={modalSearch}
                    onChange={e => setModalSearch(e.target.value)}
                  />
                </div>
              </div>
              {/* Filtros anidados y lógica completa */}
              <FiltrosContent
                loaderData={{ marcas, combustibles, transmisiones }}
                marca={modalMarca}
                setMarca={setModalMarca}
                modelo={modalModelo}
                setModelo={setModalModelo}
                anio={modalAnio}
                setAnio={setModalAnio}
                modelosFetcher={modalModelosFetcher}
                aniosFetcher={modalAniosFetcher}
                modelos={modelos}
                anios={anios}
                precioRango={modalPrecioRango}
                handlePrecioRangoClick={setModalPrecioRango}
                minSlider={0}
                maxSlider={1000000000}
                priceRange={modalPriceRange}
                setPriceRange={setModalPriceRange}
                setMinPrice={setModalMinPrice}
                setMaxPrice={setModalMaxPrice}
                setPrecioRango={setModalPrecioRango}
                formatPrice={(v: number) => v.toString()}
                handleClearFilters={handleModalClearFilters}
                combustible={modalCombustible}
                setCombustible={setModalCombustible}
                combustibles={combustibles}
                transmision={modalTransmision}
                setTransmision={setModalTransmision}
                transmisiones={transmisiones}
              />
            </div>
            <div className="p-6 border-t border-brand-secondary bg-white">
              <button
                type="button"
                onClick={handleModalApplyFilters}
                className="w-full inline-flex justify-center rounded-md border border-transparent bg-brand-primary px-4 py-2 text-base font-medium text-brand-title shadow-sm hover:bg-brand-secondary focus:outline-none focus:ring-2 focus:ring-brand-highlight focus:ring-offset-2"
              >
                Aplicar Filtros
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
