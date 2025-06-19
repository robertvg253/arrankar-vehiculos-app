import { json, redirect } from "@remix-run/node";
import { Form, useActionData } from "@remix-run/react";
import { supabase } from "~/utils/supabase.server";

type ActionData = {
  errors?: {
    nombre?: string;
    email?: string;
    form?: string;
  };
};

export const action = async ({ request }: { request: Request }) => {
  console.log("Action started - Processing form submission");
  
  const formData = await request.formData();
  const nombre = formData.get("nombre") as string;
  const email = formData.get("email") as string;

  console.log("Form data received:", { nombre, email });

  // Validación
  const errors: ActionData["errors"] = {};
  if (!nombre) errors.nombre = "El nombre es requerido";
  if (!email) errors.email = "El email es requerido";
  if (Object.keys(errors).length > 0) {
    console.log("Validation errors:", errors);
    return json<ActionData>({ errors });
  }

  try {
    console.log("Attempting to insert into Supabase...");
    
    const { data, error } = await supabase
      .from("clientes")
      .insert([{ name: nombre, email }])
      .select();

    if (error) {
      console.error("Supabase error details:", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      throw error;
    }

    console.log("Successfully inserted client:", data);
    return redirect("/clientes");
  } catch (error) {
    console.error("Error in action:", error);

    let errorMessage = "Hubo un error al guardar el cliente. Por favor intenta de nuevo.";
    
    if (error instanceof Error) {
      errorMessage = `Error: ${error.message}`;
    } else if (typeof error === 'object' && error !== null) {
      const supabaseError = error as { message?: string; details?: string };
      errorMessage = `Error de Supabase: ${supabaseError.message || 'Error desconocido'}`;
      if (supabaseError.details) {
        errorMessage += ` (${supabaseError.details})`;
      }
    }

    return json<ActionData>({
      errors: {
        form: errorMessage,
      },
    });
  }
};

export default function NuevoCliente() {
  const actionData = useActionData<typeof action>();

  return (
    <div>
      <h1 className="mb-8 text-2xl font-bold text-gray-900 dark:text-white">
        Nuevo Cliente
      </h1>
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <Form method="post" className="space-y-6">
          {actionData?.errors?.form && (
            <div className="rounded-md bg-red-50 p-4 text-sm text-red-700 dark:bg-red-900/50 dark:text-red-200">
              {actionData.errors.form}
            </div>
          )}

          <div>
            <label
              htmlFor="nombre"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Nombre
            </label>
            <input
              type="text"
              name="nombre"
              id="nombre"
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            />
            {actionData?.errors?.nombre && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                {actionData.errors.nombre}
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
              required
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
              className="inline-flex justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
            >
              Guardar Cliente
            </button>
          </div>
        </Form>
      </div>
    </div>
  );
} 