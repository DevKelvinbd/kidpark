/* KID PARK — State Management (Context + Supabase) */
import { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { supabase } from './supabase';

const LS_KEY = 'kidpark_v2';

const DEFAULT_STATE = {
  loading: true,
  syncError: null,
  config: {
    brandName: 'Kid Park',
    checkoutPixType: 'sinal',
    maxDaysAhead: 60,
    heroLede: 'Duas piscinas, salão amplo, cozinha equipada e estrutura completa pra você só se preocupar com os convidados.',
    stat1: '2', stat1lbl: 'Piscinas',
    stat2: '120', stat2lbl: 'Convidados',
    stat3: '8h', stat3lbl: 'de festa',
    whatsapp: '5585999999999',
    whatsappLabel: '(85) 99999-9999',
    instagram: 'https://instagram.com/kidpark',
    instagramLabel: '@kidpark',
    youtube: 'https://youtube.com/@kidpark',
    youtubeLabel: '@kidpark',
    email: 'contato@kidpark.com.br',
    endereco: 'Av. das Festas, 100 — Madalena, CE',
    adminPass: 'kidpark2026',
    backendUrl: '',
    horaInicioManha: '08:00', horaFimManha: '17:00',
    horaInicioTarde: '12:00', horaFimTarde: '00:00',
    horaInicioDia: '08:00', horaFimDia: '00:00',
    precoHoraExtra: 100,
    contratoText: `CONTRATO DE LOCAÇÃO DE ESPAÇO PARA EVENTOS

1. OBJETO
O presente contrato tem por objeto a locação temporária do espaço Kid Park para a realização do evento indicado pelo contratante.

2. VALOR E PAGAMENTO
O valor total da locação é definido de acordo com o plano e itens adicionais selecionados.
O agendamento só é confirmado mediante o pagamento de um SINAL correspondente a 50% (cinquenta por cento) do valor total.
O saldo restante de 50% deverá ser pago impreterivelmente até o dia do evento, antes da liberação da entrada.

3. CANCELAMENTO E DESISTÊNCIA
Em caso de desistência por parte do contratante, o valor do sinal não será devolvido, podendo ser utilizado para reagendamento futuro conforme disponibilidade, desde que solicitado com no mínimo 15 dias de antecedência.

4. RESPONSABILIDADE POR DANOS
O contratante responsabiliza-se por quaisquer danos causados ao patrimônio do Kid Park durante o período da locação.`,
    icones: {
      logo: { def: '🏊', url: '' }, step1: { def: '🗓️', url: '' },
      step2: { def: '🎉', url: '' }, step3: { def: '💳', url: '' },
      contactWA: { def: '💬', url: '' }, contactIG: { def: '📷', url: '' },
      contactYT: { def: '▶️', url: '' }, contactAddr: { def: '📍', url: '' },
      catPacote: { def: '📦', url: '' }, catEspaco: { def: '🏊', url: '' },
      catEquip: { def: '🔌', url: '' }, catExtra: { def: '✨', url: '' },
      heroEmpty1: { def: '🏊', url: '' }, heroEmpty2: { def: '🎈', url: '' },
      heroEmpty3: { def: '🎂', url: '' },
    },
  },
  pix: { chave: '', nomeBeneficiario: '', banco: '', qrUrl: '', qrBase64: '' },
  gallery: [],
  items: [
    { id: 'pkg1', nome: 'Plano 1 · Salão', categoria: 'pacote', desc: 'Salão amplo, sem piscinas. Ideal pra reuniões e festas menores.', preco: 450, unidade: 'diaria', ativo: true, imagemUrl: '' },
    { id: 'pkg2', nome: 'Plano 2 · Salão + 2 piscinas', categoria: 'pacote', desc: 'A festa completa: salão com as duas piscinas liberadas.', preco: 800, unidade: 'diaria', ativo: true, imagemUrl: '' },
    { id: 'pkg3', nome: 'Plano 3 · Tudo incluso', categoria: 'pacote', desc: 'Salão + piscinas + mesas, cadeiras, som, fogão e freezer.', preco: 1200, unidade: 'diaria', ativo: true, imagemUrl: '' },
    { id: 'esp1', nome: 'Mesas e cadeiras', categoria: 'equipamento', desc: '10 mesas + 60 cadeiras de plástico, prontas para o evento.', preco: 120, unidade: 'diaria', ativo: true, imagemUrl: '' },
    { id: 'esp2', nome: 'Som ambiente', categoria: 'equipamento', desc: 'Caixa de som amplificada com microfone e cabo auxiliar.', preco: 150, unidade: 'diaria', ativo: true, imagemUrl: '' },
    { id: 'esp3', nome: 'Fogão + botijão', categoria: 'equipamento', desc: 'Fogão de 4 bocas com gás incluso. Pronto pra cozinhar no local.', preco: 80, unidade: 'diaria', ativo: true, imagemUrl: '' },
    { id: 'esp4', nome: 'Freezer', categoria: 'equipamento', desc: 'Freezer 300L pra bebidas e gelo. Liga e usa.', preco: 70, unidade: 'diaria', ativo: true, imagemUrl: '' },
  ],
  bookings: [],
  blockedDates: [],
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_STATE': return { ...state, ...action.payload };
    case 'UPDATE_CONFIG': return { ...state, config: { ...state.config, ...action.payload } };
    case 'UPDATE_PIX': return { ...state, pix: { ...state.pix, ...action.payload } };
    case 'SET_ITEMS': return { ...state, items: action.payload };
    case 'ADD_ITEM': return { ...state, items: [...state.items, action.payload] };
    case 'UPDATE_ITEM': return { ...state, items: state.items.map(i => i.id === action.payload.id ? { ...i, ...action.payload } : i) };
    case 'DELETE_ITEM': return { ...state, items: state.items.filter(i => i.id !== action.payload) };
    case 'SET_GALLERY': return { ...state, gallery: action.payload };
    case 'ADD_GALLERY': return { ...state, gallery: [...state.gallery, action.payload] };
    case 'DELETE_GALLERY': return { ...state, gallery: state.gallery.filter((_, i) => i !== action.payload) };
    case 'MOVE_GALLERY': {
      const { from, to } = action.payload;
      const g = [...state.gallery]; [g[from], g[to]] = [g[to], g[from]];
      return { ...state, gallery: g };
    }
    case 'ADD_BOOKING': return { ...state, bookings: [action.payload, ...state.bookings] };
    case 'UPDATE_BOOKING': return { ...state, bookings: state.bookings.map(b => b.id === action.payload.id ? { ...b, ...action.payload } : b) };
    case 'SET_BLOCKED_DATES': return { ...state, blockedDates: action.payload };
    case 'ADD_BLOCKED_DATE': return { ...state, blockedDates: [...state.blockedDates, action.payload] };
    case 'REMOVE_BLOCKED_DATE': return { ...state, blockedDates: state.blockedDates.filter(d => d !== action.payload) };
    case 'UPDATE_ICONES': return { ...state, config: { ...state.config, icones: { ...state.config.icones, ...action.payload } } };
    case 'SET_SYNC_ERROR': return { ...state, syncError: action.payload };
    case 'RESET': return { ...DEFAULT_STATE, loading: false };
    default: return state;
  }
}

