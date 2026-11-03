import React, { useState } from 'react';
import {
  Users,
  UserPlus,
  CheckCircle2,
  XCircle,
  Edit2,
  Trash2,
  Phone,
  Mail,
  Sparkles,
  Check,
  X,
  KeyRound,
  Loader2
} from 'lucide-react';
import { StaffMember, StaffColor, StaffAccessRole, STAFF_COLORS, getStaffColorConfig, Appointment } from '../types';
import { generateUUID, isValidUUID, provisionStaffLogin, sendStaffPasswordReset, StaffAccessError } from '../lib/salonService';
import { ProUpsellCard } from './ProUpsellCard';

interface StaffManagerProps {
  staffMembers: StaffMember[];
  appointments?: Appointment[];
  onUpdateStaff: (updatedStaff: StaffMember[]) => void;
  showToast: (msg: string) => void;
  teamLocked?: boolean;
  onUpgrade?: () => void;
  salonId?: string;
  /** Solo il titolare con feature staff può creare credenziali. */
  canInvite?: boolean;
}

export const StaffManager: React.FC<StaffManagerProps> = ({
  staffMembers,
  appointments = [],
  onUpdateStaff,
  showToast,
  teamLocked = false,
  onUpgrade,
  salonId,
  canInvite = false,
}) => {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [resettingId, setResettingId] = useState<string | null>(null);

  // New Staff form state
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('Hair Stylist Senior');
  const [newColor, setNewColor] = useState<StaffColor>('pink');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newAccessRole, setNewAccessRole] = useState<StaffAccessRole>('operator');
  const [withLogin, setWithLogin] = useState(true);

  // Edit Staff form state
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editColor, setEditColor] = useState<StaffColor>('purple');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editAccessRole, setEditAccessRole] = useState<StaffAccessRole>('operator');
  const [editPassword, setEditPassword] = useState('');

  const commonRoles = [
    'Titolare & Master Stylist',
    'Hair Stylist Senior',
    'Hair Colorist & Stylist',
    'Estetista & Nail Specialist',
    'Barber & Junior Stylist',
    'Apprendista / Junior',
  ];

  const resetAddForm = () => {
    setNewName('');
    setNewRole('Hair Stylist Senior');
    setNewColor('pink');
    setNewPhone('');
    setNewEmail('');
    setNewPassword('');
    setNewAccessRole('operator');
    setWithLogin(true);
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      showToast('Inserisci il nome del collaboratore');
      return;
    }

    const wantsLogin = canInvite && withLogin;
    if (wantsLogin && newPassword.trim().length < 6) {
      showToast('La password iniziale deve avere almeno 6 caratteri');
      return;
    }

    const newStaff: StaffMember = {
      id: generateUUID(),
      name: newName.trim(),
      role: newRole.trim() || 'Collaboratore',
      color: newColor,
      isActive: true,
      phone: newPhone.trim() || undefined,
      email: newEmail.trim() || undefined,
      accessRole: wantsLogin ? newAccessRole : undefined,
      loginEnabled: wantsLogin,
    };

    setIsSaving(true);
    try {
      if (wantsLogin) {
        if (!salonId || !isValidUUID(salonId)) {
          showToast('Salone non ancora pronto. Ricarica la pagina e riprova.');
          return;
        }
        const created = await provisionStaffLogin({
          salonId,
          name: newStaff.name,
          email: newEmail.trim(),
          password: newPassword,
          accessRole: newAccessRole,
        });
        newStaff.authUserId = created.userId;
        newStaff.loginEnabled = true;
        showToast(
          created.needsEmailConfirm
            ? `Accesso creato per ${newStaff.name}. Deve confermare l’email, poi entra con la password iniziale.`
            : `Accesso creato per ${newStaff.name}. Può entrare da Accedi con questa email.`
        );
      } else {
        showToast(`Collaboratore "${newStaff.name}" aggiunto al team!`);
      }

      onUpdateStaff([...staffMembers, newStaff]);
      resetAddForm();
      setIsAddOpen(false);
    } catch (err) {
      const message = err instanceof StaffAccessError || err instanceof Error
        ? err.message
        : 'Impossibile creare l’accesso';
      showToast(message);
    } finally {
      setIsSaving(false);
    }
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
    setEditEmail(staff.email || '');
    setEditAccessRole(staff.accessRole === 'admin' ? 'admin' : 'operator');
    setEditPassword('');
  };

  const handleResetPassword = async (staff: StaffMember) => {
    if (!staff.email) {
      showToast('Aggiungi un’email prima di inviare il recupero');
      return;
    }
    setResettingId(staff.id);
    try {
      await sendStaffPasswordReset(staff.email);
      showToast(`Email di recupero inviata a ${staff.email}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Impossibile inviare il recupero password');
    } finally {
      setResettingId(null);
    }
  };

  const handleSaveEdit = async (staff: StaffMember) => {
    if (!editName.trim()) {
      showToast('Il nome non può essere vuoto');
      return;
    }

    let authUserId = staff.authUserId;
    let loginEnabled = staff.loginEnabled === true;
    const accessRole = editAccessRole;
    const email = editEmail.trim();

    setIsSaving(true);
    try {
      if (canInvite && !authUserId && editPassword.trim()) {
        if (!salonId || !isValidUUID(salonId)) {
          showToast('Salone non ancora pronto. Ricarica la pagina e riprova.');
          return;
        }
        const created = await provisionStaffLogin({
          salonId,
          name: editName.trim(),
          email,
          password: editPassword,
          accessRole,
        });
        authUserId = created.userId;
        loginEnabled = true;
        showToast(
          created.needsEmailConfirm
            ? 'Accesso creato. L’operatore deve confermare l’email prima di entrare.'
            : 'Accesso creato. L’operatore può entrare da Accedi.'
        );
      }

      const updated = staffMembers.map(s => {
        if (s.id !== staff.id) return s;
        return {
          ...s,
          name: editName.trim(),
          role: editRole.trim() || 'Collaboratore',
          color: editColor,
          phone: editPhone.trim() || undefined,
          email: email || undefined,
          accessRole: loginEnabled || authUserId ? accessRole : s.accessRole,
          authUserId,
          loginEnabled,
        };
      });

      onUpdateStaff(updated);
      setEditingStaffId(null);
      if (!(canInvite && !staff.authUserId && editPassword.trim())) {
        showToast('Dati del collaboratore aggiornati con successo!');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Impossibile aggiornare il collaboratore');
    } finally {
      setIsSaving(false);
    }
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

        {!teamLocked && (
          <button
            type="button"
            onClick={() => setIsAddOpen(!isAddOpen)}
            className="px-3.5 py-2 bg-gradient-to-r from-[#E95F8F] to-[#8B5CF6] hover:opacity-95 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition self-start sm:self-auto cursor-pointer"
          >
            {isAddOpen ? <X className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
            <span>{isAddOpen ? 'Chiudi Form' : '+ Nuovo Collaboratore'}</span>
          </button>
        )}
      </div>

      {teamLocked && onUpgrade && (
        <ProUpsellCard
          description="Nel piano BASE resta solo il titolare. Creare operatori e il loro accesso è nel piano PRO."
          onUpgrade={onUpgrade}
        />
      )}

      {/* Add New Staff Form Drawer */}
      {!teamLocked && isAddOpen && (
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

            {canInvite && (
              <div className="sm:col-span-2 rounded-xl border border-purple-100 bg-white/80 p-3 space-y-3">
                <label className="flex items-center gap-2 text-slate-800 font-semibold">
                  <input
                    type="checkbox"
                    checked={withLogin}
                    onChange={(e) => setWithLogin(e.target.checked)}
                    className="w-4 h-4 text-[#8B5CF6] rounded border-slate-300"
                  />
                  Crea accesso a Nuvia
                </label>
                {withLogin && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Email di accesso *</label>
                      <input
                        type="email"
                        required
                        autoComplete="off"
                        placeholder="martina@salone.it"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        className="w-full p-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#8B5CF6] outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Password iniziale *</label>
                      <input
                        type="password"
                        required
                        minLength={6}
                        autoComplete="new-password"
                        placeholder="Minimo 6 caratteri"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full p-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#8B5CF6] outline-none"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-slate-700 font-semibold mb-1">Ruolo di accesso</label>
                      <div className="flex flex-wrap gap-2">
                        {([
                          ['operator', 'Operatore'],
                          ['admin', 'Admin salone'],
                        ] as const).map(([value, label]) => (
                          <button
                            key={value}
                            type="button"
                            aria-pressed={newAccessRole === value}
                            onClick={() => setNewAccessRole(value)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border cursor-pointer ${
                              newAccessRole === value
                                ? 'bg-[#8B5CF6] text-white border-[#8B5CF6]'
                                : 'bg-white text-slate-600 border-slate-200'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1.5">
                        L’operatore vede agenda, clienti e cassa. L’admin gestisce anche il salone, mai l’abbonamento. La password si recupera da Accedi.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

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
              disabled={isSaving}
              className="px-4 py-2 bg-[#8B5CF6] hover:bg-[#7c4ee0] text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-70"
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
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
                      <label className="block text-[11px] text-slate-600 font-semibold mb-0.5">Email</label>
                      <input
                        type="email"
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-[#8B5CF6]"
                      />
                    </div>

                    {canInvite && (
                      <div className="space-y-2">
                        <label className="block text-[11px] text-slate-600 font-semibold">Accesso</label>
                        <div className="flex flex-wrap gap-1.5">
                          {([
                            ['operator', 'Operatore'],
                            ['admin', 'Admin salone'],
                          ] as const).map(([value, label]) => (
                            <button
                              key={value}
                              type="button"
                              aria-pressed={editAccessRole === value}
                              onClick={() => setEditAccessRole(value)}
                              className={`px-2 py-0.5 rounded text-[11px] font-bold border cursor-pointer ${
                                editAccessRole === value
                                  ? 'bg-[#8B5CF6] text-white border-[#8B5CF6]'
                                  : 'bg-white border-slate-200 text-slate-600'
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                        {!staff.authUserId && (
                          <input
                            type="password"
                            autoComplete="new-password"
                            placeholder="Password iniziale per creare l’accesso"
                            value={editPassword}
                            onChange={(e) => setEditPassword(e.target.value)}
                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-[#8B5CF6]"
                          />
                        )}
                      </div>
                    )}

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
                      disabled={isSaving}
                      onClick={() => handleSaveEdit(staff)}
                      className="px-3 py-1 bg-[#8B5CF6] text-white text-xs font-bold rounded-lg hover:bg-[#7c4ee0] disabled:opacity-70"
                    >
                      {isSaving ? 'Salvo…' : 'Salva'}
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
                        {staff.email && (
                          <p className="text-xs text-slate-600 flex items-center gap-1 mt-1 break-all">
                            <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                            {staff.email}
                          </p>
                        )}
                        {staff.loginEnabled && (
                          <p className="text-[11px] font-semibold text-purple-700 mt-1">
                            {staff.accessRole === 'admin' ? 'Accesso admin salone' : 'Accesso operatore'}
                          </p>
                        )}
                      </div>
                    </div>

                    {!teamLocked && (
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
                    )}
                  </div>

                  {/* Card Footer: Appointments count & toggle active */}
                  <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-slate-600 text-xs font-medium">
                      <strong className="text-slate-700">{staffAppsCount}</strong> appuntamenti assegnati
                    </span>

                    {!teamLocked && (
                    <div className="flex items-center gap-1.5">
                      {canInvite && staff.loginEnabled && staff.email && (
                        <button
                          type="button"
                          disabled={resettingId === staff.id}
                          onClick={() => handleResetPassword(staff)}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-purple-200 bg-purple-50 text-purple-700 inline-flex items-center gap-1 disabled:opacity-70"
                        >
                          {resettingId === staff.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <KeyRound className="w-3 h-3" />}
                          Recupero password
                        </button>
                      )}
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
                    )}
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
