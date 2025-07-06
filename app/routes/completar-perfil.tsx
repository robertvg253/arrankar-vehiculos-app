import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, useActionData, useLoaderData } from "@remix-run/react";
import { useEffect, useState } from "react";
import { supabase } from "~/utils/supabase.server";

export async function loader({ request }: LoaderFunctionArgs) {
  // Obtener la sesión actual
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    return redirect("/login");
  }

  // Obtener datos del usuario actual
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("*")
    .eq("auth_id", session.user.id)
    .single();

  if (userError || !user) {
    return redirect("/register");
  }

  // Obtener lista de concesionarios
  const { data: concesionarios, error: concesionariosError } = await supabase
    .from("concesionario")
    .select("id, nombre")
    .order("nombre");

  if (concesionariosError) {
    console.error("Error al cargar concesionarios:", concesionariosError);
  }

  return json({
    user,
    concesionarios: concesionarios || []
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const rol = String(formData.get("rol") || "").trim();
  const concesionarioId = String(formData.get("concesionario_id") || "").trim();

  // Validación
  if (!rol) {
    return json({ error: "Debe seleccionar un rol." }, { status: 400 });
  }

  // Obtener la sesión actual
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    return redirect("/login");
  }

  // Validar que el usuario existe
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("*")
    .eq("auth_id", session.user.id)
    .single();

  if (userError || !user) {
    return json({ error: "Usuario no encontrado." }, { status: 400 });
  }

  // Preparar datos para actualizar
  const updateData: any = { rol };
  
  // Solo incluir concesionario_id si se seleccionó uno
  if (concesionarioId && concesionarioId !== "null") {
    updateData.concesionario_id = concesionarioId;
  }

  // Actualizar usuario en la base de datos
  const { data: updatedUser, error: updateError } = await supabase
    .from("users")
    .update(updateData)
    .eq("auth_id", session.user.id)
    .select()
    .single();

  if (updateError) {
    console.error("Error al actualizar usuario:", updateError);
    return json({ error: "Error al actualizar perfil." }, { status: 400 });
  }

  console.log("✅ [COMPLETAR PERFIL] Usuario actualizado exitosamente:", updatedUser);
  
  // Redirigir al dashboard
  return redirect("/dashboard");
}

export default function CompletarPerfilPage() {
  const { user, concesionarios } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [selectedRol, setSelectedRol] = useState(user?.rol || "");
  const [showConcesionarioSelect, setShowConcesionarioSelect] = useState(false);

  useEffect(() => {
    setShowConcesionarioSelect(selectedRol === "concesionario");
  }, [selectedRol]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-bg">
      <div className="bg-white rounded-lg shadow-md p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-brand-title mb-6 text-center">Completar Perfil</h1>
        
        <div className="mb-6 p-4 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Usuario:</strong> {user?.name} {user?.lastName}
          </p>
          <p className="text-sm text-blue-800">
            <strong>Email:</strong> {user?.email}
          </p>
        </div>

        <Form method="post" className="space-y-6">
          <div>
            <label htmlFor="rol" className="block text-sm font-medium text-brand-title mb-1">
              Selecciona tu rol *
            </label>
            <select
              name="rol"
              id="rol"
              value={selectedRol}
              onChange={(e) => setSelectedRol(e.target.value)}
              className="block w-full rounded-lg border border-brand-secondary px-3 py-2 bg-white text-brand-title shadow-md focus:outline-none focus:ring-2 focus:ring-brand-highlight"
              required
            >
              <option value="">Selecciona un rol</option>
              <option value="suscriptor">Suscriptor</option>
              <option value="concesionario">Concesionario</option>
              <option value="vendedor_particular">Vendedor Particular</option>
              <option value="agente">Agente</option>
            </select>
          </div>

          {showConcesionarioSelect && (
            <div>
              <label htmlFor="concesionario_id" className="block text-sm font-medium text-brand-title mb-1">
                Selecciona tu concesionario
              </label>
              <select
                name="concesionario_id"
                id="concesionario_id"
                className="block w-full rounded-lg border border-brand-secondary px-3 py-2 bg-white text-brand-title shadow-md focus:outline-none focus:ring-2 focus:ring-brand-highlight"
              >
                <option value="null">Selecciona un concesionario</option>
                {concesionarios.map((concesionario) => (
                  <option key={concesionario.id} value={concesionario.id}>
                    {concesionario.nombre}
                  </option>
                ))}
              </select>
            </div>
          )}

          {actionData?.error && (
            <div className="text-red-600 text-sm text-center">{actionData.error}</div>
          )}

          <button
            type="submit"
            className="w-full bg-brand-primary text-brand-title font-semibold py-2 px-4 rounded-md shadow-sm hover:bg-brand-highlight focus:outline-none focus:ring-2 focus:ring-brand-highlight focus:ring-offset-2 transition"
          >
            Completar Registro
          </button>
        </Form>
      </div>
    </div>
  );
} 