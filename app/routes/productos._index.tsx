import { json, redirect, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useActionData, useNavigation, useRevalidator, useFetcher, useNavigate, useSearchParams } from "@remix-run/react";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { getFilteredProducts } from "~/utils/productQueries.server";
import RightSideDrawer from "~/components/RightSideDrawer";
import ProductForm from "~/components/ProductForm";
import type { LoaderData as ProductLoaderData } from "./productos.$productId";
import type { ActionData } from "./productos.nuevo";

type LoaderData = {
  products: Array<{
    id: string;
    name: string;
    description?: string;
    price: number;
    created_at: string;
  }>;
  error?: string;
  query: string;
  startDate: string | null;
  endDate: string | null;
  totalProducts: number;
  currentPage: number;
  limit: number;
};

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const searchParams = new URLSearchParams(url.search);
  
  const page = Number(searchParams.get("page")) || 1;
  const limit = Number(searchParams.get("limit")) || 10;
  
  try {
    const result = await getFilteredProducts(request, page, limit);
    return json<LoaderData>({
      products: result.products || [],
      error: result.error?.message,
      query: result.query,
      startDate: result.startDate,
      endDate: result.endDate,
      totalProducts: result.totalProducts,
      currentPage: result.currentPage,
      limit: result.limit,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Página inválida") {
      // Mantener todos los searchParams excepto page
      const newParams = new URLSearchParams(searchParams);
      newParams.set("page", "1");
      return redirect(`/productos?${newParams.toString()}`);
    }
    return json<LoaderData>({
      products: [],
      error: error instanceof Error ? error.message : "Error desconocido",
      query: "",
      startDate: null,
      endDate: null,
      totalProducts: 0,
      currentPage: 1,
      limit: 10,
    });
  }
}

