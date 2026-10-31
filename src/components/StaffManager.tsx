import React, { useState } from 'react';
import {
  Users,
  UserPlus,
  CheckCircle2,
  XCircle,
  Edit2,
  Trash2,
  Shield,
  Phone,
  Sparkles,
  Check,
  X,
  Plus
} from 'lucide-react';
import { StaffMember, StaffColor, STAFF_COLORS, getStaffColorConfig, Appointment } from '../types';
import { generateUUID } from '../lib/salonService';

interface StaffManagerProps {
  staffMembers: StaffMember[];
  appointments?: Appointment[];
  onUpdateStaff: (updatedStaff: StaffMember[]) => void;
  showToast: (msg: string) => void;
}

export const StaffManager: React.FC<StaffManagerProps> = ({
  staffMembers,
  appointments = [],
  onUpdateStaff,
  showToast,
}) => {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);

  // New Staff form state
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('Hair Stylist Senior');
  const [newColor, setNewColor] = useState<StaffColor>('pink');
  const [newPhone, setNewPhone] = useState('');

  // Edit Staff form state
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editColor, setEditColor] = useState<StaffColor>('purple');
  const [editPhone, setEditPhone] = useState('');

  const commonRoles = [
    'Titolare & Master Stylist',
    'Hair Stylist Senior',
    'Hair Colorist & Stylist',
    'Estetista & Nail Specialist',
    'Barber & Junior Stylist',
    'Apprendista / Junior',
  ];

  const handleAddStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      showToast('Inserisci il nome del collaboratore');
      return;
    }

    const newStaff: StaffMember = {
      id: generateUUID(),
      name: newName.trim(),
      role: newRole.trim() || 'Collaboratore',
      color: newColor,
      isActive: true,
      phone: newPhone.trim() || undefined,
    };

    const updated = [...staffMembers, newStaff];
    onUpdateStaff(updated);
    showToast(`Collaboratore "${newStaff.name}" aggiunto al team!`);

    // Reset form
    setNewName('');
    setNewRole('Hair Stylist Senior');
    setNewColor('pink');
    setNewPhone('');
    setIsAddOpen(false);
  };

  const handleToggleActive = (staff: StaffMember) => {
    // Safety check: ensure at least one active staff member
    if (staff.isActive) {
      const activeCount = staffMembers.filter(s => s.isActive).length;
      if (activeCount <= 1) {
        showToast('Deve rimanere almeno un membro dello staff attivo');
        return;
      }
    }

    const updated = staffMembers.map(s =>
      s.id === staff.id ? { ...s, isActive: !s.isActive } : s
    );
    onUpdateStaff(updated);
    showToast(
      `Stato di "${staff.name}" impostato su: ${!staff.isActive ? 'Attivo' : 'Non Attivo'}`
    );
  };

  const handleStartEdit = (staff: StaffMember) => {
    setEditingStaffId(staff.id);
    setEditName(staff.name);
    setEditRole(staff.role);
    setEditColor(staff.color);
    setEditPhone(staff.phone || '');
  };

  const handleSaveEdit = (staffId: string) => {
    if (!editName.trim()) {
      showToast('Il nome non può essere vuoto');
      return;
    }

    const updated = staffMembers.map(s => {
      if (s.id === staffId) {
        return {
          ...s,
          name: editName.trim(),
          role: editRole.trim() || 'Collaboratore',
          color: editColor,
          phone: editPhone.trim() || undefined,
        };
      }
      return s;
    });

    onUpdateStaff(updated);
    setEditingStaffId(null);
    showToast('Dati del collaboratore aggiornati con successo!');
  };

  const handleDeleteStaff = (staff: StaffMember) => {
    if (staffMembers.length <= 1) {
      showToast('Impossibile eliminare l\'unico membro del salone');
      return;
    }

    const updated = staffMembers.filter(s => s.id !== staff.id);
    onUpdateStaff(updated);
    showToast(`Collaboratore "${staff.name}" rimosso dal team`);
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-pink-100 shadow-sm space-y-5">
      {/* Header */}
      <div className="border-b border-pink-50 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="font-bold text-[#1E1B2E] text-base flex items-center gap-2">
            <Users className="w-5 h-5 text-[#8B5CF6]" />
            Team & Collaboratori del Salone
          </h3>
          <p className="text-sm text-slate-600 mt-0.5">
            Gestisci i professionisti che lavorano in salone, assegna loro un colore identificativo per l'agenda e assegna gli appuntamenti.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsAddOpen(!isAddOpen)}
          className="px-3.5 py-2 bg-gradient-to-r from-[#E95F8F] to-[#8B5CF6] hover:opacity-95 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition self-start sm:self-auto cursor-pointer"
        >
          {isAddOpen ? <X className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
          <span>{isAddOpen ? 'Chiudi Form' : '+ Nuovo Collaboratore'}</span>
        </button>
      </div>

      {/* Add New Staff Form Drawer */}
      {isAddOpen && (
        <form
          onSubmit={handleAddStaff}
          className="p-4 bg-gradient-to-br from-pink-50/70 via-purple-50/40 to-slate-50 border border-pink-200/80 rounded-2xl space-y-4 animate-fadeIn"
        >
          <div className="flex items-center justify-between">
            <span className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#8B5CF6]" />
              Aggiungi Membro dello Staff
            </span>
            <span className="text-xs text-slate-600">Tutti i campi contrassegnati con * sono obbligatori</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Nome e Cognome *</label>
              <input
                type="text"
                required
                placeholder="Es. Martina Neri"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full p-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#8B5CF6] outline-none font-medium"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Ruolo / Specializzazione *</label>
              <div className="space-y-1.5">
                <input
                  type="text"
                  required
                  placeholder="Es. Hair Stylist Senior, Estetista..."
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#8B5CF6] outline-none font-medium"
                />
                <div className="flex flex-wrap gap-1">
                  {commonRoles.map(role => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setNewRole(role)}
                      className="text-[10px] px-2 py-0.5 rounded-md bg-white border border-slate-200 hover:border-purple-300 text-slate-600 transition"
                    >
                      {role}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Cellulare (opzionale)</label>
              <input
                type="text"
                placeholder="+39 340 1234567"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-mono focus:ring-2 focus:ring-[#8B5CF6] outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1.5">
                Colore Badge / Calendario *
              </label>
              <div className="flex flex-wrap items-center gap-2">
                {STAFF_COLORS.map(c => {
                  const isSelected = newColor === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setNewColor(c.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 border cursor-pointer ${
                        isSelected
                          ? `${c.bg} ${c.text} ${c.border} ring-2 ${c.ring}`
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <span className={`w-2.5 h-2.5 rounded-full ${c.dot}`} />
                      <span>{c.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200/60">
            <button
              type="button"
              onClick={() => setIsAddOpen(false)}
              className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/70 rounded-xl transition cursor-pointer"
            >
              Annulla
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-[#8B5CF6] hover:bg-[#7c4ee0] text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              Conferma & Salva
            </button>
          </div>
        </form>
      )}

      {/* Staff Members List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {staffMembers.map((staff) => {
          const colorCfg = getStaffColorConfig(staff.color);
          const isEditing = editingStaffId === staff.id;
          const staffAppsCount = appointments.filter(
            a => a.staffId === staff.id || (a.staffName && a.staffName.toLowerCase() === staff.name.toLowerCase())
          ).length;

          return (
            <div
              key={staff.id}
              className={`p-4 rounded-2xl border transition-all shadow-2xs flex flex-col justify-between gap-3 ${
                !staff.isActive
                  ? 'bg-slate-50/70 border-slate-200 opacity-75'
                  : 'bg-white border-pink-100 hover:border-purple-200'
              }`}
            >
              {isEditing ? (
                /* INLINE EDIT FORM */
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-[#8B5CF6]">Modifica Collaboratore</span>
                    <button
                      type="button"
                      onClick={() => setEditingStaffId(null)}
                      className="text-slate-400 hover:text-slate-600 p-1"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div>
                      <label className="block text-[11px] text-slate-600 font-semibold mb-0.5">Nome</label>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-[#8B5CF6]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-600 font-semibold mb-0.5">Ruolo</label>
                      <input
                        type="text"
                        value={editRole}
                        onChange={(e) => setEditRole(e.target.value)}
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-[#8B5CF6]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-600 font-semibold mb-0.5">Cellulare</label>
                      <input
                        type="text"
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-mono outline-none focus:ring-2 focus:ring-[#8B5CF6]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-600 font-semibold mb-1">Colore Badge</label>
                      <div className="flex flex-wrap gap-1.5">
                        {STAFF_COLORS.map(c => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => setEditColor(c.id)}
                            className={`px-2 py-0.5 rounded text-[11px] font-bold border ${
                              editColor === c.id
                                ? `${c.bg} ${c.text} ${c.border} ring-2 ${c.ring}`
                                : 'bg-white border-slate-200 text-slate-600'
                            }`}
                          >
                            <span className={`w-2 h-2 inline-block rounded-full mr-1 ${c.dot}`} />
                            {c.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setEditingStaffId(null)}
                      className="px-2.5 py-1 text-xs text-slate-500 hover:bg-slate-100 rounded-lg"
                    >
                      Annulla
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSaveEdit(staff.id)}
                      className="px-3 py-1 bg-[#8B5CF6] text-white text-xs font-bold rounded-lg hover:bg-[#7c4ee0]"
                    >
                      Salva
                    </button>
                  </div>
                </div>
              ) : (
                /* NORMAL CARD VIEW */
                <>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3 min-w-0">
                      {/* Avatar with dot */}
                      <div className="relative">
                        <div className={`w-10 h-10 rounded-2xl ${colorCfg.bg} ${colorCfg.text} border ${colorCfg.border} flex items-center justify-center font-bold text-sm shadow-2xs`}>
                          {staff.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                        </div>
                        <span className={`w-3 h-3 rounded-full absolute -bottom-0.5 -right-0.5 border-2 border-white ${colorCfg.dot}`} />
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="font-bold text-slate-900 text-sm truncate">
                            {staff.name}
                          </h4>
                          {staff.isActive ? (
                            <span className="px-2 py-0.2 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Attivo
                            </span>
                          ) : (
                            <span className="px-2 py-0.2 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-500 border border-slate-200 flex items-center gap-1">
                              <XCircle className="w-3 h-3" /> Disattivato
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${colorCfg.bg} ${colorCfg.text} border ${colorCfg.border}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${colorCfg.dot}`} />
                            {staff.role}
                          </span>
                        </div>

                        {staff.phone && (
                          <p className="text-xs text-slate-600 font-mono flex items-center gap-1 mt-1">
                            <Phone className="w-3 h-3 text-slate-400" />
                            {staff.phone}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Quick Edit button */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(staff)}
                        className="p-1.5 text-slate-400 hover:text-[#8B5CF6] hover:bg-purple-50 rounded-lg transition"
                        title="Modifica collaboratore"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteStaff(staff)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                        title="Elimina collaboratore"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Card Footer: Appointments count & toggle active */}
                  <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-slate-600 text-xs font-medium">
                      <strong className="text-slate-700">{staffAppsCount}</strong> appuntamenti assegnati
                    </span>

                    <button
                      type="button"
                      onClick={() => handleToggleActive(staff)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition cursor-pointer ${
                        staff.isActive
                          ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                      }`}
                    >
                      {staff.isActive ? 'Disattiva' : 'Attiva'}
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
