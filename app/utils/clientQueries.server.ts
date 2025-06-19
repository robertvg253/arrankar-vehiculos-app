import { supabase } from "~/utils/supabase.server";

export type Cliente = {
  id: string;
  name: string;
  email: string;
  created_at: string;
};

export type FilteredClientsResult = {
  clientes: Cliente[] | null;
  error: Error | null;
  query: string;
  startDate: string | null;
  endDate: string | null;
  totalClients: number;
  currentPage: number;
  limit: number;
};

function getStartOfDay(date: string): string {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

function getStartOfNextDay(date: string): string {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + 1);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

export async function getFilteredClients(
  request: Request,
  page: number = 1,
  limit: number = 10
): Promise<FilteredClientsResult> {
  const url = new URL(request.url);
  const query = url.searchParams.get("q") || "";
  const startDate = url.searchParams.get("startDate");
  const endDate = url.searchParams.get("endDate");

  // Calcular el offset para la paginación
  const offset = (page - 1) * limit;
  const to = offset + limit - 1;

  // Construir la consulta base
  let supabaseQuery = supabase
    .from("clientes")
    .select("*", { count: "exact", head: false })
    .order("created_at", { ascending: false });

  // Aplicar filtro de fecha inicio si existe
  if (startDate) {
    const startDateTime = getStartOfDay(startDate);
    supabaseQuery = supabaseQuery.gte("created_at", startDateTime);
  }

  // Aplicar filtro de fecha fin si existe
  if (endDate) {
    const endDateTime = getStartOfNextDay(endDate);
    supabaseQuery = supabaseQuery.lt("created_at", endDateTime);
  }

  // Aplicar filtro de búsqueda si existe
  if (query) {
    supabaseQuery = supabaseQuery.or(`name.ilike.%${query}%,email.ilike.%${query}%`);
  }

  // Primero obtener el conteo total (sin paginación)
  const { count } = await supabaseQuery;

  // Luego aplicar la paginación y obtener los datos
  const { data: clientes, error } = await supabaseQuery.range(offset, to);

  // Calcular el total de páginas
  const totalClients = count || 0;
  const totalPages = Math.ceil(totalClients / limit);

  // Si la página actual es mayor que el total de páginas y hay resultados,
  // devolver un error que será manejado por el loader
  if (page > totalPages && totalClients > 0) {
    return {
      clientes: null,
      error: new Error("Página inválida"),
      query,
      startDate,
      endDate,
      totalClients,
      currentPage: page,
      limit,
    };
  }

  return {
    clientes,
    error,
    query,
    startDate,
    endDate,
    totalClients,
    currentPage: page,
    limit,
  };
} 