import React from "react";

interface PdfUploaderProps {
  label?: string;
  className?: string;
  inputRef?: React.RefObject<HTMLInputElement>;
}

const PdfUploader: React.FC<PdfUploaderProps> = ({
  label = "Subir Documentos PDF (Fichas Técnicas, Manuales, etc.)",
  className = "",
  inputRef,
}) => {
  return (
    <div className={`w-full ${className}`}>
      <label htmlFor="documentosPdf" className="block text-sm font-medium text-brand-title mb-2">
        {label}
      </label>
      <input
        type="file"
        id="documentosPdf"
        name="documentosPdf"
        multiple
        accept=".pdf"
        ref={inputRef}
        className="block w-full text-sm text-gray-700 file:mr-4 file:rounded-md file:border-0 file:bg-brand-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-brand-title hover:file:bg-brand-highlight focus:outline-none focus:ring-2 focus:ring-brand-highlight focus:ring-offset-2"
      />
      <p className="mt-1 text-xs text-gray-500">Solo se permiten archivos PDF. Puedes seleccionar varios a la vez.</p>
    </div>
  );
};

export default PdfUploader;
