import { json, redirect } from "@remix-run/node";
import { useLoaderData, Link, Form, useActionData, useNavigation } from "@remix-run/react";
import type { LoaderFunction, ActionFunction } from "@remix-run/node";
import { supabase } from "~/utils/supabase.server";
import { useState, useEffect } from "react";

type Cliente = {
  id: string;
  name: string;
  email: string;
  created_at: string;
};

type ActionData = {
  errors?: {
    name?: string;
    email?: string;
    form?: string;
  };
};

export const loader: LoaderFunction = async ({ params }) => {
  const clienteId = params.clienteId;

  if (!clienteId) {
    return json(
      { message: "ID de cliente no proporcionado" },
      { status: 400 }
    );
  }

  const { data: cliente, error } = await supabase
    .from("clientes")
    .select("*")
    .eq("id", clienteId)
    .single();

  if (error) {
    console.error("Error al cargar cliente:", error);
    return json(
      { message: "Error al cargar el cliente" },
      { status: 500 }
    );
  }

  if (!cliente) {
    return json(
      { message: "Cliente no encontrado" },
      { status: 404 }
    );
  }

  return json({ cliente });
};

export const action: ActionFunction = async ({ request, params }) => {
  const formData = await request.formData();
  const method = formData.get("_method") as string;

  if (method === "delete") {
    const clienteId = params.clienteId;

    try {
      const { error } = await supabase
        .from("clientes")
        .delete()
        .eq("id", clienteId);

      if (error) {
        console.error("Error al eliminar cliente:", error);
        return json<ActionData>({
          errors: {
            form: "Error al eliminar el cliente. Por favor intenta de nuevo.",
          },
        });
      }

      return redirect("/clientes");
    } catch (error) {
      console.error("Error inesperado al eliminar:", error);
      return json<ActionData>({
        errors: {
          form: "Error inesperado al eliminar el cliente.",
        },
      });
    }
  }

  // Si no es delete, es una actualización
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;

  // Validación
  const errors: ActionData["errors"] = {};
  if (!name) errors.name = "El nombre es requerido";
  if (!email) errors.email = "El email es requerido";
  if (Object.keys(errors).length > 0) {
    return json<ActionData>({ errors });
  }

  try {
    const { error } = await supabase
      .from("clientes")
      .update({ name, email })
      .eq("id", params.clienteId)
      .select()
      .single();

    if (error) {
      console.error("Error al actualizar cliente:", error);
      return json<ActionData>({
        errors: {
          form: "Error al actualizar el cliente. Por favor intenta de nuevo.",
        },
      });
    }

    return redirect(`/clientes/${params.clienteId}`);
  } catch (error) {
    console.error("Error inesperado:", error);
    return json<ActionData>({
      errors: {
        form: "Error inesperado al actualizar el cliente.",
      },
    });
  }
};

function DeleteModal({ 
  isOpen, 
  onClose, 
  clienteName,
  isDeleting 
}: { 
  isOpen: boolean; 
  onClose: () => void;
  clienteName: string;
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
                Eliminar Cliente
              </h3>
              <div className="mt-2">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  ¿Estás seguro de que deseas eliminar al cliente "{clienteName}"? Esta acción no se puede deshacer.
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

export default function ClienteDetallePage() {
  const { cliente, message } = useLoaderData<{ cliente?: Cliente; message?: string }>();
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  if (message) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <h1 className="mb-4 text-2xl font-bold text-gray-900 dark:text-white">
            {message}
          </h1>
          <p className="mb-4 text-gray-600 dark:text-gray-400">
            El cliente que buscas no existe o no se pudo cargar.
          </p>
          <Link
            to="/clientes"
            className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
          >
            Volver a la lista de clientes
          </Link>
        </div>
      </div>
    );
  }

  if (!cliente) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Detalles del Cliente
        </h1>
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center md:w-auto md:flex-row md:gap-4">
          <button
            onClick={() => setIsDeleteModalOpen(true)}
            className="inline-flex w-full items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 dark:focus:ring-offset-gray-800 sm:w-auto"
          >
            <svg
              className="mr-2 h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
              />
            </svg>
            Eliminar Cliente
          </button>
          <Link
            to="/clientes"
            className="inline-flex w-full items-center justify-center rounded-lg border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 sm:w-auto"
          >
            <svg
              className="mr-2 h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3"
              />
            </svg>
            Volver a la lista
          </Link>
        </div>
      </div>

      <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <dl className="space-y-4">
          <div>
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
              ID
            </dt>
            <dd className="mt-1 text-sm text-gray-900 dark:text-white">
              {cliente.id}
            </dd>
          </div>

          <div>
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Nombre
            </dt>
            <dd className="mt-1 text-sm text-gray-900 dark:text-white">
              {cliente.name}
            </dd>
          </div>

          <div>
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Email
            </dt>
            <dd className="mt-1 text-sm text-gray-900 dark:text-white">
              {cliente.email}
            </dd>
          </div>

          <div>
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Fecha de Creación
            </dt>
            <dd className="mt-1 text-sm text-gray-900 dark:text-white">
              {new Date(cliente.created_at).toLocaleDateString("es-ES", {
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </dd>
          </div>
        </dl>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-6 text-lg font-medium text-gray-900 dark:text-white">
          Editar Cliente
        </h2>

        <Form method="post" className="space-y-6">
          {actionData?.errors?.form && (
            <div className="rounded-md bg-red-50 p-4 text-sm text-red-700 dark:bg-red-900/50 dark:text-red-200">
              {actionData.errors.form}
            </div>
          )}

          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Nombre
            </label>
            <input
              type="text"
              name="name"
              id="name"
              defaultValue={cliente.name}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            />
            {actionData?.errors?.name && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                {actionData.errors.name}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Email
            </label>
            <input
              type="email"
              name="email"
              id="email"
              defaultValue={cliente.email}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            />
            {actionData?.errors?.email && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                {actionData.errors.email}
              </p>
            )}
          </div>

          <div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:focus:ring-offset-gray-900"
            >
              {isSubmitting ? "Guardando..." : "Guardar Cambios"}
            </button>
          </div>
        </Form>
      </div>

      <DeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        clienteName={cliente.name}
        isDeleting={isSubmitting}
      />
    </div>
  );
} 