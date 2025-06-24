import React, { useRef, useState, useEffect, useCallback } from "react";
import {
  DndContext,
  closestCenter,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// Utilidad para generar UUID (compatible con navegadores modernos)
function generateUUID() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback simple
  return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

export type ImageUploaderImage = {
  id: string; // ID de la BBDD para existentes, storage_id para nuevas
  storage_id: string;
  url: string; // URL de preview para nuevas, URL de storage para existentes
  order_index?: number;
  destacada: boolean;
  isNew: boolean;
  file?: File;
};

export type ImageMetadata = {
  id?: string; // ID de la BBDD, solo para existentes
  storage_id: string;
  order_index: number;
  isNew: boolean;
  destacada: boolean;
  url?: string; // solo para existentes
};

export interface ImageUploaderChanges {
  orderedImagesMetadata: ImageMetadata[];
  filesToUpload: Map<string, File>;
  imageIdsToDelete: { id: string, storage_id: string }[];
}

interface ImageUploaderProps {
  existingImages?: Array<{ id: string; url: string; storage_id: string; order_index: string; destacada: boolean }>;
  onImagesChange?: (changes: ImageUploaderChanges) => void;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({ existingImages = [], onImagesChange }) => {
  const [orderedImages, setOrderedImages] = useState<ImageUploaderImage[]>([]);
  const [imagesToDelete, setImagesToDelete] = useState<{ id: string, storage_id: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isInitialized = useRef(false);

  // Inicializar imágenes existentes solo una vez
  useEffect(() => {
    if (!isInitialized.current) {
      if (existingImages.length > 0) {
        setOrderedImages(
          existingImages
            .sort((a, b) => parseInt(a.order_index, 10) - parseInt(b.order_index, 10))
            .map((img) => ({ 
              ...img, 
              order_index: parseInt(img.order_index, 10),
              isNew: false,
            }))
        );
      }
      isInitialized.current = true;
    }
  }, [existingImages]);

  // Callback para notificar cambios
  useEffect(() => {
    if (onImagesChange) {
      const filesToUpload = new Map<string, File>();
      const orderedImagesMetadata: ImageMetadata[] = orderedImages.map(
        (img, index) => {
          const metadata: ImageMetadata = {
            id: img.isNew ? undefined : img.id,
            storage_id: img.storage_id,
            order_index: index + 1,
            isNew: img.isNew,
            destacada: img.destacada,
            url: img.isNew ? undefined : img.url,
          };
          if (img.isNew && img.file) {
            filesToUpload.set(img.storage_id, img.file);
          }
          return metadata;
        }
      );
      onImagesChange({
        orderedImagesMetadata,
        filesToUpload,
        imageIdsToDelete: imagesToDelete,
      });
    }
  }, [orderedImages, imagesToDelete, onImagesChange]);

  // Selección de archivos
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newImages: ImageUploaderImage[] = files.map((file, index) => {
      const storage_id = generateUUID();
      return {
        id: storage_id, // Usar storage_id como clave única para dnd-kit en nuevas imágenes
        storage_id: storage_id,
        file,
        url: URL.createObjectURL(file),
        isNew: true,
        destacada: orderedImages.length === 0 && index === 0, // Destacar la primera si no hay más
      };
    });

    if (newImages.length > 0 && orderedImages.every(img => !img.destacada)) {
        newImages[0].destacada = true;
    }

    setOrderedImages((prev) => [...prev, ...newImages]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };
  
  // Marcar como destacada
  const handleSetDestacada = (storage_id: string) => {
    setOrderedImages(prev => 
        prev.map(img => ({ ...img, destacada: img.storage_id === storage_id }))
    );
  };

  // Eliminar imagen
  const handleRemoveImage = (imageToRemove: ImageUploaderImage) => {
    // Si la imagen a eliminar era la destacada, se destaca la primera de las restantes (si hay)
    const wasDestacada = imageToRemove.destacada;

    setOrderedImages((prev) => {
      const remaining = prev.filter((img) => img.id !== imageToRemove.id);
      if (wasDestacada && remaining.length > 0) {
        remaining[0].destacada = true;
      }
      return remaining;
    });

    if (imageToRemove.isNew) {
      URL.revokeObjectURL(imageToRemove.url);
    } else {
      setImagesToDelete((del) => [...del, { id: imageToRemove.id, storage_id: imageToRemove.storage_id }]);
    }
  };

  // Drag and drop
  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = orderedImages.findIndex((img) => img.id === active.id);
    const newIndex = orderedImages.findIndex((img) => img.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    setOrderedImages((prev) => arrayMove(prev, oldIndex, newIndex));
  };

  // Componente SortableImage para encapsular la lógica de useSortable
  function SortableImage({ img }: { img: ImageUploaderImage }) {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: img.id });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      cursor: isDragging ? "grabbing" : "grab",
      zIndex: isDragging ? 50 : undefined,
      opacity: isDragging ? 1 : 1,
    };

    return (
      <div
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        className={`relative group w-32 h-32 flex-shrink-0 rounded-lg border bg-white shadow-md flex items-center justify-center overflow-hidden transition-shadow ${isDragging ? "z-50 shadow-xl opacity-100" : ""} ${img.destacada ? "border-brand-primary border-2" : "border-brand-secondary"}`}
        style={style}
      >
        <img
          src={img.url}
          alt="preview"
          className="object-cover w-full h-full"
        />
        {/* Botón para destacar */}
        <button
            type="button"
            className={`absolute top-1 left-1 bg-white/70 text-yellow-500 rounded-full p-1 opacity-80 hover:opacity-100 shadow-md transition-all ${img.destacada ? 'text-yellow-400' : 'text-gray-400'}`}
            onClick={() => handleSetDestacada(img.storage_id)}
            aria-label="Marcar como destacada"
        >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
        </button>
        {/* Botón para eliminar */}
        <button
          type="button"
          className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-80 hover:opacity-100 shadow"
          onClick={() => handleRemoveImage(img)}
          tabIndex={-1}
          aria-label="Eliminar imagen"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    );
  }

  // Render
  return (
    <div>
      <label className="block text-sm font-medium text-brand-title mb-2">Imágenes del Vehículo</label>
      <input
        type="file"
        accept="image/*"
        multiple
        ref={fileInputRef}
        className="hidden"
        onChange={handleFileSelect}
      />
      <button
        type="button"
        className="mb-4 inline-flex items-center rounded-md bg-brand-primary px-4 py-2 text-brand-title font-semibold shadow hover:bg-brand-secondary focus:outline-none focus:ring-2 focus:ring-brand-highlight focus:ring-offset-2"
        onClick={() => fileInputRef.current?.click()}
      >
        Seleccionar Imágenes
      </button>
      <DndContext onDragEnd={onDragEnd} collisionDetection={closestCenter}>
        <SortableContext items={orderedImages.map((img) => img.id)} strategy={horizontalListSortingStrategy}>
          <div className="flex flex-wrap gap-4 min-h-[9rem]">
            {orderedImages.map((img) => (
              <SortableImage key={img.id} img={img} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
};

export default ImageUploader; 