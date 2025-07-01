import { Form, useActionData, useNavigation } from "@remix-run/react";

interface FormularioContactoVehiculoProps {
  vehiculo_uuid: string;
}

interface ActionData {
  success?: string;
  errors?: {
    nombre?: string;
    email?: string;
    mensaje?: string;
    form?: string;
  };
}

const FormularioContactoVehiculo = ({ vehiculo_uuid }: FormularioContactoVehiculoProps) => {
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();
  const loading = navigation.state === "submitting";

  return (
    <Form method="post" className="w-full bg-white rounded-lg shadow-md p-4 space-y-3 border border-gray-200" style={{ fontFamily: 'inherit' }}>
      <input type="hidden" name="vehiculo_uuid" value={vehiculo_uuid} />
      <h2 className="text-lg font-bold mb-1 text-brand-title">Contáctanos por este vehículo</h2>
      <div>
        <label htmlFor="nombre" className="block text-xs font-medium text-brand-text mb-1">Nombre</label>
        <input
          type="text"
          id="nombre"
          name="nombre"
          className={`block w-full rounded-lg border border-brand-secondary px-3 py-2 bg-white text-brand-title text-sm shadow-md focus:outline-none focus:ring-2 focus:ring-brand-highlight placeholder:text-brand-text ${actionData?.errors?.nombre ? 'border-red-500' : ''}`}
          disabled={loading}
          placeholder="Tu nombre"
        />
        {actionData?.errors?.nombre && <p className="text-red-500 text-xs mt-1">{actionData.errors.nombre}</p>}
      </div>
      <div>
        <label htmlFor="email" className="block text-xs font-medium text-brand-text mb-1">Correo electrónico</label>
        <input
          type="email"
          id="email"
          name="email"
          className={`block w-full rounded-lg border border-brand-secondary px-3 py-2 bg-white text-brand-title text-sm shadow-md focus:outline-none focus:ring-2 focus:ring-brand-highlight placeholder:text-brand-text ${actionData?.errors?.email ? 'border-red-500' : ''}`}
          disabled={loading}
          placeholder="tucorreo@email.com"
        />
        {actionData?.errors?.email && <p className="text-red-500 text-xs mt-1">{actionData.errors.email}</p>}
      </div>
      <div>
        <label htmlFor="mensaje" className="block text-xs font-medium text-brand-text mb-1">Mensaje</label>
        <textarea
          id="mensaje"
          name="mensaje"
          rows={3}
          className={`block w-full rounded-lg border border-brand-secondary px-3 py-2 bg-white text-brand-title text-sm shadow-md focus:outline-none focus:ring-2 focus:ring-brand-highlight placeholder:text-brand-text resize-none ${actionData?.errors?.mensaje ? 'border-red-500' : ''}`}
          disabled={loading}
          placeholder="¿En qué podemos ayudarte?"
        />
        {actionData?.errors?.mensaje && <p className="text-red-500 text-xs mt-1">{actionData.errors.mensaje}</p>}
      </div>
      {actionData?.errors?.form && <div className="text-red-600 text-xs font-medium">{actionData.errors.form}</div>}
      {actionData?.success && <div className="text-green-600 text-xs font-medium">{actionData.success}</div>}
      <button
        type="submit"
        className="w-full inline-flex justify-center rounded-lg border border-transparent bg-brand-primary px-4 py-2 text-sm font-medium text-brand-title shadow-sm hover:bg-brand-highlight focus:outline-none focus:ring-2 focus:ring-brand-highlight focus:ring-offset-2 transition-colors disabled:opacity-50"
        disabled={loading}
      >
        {loading ? "Enviando..." : "Enviar Solicitud"}
      </button>
    </Form>
  );
};

export default FormularioContactoVehiculo;