const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, DEFAULT_STATE);

  // Load state from Supabase
  useEffect(() => {
    async function loadFromSupabase() {
      try {
        if (!supabase) {
          console.warn("Supabase client not initialized, using localStorage fallback.");
          const localSettings = localStorage.getItem('kp_settings');
          const localBookings = localStorage.getItem('kp_bookings');
          
          let dbState = {};
          if (localSettings) {
            const parsed = JSON.parse(localSettings);
            dbState = {
              config: parsed.config || DEFAULT_STATE.config,
              pix: parsed.pix || DEFAULT_STATE.pix,
              blockedDates: parsed.blockedDates || [],
              gallery: parsed.gallery || [],
              items: parsed.items || DEFAULT_STATE.items,
            };
          } else {
            dbState = {
              config: DEFAULT_STATE.config,
              pix: DEFAULT_STATE.pix,
              blockedDates: DEFAULT_STATE.blockedDates,
              gallery: DEFAULT_STATE.gallery,
              items: DEFAULT_STATE.items,
            };
          }

          const mappedBookings = localBookings ? JSON.parse(localBookings) : [];

          dispatch({
            type: 'SET_STATE',
            payload: {
              ...dbState,
              bookings: mappedBookings,
              loading: false
            }
          });
          return;
        }

        // 1. Fetch settings (id = 1)
        const { data: settingsData, error: settingsError } = await supabase
          .from('kp_settings')
          .select('*')
          .eq('id', 1)
          .single();
        
        // 2. Fetch bookings
        const { data: bookingsData, error: bookingsError } = await supabase
          .from('kp_bookings')
          .select('*')
          .order('created_at', { ascending: false });

        if (settingsError && settingsError.code !== 'PGRST116') {
          console.error("Error loading settings from Supabase:", settingsError);
        }
        if (bookingsError) {
          console.error("Error loading bookings from Supabase:", bookingsError);
        }

        // Map Supabase bookings back to the format used in frontend
        const mappedBookings = (bookingsData || []).map(b => ({
          id: b.id,
          verificacao: b.verificacao,
          data: b.data,
          slot: b.slot,
          horasExtras: b.horas_extras,
          precoHoraExtra: Number(b.preco_hora_extra) || 0,
          items: b.items || [],
          total: Number(b.total) || 0,
          status: b.status,
          createdAt: b.created_at,
          contrato: b.contrato || { assinado: false, fotoBase64: '', dataAssinatura: '' },
          cliente: {
            nome: b.cliente_nome,
            tel: b.cliente_tel,
            cpf: b.cliente_cpf,
            nascimento: b.cliente_nascimento,
            endereco: b.cliente_endereco,
            evento: b.cliente_evento,
            obs: b.cliente_obs
          }
        }));

        let dbState = {};
        if (settingsData) {
          dbState = {
            config: settingsData.config,
            pix: settingsData.pix,
            blockedDates: settingsData.blocked_dates || [],
            gallery: settingsData.gallery || [],
            items: settingsData.items || [],
          };
        } else {
          // If settings row 1 does not exist, insert initial setup
          const { error: insertError } = await supabase
            .from('kp_settings')
            .insert([{
              id: 1,
              config: DEFAULT_STATE.config,
              pix: DEFAULT_STATE.pix,
              blocked_dates: DEFAULT_STATE.blockedDates,
              gallery: DEFAULT_STATE.gallery,
              items: DEFAULT_STATE.items
            }]);
          if (insertError) {
            console.error("Error inserting default settings to Supabase:", insertError);
          }
          dbState = {
            config: DEFAULT_STATE.config,
            pix: DEFAULT_STATE.pix,
            blockedDates: DEFAULT_STATE.blockedDates,
            gallery: DEFAULT_STATE.gallery,
            items: DEFAULT_STATE.items,
          };
        }

        dispatch({
          type: 'SET_STATE',
          payload: {
            ...dbState,
            bookings: mappedBookings,
            loading: false
          }
        });
      } catch (err) {
        console.error("Failed to fetch from Supabase, trying localStorage backup:", err);
        // Try localStorage backup before falling back to defaults
        try {
          const localSettings = localStorage.getItem('kp_settings');
          const localBookings = localStorage.getItem('kp_bookings');
          if (localSettings) {
            const parsed = JSON.parse(localSettings);
            dispatch({
              type: 'SET_STATE',
              payload: {
                config: parsed.config || DEFAULT_STATE.config,
                pix: parsed.pix || DEFAULT_STATE.pix,
                blockedDates: parsed.blockedDates || [],
                gallery: parsed.gallery || [],
                items: parsed.items || DEFAULT_STATE.items,
                bookings: localBookings ? JSON.parse(localBookings) : [],
                loading: false,
                syncError: 'Carregado do backup local. Sem conexão com servidor.'
              }
            });
            return;
          }
        } catch (lsErr) {
          console.error('localStorage backup also failed:', lsErr);
        }
        dispatch({ type: 'SET_STATE', payload: { ...DEFAULT_STATE, loading: false } });
      }
    }
    loadFromSupabase();
  }, []);

  // Save Settings state back to Supabase automatically when modified (with debounce)
  useEffect(() => {
    if (state.loading) return;

    // Always save to localStorage immediately as backup (safety net)
    const localBackup = {
      config: state.config,
      pix: state.pix,
      blockedDates: state.blockedDates,
      gallery: state.gallery,
      items: state.items
    };
    try {
      localStorage.setItem('kp_settings', JSON.stringify(localBackup));
    } catch (lsErr) {
      console.warn('localStorage backup failed (possible quota exceeded):', lsErr);
    }

    if (!supabase) return;

    // Debounce Supabase sync (1 second) to avoid rapid writes
    const timer = setTimeout(async () => {
      try {
        const { error } = await supabase
          .from('kp_settings')
          .update({
            config: state.config,
            pix: state.pix,
            blocked_dates: state.blockedDates,
            gallery: state.gallery,
            items: state.items
          })
          .eq('id', 1);
        if (error) {
          console.error("Failed to sync settings to Supabase:", error);
          // Dispatch sync error so the UI can show a warning
          dispatch({ type: 'SET_SYNC_ERROR', payload: 'Erro ao sincronizar com o servidor. Suas alterações estão salvas localmente.' });
        } else {
          // Clear any previous sync error on success
          if (state.syncError) {
            dispatch({ type: 'SET_SYNC_ERROR', payload: null });
          }
        }
      } catch (err) {
        console.error("Sync exception:", err);
        dispatch({ type: 'SET_SYNC_ERROR', payload: 'Falha de conexão ao salvar. Alterações salvas localmente.' });
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [state.config, state.pix, state.blockedDates, state.gallery, state.items, state.loading]);

  const value = { state, dispatch };
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}

export function useConfig() { return useStore().state.config; }

export function useExportData() {
  const { state } = useStore();
  return useCallback(() => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `kidpark-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [state]);
}

export { DEFAULT_STATE, LS_KEY };
