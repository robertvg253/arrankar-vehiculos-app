import { Form, useSearchParams, useSubmit, useNavigation } from "@remix-run/react";
import { useEffect, useState } from "react";

export function ClientFilterSearch() {
  const [searchParams] = useSearchParams();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isSearching = navigation.state === "loading";
  const [isFiltersVisible, setIsFiltersVisible] = useState(false);

  const [searchValue, setSearchValue] = useState(searchParams.get("q") || "");
  const [startDate, setStartDate] = useState(searchParams.get("startDate") || "");
  const [endDate, setEndDate] = useState(searchParams.get("endDate") || "");

  // Debounce para la búsqueda
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchValue !== searchParams.get("q")) {
        const formData = new FormData();
        if (searchValue) {
          formData.append("q", searchValue);
        }
        // Mantener los filtros de fecha actuales
        const currentStartDate = searchParams.get("startDate");
        const currentEndDate = searchParams.get("endDate");
        const currentPage = searchParams.get("page");
        if (currentStartDate) formData.append("startDate", currentStartDate);
        if (currentEndDate) formData.append("endDate", currentEndDate);
        if (currentPage) formData.append("page", currentPage);
        submit(formData, { method: "get", replace: true });
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchValue, submit, searchParams]);

  const handleClearFilters = () => {
    const formData = new FormData();
    const currentPage = searchParams.get("page");
    if (currentPage) formData.append("page", currentPage);
    submit(formData, { method: "get", replace: true });
    setSearchValue("");
    setStartDate("");
    setEndDate("");
    setIsFiltersVisible(false);
  };

  const toggleFilters = () => {
    setIsFiltersVisible(!isFiltersVisible);
  };

  return (
    <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="space-y-6">
        {/* Campo de búsqueda y botón de filtros */}
        <div className="flex flex-col space-y-4 md:flex-row md:items-center md:space-x-4 md:space-y-0">
          <div className="relative flex-1">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <svg
                className="h-5 w-5 text-gray-400"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <input
              type="text"
              name="q"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder="Buscar por nombre o email..."
              className="block w-full rounded-md border-0 py-2.5 pl-10 pr-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 dark:bg-gray-700 dark:text-white dark:ring-gray-600 dark:placeholder:text-gray-400 dark:focus:ring-blue-500 sm:text-sm sm:leading-6"
            />
            {isSearching && (
              <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                <svg
                  className="h-5 w-5 animate-spin text-gray-400"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
              </div>
            )}
          </div>

          {/* Botón de filtros (visible en todas las resoluciones) */}
          <button
            type="button"
            onClick={toggleFilters}
            className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
          >
            <svg
              className="mr-2 h-5 w-5 text-gray-400"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M2 3.75A.75.75 0 012.75 3h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 3.75zm0 4.167a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75zm0 4.166a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75z"
                clipRule="evenodd"
              />
            </svg>
            {isFiltersVisible ? "Ocultar Filtros" : "Filtrar por Fecha"}
          </button>
        </div>

        {/* Filtros de fecha y botones */}
        <div
          className={`grid grid-cols-1 gap-4 overflow-hidden transition-all duration-300 ease-in-out ${
            isFiltersVisible ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
          } sm:grid-cols-2 lg:grid-cols-3`}
        >
          {/* Filtro de fecha inicio */}
          <div>
            <label
              htmlFor="startDate"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Fecha Inicio
            </label>
            <input
              type="date"
              id="startDate"
              name="startDate"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="mt-1 block w-full rounded-md border-0 py-2.5 px-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 dark:bg-gray-700 dark:text-white dark:ring-gray-600 dark:placeholder:text-gray-400 dark:focus:ring-blue-500 sm:text-sm sm:leading-6"
            />
          </div>

          {/* Filtro de fecha fin */}
          <div>
            <label
              htmlFor="endDate"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Fecha Fin
            </label>
            <input
              type="date"
              id="endDate"
              name="endDate"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="mt-1 block w-full rounded-md border-0 py-2.5 px-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 dark:bg-gray-700 dark:text-white dark:ring-gray-600 dark:placeholder:text-gray-400 dark:focus:ring-blue-500 sm:text-sm sm:leading-6"
            />
          </div>

          {/* Botones de acción */}
          <div className="flex items-end space-x-2">
            <Form method="get" className="flex-1">
              <input type="hidden" name="q" value={searchValue} />
              <input type="hidden" name="startDate" value={startDate} />
              <input type="hidden" name="endDate" value={endDate} />
              <input type="hidden" name="page" value={searchParams.get("page") || "1"} />
              <button
                type="submit"
                className="w-full rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
              >
                Aplicar Filtros
              </button>
            </Form>
            <button
              type="button"
              onClick={handleClearFilters}
              className="rounded-md bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:bg-gray-700 dark:text-gray-300 dark:ring-gray-600 dark:hover:bg-gray-600 dark:focus:ring-offset-gray-800"
            >
              Limpiar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 