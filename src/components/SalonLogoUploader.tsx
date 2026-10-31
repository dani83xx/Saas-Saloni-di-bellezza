import React, { useState, useRef, DragEvent, ChangeEvent } from 'react';
import {
  Upload,
  Trash2,
  CheckCircle2,
  Eye,
  Scissors,
} from 'lucide-react';

interface SalonLogoUploaderProps {
  currentLogoUrl?: string;
  salonName: string;
  ownerName: string;
  onLogoChange: (logoUrl: string | undefined) => void | Promise<void>;
  onLogoFile?: (file: File) => void | Promise<void>;
  showToast: (msg: string) => void;
}

export const SalonLogoUploader: React.FC<SalonLogoUploaderProps> = ({
  currentLogoUrl,
  salonName,
  ownerName,
  onLogoChange,
  onLogoFile,
  showToast,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = (file: File) => {
    setErrorMsg(null);

    // Validate mime type
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      setErrorMsg('Formato non supportato. Carica un file PNG, JPG, WEBP o SVG.');
      return;
    }

    // Validate size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setErrorMsg('Il file supera la dimensione massima consentita di 5MB.');
      return;
    }

    if (onLogoFile) {
      void Promise.resolve(onLogoFile(file))
        .then(() => showToast('Nuovo logo salone caricato con successo!'))
        .catch(() => setErrorMsg('Errore nel salvataggio del logo. Riprova.'));
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (result) {
        void Promise.resolve(onLogoChange(result)).then(
          () => showToast('Nuovo logo salone caricato con successo!'),
          () => setErrorMsg('Errore nel salvataggio del logo. Riprova.')
        );
      }
    };
    reader.onerror = () => {
      setErrorMsg('Errore nella lettura del file. Riprova con un altro file.');
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  const handleRemoveLogo = () => {
    onLogoChange(undefined);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    showToast('Logo personalizzato rimosso. Ripristinato simbolo predefinito.');
  };

  return (
    <div className="space-y-4">
      {/* Upload Zone & Actions */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
        {/* Dropzone Container (Both Drag & Drop and Click via input) */}
        <div className="md:col-span-8">
          <div
            id="salon-logo-dropzone"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative rounded-2xl border-2 border-dashed p-5 md:p-6 text-center transition cursor-pointer flex flex-col items-center justify-center min-h-[170px] ${
              isDragging
                ? 'border-[#E95F8F] bg-pink-50/70 scale-[1.01]'
                : 'border-pink-200 bg-pink-50/20 hover:bg-pink-50/40 hover:border-[#8B5CF6]'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
              onChange={handleFileInputChange}
              className="hidden"
            />

            <div className="hidden md:flex w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#E95F8F]/15 to-[#8B5CF6]/15 text-[#8B5CF6] items-center justify-center mb-2.5 shadow-2xs border border-pink-100">
              <Upload className="w-6 h-6 text-[#8B5CF6]" />
            </div>

            <p className="hidden md:block font-bold text-slate-800 text-sm">
              Trascina qui il logo aziendale, oppure <span className="text-[#E95F8F] underline">sfoglia</span>
            </p>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                fileInputRef.current?.click();
              }}
              className="md:hidden inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-[#E95F8F] to-[#8B5CF6] text-white text-sm font-bold shadow"
            >
              <Upload className="w-4 h-4" />
              Carica logo
            </button>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              PNG, SVG o JPG, max 5 MB.
            </p>
          </div>

          {errorMsg && (
            <div className="mt-2 text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-100 p-2 rounded-xl">
              ⚠️ {errorMsg}
            </div>
          )}
        </div>

        {/* Current Logo Badge & Reset Control */}
        <div className="md:col-span-4 bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col items-center justify-center text-center h-full min-h-[170px]">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
            Stato Logo Attuale
          </span>

          <div className="w-24 h-24 rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-sm flex items-center justify-center relative mb-2.5">
            {currentLogoUrl ? (
              <img
                src={currentLogoUrl}
                alt={salonName}
                className="w-full h-full object-contain object-center p-0.5"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-tr from-[#E95F8F] to-[#8B5CF6] flex items-center justify-center text-white">
                <Scissors className="w-7 h-7" />
              </div>
            )}
          </div>

          <div className={`inline-flex items-center gap-1.5 text-xs font-bold ${currentLogoUrl ? 'text-emerald-700' : 'text-slate-500'}`}>
            {currentLogoUrl ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : null}
            {currentLogoUrl ? 'Logo attivo' : 'Nessun logo caricato'}
          </div>

          <div className="mt-2.5 flex items-center gap-1.5 w-full">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 py-1.5 px-2.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl transition cursor-pointer"
            >
              Cambia
            </button>
            {currentLogoUrl && (
              <button
                type="button"
                onClick={handleRemoveLogo}
                className="py-1.5 px-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-xl border border-rose-200 transition flex items-center gap-1 cursor-pointer"
                title="Rimuovi logo e ripristina predefinito"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Rimuovi
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Real-world Live Context Previews */}
      <div className="border border-pink-100 rounded-2xl p-4 bg-white shadow-2xs">
        <div className="flex items-center gap-2 mb-3">
          <Eye className="w-4 h-4 text-[#E95F8F]" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Anteprima Visiva del Logo nei Canali del Salone
          </h4>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* 1. Sidebar Dark Preview */}
          <div className="bg-[#1E1B2E] p-3 rounded-xl border border-slate-800 flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl overflow-hidden bg-white shrink-0 border border-white/10 flex items-center justify-center">
              {currentLogoUrl ? (
                <img
                  src={currentLogoUrl}
                  alt="Preview Dark"
                  className="w-full h-full object-contain object-center p-0.5"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-tr from-[#E95F8F] to-[#8B5CF6] flex items-center justify-center text-white">
                  <Scissors className="w-5 h-5" />
                </div>
              )}
            </div>
            <div className="min-w-0">
              <span className="text-[9px] font-bold text-pink-400 uppercase tracking-wider block">
                Menu Laterale
              </span>
              <p className="text-xs font-bold text-white truncate">{salonName}</p>
              <p className="text-[10px] text-slate-400 truncate">Titolare: {ownerName}</p>
            </div>
          </div>

          {/* 2. Light Header / Invoice Preview */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl overflow-hidden bg-white shrink-0 border border-slate-200 flex items-center justify-center shadow-xs">
              {currentLogoUrl ? (
                <img
                  src={currentLogoUrl}
                  alt="Preview Light"
                  className="w-full h-full object-contain object-center p-0.5"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-tr from-[#E95F8F] to-[#8B5CF6] flex items-center justify-center text-white">
                  <Scissors className="w-5 h-5" />
                </div>
              )}
            </div>
            <div className="min-w-0">
              <span className="text-[9px] font-bold text-purple-600 uppercase tracking-wider block">
                Intestazione Ricevuta
              </span>
              <p className="text-xs font-bold text-slate-900 truncate">{salonName}</p>
              <p className="text-[10px] text-slate-500 truncate">Via Montenapoleone 18, Milano</p>
            </div>
          </div>

          {/* 3. WhatsApp Message Card Preview */}
          <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-200 flex items-center gap-3">
            <div className="w-12 h-12 rounded-full overflow-hidden bg-white shrink-0 border border-emerald-300 flex items-center justify-center shadow-xs">
              {currentLogoUrl ? (
                <img
                  src={currentLogoUrl}
                  alt="Preview WhatsApp"
                  className="w-full h-full object-contain object-center p-0.5"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-tr from-[#E95F8F] to-[#8B5CF6] flex items-center justify-center text-white">
                  <Scissors className="w-5 h-5" />
                </div>
              )}
            </div>
            <div className="min-w-0">
              <span className="text-[9px] font-bold text-emerald-700 uppercase tracking-wider block">
                Avatar WhatsApp
              </span>
              <p className="text-xs font-bold text-slate-900 truncate">{salonName}</p>
              <p className="text-[10px] text-emerald-600 font-semibold truncate">Account Business Verificato</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
