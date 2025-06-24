import React, { useState, useEffect, useRef } from "react";

export type ImageGalleryImage = {
  id: string;
  url: string;
  storage_id: string;
  order_index: string;
  destacada: boolean;
};

interface ImageGalleryProps {
  images: ImageGalleryImage[];
}

const ImageGallery: React.FC<ImageGalleryProps> = ({ images }) => {
  const [current, setCurrent] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalIndex, setModalIndex] = useState(0);

  // Refs para drag-scroll
  const thumbBarRef = useRef<HTMLDivElement>(null);
  const modalThumbBarRef = useRef<HTMLDivElement>(null);
  // Estado para drag
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);
  // Estado para distinguir click vs drag
  const clickThreshold = 5; // px
  const mouseDownPos = useRef(0);
  const wasDrag = useRef(false);

  // Funciones drag-scroll para miniaturas
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    isDragging.current = true;
    startX.current = e.pageX - (thumbBarRef.current?.offsetLeft || 0);
    scrollLeft.current = thumbBarRef.current?.scrollLeft || 0;
    mouseDownPos.current = e.pageX;
    wasDrag.current = false;
    document.body.style.userSelect = 'none';
  };
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging.current || !thumbBarRef.current) return;
    const x = e.pageX - thumbBarRef.current.offsetLeft;
    const walk = x - startX.current;
    if (Math.abs(e.pageX - mouseDownPos.current) > clickThreshold) {
      wasDrag.current = true;
    }
    thumbBarRef.current.scrollLeft = scrollLeft.current - walk;
  };
  const handleMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    isDragging.current = false;
    document.body.style.userSelect = '';
  };
  const handleMouseLeave = () => {
    isDragging.current = false;
    document.body.style.userSelect = '';
  };
  // Touch events
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    isDragging.current = true;
    startX.current = e.touches[0].pageX - (thumbBarRef.current?.offsetLeft || 0);
    scrollLeft.current = thumbBarRef.current?.scrollLeft || 0;
    mouseDownPos.current = e.touches[0].pageX;
    wasDrag.current = false;
  };
  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isDragging.current || !thumbBarRef.current) return;
    const x = e.touches[0].pageX - thumbBarRef.current.offsetLeft;
    const walk = x - startX.current;
    if (Math.abs(e.touches[0].pageX - mouseDownPos.current) > clickThreshold) {
      wasDrag.current = true;
    }
    thumbBarRef.current.scrollLeft = scrollLeft.current - walk;
  };
  const handleTouchEnd = () => {
    isDragging.current = false;
  };

  // Click en miniatura (solo si no fue drag)
  const handleThumbClick = (idx: number) => (e: React.MouseEvent | React.TouchEvent) => {
    if (!wasDrag.current) {
      setCurrent(idx);
      openModal(idx);
    }
  };

  // Drag-scroll para miniaturas en modal
  const modalIsDragging = useRef(false);
  const modalStartX = useRef(0);
  const modalScrollLeft = useRef(0);
  const modalMouseDownPos = useRef(0);
  const modalWasDrag = useRef(false);
  const handleModalMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    modalIsDragging.current = true;
    modalStartX.current = e.pageX - (modalThumbBarRef.current?.offsetLeft || 0);
    modalScrollLeft.current = modalThumbBarRef.current?.scrollLeft || 0;
    modalMouseDownPos.current = e.pageX;
    modalWasDrag.current = false;
    document.body.style.userSelect = 'none';
  };
  const handleModalMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!modalIsDragging.current || !modalThumbBarRef.current) return;
    const x = e.pageX - modalThumbBarRef.current.offsetLeft;
    const walk = x - modalStartX.current;
    if (Math.abs(e.pageX - modalMouseDownPos.current) > clickThreshold) {
      modalWasDrag.current = true;
    }
    modalThumbBarRef.current.scrollLeft = modalScrollLeft.current - walk;
  };
  const handleModalMouseUp = () => {
    modalIsDragging.current = false;
    document.body.style.userSelect = '';
  };
  const handleModalMouseLeave = () => {
    modalIsDragging.current = false;
    document.body.style.userSelect = '';
  };
  const handleModalTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    modalIsDragging.current = true;
    modalStartX.current = e.touches[0].pageX - (modalThumbBarRef.current?.offsetLeft || 0);
    modalScrollLeft.current = modalThumbBarRef.current?.scrollLeft || 0;
    modalMouseDownPos.current = e.touches[0].pageX;
    modalWasDrag.current = false;
  };
  const handleModalTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!modalIsDragging.current || !modalThumbBarRef.current) return;
    const x = e.touches[0].pageX - modalThumbBarRef.current.offsetLeft;
    const walk = x - modalStartX.current;
    if (Math.abs(e.touches[0].pageX - modalMouseDownPos.current) > clickThreshold) {
      modalWasDrag.current = true;
    }
    modalThumbBarRef.current.scrollLeft = modalScrollLeft.current - walk;
  };
  const handleModalTouchEnd = () => {
    modalIsDragging.current = false;
  };
  // Click en miniatura en modal (solo si no fue drag)
  const handleModalThumbClick = (idx: number) => (e: React.MouseEvent | React.TouchEvent) => {
    if (!modalWasDrag.current) {
      setModalIndex(idx);
    }
  };

  useEffect(() => {
    if (images && images.length > 0) {
      const featuredImageIndex = images.findIndex(img => img.destacada);
      setCurrent(featuredImageIndex !== -1 ? featuredImageIndex : 0);
    }
  }, [images]);

  if (!images || images.length === 0) {
    return (
      <div className="w-full h-64 flex items-center justify-center bg-brand-bg rounded-xl border border-brand-secondary">
        <span className="text-brand-highlight">Sin imágenes</span>
      </div>
    );
  }

  const goTo = (idx: number) => {
    setCurrent((idx + images.length) % images.length);
  };

  const openModal = (idx: number) => {
    setModalIndex(idx);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
  };

  const goToModal = (idx: number) => {
    setModalIndex((idx + images.length) % images.length);
  };

  return (
    <div className="w-full flex flex-col items-center">
      {/* Imagen principal */}
      <div
        className="relative w-full max-w-2xl aspect-[16/9] bg-brand-bg rounded-xl overflow-hidden border border-brand-secondary flex items-center justify-center cursor-pointer"
        onClick={() => openModal(current)}
        title="Ver galería ampliada"
      >
        <img
          src={images[current].url}
          alt={`Imagen ${current + 1}`}
          className="w-full h-full object-cover rounded-xl select-none"
        />
        {/* Icono de ampliar */}
        <div className="absolute bottom-2 right-2 bg-white/80 rounded-full p-2 shadow">
          <svg className="w-5 h-5 text-brand-title" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 10V5a2 2 0 00-2-2h-6a2 2 0 00-2 2v6a2 2 0 002 2h5m4 4v5a2 2 0 01-2 2h-6a2 2 0 01-2-2v-6a2 2 0 012-2h5" /></svg>
        </div>
      </div>
      {/* Miniaturas */}
      <div
        ref={thumbBarRef}
        className="w-full max-w-2xl mt-3 flex gap-2 overflow-hidden select-none"
        style={{ WebkitOverflowScrolling: 'touch', cursor: isDragging.current ? 'grabbing' : 'grab' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {images.map((img, idx) => (
          <button
            key={img.id}
            className={`w-16 h-16 rounded-lg border-2 ${idx === current ? 'border-brand-primary shadow-lg' : 'border-brand-secondary/40'} overflow-hidden focus:outline-none flex-shrink-0`}
            tabIndex={0}
            aria-label={`Ver imagen ${idx + 1}`}
            type="button"
            onClick={handleThumbClick(idx)}
            onTouchEnd={handleThumbClick(idx)}
          >
            <img
              src={img.url}
              alt={`Miniatura ${idx + 1}`}
              className="object-cover w-full h-full pointer-events-none"
            />
          </button>
        ))}
      </div>

      {/* Modal de galería ampliada */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <div className="relative w-full max-w-3xl mx-auto flex flex-col items-center">
            {/* Botón cerrar */}
            <button
              className="absolute top-4 right-4 bg-white/80 hover:bg-white text-brand-title rounded-full p-2 shadow-lg z-10"
              onClick={closeModal}
              aria-label="Cerrar galería"
              type="button"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            {/* Carrusel */}
            <div className="relative w-full aspect-[16/9] bg-brand-bg rounded-xl overflow-hidden border border-brand-secondary flex items-center justify-center mt-8">
              {/* Flecha izquierda */}
              <button
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-brand-primary text-brand-title rounded-full p-2 shadow transition z-10"
                onClick={() => goToModal(modalIndex - 1)}
                aria-label="Anterior"
                type="button"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
              </button>
              {/* Imagen principal en modal */}
              <img
                src={images[modalIndex].url}
                alt={`Imagen ampliada ${modalIndex + 1}`}
                className="w-full h-full object-cover rounded-xl select-none"
              />
              {/* Flecha derecha */}
              <button
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-brand-primary text-brand-title rounded-full p-2 shadow transition z-10"
                onClick={() => goToModal(modalIndex + 1)}
                aria-label="Siguiente"
                type="button"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>
            {/* Miniaturas en modal */}
            <div
              ref={modalThumbBarRef}
              className="w-full max-w-3xl flex gap-2 mt-4 overflow-hidden select-none"
              style={{ WebkitOverflowScrolling: 'touch', cursor: modalIsDragging.current ? 'grabbing' : 'grab' }}
              onMouseDown={handleModalMouseDown}
              onMouseMove={handleModalMouseMove}
              onMouseUp={handleModalMouseUp}
              onMouseLeave={handleModalMouseLeave}
              onTouchStart={handleModalTouchStart}
              onTouchMove={handleModalTouchMove}
              onTouchEnd={handleModalTouchEnd}
            >
              {images.map((img, idx) => (
                <button
                  key={img.id}
                  className={`w-16 h-16 rounded-lg border-2 ${idx === modalIndex ? 'border-brand-primary shadow-lg' : 'border-brand-secondary/40'} overflow-hidden focus:outline-none flex-shrink-0`}
                  tabIndex={0}
                  aria-label={`Ver imagen ${idx + 1}`}
                  type="button"
                  onClick={handleModalThumbClick(idx)}
                  onTouchEnd={handleModalThumbClick(idx)}
                >
                  <img
                    src={img.url}
                    alt={`Miniatura ${idx + 1}`}
                    className="object-cover w-full h-full pointer-events-none"
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageGallery;
