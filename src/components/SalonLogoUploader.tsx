import React, { useState, useRef, DragEvent, ChangeEvent } from 'react';
import {
  Upload,
  Image as ImageIcon,
  Trash2,
  CheckCircle2,
  RotateCcw,
  Sparkles,
  Eye,
  Scissors,
  Check
} from 'lucide-react';

interface SalonLogoUploaderProps {
  currentLogoUrl?: string;
  salonName: string;
  ownerName: string;
  onLogoChange: (logoUrl: string | undefined) => void | Promise<void>;
  onLogoFile?: (file: File) => void | Promise<void>;
  showToast: (msg: string) => void;
}

// Preset luxury sample logos for instant testing
const PRESET_LOGOS = [
  {
    id: 'gold-scissors',
    name: 'Luce & Gold Scissors',
    description: 'Icona forbici dorate su nero',
    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120"><rect width="120" height="120" rx="28" fill="%231E1B2E"/><circle cx="60" cy="60" r="46" fill="none" stroke="%23E95F8F" stroke-width="2" stroke-dasharray="4 2"/><path d="M42 42 L60 60 L78 42 M42 78 L60 60 L78 78" stroke="%23F59E0B" stroke-width="5" stroke-linecap="round"/><circle cx="42" cy="42" r="7" fill="none" stroke="%23F59E0B" stroke-width="4"/><circle cx="42" cy="78" r="7" fill="none" stroke="%23F59E0B" stroke-width="4"/><circle cx="60" cy="60" r="4" fill="%23E95F8F"/></svg>',
  },
  {
    id: 'rose-minimal',
    name: 'Atelier Rose Chic',
    description: 'Monogramma floreale rose-gold',
    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23E95F8F"/><stop offset="100%" stop-color="%238B5CF6"/></linearGradient></defs><rect width="120" height="120" rx="28" fill="url(%23g)"/><text x="60" y="72" font-family="sans-serif" font-size="38" font-weight="900" fill="white" text-anchor="middle" letter-spacing="2">LS</text><circle cx="60" cy="60" r="44" fill="none" stroke="white" stroke-width="2" opacity="0.4"/><polygon points="60,24 64,34 74,34 66,40 69,50 60,44 51,50 54,40 46,34 56,34" fill="%23FDE047" transform="scale(0.4) translate(60, 20)"/></svg>',
  },
  {
    id: 'spa-wellness',
    name: 'Lotus Wellness & Spa',
    description: 'Foglia zen verde smeraldo & lilla',
    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120"><rect width="120" height="120" rx="28" fill="%23064E3B"/><path d="M60 30 C45 45 40 68 60 90 C80 68 75 45 60 30 Z" fill="%2334D399"/><path d="M60 45 C52 56 50 70 60 84 C70 70 68 56 60 45 Z" fill="%23A7F3D0"/><circle cx="60" cy="60" r="3" fill="%23FBBF24"/><circle cx="60" cy="60" r="48" fill="none" stroke="%2334D399" stroke-width="1.5" stroke-dasharray="3 3"/></svg>',
  },
];

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

            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#E95F8F]/15 to-[#8B5CF6]/15 text-[#8B5CF6] flex items-center justify-center mb-2.5 shadow-2xs border border-pink-100">
              <Upload className="w-6 h-6 text-[#8B5CF6]" />
            </div>

            <p className="font-bold text-slate-800 text-sm">
              Trascina qui il logo aziendale, oppure <span className="text-[#E95F8F] underline">sfoglia</span>
            </p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              Formati consigliati: PNG trasparente, SVG o JPG ad alta risoluzione (max 5 MB).
            </p>

            {currentLogoUrl && (
              <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100/80 text-emerald-800 text-[11px] font-bold">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Logo aziendale attivo
              </div>
            )}
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

          <div className="w-16 h-16 rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-sm flex items-center justify-center relative mb-2.5">
            {currentLogoUrl ? (
              <img
                src={currentLogoUrl}
                alt={salonName}
                className="w-full h-full object-contain p-1"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-tr from-[#E95F8F] to-[#8B5CF6] flex items-center justify-center text-white">
                <Scissors className="w-7 h-7" />
              </div>
            )}
          </div>

          <div className="text-xs font-bold text-slate-800 truncate max-w-full">
            {currentLogoUrl ? 'Logo Personalizzato' : 'Icona Predefinita'}
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

      {/* Preset Test Logos */}
      <div className="bg-purple-50/50 border border-purple-100 rounded-2xl p-3.5">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-[#8B5CF6]" />
          <span className="text-xs font-bold text-slate-800">
            Oppure prova subito uno stile di esempio con 1 click:
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {PRESET_LOGOS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => {
                void Promise.resolve(onLogoChange(preset.url)).then(
                  () => showToast(`Applicato logo di prova: "${preset.name}"`),
                  () => setErrorMsg('Errore nel salvataggio del logo. Riprova.')
                );
              }}
              className="p-2 bg-white hover:bg-purple-50/70 border border-purple-100 rounded-xl flex items-center gap-2.5 text-left transition shadow-2xs group cursor-pointer"
            >
              <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0 border border-slate-100 bg-slate-900 flex items-center justify-center">
                <img
                  src={preset.url}
                  alt={preset.name}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-800 truncate group-hover:text-[#8B5CF6]">
                  {preset.name}
                </p>
                <p className="text-[10px] text-slate-500 truncate">{preset.description}</p>
              </div>
            </button>
          ))}
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
            <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-800 shrink-0 border border-white/10 flex items-center justify-center">
              {currentLogoUrl ? (
                <img
                  src={currentLogoUrl}
                  alt="Preview Dark"
                  className="w-full h-full object-contain p-0.5 bg-white"
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
            <div className="w-10 h-10 rounded-xl overflow-hidden bg-white shrink-0 border border-slate-200 flex items-center justify-center shadow-xs">
              {currentLogoUrl ? (
                <img
                  src={currentLogoUrl}
                  alt="Preview Light"
                  className="w-full h-full object-contain p-0.5"
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
            <div className="w-10 h-10 rounded-full overflow-hidden bg-white shrink-0 border border-emerald-300 flex items-center justify-center shadow-xs">
              {currentLogoUrl ? (
                <img
                  src={currentLogoUrl}
                  alt="Preview WhatsApp"
                  className="w-full h-full object-contain p-0.5"
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
