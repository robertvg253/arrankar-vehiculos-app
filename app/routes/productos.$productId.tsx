import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { supabase } from "~/utils/supabase.server";

export type LoaderData = {
  product: {
    id: string;
    name: string;
    description?: string;
    price: number;
    created_at: string;
  } | null;
  images: Array<{
    id: string;
    url: string;
    uuid: string;
  }> | null;
  error?: string;
};

export const loader = async ({ params }: LoaderFunctionArgs) => {
  try {
    // Validar productId
    if (!params.productId) {
      return json<LoaderData>(
        {
          product: null,
          images: null,
          error: "ID de producto no proporcionado.",
        },
        { status: 400 }
      );
    }

    const { productId } = params;

    // Consultar el producto
    const { data: product, error: productError } = await supabase
      .from("products")
      .select("*")
      .eq("id", productId)
      .single();

    // Si hay error al consultar el producto
    if (productError) {
      console.error("Error al cargar producto:", productError);
      return json<LoaderData>(
        {
          product: null,
          images: null,
          error: "Error al cargar el producto.",
        },
        { status: 500 }
      );
    }

    // Si el producto no existe
    if (!product) {
      return json<LoaderData>(
        {
          product: null,
          images: null,
          error: "Producto no encontrado.",
        },
        { status: 404 }
      );
    }

    // Consultar las imágenes asociadas
    const { data: images, error: imagesError } = await supabase
      .from("images")
      .select("id, url, uuid, order_index")
      .eq("product_id", productId)
      .order('order_index', { ascending: true });

    // Si hay error al cargar imágenes, devolvemos el producto sin imágenes
    if (imagesError) {
      console.error("Error al cargar imágenes:", imagesError);
      return json<LoaderData>(
        {
          product,
          images: null,
          error: "Error al cargar las imágenes del producto.",
        },
        { status: 200 }
      );
    }

    // Devolver respuesta exitosa
    return json<LoaderData>(
      {
        product,
        images: images || null,
      },
      { status: 200 }
    );
  } catch (error) {
    // Capturar cualquier error inesperado
    console.error("Error inesperado en el loader:", error);
    return json<LoaderData>(
      {
        product: null,
        images: null,
        error: "Error inesperado al cargar el producto.",
      },
      { status: 500 }
    );
  }
};
