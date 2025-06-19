import { useEffect, useRef, useState } from "react";
import type { ActionData } from "~/routes/productos.nuevo";
import type { FetcherWithComponents } from "@remix-run/react";
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';

// Tipos para las imágenes
type ExistingImage = {
  id: string;
  url: string;
  uuid: string;
  order_index?: number;
};

type NewImage = {
  id: string;
  url: string;
  file: File;
  order_index: number;
};

type OrderedImage = {
  id: string;
  url: string;
  type: 'existing' | 'new';
  data: ExistingImage | NewImage;
  order_index: number;
};

interface ProductFormProps {
  onClose: () => void;
  defaultValues?: {
    id?: string;
    name: string;
    description?: string;
    price: number;
    images?: ExistingImage[] | null;
  };
  fetcher: FetcherWithComponents<ActionData>;
}

export default function ProductForm({ onClose, defaultValues, fetcher }: ProductFormProps) {
  const isSubmitting = fetcher.state === "submitting";
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Estado para las imágenes ordenadas
  const [orderedImages, setOrderedImages] = useState<OrderedImage[]>(() => {
    // Ordenar las imágenes por order_index antes de mapearlas
    const sortedImages = [...(defaultValues?.images || [])].sort((a, b) => {
      // Si ambos tienen order_index, ordenar por ese valor
      if (a.order_index !== undefined && b.order_index !== undefined) {
        return a.order_index - b.order_index;
      }
      // Si solo uno tiene order_index, poner primero el que lo tiene
      if (a.order_index !== undefined) return -1;
      if (b.order_index !== undefined) return 1;
      // Si ninguno tiene order_index, mantener el orden original
      return 0;
    });

    return sortedImages.map((img) => ({
      id: img.id,
      url: img.url,
      type: 'existing' as const,
      order_index: img.order_index || 0, // Usar el order_index existente
      data: {
        ...img,
        order_index: img.order_index || 0
      }
    }));
  });

  // Estado para trackear imágenes eliminadas
  const [deletedImages, setDeletedImages] = useState<string[]>([]);

  // Función para generar IDs únicos para nuevas imágenes
  const generateUniqueId = () => `new-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Función para manejar la selección de nuevas imágenes
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const newImages: OrderedImage[] = Array.from(files).map((file) => {
      const id = generateUniqueId();
      const url = URL.createObjectURL(file);
      // No asignamos order_index aquí, se asignará en el reordenamiento
      return {
        id,
        url,
        type: 'new' as const,
        order_index: 0, // Inicialmente 0, se actualizará en el reordenamiento
        data: {
          id,
          url,
          file,
          order_index: 0
        }
      };
    });

    // Actualizar el estado y reordenar todas las imágenes
    setOrderedImages(prev => {
      const allImages = [...prev, ...newImages];
      return allImages.map((img, index) => ({
        ...img,
        order_index: index + 1,
        data: {
          ...img.data,
          order_index: index + 1
        }
      }));
    });
  };

  // Función para reordenar imágenes
  const reorder = (list: OrderedImage[], startIndex: number, endIndex: number) => {
    const result = Array.from(list);
    const [removed] = result.splice(startIndex, 1);
    result.splice(endIndex, 0, removed);
    
    // Actualizar order_index para todas las imágenes
    return result.map((img, index) => ({
      ...img,
      order_index: index + 1,
      data: {
        ...img.data,
        order_index: index + 1
      }
    }));
  };

  // Función para manejar el fin del drag and drop
  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const reordered = reorder(
      orderedImages,
      result.source.index,
      result.destination.index
    );

    console.log('Imágenes reordenadas:', reordered.map(img => ({
      id: img.id,
      order_index: img.order_index,
      type: img.type
    })));

    setOrderedImages(reordered);
  };

  // Función para eliminar una imagen
  const handleRemoveImage = (imageId: string) => {
    setOrderedImages(prev => {
      const imageToRemove = prev.find(img => img.id === imageId);
      if (imageToRemove?.type === 'new') {
        URL.revokeObjectURL(imageToRemove.url);
      } else if (imageToRemove?.type === 'existing') {
        // Agregar a la lista de imágenes eliminadas
        setDeletedImages(prev => [...prev, imageId]);
      }
      const newImages = prev.filter(img => img.id !== imageId);
      // Reordenar las imágenes restantes
      return newImages.map((img, index) => ({
        ...img,
        order_index: index + 1,
        data: {
          ...img.data,
          order_index: index + 1
        }
      }));
    });
  };

  // Función para manejar el envío del formulario
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    
    // Crear un nuevo FormData
    const formData = new FormData(event.currentTarget);
    
    // Agregar los order_index actualizados
    orderedImages.forEach((image, index) => {
      formData.set(`images[${index}].order_index`, image.order_index.toString());
      if (image.type === 'existing') {
        formData.set(`images[${index}].id`, image.id);
      }
    });

    // Agregar la lista de imágenes eliminadas
    formData.set('deletedImages', JSON.stringify(deletedImages));

    // Debug: Mostrar los datos que se enviarán
    console.log('Datos a enviar:', {
      productId: formData.get('productId'),
      images: orderedImages.map(img => ({
        id: img.id,
        order_index: img.order_index,
        type: img.type
      })),
      deletedImages
    });

    // Enviar el formulario
    event.currentTarget.submit();
  };

  // Limpiar URLs de objetos cuando el componente se desmonte
  useEffect(() => {
    return () => {
      orderedImages.forEach(img => {
        if (img.type === 'new') {
          URL.revokeObjectURL(img.url);
        }
      });
    };
  }, [orderedImages]);

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.success) {
      // Resetear el formulario
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      onClose();
      console.log("Producto guardado exitosamente:", fetcher.data);
    } else if (fetcher.state === "idle" && fetcher.data?.errors) {
      console.log("Errores en el formulario:", fetcher.data.errors);
    }
  }, [fetcher.data, fetcher.state, onClose]);

  return (
    <fetcher.Form
      method="post"
      action="/productos/nuevo"
      encType="multipart/form-data"
      className="space-y-6"
      onSubmit={handleSubmit}
    >
      {defaultValues?.id && (
        <input type="hidden" name="productId" value={defaultValues.id} />
      )}

      {/* Input oculto para las imágenes eliminadas */}
      <input type="hidden" name="deletedImages" value={JSON.stringify(deletedImages)} />

      {/* Agregar inputs ocultos para el order_index y ID de cada imagen */}
      {orderedImages.map((image, index) => (
        <div key={`image-data-${image.id}`}>
          <input
            type="hidden"
            name={`images[${index}].order_index`}
            value={image.order_index}
          />
          {image.type === 'existing' && (
            <input
              type="hidden"
              name={`images[${index}].id`}
              value={image.id}
            />
          )}
        </div>
      ))}

      {/* Debug: Mostrar el estado actual de las imágenes */}
      {process.env.NODE_ENV === 'development' && (
        <div className="hidden">
          <pre>{JSON.stringify(orderedImages, null, 2)}</pre>
        </div>
      )}

      <div>
        <label
          htmlFor="name"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Nombre del Producto
        </label>
        <input
          type="text"
          id="name"
          name="name"
          required
          defaultValue={defaultValues?.name || ""}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        />
        {fetcher.data?.errors?.name && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">
            {fetcher.data.errors.name}
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor="description"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Descripción
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={defaultValues?.description || ""}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        />
        {fetcher.data?.errors?.description && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">
            {fetcher.data.errors.description}
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor="price"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Precio
        </label>
        <div className="relative mt-1 rounded-md shadow-sm">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <span className="text-gray-500 dark:text-gray-400">$</span>
          </div>
          <input
            type="number"
            id="price"
            name="price"
            step="0.01"
            min="0"
            required
            defaultValue={defaultValues?.price || ""}
            className="block w-full rounded-md border border-gray-300 pl-7 pr-12 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          />
        </div>
        {fetcher.data?.errors?.price && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">
            {fetcher.data.errors.price}
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor="images"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Imágenes del Producto
        </label>
        <input
          ref={fileInputRef}
          type="file"
          id="images"
          name="images"
          multiple
          accept="image/*"
          onChange={handleFileSelect}
          className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:rounded-md file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100 dark:text-gray-400 dark:file:bg-blue-900/50 dark:file:text-blue-300 dark:hover:file:bg-blue-900"
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Formatos permitidos: JPG, PNG, GIF. Tamaño máximo: 20MB por imagen.
        </p>
        {fetcher.data?.errors?.images && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">
            {fetcher.data.errors.images}
          </p>
        )}

        {/* Área de Drag and Drop */}
        {orderedImages.length > 0 && (
          <div className="mt-4">
            <h4 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              Imágenes ({orderedImages.length} en total)
            </h4>
            <DragDropContext onDragEnd={onDragEnd}>
              <Droppable droppableId="image-list" direction="horizontal">
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="grid grid-cols-4 gap-4"
                  >
                    {orderedImages.map((image, index) => (
                      <Draggable key={image.id} draggableId={image.id} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className={`relative aspect-square overflow-hidden rounded-lg border transition-all duration-200
                                     ${snapshot.isDragging 
                                       ? 'border-blue-500 shadow-lg opacity-100 cursor-grabbing scale-105 z-50' 
                                       : 'border-gray-200 cursor-grab hover:border-blue-300 dark:border-gray-700'}
                                     ${image.type === 'new' ? 'border-dashed border-blue-400' : ''}`}
                          >
                            <img
                              src={image.url}
                              alt="Imagen del producto"
                              className="h-full w-full object-cover"
                            />
                            <button
                              type="button"
                              onClick={() => handleRemoveImage(image.id)}
                              className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 text-xs transition-colors duration-200"
                              aria-label="Eliminar imagen"
                            >
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"></path>
                              </svg>
                            </button>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          </div>
        )}
      </div>

      <div className="flex justify-end space-x-3">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed dark:focus:ring-offset-gray-900"
        >
          {isSubmitting
            ? "Guardando..."
            : defaultValues?.id
            ? "Actualizar Producto"
            : "Guardar Producto"}
        </button>
      </div>
    </fetcher.Form>
  );
}
