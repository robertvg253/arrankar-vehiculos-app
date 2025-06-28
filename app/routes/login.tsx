import { json, redirect, type ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { Form, useActionData } from "@remix-run/react";
import { supabase } from "~/utils/supabase.server";
import { sessionStorage } from "~/utils/session.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await sessionStorage.getSession(request.headers.get("Cookie"));
  if (session.has("concesionario_id")) {
    return redirect("/dashboard");
  }
  return json({});
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const email = formData.get("email");
  const password = formData.get("password");
  if (!email || !password) {
    return json({ error: "Email y contraseña son requeridos." }, { status: 400 });
  }
  // Autenticación con Supabase
  const { data, error } = await supabase.auth.signInWithPassword({ email: String(email), password: String(password) });
  if (error || !data.user) {
    return json({ error: error?.message || "Credenciales inválidas" }, { status: 401 });
  }
  // Buscar usuario en public.users
  const { data: userRows, error: userError } = await supabase
    .from("users")
    .select("concesionario_id")
    .eq("auth_id", data.user.id)
    .single();
  if (userError || !userRows?.concesionario_id) {
    return json({ error: "No se encontró el usuario o concesionario." }, { status: 401 });
  }
  // Guardar concesionario_id y user_id en la sesión
  const session = await sessionStorage.getSession(request.headers.get("Cookie"));
  session.set("concesionario_id", userRows.concesionario_id);
  session.set("user_id", data.user.id);
  return redirect("/vehiculos", {
    headers: {
      "Set-Cookie": await sessionStorage.commitSession(session),
    },
  });
}

// Type guard para saber si actionData es un error
function isError(data: any): data is { error: string } {
  return data && typeof data === 'object' && 'error' in data;
}

export default function LoginPage() {
  const actionData = useActionData<typeof action>();
  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-bg">
      <div className="bg-white rounded-lg shadow-md p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-brand-title mb-6 text-center">Iniciar sesión</h1>
        <Form method="post" className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-brand-title mb-1">Email</label>
            <input
              type="email"
              name="email"
              id="email"
              className="block w-full rounded-lg border border-brand-secondary px-3 py-2 bg-white text-brand-title shadow-md focus:outline-none focus:ring-2 focus:ring-brand-highlight placeholder:text-brand-text"
              required
              autoComplete="email"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-brand-title mb-1">Contraseña</label>
            <input
              type="password"
              name="password"
              id="password"
              className="block w-full rounded-lg border border-brand-secondary px-3 py-2 bg-white text-brand-title shadow-md focus:outline-none focus:ring-2 focus:ring-brand-highlight placeholder:text-brand-text"
              required
              autoComplete="current-password"
            />
          </div>
          {isError(actionData) && (
            <div className="text-red-600 text-sm text-center">{actionData.error}</div>
          )}
          <button
            type="submit"
            className="w-full bg-brand-primary text-brand-title font-semibold py-2 px-4 rounded-md shadow-sm hover:bg-brand-highlight focus:outline-none focus:ring-2 focus:ring-brand-highlight focus:ring-offset-2 transition"
          >
            Ingresar
          </button>
        </Form>
      </div>
    </div>
  );
} 