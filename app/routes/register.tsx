import { json, redirect, type ActionFunctionArgs } from "@remix-run/node";
import { Form, useActionData, useSearchParams } from "@remix-run/react";
import { useRef, useEffect } from "react";
import { supabase } from "~/utils/supabase.server";

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const name = String(formData.get("name") || "").trim();
  const lastName = String(formData.get("lastName") || "").trim();

  // Validación básica
  if (!email || !password || !name || !lastName) {
    return json({ error: "Todos los campos son requeridos." }, { status: 400 });
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return json({ error: "Formato de email inválido." }, { status: 400 });
  }

  // Registro con Supabase
  console.log("🔍 [REGISTER DEBUG] Intentando registro con:", { email, name, lastName });
  
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name, lastName } },
  });
  
  console.log("🔍 [REGISTER DEBUG] Respuesta de Supabase:", { 
    error: error ? { message: error.message, status: error.status, name: error.name } : null,
    data: data ? { 
      user: data.user ? { id: data.user.id, email: data.user.email, created_at: data.user.created_at } : null,
      session: data.session ? { access_token: !!data.session.access_token, refresh_token: !!data.session.refresh_token } : null
    } : null
  });
  
  if (error || !data.user) {
    console.log("❌ [REGISTER DEBUG] Registro falló:", error?.message || "No se creó usuario");
    return json({ error: error?.message || "Error al registrar usuario." }, { status: 400 });
  }

  // Registro exitoso en Supabase Auth, ahora crear usuario en public.users
  console.log("✅ [REGISTER DEBUG] Usuario creado en Auth, creando registro en public.users");
  
  try {
    const { data: userData, error: userError } = await supabase
      .from("users")
      .insert({
        auth_id: data.user.id,
        email: email,
        name: `${name} ${lastName}`.trim(), // Guardar nombre y apellido juntos
        rol: null, // Se completará en la siguiente pantalla
        concesionario_id: null // Se completará en la siguiente pantalla
      })
      .select()
      .single();

    if (userError) {
      console.log("❌ [REGISTER DEBUG] Error al crear usuario en public.users:", userError);
      return json({ error: "Error al crear perfil de usuario." }, { status: 400 });
    }

    console.log("✅ [REGISTER DEBUG] Usuario creado exitosamente en public.users:", userData);
    
    // Redirigir a completar perfil
    return redirect("/completar-perfil");
  } catch (insertError) {
    console.log("❌ [REGISTER DEBUG] Excepción al crear usuario en public.users:", insertError);
    return json({ error: "Error interno al crear perfil de usuario." }, { status: 500 });
  }
}

export default function RegisterPage() {
  const actionData = useActionData<typeof action>();
  const [searchParams] = useSearchParams();
  const emailParam = searchParams.get("email") || "";
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (emailParam && emailRef.current) {
      emailRef.current.value = emailParam;
    }
  }, [emailParam]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-bg">
      <div className="bg-white rounded-lg shadow-md p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-brand-title mb-6 text-center">Registro</h1>
        <Form method="post" className="space-y-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-brand-title mb-1">Nombre</label>
            <input
              type="text"
              name="name"
              id="name"
              className="block w-full rounded-lg border border-brand-secondary px-3 py-2 bg-white text-brand-title shadow-md focus:outline-none focus:ring-2 focus:ring-brand-highlight placeholder:text-brand-text"
              required
            />
          </div>
          <div>
            <label htmlFor="lastName" className="block text-sm font-medium text-brand-title mb-1">Apellido</label>
            <input
              type="text"
              name="lastName"
              id="lastName"
              className="block w-full rounded-lg border border-brand-secondary px-3 py-2 bg-white text-brand-title shadow-md focus:outline-none focus:ring-2 focus:ring-brand-highlight placeholder:text-brand-text"
              required
            />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-brand-title mb-1">Email</label>
            <input
              type="email"
              name="email"
              id="email"
              ref={emailRef}
              defaultValue={emailParam}
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
              autoComplete="new-password"
            />
          </div>
          {actionData?.error && (
            <div className="text-red-600 text-sm text-center">{actionData.error}</div>
          )}
          <button
            type="submit"
            className="w-full bg-brand-primary text-brand-title font-semibold py-2 px-4 rounded-md shadow-sm hover:bg-brand-highlight focus:outline-none focus:ring-2 focus:ring-brand-highlight focus:ring-offset-2 transition"
          >
            Registrarse
          </button>
          <div className="text-center mt-4">
            <a
              href="/login"
              className="text-brand-highlight hover:underline text-sm"
            >
              ¿Ya tienes cuenta? Inicia sesión
            </a>
          </div>
        </Form>
      </div>
    </div>
  );
} 