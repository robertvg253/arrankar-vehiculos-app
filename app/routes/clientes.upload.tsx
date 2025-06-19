import { json, type ActionFunctionArgs } from "@remix-run/node";
import { Form, useActionData, useNavigation } from "@remix-run/react";
import { supabase } from "~/utils/supabase.server";

type ActionData = {
  success?: string;
  error?: string;
};

export async function action({ request }: ActionFunctionArgs) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return json<ActionData>(
        { error: "Por favor, selecciona un archivo." },
        { status: 400 }
      );
    }

    // Validar tipo de archivo
    if (!file.type.match(/^(text\/plain|text\/csv)$/)) {
      return json<ActionData>(
        { error: "El archivo debe ser de tipo texto (.txt o .csv)." },
        { status: 400 }
      );
    }

    // Leer y procesar el archivo
    const content = await file.text();
    const lines = content.split(/\r?\n/).filter(line => line.trim());

    if (lines.length === 0) {
      return json<ActionData>(
        { error: "El archivo está vacío." },
        { status: 400 }
      );
    }

    // Procesar cada línea
    const clients = lines.map((line, index) => {
      const [name, email] = line.split(",").map(field => field.trim());
      
      if (!name || !email) {
        throw new Error(`Error en la línea ${index + 1}: formato inválido. Se espera "nombre,email"`);
      }

      if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
        throw new Error(`Error en la línea ${index + 1}: email inválido`);
      }

      return { name, email };
    });

    // Insertar en Supabase
    const { error: insertError } = await supabase
      .from("clientes")
      .insert(clients);

    if (insertError) {
      console.error("Error al insertar clientes:", insertError);
      return json<ActionData>(
        { error: "Error al guardar los clientes en la base de datos." },
        { status: 500 }
      );
    }

    return json<ActionData>({
      success: `${clients.length} clientes subidos exitosamente.`,
    });
  } catch (error) {
    console.error("Error procesando el archivo:", error);
    return json<ActionData>(
      { error: error instanceof Error ? error.message : "Error procesando el archivo." },
      { status: 400 }
    );
  }
}

export default function UploadClientesPage() {
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();
  const isUploading = navigation.state === "submitting";

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-8 text-2xl font-bold text-gray-900 dark:text-white">
          Subir Clientes Masivamente
        </h1>

        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <Form method="post" encType="multipart/form-data" className="space-y-6">
            <div>
              <label
                htmlFor="file"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Archivo de Clientes
              </label>
              <div className="mt-1">
                <input
                  type="file"
                  id="file"
                  name="file"
                  accept=".csv,.txt"
                  className="block w-full text-sm text-gray-500 file:mr-4 file:rounded-md file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100 dark:text-gray-400 dark:file:bg-gray-700 dark:file:text-gray-300"
                />
              </div>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                Sube un archivo .csv o .txt. Cada línea debe tener el formato: nombre,email
              </p>
            </div>

            <div>
              <button
                type="submit"
                disabled={isUploading}
                className="inline-flex w-full items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:focus:ring-offset-gray-800"
              >
                {isUploading ? (
                  <>
                    <svg
                      className="mr-2 h-4 w-4 animate-spin"
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
                    Subiendo...
                  </>
                ) : (
                  "Subir Archivo"
                )}
              </button>
            </div>
          </Form>

          {/* Mensajes de Feedback */}
          {actionData?.success && (
            <div className="mt-4 rounded-md bg-green-50 p-4 dark:bg-green-900/50">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg
                    className="h-5 w-5 text-green-400"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-green-800 dark:text-green-200">
                    {actionData.success}
                  </p>
                </div>
              </div>
            </div>
          )}

          {actionData?.error && (
            <div className="mt-4 rounded-md bg-red-50 p-4 dark:bg-red-900/50">
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
                  <p className="text-sm font-medium text-red-800 dark:text-red-200">
                    {actionData.error}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 