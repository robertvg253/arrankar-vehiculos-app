import { json, type ActionFunctionArgs, unstable_parseMultipartFormData, unstable_createMemoryUploadHandler } from "@remix-run/node";
import { supabase } from "~/utils/supabase.server";
import { randomUUID } from "crypto";
import { redirect } from "@remix-run/node";

export type ActionData = {
  success?: string;
  errors?: {
    name?: string;
    description?: string;
    price?: string;
    images?: string;
    form?: string;
  };
  productId?: string;
};

// Constantes para límites de tamaño
const MAX_FILE_SIZE = 20_000_000; // 20MB
const MAX_TOTAL_SIZE = 50_000_000; // 50MB para múltiples archivos

export const action = async ({ request }: ActionFunctionArgs) => {
  // Configurar el uploadHandler para archivos
  const uploadHandler = unstable_createMemoryUploadHandler({
    maxPartSize: MAX_FILE_SIZE,
  });

  try {
    let formData;
    try {
      // Parsear el formData con soporte para archivos
      formData = await unstable_parseMultipartFormData(request, uploadHandler);
    } catch (error) {
      console.error("Error al procesar el formulario:", error);
      
      // Manejar específicamente el error de tamaño excedido
      if (error instanceof Error && error.message.includes("exceeded upload size")) {
        return json<ActionData>(
          {
            errors: {
              images: `Una o más imágenes superan el límite de ${MAX_FILE_SIZE / 1_000_000}MB por archivo.`,
            },
          },
          { status: 413 }
        );
      }
      
      // Para otros errores de procesamiento del formulario
      return json<ActionData>(
        {
          errors: {
            form: "Error al procesar el formulario. Por favor, intenta de nuevo.",
          },
        },
        { status: 400 }
      );
    }
    
    // Check if this is a "noop" submission
    const isNoOp = !formData.get("productId") && 
                  !formData.get("name") && 
                  !formData.getAll("images").some(file => file instanceof File && file.size > 0);

    if (isNoOp) {
      console.log("[productos.nuevo] Detected no-op submission. Returning success.");
      return json<ActionData>({ success: "No operation performed" }, { status: 200 });
    }
    
    // Debug: Ver todos los campos recibidos
    console.log('FormData received:', [...formData.entries()].map(([key, value]) => {
      if (value instanceof File) {
        return [key, { name: value.name, type: value.type, size: value.size }];
      }
      return [key, value];
    }));
    
    // Extraer campos del formulario
    const productId = formData.get("productId")?.toString();
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    const price = formData.get("price") as string;
    const imageFiles = formData.getAll("images") as File[];
    
    // Obtener los order_index de las imágenes existentes
    const imageOrderIndices = formData.getAll("images[].order_index").map(index => Number(index));

    // Debug: Verificar archivos de imagen
    console.log('Image Files detected:', imageFiles.length, imageFiles.map(file => ({
      name: file.name,
      type: file.type,
      size: file.size
    })));

    // Validación de campos
    const errors: ActionData["errors"] = {};
    if (!name?.trim()) {
      errors.name = "El nombre es requerido";
    }
    if (!price || isNaN(Number(price)) || Number(price) <= 0) {
      errors.price = "El precio debe ser un número positivo";
    }

    // Validar tamaño total de las imágenes
    const totalSize = imageFiles.reduce((sum, file) => sum + file.size, 0);
    if (totalSize > MAX_TOTAL_SIZE) {
      errors.images = `El tamaño total de las imágenes (${(totalSize / 1_000_000).toFixed(1)}MB) excede el límite de ${MAX_TOTAL_SIZE / 1_000_000}MB.`;
    }

    if (Object.keys(errors).length > 0) {
      return json<ActionData>({ errors }, { status: 400 });
    }

    let productResult;

    if (!productId) {
      // INSERT: Crear nuevo producto
      const { data: newProduct, error: productError } = await supabase
        .from("products")
        .insert([
          {
            name: name.trim(),
            description: description?.trim() || null,
            price: Number(price),
          },
        ])
        .select("id")
        .single();

      if (productError) {
        console.error("Error al crear el producto:", productError);
        return json<ActionData>({
          errors: {
            form: "Error al crear el producto en la base de datos. Por favor, intenta de nuevo."
          }
        }, { status: 500 });
      }

      console.log('Producto creado exitosamente:', newProduct);
      productResult = newProduct;
    } else {
      // UPDATE: Actualizar producto existente
      const { data: updatedProduct, error: updateError } = await supabase
        .from("products")
        .update({
          name: name.trim(),
          description: description?.trim() || null,
          price: Number(price),
        })
        .eq("id", productId)
        .select("id")
        .single();

      if (updateError) {
        console.error("Error al actualizar el producto:", updateError);
        return json<ActionData>({
          errors: {
            form: "Error al actualizar el producto en la base de datos. Por favor, intenta de nuevo."
          }
        }, { status: 500 });
      }

      console.log('Producto actualizado exitosamente:', updatedProduct);
      productResult = updatedProduct;
    }

    // Procesar imágenes si existen
    if (imageFiles.length > 0) {
      const imagePromises = imageFiles.map(async (file, index) => {
        try {
          // Validar tipo y tamaño de archivo
          if (!file.type.startsWith("image/")) {
            console.warn(`Archivo ignorado: ${file.name} - No es una imagen válida`);
            return null;
          }

          if (file.size > MAX_FILE_SIZE) {
            console.warn(`Archivo ignorado: ${file.name} - Excede el tamaño máximo de ${MAX_FILE_SIZE / 1_000_000}MB`);
            return null;
          }

          // Generar UUID único para la imagen
          const imageUuid = randomUUID();
          const fileExtension = file.name.split(".").pop();
          const storagePath = `products/${productResult.id}/${imageUuid}.${fileExtension}`;

          console.log('Intentando subir imagen:', {
            path: storagePath,
            size: file.size,
            type: file.type
          });

          // Subir imagen a Supabase Storage
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from("product-images")
            .upload(storagePath, file, {
              upsert: true,
              contentType: file.type,
            });

          if (uploadError) {
            console.error("Error al subir imagen:", uploadError);
            return null;
          }

          console.log('Imagen subida exitosamente:', uploadData);

          // Obtener URL pública
          const { data: { publicUrl } } = supabase.storage
            .from("product-images")
            .getPublicUrl(storagePath);

          console.log('URL pública generada:', publicUrl);

          if (!publicUrl) {
            console.error("No se pudo obtener la URL pública para:", storagePath);
            return null;
          }

          // Registrar imagen en la tabla images con order_index
          const { error: imageError } = await supabase.from("images").insert([
            {
              uuid: imageUuid,
              url: publicUrl,
              product_id: productResult.id,
              order_index: imageOrderIndices[index] || index + 1, // Usar el order_index proporcionado o generar uno
            },
          ]);

          if (imageError) {
            console.error("Error al registrar imagen en la base de datos:", imageError);
            return null;
          }

          console.log('Imagen registrada exitosamente en la base de datos');
          return publicUrl;
        } catch (error) {
          console.error("Error procesando imagen:", error);
          return null;
        }
      });

      // Esperar a que todas las imágenes se procesen
      const results = await Promise.all(imagePromises);
      const successfulUploads = results.filter(url => url !== null);
      
      console.log('Resumen de subida de imágenes:', {
        total: imageFiles.length,
        exitosas: successfulUploads.length,
        fallidas: imageFiles.length - successfulUploads.length
      });

      if (successfulUploads.length === 0 && imageFiles.length > 0) {
        errors.images = "No se pudo subir ninguna imagen";
      }
    }

    // Si es una actualización, procesar las imágenes eliminadas
    if (productId) {
      // Obtener la lista de imágenes eliminadas
      const deletedImagesStr = formData.get('deletedImages')?.toString();
      if (deletedImagesStr) {
        try {
          const deletedImages = JSON.parse(deletedImagesStr) as string[];
          console.log('Imágenes a eliminar:', deletedImages);

          // Obtener las imágenes a eliminar para obtener sus UUIDs
          const { data: imagesToDelete, error: fetchError } = await supabase
            .from("images")
            .select("id, uuid")
            .in("id", deletedImages);

          if (fetchError) {
            console.error("Error al obtener imágenes a eliminar:", fetchError);
          } else if (imagesToDelete) {
            // Eliminar las imágenes de Storage
            const deleteStoragePromises = imagesToDelete.map(async (image) => {
              // Obtener la extensión del archivo de la URL
              const { data: imageData } = await supabase
                .from("images")
                .select("url")
                .eq("id", image.id)
                .single();

              if (imageData?.url) {
                const urlParts = imageData.url.split('.');
                const extension = urlParts[urlParts.length - 1];
                const storagePath = `products/${productId}/${image.uuid}.${extension}`;

                const { error: storageError } = await supabase.storage
                  .from("product-images")
                  .remove([storagePath]);

                if (storageError) {
                  console.error(`Error al eliminar imagen de storage: ${storagePath}`, storageError);
                }
              }
            });

            await Promise.all(deleteStoragePromises);

            // Eliminar los registros de la base de datos
            const { error: deleteError } = await supabase
              .from("images")
              .delete()
              .in("id", deletedImages);

            if (deleteError) {
              console.error("Error al eliminar registros de imágenes:", deleteError);
            } else {
              console.log('Imágenes eliminadas exitosamente');
            }
          }
        } catch (error) {
          console.error("Error al procesar imágenes eliminadas:", error);
        }
      }

      // Obtener todos los order_index y IDs de las imágenes del formulario
      const imageUpdates = [];
      let index = 0;
      
      while (true) {
        const imageId = formData.get(`images[${index}].id`);
        const orderIndex = formData.get(`images[${index}].order_index`);
        
        if (!imageId || !orderIndex) break;
        
        imageUpdates.push({
          id: imageId.toString(),
          order_index: parseInt(orderIndex.toString(), 10)
        });
        
        index++;
      }

      console.log('Actualizando order_index de imágenes:', imageUpdates);

      // Actualizar cada imagen con su nuevo order_index
      const updatePromises = imageUpdates.map(update => {
        console.log(`Actualizando imagen ${update.id} con order_index ${update.order_index}`);
        return supabase
          .from("images")
          .update({ order_index: update.order_index })
          .eq("id", update.id)
          .eq("product_id", productId);
      });

      const results = await Promise.all(updatePromises);
      const errors = results.filter(result => result.error);

      if (errors.length > 0) {
        console.error("Errores al actualizar order_index:", errors);
      } else {
        console.log('Order_index actualizado exitosamente para todas las imágenes');
      }
    }

    // Redirigir a /productos en ambos casos (creación y actualización)
    return redirect("/productos");

  } catch (error) {
    console.error("Error en la acción:", error);
    return json<ActionData>(
      {
        errors: {
          form: error instanceof Error ? error.message : "Error desconocido al procesar la solicitud",
        },
      },
      { status: 500 }
    );
  }
};
