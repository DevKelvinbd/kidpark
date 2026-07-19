/* KID PARK — Utility functions */

export const uid = (p = 'ID') => p + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
export const pad = n => String(n).padStart(2, '0');
export const fmtMoney = n => 'R$ ' + (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
export const fmtMoneyFull = n => (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

export function dateBR(ymd) {
  if (!ymd) return '';
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
}

export function dateShort(ymd) {
  if (!ymd) return '';
  const [y, m, d] = ymd.split('-').map(Number);
  return `${pad(d)}/${pad(m)}/${y}`;
}

export function slotLabel(slot, config) {
  if (slot === 'manha') return `Diurno (${config.horaInicioManha}–${config.horaFimManha})`;
  if (slot === 'tarde') return `Tarde/Noite (${config.horaInicioTarde}–${config.horaFimTarde})`;
  if (slot === 'dia') return `Dia inteiro (${config.horaInicioDia}–${config.horaFimDia})`;
  return slot || '';
}

export function fileToBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}