export default function ProductosPage() {
  const { products, error, query, startDate, endDate, totalProducts, currentPage, limit } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<ActionData>();
  const editFetcher = useFetcher<ProductLoaderData>();
  const revalidator = useRevalidator();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [showCreateProductDrawer, setShowCreateProductDrawer] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const isProcessingSuccessRef = useRef(false);

  // Calcular el total de páginas
  const totalPages = Math.max(1, Math.ceil(totalProducts / limit));

  // Función para construir la URL de paginación
  const getPageUrl = (page: number) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", page.toString());
    return `?${params.toString()}`;
  };

  // Función para cerrar el drawer de edición
  const handleCloseDrawer = useCallback(() => {
    console.log("[productos._index] 🧹 handleCloseDrawer: Iniciando reseteo completo de estados.");
    
    // Reseteamos los estados en orden
    setEditingProductId(null);
    setShowCreateProductDrawer(false);
    
    console.log("[productos._index] ✅ handleCloseDrawer: Estados reseteados.");
  }, []);

  // Función para iniciar la edición de un producto
  const handleStartEdit = useCallback((productId: string) => {
    console.log(`[productos._index] 🚀 handleStartEdit: Iniciando edición para ID ${productId}`);
    
    // Establecemos el nuevo ID y cerramos el modo creación
    setShowCreateProductDrawer(false);
    setEditingProductId(productId);
    
    console.log(`[productos._index] ✅ handleStartEdit: Estados actualizados para ID ${productId}`);
  }, []);

  // Efecto para cargar datos del producto al editar
  useEffect(() => {
    console.log(`[productos._index] 🔍 useEffect (editFetcher.load): Estado actual - editingProductId=${editingProductId}, editFetcher.state=${editFetcher.state}, editFetcher.data?.product?.id=${editFetcher.data?.product?.id}`);

    if (editingProductId && editFetcher.state === "idle") {
      if (!editFetcher.data?.product || editFetcher.data.product.id !== editingProductId) {
        console.log(`[productos._index] 🚀 Disparando editFetcher.load para ID: ${editingProductId}`);
        editFetcher.load(`/productos/${editingProductId}`);
      } else {
        console.log(`[productos._index] ℹ️ Datos ya cargados para ID ${editingProductId}. No se necesita recargar.`);
      }
    }
  }, [editingProductId, editFetcher]);

  // Efecto para manejar el éxito de la operación
  useEffect(() => {
    // Check if action was successful AND we haven't processed this specific success event yet
    if (fetcher.state === "idle" && fetcher.data?.success && !isProcessingSuccessRef.current) {
      console.log("[productos._index] 🥳 Action exitosa detectada. Cerrando drawer y actualizando lista.");
      
      // Set flag to true to prevent re-execution for this success
      isProcessingSuccessRef.current = true;
      
      // Perform side effects: close drawer and revalidate the list
      handleCloseDrawer();
      revalidator.revalidate();

      // CRITICAL FIX: After processing the success,
      // trigger a "noop" fetcher submission to clear its internal data state.
      // This makes fetcher.data.success become false, stopping the useEffect loop.
      const dummyFormData = new FormData();
      fetcher.submit(dummyFormData, { method: "post", action: "/productos/nuevo" });

    } else if (fetcher.state === "idle" && !fetcher.data?.success && isProcessingSuccessRef.current) {
      // If fetcher state is idle, and the data no longer indicates success (e.g., after the dummy submit),
      // and we previously processed a success, then reset the flag.
      console.log("[productos._index] 🔄 Resetting isProcessingSuccessRef.current flag because fetcher.data no longer indicates success.");
      isProcessingSuccessRef.current = false;
    }
  }, [fetcher.state, fetcher.data, handleCloseDrawer, revalidator, fetcher]);

  // Memoizamos el título del drawer para evitar recálculos
  const drawerTitle = useMemo(() => {
    if (showCreateProductDrawer) {
      return "Crear Nuevo Producto";
    }
    if (editingProductId) {
      if (editFetcher.state === "loading" || editFetcher.state === "submitting") {
        return "Cargando Producto...";
      }
      if (editFetcher.data?.product) {
        return "Editar Producto";
      }
      if (editFetcher.data?.error) {
        return `Error al cargar: ${editFetcher.data.error}`;
      }
      return "Cargando Producto...";
    }
    return "";
  }, [showCreateProductDrawer, editingProductId, editFetcher.state, editFetcher.data]);

  // Memoizamos el estado de apertura del drawer
  const isDrawerOpen = showCreateProductDrawer || editingProductId !== null;

  // Memoizamos los datos del producto para edición
  const editProductData = useMemo(() => {
    if (!editFetcher.data?.product) return undefined;
    return {
      id: editFetcher.data.product.id,
      name: editFetcher.data.product.name,
      description: editFetcher.data.product.description,
      price: editFetcher.data.product.price,
      images: editFetcher.data.images || [],
    };
  }, [editFetcher.data]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Listado de Productos
          </h1>
          {fetcher.state === "submitting" && (
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Guardando producto...
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            handleCloseDrawer();
            setShowCreateProductDrawer(true);
          }}
          className="inline-flex items-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
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
          Agregar Producto
        </button>
      </div>

      {error ? (
        <div className="rounded-md bg-red-50 p-4 dark:bg-red-900/50">
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
              <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                Error al cargar los productos
              </h3>
              <div className="mt-2 text-sm text-red-700 dark:text-red-300">
                {error}
              </div>
            </div>
          </div>
        </div>
      ) : products.length > 0 ? (
        <>
          {/* Diseño de Tabla para pantallas MD y mayores */}
          <div className="hidden md:block overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
                  >
                    Nombre
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
                  >
                    Descripción
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
                  >
                    Precio
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
                  >
                    Fecha de Creación
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
                  >
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
                {products.map((product) => (
                  <tr
                    key={product.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {product.name}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {product.description}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        ${product.price}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {new Date(product.created_at).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(product.id)}
                        className="inline-flex items-center rounded-md border border-transparent bg-blue-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Diseño de Tarjetas para pantallas Móviles (MD o menor) */}
          <div className="md:hidden space-y-4">
            {products.map((product) => (
              <div
                key={product.id}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 border border-gray-200 dark:border-gray-700"
              >
                <div className="flex justify-between items-start mb-3">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {product.name}
                  </h3>
                  <button
                    type="button"
                    onClick={() => handleStartEdit(product.id)}
                    className="inline-flex items-center rounded-md border border-transparent bg-blue-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4 mr-1"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                    </svg>
                    Editar
                  </button>
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    <span className="font-medium text-gray-700 dark:text-gray-400">
                      Descripción:
                    </span>{" "}
                    {product.description || "N/A"}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    <span className="font-medium text-gray-700 dark:text-gray-400">
                      Precio:
                    </span>{" "}
                    ${product.price}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    <span className="font-medium text-gray-700 dark:text-gray-400">
                      Creado:
                    </span>{" "}
                    {new Date(product.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="rounded-md bg-gray-50 p-4 dark:bg-gray-800">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-gray-400"
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
              <h3 className="text-sm font-medium text-gray-800 dark:text-gray-200">
                No se encontraron productos
              </h3>
              <div className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                Esta tabla está vacía
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Placeholder para componentes de búsqueda y paginación */}
      <div className="mt-4">
        {/* Aquí irá el componente de búsqueda */}
      </div>
      <div className="mt-4">
        {/* Aquí irá el componente de paginación */}
      </div>

      {/* Controles de Paginación */}
      <div className="mt-6 flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800 sm:px-6">
        <div className="flex flex-1 justify-between sm:hidden">
          <button
            onClick={() => {
              const newPage = Math.max(1, currentPage - 1);
              navigate(getPageUrl(newPage));
            }}
            disabled={currentPage === 1}
            className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 dark:focus:ring-offset-gray-900"
          >
            Anterior
          </button>
          <button
            onClick={() => {
              const newPage = currentPage + 1;
              navigate(getPageUrl(newPage));
            }}
            disabled={currentPage === totalPages}
            className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 dark:focus:ring-offset-gray-900"
          >
            Siguiente
          </button>
        </div>
        <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Mostrando{" "}
              <span className="font-medium">
                {totalProducts > 0 ? (currentPage - 1) * limit + 1 : 0}
              </span>{" "}
              a{" "}
              <span className="font-medium">
                {Math.min(currentPage * limit, totalProducts)}
              </span>{" "}
              de{" "}
              <span className="font-medium">{totalProducts}</span>{" "}
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
                className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed dark:ring-gray-600 dark:hover:bg-gray-600"
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
              <span className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 focus:z-20 focus:outline-offset-0 dark:text-white dark:ring-gray-600">
                Página {currentPage} de {totalPages}
              </span>
              <button
                onClick={() => {
                  const newPage = currentPage + 1;
                  navigate(getPageUrl(newPage));
                }}
                disabled={currentPage === totalPages}
                className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed dark:ring-gray-600 dark:hover:bg-gray-600"
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

      {/* Drawer para crear/editar producto */}
      <RightSideDrawer
        isOpen={isDrawerOpen}
        onClose={handleCloseDrawer}
        title={drawerTitle}
      >
        {showCreateProductDrawer ? (
          <ProductForm
            key="new-product-form"
            onClose={handleCloseDrawer}
            fetcher={fetcher}
          />
        ) : editingProductId && editFetcher.state === "loading" ? (
          <div className="flex justify-center items-center h-48 text-gray-400">
            Cargando producto...
          </div>
        ) : editingProductId && editFetcher.state === "idle" && editFetcher.data?.product?.id === editingProductId ? (
          <ProductForm
            key={`edit-product-form-${editingProductId}`}
            onClose={handleCloseDrawer}
            defaultValues={{
              id: editFetcher.data.product.id,
              name: editFetcher.data.product.name,
              description: editFetcher.data.product.description,
              price: editFetcher.data.product.price,
              images: editFetcher.data.images || [],
            }}
            fetcher={fetcher}
          />
        ) : editingProductId && editFetcher.state === "idle" && editFetcher.data?.error ? (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mt-4">
            <strong className="font-bold">Error al cargar:</strong>
            <span className="block sm:inline"> {editFetcher.data.error}</span>
          </div>
        ) : null}
      </RightSideDrawer>
    </div>
  );
}
