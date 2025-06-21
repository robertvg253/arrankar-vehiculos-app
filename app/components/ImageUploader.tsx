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

export type ImageUploaderImage =
  | { id: string; url: string; uuid?: string; order_index?: number; isNew?: false }
  | { id: string; file: File; previewUrl: string; isNew: true };

export type ImageMetadata = {
  id: string;
  order_index: number;
  isNew: boolean;
  url?: string;
};

export interface ImageUploaderChanges {
  orderedImagesMetadata: ImageMetadata[];
  filesToUpload: Map<string, File>;
  filesArray: File[];
  imageIdsToDelete: string[];
}

interface ImageUploaderProps {
  existingImages?: Array<{ id: string; url: string; uuid?: string; order_index?: number }>;
  onImagesChange?: (changes: ImageUploaderChanges) => void;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({ existingImages = [], onImagesChange }) => {
  const [orderedImages, setOrderedImages] = useState<ImageUploaderImage[]>([]);
  const [imagesToDelete, setImagesToDelete] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isInitialized = useRef(false);

  // Inicializar imágenes existentes solo una vez para prevenir reseteos
  useEffect(() => {
    if (!isInitialized.current) {
      if (existingImages.length > 0) {
        setOrderedImages(
          existingImages
            .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
            .map((img) => ({ ...img, isNew: false }))
        );
      }
      // Marcar como inicializado para que este efecto no se vuelva a ejecutar
      isInitialized.current = true;
    }
  }, [existingImages]);

  // Callback para notificar cambios
  useEffect(() => {
    if (onImagesChange) {
      const filesToUpload = new Map<string, File>();
      const filesArray: File[] = [];
      const orderedImagesMetadata: ImageMetadata[] = orderedImages.map(
        (img, index) => {
          if (img.isNew) {
            filesToUpload.set(img.id, img.file);
            filesArray.push(img.file);
            return {
              id: img.id,
              order_index: index + 1,
              isNew: true,
            };
          }
          return {
            id: img.id,
            order_index: index + 1,
            isNew: false,
            url: img.url,
          };
        }
      );
      onImagesChange({
        orderedImagesMetadata,
        filesToUpload,
        filesArray,
        imageIdsToDelete: imagesToDelete,
      });
    }
  }, [orderedImages, imagesToDelete, onImagesChange]);

  // Selección de archivos
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newImages: ImageUploaderImage[] = files.map((file) => ({
      id: generateUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
      isNew: true,
    }));
    setOrderedImages((prev) => [...prev, ...newImages]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Eliminar imagen
  const handleRemoveImage = (imageId: string) => {
    setOrderedImages((prev) => {
      const img = prev.find((img) => img.id === imageId);
      if (img && img.isNew && 'previewUrl' in img && img.previewUrl) {
        URL.revokeObjectURL(img.previewUrl);
      }
      if (img && !img.isNew && img.id) {
        setImagesToDelete((del) => [...del, img.id]);
      }
      return prev.filter((img) => img.id !== imageId);
    });
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
  function SortableImage({ img, idx, handleRemoveImage }: { img: ImageUploaderImage; idx: number; handleRemoveImage: (imageId: string) => void }) {
    const id = img.id;
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id });

    const imageSrc = React.useMemo(() => {
      if (img.isNew) {
        if ('previewUrl' in img && img.previewUrl) return img.previewUrl;
        if ('file' in img && img.file) return URL.createObjectURL(img.file);
      } else {
        if ('url' in img && img.url) return img.url;
      }
      return '';
    }, [img]);

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
        className={`relative group w-32 h-32 flex-shrink-0 rounded-lg border border-brand-secondary bg-white shadow-md flex items-center justify-center overflow-hidden transition-shadow ${isDragging ? "z-50 shadow-xl opacity-100" : "hover:shadow-lg"}`}
        style={style}
      >
        <img
          src={imageSrc}
          alt="preview"
          className="object-cover w-full h-full"
        />
        <button
          type="button"
          className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-80 hover:opacity-100 shadow"
          onClick={() => handleRemoveImage(img.id)}
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
      <DndContext onDragEnd={onDragEnd}>
        <SortableContext items={orderedImages.map((img) => img.id)} strategy={horizontalListSortingStrategy}>
          <div className="flex flex-wrap gap-4 min-h-[9rem]">
            {orderedImages.map((img, idx) => (
              <SortableImage key={img.id} img={img} idx={idx} handleRemoveImage={handleRemoveImage} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
};

export default ImageUploader; 