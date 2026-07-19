/* KID PARK — Admin Panel */
import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../lib/store';
import { useToast } from '../../hooks/useToast';
import { Icon } from '../../components/Icon';
import { supabase } from '../../lib/supabase';
import Modal from '../../components/Modal';
import { fmtMoney, fmtMoneyFull, dateBR, dateShort, slotLabel, uid, todayStr, fileToBase64 } from '../../lib/utils';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

const TABS = [
  { id: 'dash', label: '📊 Dashboard' },
  { id: 'itens', label: '📦 Itens' },
  { id: 'galeria', label: '📸 Galeria' },
  { id: 'icones', label: '🎨 Ícones' },
  { id: 'pix', label: '💳 PIX' },
  { id: 'agenda', label: '📅 Agenda' },
  { id: 'config', label: '⚙️ Config' },
];

export default function AdminPage() {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const nav = useNavigate();
  const [loggedIn, setLoggedIn] = useState(false);
  const [passInput, setPassInput] = useState('');
  const [tab, setTab] = useState('dash');
  const [editItem, setEditItem] = useState(null);
  const [editModal, setEditModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [viewModal, setViewModal] = useState(false);

  // All hooks must be declared before any conditional return (React rules of hooks)
  const galFileRef = useRef(null);
  const pixQrRef = useRef(null);
  const [cfgState, setCfg] = useState({ ...state.config });
  const [pixState, setPixState] = useState({ ...state.pix });
  const [blockDate, setBlockDate] = useState('');

  // Login
  if (!loggedIn) {
    const tryLogin = () => {
      const pass = state.config.adminPass || 'kidpark2026';
      if (passInput === pass) { setLoggedIn(true); toast('Bem-vindo ao painel! ✓', 'success'); }
      else { toast('Senha incorreta', 'error'); }
      setPassInput('');
    };
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--bg)' }}>
        <div style={{ background: '#fff', borderRadius: 'var(--radius-lg)', padding: 40, maxWidth: 420, width: '100%', boxShadow: 'var(--shadow-lg)', margin: 24 }}>
          <div className="logo" style={{ justifyContent: 'center', marginBottom: 24 }}>
            <div className="logo-mark"><Icon icones={state.config.icones} name="logo" size="24px" /></div>
            <span>{state.config.brandName}</span>
          </div>
          <h3 style={{ fontFamily: 'var(--font-display)', textAlign: 'center', marginBottom: 24 }}>Acesso administrativo</h3>
          <div className="field">
            <label>Senha</label>
            <input type="password" value={passInput} onChange={e => setPassInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && tryLogin()} placeholder="••••••••" autoFocus />
            <div className="help">Senha padrão: <code>kidpark2026</code> — altere em Configurações.</div>
          </div>
          <button className="btn-block" onClick={tryLogin}>Entrar</button>
          <button className="btn-secondary" style={{ width: '100%', marginTop: 12 }} onClick={() => nav('/')}>← Voltar ao site</button>
        </div>
      </div>
    );
  }

  const c = state.config;
  const ic = c.icones;
  const today = todayStr();

  // Dashboard KPIs
  const futureBookings = state.bookings.filter(b => b.data >= today && b.status !== 'cancelled');
  const monthBookings = state.bookings.filter(b => b.data?.startsWith(today.slice(0, 7)) && b.status !== 'cancelled');
  const monthRevenue = monthBookings.reduce((s, b) => s + (Number(b.total) || 0), 0);
  const pendingCount = state.bookings.filter(b => b.status === 'aguardando_sinal').length;

  // Item CRUD
  const openItemEdit = (item = null) => {
    setEditItem(item ? { ...item } : { id: '', nome: '', desc: '', preco: '', unidade: 'diaria', categoria: 'espaco', imagemUrl: '', ativo: true });
    setEditModal(true);
  };
  const saveItem = () => {
    if (!editItem.nome.trim()) { toast('Preencha o nome', 'error'); return; }
    if (!editItem.preco || Number(editItem.preco) <= 0) { toast('Preço inválido', 'error'); return; }
    const data = { ...editItem, preco: Number(editItem.preco) };
    if (editItem.id) { dispatch({ type: 'UPDATE_ITEM', payload: data }); }
    else { dispatch({ type: 'ADD_ITEM', payload: { ...data, id: uid('IT') } }); }
    setEditModal(false);
    toast('Item salvo ✓', 'success');
  };
  const deleteItem = id => { if (confirm('Excluir este item?')) { dispatch({ type: 'DELETE_ITEM', payload: id }); toast('Item excluído', 'success'); } };

  // Gallery
  const addGallery = async () => {
    const url = prompt('Cole uma URL de imagem/vídeo (ou deixe vazio para upload):');
    if (url === null) return;
    if (url.trim()) {
      const tipo = /\.(mp4|webm|mov)$/i.test(url) ? 'video' : 'image';
      dispatch({ type: 'ADD_GALLERY', payload: { tipo, url: url.trim() } });
      toast('Adicionado ✓', 'success');
    } else { galFileRef.current?.click(); }
  };
  const handleGalUpload = async e => {
    const f = e.target.files[0]; if (!f) return;
    if (f.size > 2 * 1024 * 1024) { toast('Máximo 2MB', 'error'); return; }
    const b64 = await fileToBase64(f);
    dispatch({ type: 'ADD_GALLERY', payload: { tipo: f.type.startsWith('video') ? 'video' : 'image', url: b64 } });
    toast('Enviado ✓', 'success');
    e.target.value = '';
  };

  // Config save
  const saveCfg = () => { dispatch({ type: 'UPDATE_CONFIG', payload: cfgState }); toast('Configurações salvas ✓', 'success'); };

  // PIX save
  const savePix = async () => {
    let qrBase64 = pixState.qrBase64;
    if (pixQrRef.current?.files?.[0]) {
      const f = pixQrRef.current.files[0];
      if (f.size > 1024 * 1024) { toast('QR muito grande (máx 1MB)', 'error'); return; }
      qrBase64 = await fileToBase64(f);
    }
    dispatch({ type: 'UPDATE_PIX', payload: { ...pixState, qrBase64 } });
    toast('PIX salvo ✓', 'success');
  };

  // Booking actions
  const confirmBooking = async id => {
    if (!confirm('Confirmar recebimento do SINAL de 50%?')) return;
    try {
      if (!supabase) {
        console.warn("Supabase not configured, confirming signal in localStorage.");
        const localBookings = JSON.parse(localStorage.getItem('kp_bookings') || '[]');
        const idx = localBookings.findIndex(x => x.id === id);
        if (idx >= 0) {
          localBookings[idx].status = 'confirmada';
          localStorage.setItem('kp_bookings', JSON.stringify(localBookings));
        }
        dispatch({ type: 'UPDATE_BOOKING', payload: { id, status: 'confirmada', confirmedAt: new Date().toISOString() } });
        toast('Sinal de 50% confirmado com sucesso ✓', 'success');
        return;
      }
      const { error } = await supabase.from('kp_bookings').update({ status: 'confirmada' }).eq('id', id);
      if (error) { toast('Erro no Supabase: ' + error.message, 'error'); return; }
      dispatch({ type: 'UPDATE_BOOKING', payload: { id, status: 'confirmada', confirmedAt: new Date().toISOString() } });
      toast('Sinal de 50% confirmado com sucesso ✓', 'success');
    } catch (err) {
      console.error(err);
      toast('Erro de conexão ao confirmar sinal', 'error');
    }
  };

  const quitarBooking = async id => {
    if (!confirm('Confirmar quitação total (100%) desta reserva?')) return;
    try {
      if (!supabase) {
        console.warn("Supabase not configured, quitting booking in localStorage.");
        const localBookings = JSON.parse(localStorage.getItem('kp_bookings') || '[]');
        const idx = localBookings.findIndex(x => x.id === id);
        if (idx >= 0) {
          localBookings[idx].status = 'paga_total';
          localStorage.setItem('kp_bookings', JSON.stringify(localBookings));
        }
        dispatch({ type: 'UPDATE_BOOKING', payload: { id, status: 'paga_total', fullyPaidAt: new Date().toISOString() } });
        toast('Reserva totalmente quitada ✓', 'success');
        return;
      }
      const { error } = await supabase.from('kp_bookings').update({ status: 'paga_total' }).eq('id', id);
      if (error) { toast('Erro no Supabase: ' + error.message, 'error'); return; }
      dispatch({ type: 'UPDATE_BOOKING', payload: { id, status: 'paga_total', fullyPaidAt: new Date().toISOString() } });
      toast('Reserva totalmente quitada ✓', 'success');
    } catch (err) {
      console.error(err);
      toast('Erro de conexão ao quitar reserva', 'error');
    }
  };

  const cancelBooking = async id => {
    if (!confirm('Cancelar esta reserva?')) return;
    try {
      if (!supabase) {
        console.warn("Supabase not configured, cancelling booking in localStorage.");
        const localBookings = JSON.parse(localStorage.getItem('kp_bookings') || '[]');
        const idx = localBookings.findIndex(x => x.id === id);
        if (idx >= 0) {
          localBookings[idx].status = 'cancelled';
          localStorage.setItem('kp_bookings', JSON.stringify(localBookings));
        }
        dispatch({ type: 'UPDATE_BOOKING', payload: { id, status: 'cancelled', cancelledAt: new Date().toISOString() } });
        toast('Reserva cancelada', 'success');
        return;
      }
      const { error } = await supabase.from('kp_bookings').update({ status: 'cancelled' }).eq('id', id);
      if (error) { toast('Erro no Supabase: ' + error.message, 'error'); return; }
      dispatch({ type: 'UPDATE_BOOKING', payload: { id, status: 'cancelled', cancelledAt: new Date().toISOString() } });
      toast('Reserva cancelada', 'success');
    } catch (err) {
      console.error(err);
      toast('Erro de conexão ao cancelar reserva', 'error');
    }
  };

  const viewBooking = b => {
    setSelectedBooking(b);
    setViewModal(true);
  };

  // PDF Generation for Admin Panel
  const buildContractHTMLForPDF = (b) => {
    const cl = b.cliente;
    const itemsStr = b.items.map(it => `${it.nome} (${fmtMoney(it.preco)})`).join('; ');
    const horaTxt = slotLabel(b.slot, state.config);
    const horasExtrasStr = b.horasExtras > 0 ? ` + ${b.horasExtras}h extra(s)` : '';
    const cpfMasked = (cl.cpf || '').replace(/^(\d{3})\.(\d{3})\.(\d{3})/, '***.$2.$3');
    const fotoBase = (b.contrato && b.contrato.fotoBase64) || '';
    const dataAss = (b.contrato && b.contrato.dataAssinatura) || new Date().toISOString();

    const TERMOS_CONTRATO = [
      'Por meio do presente contrato assumo a RESPONSABILIDADE TOTAL do espaço Kid Park, ficando responsável pelas pessoas que estarão ocupando o referido espaço durante o evento, que acontecerá nas datas e horários especificados acima.',
      'Estou ciente que o espaço Kid Park NÃO permite eventos abertos ao público, seja ele cobrando bilheteria ou não, sendo permitidos apenas eventos particulares como aniversários, casamentos, sociais etc. O descumprimento pode acarretar no encerramento do evento e os valores pagos pelo contratante NÃO serão reembolsados.',
      'Fico responsável por todos os bens materiais dentro do espaço Kid Park: mesas, cadeiras, congelador, fogão industrial, caixa de som, geladeira/gelágua, equipamentos de lazer e demais itens da decoração ou estrutura (jarros, plantas, quadros, portas, sanitários, pias etc.). Tendo a consciência de que a perda ou danificação destes itens deverá ser paga pelo contratante mediante acordo.',
      'Assumo a responsabilidade de orientar os participantes a NÃO utilizarem objetos de vidro ou cortantes dentro da piscina, como copos, garrafas, pratos etc.',
      'É proibido o consumo de alimentos dentro das piscinas.',
      'Estou ciente que crianças menores de 3 anos devem estar de fraldas descartáveis para entrar nas piscinas.',
      'Toda e qualquer pessoa deverá passar no chuveiro antes de entrar na piscina.',
      'O uso de carros de som é permitido apenas dentro dos limites de volumes legais em decibéis. Caso o limite máximo permitido seja excedido e o evento seja encerrado pela polícia ou órgãos jurídicos, os valores pagos pelo contratante NÃO serão reembolsados.',
      'Assumo a responsabilidade de orientar os participantes menores de 18 anos a NÃO consumirem bebidas alcoólicas, e tenho ciência de que essa prática é crime previsto por lei.'
    ];

    return `
      <div style="width:794px;padding:24px 36px;background:#ffffff;color:#1a2332;font-family:Arial, sans-serif;line-height:1.4;box-sizing:border-box">
        <h2 style="text-align:center;font-size:20px;text-decoration:underline;margin:0 0 14px;font-weight:700">
          Termo de Responsabilidade / Contrato
        </h2>
        <div style="font-size:12px;margin-bottom:4px"><b style="display:inline-block;min-width:155px">EU:</b> ${cl.nome || ''}</div>
        <div style="font-size:12px;margin-bottom:4px"><b style="display:inline-block;min-width:155px">PORTADOR DO CPF Nº:</b> ${cl.cpf || ''}</div>
        <div style="font-size:12px;margin-bottom:4px"><b style="display:inline-block;min-width:155px">RESIDENTE:</b> ${cl.endereco || ''}</div>
        <div style="font-size:12px;margin-bottom:4px"><b style="display:inline-block;min-width:155px">WHATSAPP:</b> ${cl.tel || ''}</div>

        <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:6px;padding:8px 12px;font-size:11.5px;margin:10px 0 12px;color:#0c4a6e;line-height:1.5">
          <b>RESERVA:</b> ${b.id} &nbsp;·&nbsp; <b>VERIFICAÇÃO:</b> ${b.verificacao || ''}<br>
          <b>DATA DO EVENTO:</b> ${dateBR(b.data)}<br>
          <b>HORÁRIO:</b> ${horaTxt}${horasExtrasStr}<br>
          <b>ITENS / SERVIÇOS:</b> ${itemsStr}<br>
          <b>VALOR TOTAL:</b> ${fmtMoney(b.total)}
        </div>

        <ol style="padding-left:20px;margin:0;font-size:11px;line-height:1.4">
          ${TERMOS_CONTRATO.map(t => `<li style="margin-bottom:5px;text-align:justify">${t}</li>`).join('')}
        </ol>

        <table style="width:100%;margin-top:14px;background:#ecfdf5;border:2px solid #6ee7b7;border-radius:12px;border-collapse:separate;border-spacing:0">
          <tr>
            <td style="width:78px;padding:10px 4px 10px 10px;vertical-align:middle">
              <div style="width:64px;height:64px;border-radius:50%;border:2px solid #6ee7b7;background:#ffffff;overflow:hidden">
                ${fotoBase
                  ? `<img src="${fotoBase}" alt="" style="width:64px;height:64px;object-fit:cover;display:block">`
                  : `<div style="width:64px;height:64px;display:flex;align-items:center;justify-content:center;font-size:28px;color:#9ca3af">👤</div>`}
              </div>
            </td>
            <td style="padding:10px 8px;vertical-align:middle">
              <div style="font-size:10px;font-weight:700;color:#065f46;text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px">
                ✓ Assinatura realizada por foto
              </div>
              <div style="font-weight:700;font-size:13.5px;color:#065f46;margin-bottom:2px">${cl.nome || ''}</div>
              <div style="font-size:10.5px;color:#047857;line-height:1.45">
                CPF: ${cpfMasked} &nbsp;·&nbsp; Assinado em: ${new Date(dataAss).toLocaleString('pt-BR')}
              </div>
            </td>
            <td style="width:108px;padding:10px;text-align:center;vertical-align:middle">
              <div style="display:inline-block;border:1.5px solid #059669;color:#059669;padding:5px 11px;border-radius:18px;font-size:10px;font-weight:700;letter-spacing:.5px">
                CONFIRMADO
              </div>
            </td>
          </tr>
        </table>

        <div style="text-align:center;margin-top:12px;padding-top:8px;border-top:1px solid #e5e7eb;font-size:10.5px;color:#6b7280">
          Espaço Kid Park · ${state.config.endereco || 'Madalena · CE'}
        </div>
      </div>
    `;
  };

  const generateContractPDF = async (b) => {
    toast('Gerando PDF...');
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:fixed;left:-99999px;top:0;background:#fff;z-index:-1';
    wrap.innerHTML = buildContractHTMLForPDF(b);
    document.body.appendChild(wrap);
    const target = wrap.firstElementChild;

    try {
      const canvas = await html2canvas(target, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
      });
      const imgData = canvas.toDataURL('image/jpeg', 0.92);
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

      const pageW = 210;
      const pageH = 297;
      const imgW = pageW;
      const imgH = (canvas.height * imgW) / canvas.width;

      const paginasNatural = Math.ceil(imgH / pageH);

      if (paginasNatural <= 1) {
        pdf.addImage(imgData, 'JPEG', 0, 0, imgW, imgH);
      } else {
        const usoUltimaPagina = imgH - (paginasNatural - 1) * pageH;
        const limiarComprimir = pageH * 0.35;

        if (usoUltimaPagina < limiarComprimir) {
          const paginasAlvo = paginasNatural - 1;
          const novaAltura = paginasAlvo * pageH;
          const novaLargura = (novaAltura / imgH) * imgW;
          const offsetX = (pageW - novaLargura) / 2;
          for (let i = 0; i < paginasAlvo; i++) {
            if (i > 0) pdf.addPage();
            const yOffset = -i * pageH;
            pdf.addImage(imgData, 'JPEG', offsetX, yOffset, novaLargura, novaAltura);
          }
        } else {
          let heightLeft = imgH;
          let position = 0;
          pdf.addImage(imgData, 'JPEG', 0, position, imgW, imgH);
          heightLeft -= pageH;
          while (heightLeft > 0.5) {
            position -= pageH;
            pdf.addPage();
            pdf.addImage(imgData, 'JPEG', 0, position, imgW, imgH);
            heightLeft -= pageH;
          }
        }
      }

      const blob = pdf.output('blob');
      const filename = `Contrato_${b.id}_KidPark.pdf`;
      return { blob, filename };
    } catch (err) {
      console.error('PDF erro:', err);
      toast('Falha ao gerar PDF: ' + err.message, 'error');
      return null;
    } finally {
      wrap.remove();
    }
  };

  const downloadContract = async (b) => {
    const pdf = await generateContractPDF(b);
    if (!pdf) return;
    const url = URL.createObjectURL(pdf.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = pdf.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('PDF baixado ✓', 'success');
  };

  // Blocked dates
  const addBlock = () => {
    if (!blockDate) { toast('Escolha uma data', 'error'); return; }
    if (state.blockedDates.includes(blockDate)) { toast('Já bloqueada', 'error'); return; }
    dispatch({ type: 'ADD_BLOCKED_DATE', payload: blockDate });
    setBlockDate('');
    toast('Data bloqueada', 'success');
  };

  // Export/Import/Reset
  const exportData = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `kidpark-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click(); URL.revokeObjectURL(a.href);
  };
  const importData = () => {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'application/json';
    inp.onchange = e => {
      const f = e.target.files[0]; if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        try {
          const parsed = JSON.parse(r.result);
          if (!parsed.config || !parsed.items) { toast('Arquivo inválido', 'error'); return; }
          if (!confirm('Substituir todos os dados?')) return;
          dispatch({ type: 'SET_STATE', payload: parsed });
          toast('Dados importados ✓', 'success');
        } catch { toast('Erro ao ler arquivo', 'error'); }
      };
      r.readAsText(f);
    };
    inp.click();
  };
  const resetAll = () => {
    if (!confirm('Apagar TUDO e voltar aos dados de exemplo?')) return;
    if (!confirm('Tem certeza absoluta?')) return;
    dispatch({ type: 'RESET' });
    toast('Tudo resetado', 'success');
  };

  // Icon upload
  const uploadIcon = async (key, file) => {
    if (file.size > 500 * 1024) { toast('Máximo 500KB por ícone', 'error'); return; }
    const url = await fileToBase64(file);
    dispatch({ type: 'UPDATE_ICONES', payload: { [key]: { ...ic[key], url } } });
    toast('Ícone atualizado ✓', 'success');
  };
  const resetIcon = key => {
    if (!confirm('Voltar ao emoji padrão?')) return;
    dispatch({ type: 'UPDATE_ICONES', payload: { [key]: { ...ic[key], url: '' } } });
    toast('Ícone resetado ✓', 'success');
  };

  const sortedBookings = [...state.bookings].sort((a, b) => (a.data + a.slot).localeCompare(b.data + b.slot));
  const futureB = sortedBookings.filter(b => b.data >= today);
  const pastB = sortedBookings.filter(b => b.data < today);

  const iconGroups = [
    { titulo: 'Logo', icones: [{ key: 'logo', label: 'Logo' }] },
    { titulo: 'Como funciona', icones: [{ key: 'step1', label: 'Passo 1' }, { key: 'step2', label: 'Passo 2' }, { key: 'step3', label: 'Passo 3' }] },
    { titulo: 'Contato', icones: [{ key: 'contactWA', label: 'WhatsApp' }, { key: 'contactIG', label: 'Instagram' }, { key: 'contactYT', label: 'YouTube' }, { key: 'contactAddr', label: 'Endereço' }] },
    { titulo: 'Categorias', icones: [{ key: 'catPacote', label: 'Pacote' }, { key: 'catEspaco', label: 'Espaço' }, { key: 'catEquip', label: 'Equipamento' }, { key: 'catExtra', label: 'Extra' }] },
    { titulo: 'Hero (placeholders)', icones: [{ key: 'heroEmpty1', label: 'Card 1' }, { key: 'heroEmpty2', label: 'Card 2' }, { key: 'heroEmpty3', label: 'Card 3' }] },
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Admin Header */}
      <div style={{ background: 'var(--ink)', color: '#fff', padding: 0 }}>
        <div className="wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60 }}>
          <div className="logo" style={{ color: '#fff' }}>
            <div className="logo-mark" style={{ background: 'linear-gradient(135deg, var(--sun), var(--coral))' }}><Icon icones={ic} name="logo" size="20px" /></div>
            <span style={{ fontSize: 18 }}>{c.brandName} · Admin</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost" style={{ color: 'rgba(255,255,255,.7)' }} onClick={() => nav('/')}>← Site</button>
            <button className="btn btn-ghost" style={{ color: 'rgba(255,255,255,.7)' }} onClick={() => { setLoggedIn(false); nav('/admin'); }}>Sair</button>
          </div>
        </div>
      </div>

      <div className="wrap" style={{ paddingTop: 32, paddingBottom: 64 }}>
        {/* Tabs */}
        <div className="admin-tabs">
          {TABS.map(t => <button key={t.id} className={`admin-tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>{t.label}</button>)}
        </div>

        {/* DASHBOARD */}
        {tab === 'dash' && (
          <>
            <div className="kpi-grid">
              <div className="kpi-card"><div className="kpi-icon">📅</div><div className="kpi-value">{futureBookings.length}</div><div className="kpi-label">Reservas futuras</div></div>
              <div className="kpi-card"><div className="kpi-icon">💰</div><div className="kpi-value">{fmtMoney(monthRevenue)}</div><div className="kpi-label">Faturamento do mês</div></div>
              <div className="kpi-card"><div className="kpi-icon">⏳</div><div className="kpi-value">{pendingCount}</div><div className="kpi-label">Aguardando comprovante</div></div>
              <div className="kpi-card"><div className="kpi-icon">📦</div><div className="kpi-value">{state.items.filter(i => i.ativo).length}</div><div className="kpi-label">Itens ativos</div></div>
            </div>
            {futureBookings.length > 0 && (
              <>
                <h4 style={{ fontFamily: 'var(--font-display)', fontSize: 18, marginBottom: 12 }}>Próximas reservas</h4>
                {futureBookings.slice(0, 5).map(b => (
                  <div key={b.id} className="booking-row">
                    <div className={`booking-status ${b.status === 'paga_total' || b.status === 'confirmada' ? 'confirmed' : b.status === 'cancelled' ? 'cancelled' : 'pending'}`} />
                    <div className="booking-info">
                      <div className="t">{b.cliente.nome} · {b.cliente.tel}</div>
                      <div className="m">{dateBR(b.data)} · {fmtMoney(b.total)}</div>
                    </div>
                    <span className={`booking-pill ${b.status === 'paga_total' || b.status === 'confirmada' ? 'confirmed' : b.status === 'cancelled' ? 'cancelled' : 'pending'}`}>
                      {b.status === 'paga_total' ? 'Quitada' : b.status === 'confirmada' ? 'Sinal Pago' : b.status === 'cancelled' ? 'Cancelada' : 'Aguardando'}
                    </span>
                  </div>
                ))}
              </>
            )}
          </>
        )}

        {/* ITENS */}
        {tab === 'itens' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div><div style={{ fontWeight: 700 }}>Catálogo de itens</div><div style={{ fontSize: 13, color: 'var(--mute)' }}>Aparecem na vitrine se "Disponível" estiver marcado.</div></div>
              <button className="btn btn-primary" onClick={() => openItemEdit()}>+ Adicionar item</button>
            </div>
            <div className="admin-list">
              {state.items.length === 0 ? <div className="empty-state"><div className="ic">📦</div>Nenhum item ainda.</div> : state.items.map(it => {
                const catKey = { pacote: 'catPacote', espaco: 'catEspaco', equipamento: 'catEquip', extra: 'catExtra' }[it.categoria] || 'catExtra';
                return (
                  <div key={it.id} className="admin-row">
                    <div className="thumb" style={it.imagemUrl ? { backgroundImage: `url('${it.imagemUrl}')` } : undefined}>
                      {!it.imagemUrl && <Icon icones={ic} name={catKey} size="28px" />}
                    </div>
                    <div className="info">
                      <div className="nm">{it.nome} {!it.ativo && <span style={{ background: 'var(--danger-bg)', color: 'var(--danger-text)', padding: '2px 8px', borderRadius: 999, fontSize: 10, marginLeft: 6 }}>OFF</span>}</div>
                      <div className="meta">{fmtMoney(it.preco)} · {it.unidade === 'hora' ? 'por hora' : 'por diária'} · {it.categoria}</div>
                    </div>
                    <div className="acts">
                      <button className="icon-btn" onClick={() => openItemEdit(it)} title="Editar">✏️</button>
                      <button className="icon-btn danger" onClick={() => deleteItem(it.id)} title="Excluir">🗑️</button>
                    </div>
                  </div>
                );
              })}
            </div>
            <Modal open={editModal} onClose={() => setEditModal(false)} title={editItem?.id ? 'Editar item' : 'Adicionar item'}
              footer={<><button className="btn-secondary" onClick={() => setEditModal(false)}>Cancelar</button><button className="btn btn-primary" onClick={saveItem}>Salvar item</button></>}>
              {editItem && (
                <>
                  <div className="field"><label>Nome <span className="req">*</span></label><input value={editItem.nome} onChange={e => setEditItem({ ...editItem, nome: e.target.value })} placeholder="Ex.: Salão + 2 piscinas" /></div>
                  <div className="field"><label>Descrição curta</label><textarea value={editItem.desc} onChange={e => setEditItem({ ...editItem, desc: e.target.value })} rows={2} placeholder="Descrição breve…" /></div>
                  <div className="field-row">
                    <div className="field"><label>Preço (R$) <span className="req">*</span></label><input type="number" min="0" step="0.01" value={editItem.preco} onChange={e => setEditItem({ ...editItem, preco: e.target.value })} placeholder="350.00" /></div>
                    <div className="field"><label>Unidade</label><select value={editItem.unidade} onChange={e => setEditItem({ ...editItem, unidade: e.target.value })}><option value="diaria">por diária</option><option value="hora">por hora</option><option value="unidade">por unidade</option></select></div>
                  </div>
                  <div className="field"><label>Categoria</label><select value={editItem.categoria} onChange={e => setEditItem({ ...editItem, categoria: e.target.value })}><option value="pacote">📦 Pacote</option><option value="espaco">🏊 Espaço</option><option value="equipamento">🔌 Equipamento</option><option value="extra">✨ Extra</option></select></div>
                  <div className="field">
                    <label>Imagem (URL ou arquivo)</label>
                    <input value={editItem.imagemUrl} onChange={e => setEditItem({ ...editItem, imagemUrl: e.target.value })} placeholder="https://… ou envie abaixo" />
                    <input type="file" accept="image/*" style={{ marginTop: 8 }} onChange={async e => { const f = e.target.files[0]; if (!f) return; if (f.size > 1.5 * 1024 * 1024) { toast('Máx 1.5MB', 'error'); return; } const b64 = await fileToBase64(f); setEditItem(prev => ({ ...prev, imagemUrl: b64 })); toast('Imagem carregada ✓', 'success'); }} />
                  </div>
                  <div className="field"><label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}><input type="checkbox" checked={editItem.ativo} onChange={e => setEditItem({ ...editItem, ativo: e.target.checked })} style={{ width: 'auto' }} /> Disponível para reserva</label></div>
                </>
              )}
            </Modal>
          </>
        )}

        {/* GALERIA */}
        {tab === 'galeria' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div><div style={{ fontWeight: 700 }}>Galeria do topo</div><div style={{ fontSize: 13, color: 'var(--mute)' }}>As 3 primeiras aparecem na home.</div></div>
              <button className="btn btn-primary" onClick={addGallery}>+ Adicionar</button>
            </div>
            <input type="file" ref={galFileRef} accept="image/*,video/*" style={{ display: 'none' }} onChange={handleGalUpload} />
            <div className="admin-list">
              {state.gallery.length === 0 ? <div className="empty-state"><div className="ic">📸</div>Galeria vazia.</div> : state.gallery.map((g, i) => (
                <div key={i} className="admin-row">
                  <div className="thumb" style={g.tipo === 'image' ? { backgroundImage: `url('${g.url}')` } : { background: 'var(--ink)', color: '#fff' }}>{g.tipo === 'video' ? '🎬' : ''}</div>
                  <div className="info"><div className="nm">{g.tipo === 'video' ? 'Vídeo' : 'Foto'} #{i + 1}</div><div className="meta" style={{ wordBreak: 'break-all' }}>{g.url.length > 60 ? g.url.slice(0, 60) + '…' : g.url}</div></div>
                  <div className="acts">
                    {i > 0 && <button className="icon-btn" onClick={() => dispatch({ type: 'MOVE_GALLERY', payload: { from: i, to: i - 1 } })}>↑</button>}
                    {i < state.gallery.length - 1 && <button className="icon-btn" onClick={() => dispatch({ type: 'MOVE_GALLERY', payload: { from: i, to: i + 1 } })}>↓</button>}
                    <button className="icon-btn danger" onClick={() => { if (confirm('Excluir?')) dispatch({ type: 'DELETE_GALLERY', payload: i }); }}>🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ÍCONES */}
        {tab === 'icones' && (
          <>
            <div style={{ marginBottom: 16 }}><div style={{ fontWeight: 700 }}>Personalizar ícones</div><div style={{ fontSize: 13, color: 'var(--mute)' }}>Cada ícone pode ser substituído por uma imagem. PNG transparente, máx 500KB.</div></div>
            {iconGroups.map(g => (
              <div key={g.titulo} style={{ marginBottom: 24 }}>
                <div style={{ fontWeight: 700, fontSize: 13, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--pool-deep)', marginBottom: 10 }}>{g.titulo}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 12 }}>
                  {g.icones.map(item => {
                    const icon = ic[item.key] || { def: '•', url: '' };
                    return (
                      <div key={item.key} style={{ background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 14, padding: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                        <div style={{ fontSize: 11, color: 'var(--mute)', textAlign: 'center' }}>{item.label}</div>
                        <div style={{ width: 72, height: 72, background: '#fff', border: '1px solid var(--line)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                          {icon.url ? <img src={icon.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <span style={{ fontSize: 42, lineHeight: 1 }}>{icon.def}</span>}
                        </div>
                        <div style={{ fontSize: 10, color: icon.url ? 'var(--mint)' : 'var(--mute)', fontWeight: 600 }}>{icon.url ? '✓ CUSTOM' : 'EMOJI'}</div>
                        <div style={{ display: 'flex', gap: 6, width: '100%' }}>
                          <label className="btn-secondary" style={{ flex: 1, padding: '8px 6px', fontSize: 11, textAlign: 'center', cursor: 'pointer' }}>
                            📤 {icon.url ? 'Trocar' : 'Enviar'}
                            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { if (e.target.files[0]) uploadIcon(item.key, e.target.files[0]); }} />
                          </label>
                          {icon.url && <button className="btn-secondary" style={{ padding: '8px 10px', fontSize: 11 }} onClick={() => resetIcon(item.key)}>↺</button>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </>
        )}

        {/* PIX */}
        {tab === 'pix' && (
          <>
            <div style={{ marginBottom: 16 }}><div style={{ fontWeight: 700 }}>Configuração do PIX</div><div style={{ fontSize: 13, color: 'var(--mute)' }}>Estes dados aparecem na tela de pagamento.</div></div>
            <div className="field"><label>Chave PIX <span className="req">*</span></label><input value={pixState.chave} onChange={e => setPixState({ ...pixState, chave: e.target.value })} placeholder="CPF, e-mail, telefone ou chave aleatória" /></div>
            <div className="field-row">
              <div className="field"><label>Nome do beneficiário</label><input value={pixState.nomeBeneficiario} onChange={e => setPixState({ ...pixState, nomeBeneficiario: e.target.value })} placeholder="Nome no PIX" /></div>
              <div className="field"><label>Banco</label><input value={pixState.banco} onChange={e => setPixState({ ...pixState, banco: e.target.value })} placeholder="Nubank, Itaú…" /></div>
            </div>
            <div className="field">
              <label>QR Code (URL ou upload)</label>
              <input value={pixState.qrUrl} onChange={e => setPixState({ ...pixState, qrUrl: e.target.value })} placeholder="https://…" />
              <input type="file" ref={pixQrRef} accept="image/*" style={{ marginTop: 8 }} />
            </div>
            {(pixState.qrBase64 || pixState.qrUrl) && <div style={{ textAlign: 'center', margin: '14px 0' }}><img src={pixState.qrBase64 || pixState.qrUrl} style={{ maxWidth: 160, borderRadius: 8, border: '1px solid var(--line)' }} /></div>}
            <button className="btn-block" onClick={savePix} style={{ marginTop: 14 }}>Salvar PIX</button>
          </>
        )}

        {/* AGENDA */}
        {tab === 'agenda' && (
          <>
            <div style={{ marginBottom: 16 }}><div style={{ fontWeight: 700 }}>Agenda de reservas</div><div style={{ fontSize: 13, color: 'var(--mute)' }}>Confirme depois de receber o comprovante.</div></div>
            <div style={{ background: 'var(--bg)', padding: 14, borderRadius: 14, marginBottom: 18 }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>📅 Bloquear data</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input type="date" min={today} value={blockDate} onChange={e => setBlockDate(e.target.value)} style={{ flex: 1, padding: '10px 12px', border: '1.5px solid var(--line-strong)', borderRadius: 10 }} />
                <button className="btn btn-primary" onClick={addBlock} style={{ padding: '10px 18px' }}>Bloquear</button>
              </div>
              {state.blockedDates.length > 0 && (
                <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {state.blockedDates.sort().map(d => (
                    <span key={d} style={{ background: '#fff', border: '1px solid var(--line)', padding: '6px 12px', borderRadius: 999, fontSize: 12, fontFamily: 'var(--font-mono)' }}>
                      {dateShort(d)} <a href="#" onClick={e => { e.preventDefault(); dispatch({ type: 'REMOVE_BLOCKED_DATE', payload: d }); }} style={{ marginLeft: 6, color: 'var(--coral)', fontWeight: 700 }}>✕</a>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <h4 style={{ fontFamily: 'var(--font-display)', fontSize: 18, marginBottom: 10 }}>Próximas ({futureB.length})</h4>
            {futureB.length === 0 ? <div className="empty-state"><div className="ic">📅</div>Nenhuma reserva futura.</div> : (
              <div style={{ marginBottom: 24 }}>
                {futureB.map(b => (
                  <div key={b.id} className="booking-row">
                    <div className={`booking-status ${b.status === 'paga_total' || b.status === 'confirmada' ? 'confirmed' : b.status === 'cancelled' ? 'cancelled' : 'pending'}`} />
                    <div className="booking-info">
                      <div className="t">{b.cliente.nome} · {b.cliente.tel}</div>
                      <div className="m">{dateBR(b.data)} · {slotLabel(b.slot, c)} · {fmtMoney(b.total)}</div>
                    </div>
                    <span className={`booking-pill ${b.status === 'paga_total' || b.status === 'confirmada' ? 'confirmed' : b.status === 'cancelled' ? 'cancelled' : 'pending'}`}>
                      {b.status === 'paga_total' ? 'Quitada' : b.status === 'confirmada' ? 'Sinal Pago' : b.status === 'cancelled' ? 'Cancelada' : 'Aguardando'}
                    </span>
                    <div className="acts">
                      <button className="icon-btn" onClick={() => viewBooking(b)} title="Ver">👁️</button>
                      {b.status === 'aguardando_sinal' && <button className="icon-btn" onClick={() => confirmBooking(b.id)} title="Confirmar Sinal (50%)" style={{ background: 'var(--mint)', borderColor: 'var(--mint)', color: 'var(--ink)' }}>✓</button>}
                      {b.status === 'confirmada' && <button className="icon-btn" onClick={() => quitarBooking(b.id)} title="Quitar Total (100%)" style={{ background: 'var(--sun)', borderColor: 'var(--sun)', color: 'var(--ink)' }}>💰</button>}
                      {b.status !== 'cancelled' && <button className="icon-btn danger" onClick={() => cancelBooking(b.id)} title="Cancelar">✕</button>}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {pastB.length > 0 && (
              <details style={{ marginTop: 18 }}>
                <summary style={{ cursor: 'pointer', fontWeight: 700, color: 'var(--mute)', fontSize: 14 }}>Histórico ({pastB.length})</summary>
                <div style={{ marginTop: 10 }}>
                  {pastB.map(b => (
                    <div key={b.id} className="booking-row">
                      <div className={`booking-status ${b.status === 'paga_total' || b.status === 'confirmada' ? 'confirmed' : b.status === 'cancelled' ? 'cancelled' : 'pending'}`} />
                      <div className="booking-info"><div className="t">{b.cliente.nome}</div><div className="m">{dateBR(b.data)} · {fmtMoney(b.total)}</div></div>
                      <span className={`booking-pill ${b.status === 'paga_total' || b.status === 'confirmada' ? 'confirmed' : b.status === 'cancelled' ? 'cancelled' : 'pending'}`}>{b.status === 'paga_total' ? 'Quitada' : b.status === 'confirmada' ? 'Sinal Pago' : b.status === 'cancelled' ? 'Cancelada' : 'Aguardando'}</span>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </>
        )}

        {/* CONFIG */}
        {tab === 'config' && (
          <>
            <div style={{ marginBottom: 16 }}><div style={{ fontWeight: 700 }}>Identidade e contato</div></div>
            <div className="field"><label>Nome do negócio</label><input value={cfgState.brandName} onChange={e => setCfg({ ...cfgState, brandName: e.target.value })} /></div>
            <div className="field"><label>Frase do topo</label><textarea rows={2} value={cfgState.heroLede} onChange={e => setCfg({ ...cfgState, heroLede: e.target.value })} /></div>
            <div className="field"><label>Contrato de Locação (Termos)</label><textarea rows={6} value={cfgState.contratoText} onChange={e => setCfg({ ...cfgState, contratoText: e.target.value })} placeholder="Escreva o contrato aqui..." /></div>
            <div className="field-row">
              <div className="field"><label>Stat 1 — número</label><input value={cfgState.stat1} onChange={e => setCfg({ ...cfgState, stat1: e.target.value })} /></div>
              <div className="field"><label>Stat 1 — rótulo</label><input value={cfgState.stat1lbl} onChange={e => setCfg({ ...cfgState, stat1lbl: e.target.value })} /></div>
            </div>
            <div className="field-row">
              <div className="field"><label>Stat 2 — número</label><input value={cfgState.stat2} onChange={e => setCfg({ ...cfgState, stat2: e.target.value })} /></div>
              <div className="field"><label>Stat 2 — rótulo</label><input value={cfgState.stat2lbl} onChange={e => setCfg({ ...cfgState, stat2lbl: e.target.value })} /></div>
            </div>
            <div className="field-row">
              <div className="field"><label>Stat 3 — número</label><input value={cfgState.stat3} onChange={e => setCfg({ ...cfgState, stat3: e.target.value })} /></div>
              <div className="field"><label>Stat 3 — rótulo</label><input value={cfgState.stat3lbl} onChange={e => setCfg({ ...cfgState, stat3lbl: e.target.value })} /></div>
            </div>
            <div className="field"><label>Endereço</label><input value={cfgState.endereco} onChange={e => setCfg({ ...cfgState, endereco: e.target.value })} /></div>
            <div className="field-row">
              <div className="field"><label>WhatsApp (números + DDI)</label><input value={cfgState.whatsapp} onChange={e => setCfg({ ...cfgState, whatsapp: e.target.value })} placeholder="5585999999999" /></div>
              <div className="field"><label>WhatsApp (rótulo)</label><input value={cfgState.whatsappLabel} onChange={e => setCfg({ ...cfgState, whatsappLabel: e.target.value })} /></div>
            </div>
            <div className="field-row">
              <div className="field"><label>Instagram (URL)</label><input value={cfgState.instagram} onChange={e => setCfg({ ...cfgState, instagram: e.target.value })} /></div>
              <div className="field"><label>Instagram (rótulo)</label><input value={cfgState.instagramLabel} onChange={e => setCfg({ ...cfgState, instagramLabel: e.target.value })} /></div>
            </div>
            <div className="field-row">
              <div className="field"><label>YouTube (URL)</label><input value={cfgState.youtube} onChange={e => setCfg({ ...cfgState, youtube: e.target.value })} /></div>
              <div className="field"><label>YouTube (rótulo)</label><input value={cfgState.youtubeLabel} onChange={e => setCfg({ ...cfgState, youtubeLabel: e.target.value })} /></div>
            </div>
            <div className="field"><label>E-mail</label><input value={cfgState.email} onChange={e => setCfg({ ...cfgState, email: e.target.value })} /></div>

            <div style={{ margin: '24px 0 12px 0', fontWeight: 700 }}>Turnos (horários)</div>
            <div className="field-row">
              <div className="field"><label>Diurno — início</label><input type="time" value={cfgState.horaInicioManha} onChange={e => setCfg({ ...cfgState, horaInicioManha: e.target.value })} /></div>
              <div className="field"><label>Diurno — fim</label><input type="time" value={cfgState.horaFimManha} onChange={e => setCfg({ ...cfgState, horaFimManha: e.target.value })} /></div>
            </div>
            <div className="field-row">
              <div className="field"><label>Tarde/Noite — início</label><input type="time" value={cfgState.horaInicioTarde} onChange={e => setCfg({ ...cfgState, horaInicioTarde: e.target.value })} /></div>
              <div className="field"><label>Tarde/Noite — fim</label><input type="time" value={cfgState.horaFimTarde} onChange={e => setCfg({ ...cfgState, horaFimTarde: e.target.value })} /></div>
            </div>
            <div className="field-row">
              <div className="field"><label>Dia inteiro — início</label><input type="time" value={cfgState.horaInicioDia} onChange={e => setCfg({ ...cfgState, horaInicioDia: e.target.value })} /></div>
              <div className="field"><label>Dia inteiro — fim</label><input type="time" value={cfgState.horaFimDia} onChange={e => setCfg({ ...cfgState, horaFimDia: e.target.value })} /></div>
            </div>
            <div className="field" style={{ marginTop: 8 }}><label>Preço hora extra (R$)</label><input type="number" min="0" value={cfgState.precoHoraExtra} onChange={e => setCfg({ ...cfgState, precoHoraExtra: Number(e.target.value) || 0 })} /></div>

            <div style={{ margin: '24px 0 12px 0', fontWeight: 700 }}>Segurança & integração</div>
            <div className="field"><label>Senha do admin</label><input value={cfgState.adminPass} onChange={e => setCfg({ ...cfgState, adminPass: e.target.value })} /></div>
            <div className="field"><label>URL do Apps Script (opcional)</label><input value={cfgState.backendUrl} onChange={e => setCfg({ ...cfgState, backendUrl: e.target.value })} placeholder="https://script.google.com/macros/s/.../exec" /><div className="help">Cole a URL para sincronizar reservas com Google Sheets.</div></div>

            <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
              <button className="btn-block" onClick={saveCfg}>Salvar configurações</button>
              <button className="btn-secondary" onClick={exportData}>⬇ Exportar dados</button>
              <button className="btn-secondary" onClick={importData}>⬆ Importar dados</button>
              <button className="btn-danger" onClick={resetAll}>🔄 Resetar tudo</button>
            </div>
          </>
        )}
      </div>

      {/* Booking View Modal */}
      <Modal open={viewModal} onClose={() => setViewModal(false)} title={`Detalhes da Reserva — ${selectedBooking?.id}`} wide>
        {selectedBooking && (() => {
          const b = selectedBooking;
          const items = b.items.map(it => `• ${it.nome} — ${fmtMoney(it.preco)}`).join('\n');
          const valorSinal = b.total / 2;
          const valorRestante = b.total / 2;
          const statusLabel = b.status === 'paga_total' ? 'Quitada (100% Paga)' : b.status === 'confirmada' ? 'Sinal Confirmado (Ativa)' : b.status === 'cancelled' ? 'Cancelada' : 'Aguardando Sinal';

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <h4 style={{ marginBottom: 8, color: 'var(--pool-deep)' }}>Dados do Cliente</h4>
                  <div style={{ fontSize: 13, lineHeight: 1.6 }}>
                    <strong>Nome:</strong> {b.cliente.nome}<br />
                    <strong>CPF:</strong> {b.cliente.cpf || 'Não informado'}<br />
                    <strong>WhatsApp:</strong> {b.cliente.tel}<br />
                    <strong>Nascimento:</strong> {b.cliente.nascimento ? dateShort(b.cliente.nascimento) : 'Não informado'}<br />
                    <strong>Endereço:</strong> {b.cliente.endereco || 'Não informado'}<br />
                    {b.cliente.evento && <><strong>Evento:</strong> {b.cliente.evento}<br /></>}
                    {b.cliente.obs && <><strong>Observações:</strong> {b.cliente.obs}<br /></>}
                  </div>
                </div>
                <div>
                  <h4 style={{ marginBottom: 8, color: 'var(--pool-deep)' }}>Dados da Reserva</h4>
                  <div style={{ fontSize: 13, lineHeight: 1.6 }}>
                    <strong>Data do Evento:</strong> {dateBR(b.data)}<br />
                    <strong>Horário / Turno:</strong> {slotLabel(b.slot, state.config)} {b.horasExtras > 0 ? ` (+${b.horasExtras}h extra)` : ''}<br />
                    <strong>Status:</strong> <span style={{ fontWeight: 700, color: b.status === 'paga_total' ? 'var(--mint-deep)' : b.status === 'confirmada' ? 'var(--pool-deep)' : 'var(--danger)' }}>{statusLabel}</span><br />
                    <strong>Cód. Verificação:</strong> {b.verificacao || 'Não gerado'}<br />
                    <strong>Data de Criação:</strong> {new Date(b.createdAt).toLocaleString('pt-BR')}
                  </div>
                </div>
              </div>

              <div>
                <h4 style={{ marginBottom: 8, color: 'var(--pool-deep)' }}>Resumo Financeiro</h4>
                <div style={{ background: 'var(--bg)', padding: 12, borderRadius: 8, fontSize: 13 }}>
                  <div style={{ whiteSpace: 'pre-line', marginBottom: 8 }}>{items}</div>
                  {b.horasExtras > 0 && <div style={{ marginBottom: 8 }}>• Hora extra ({b.horasExtras}h) — {fmtMoney(b.horasExtras * b.precoHoraExtra)}</div>}
                  <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '8px 0' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 14 }}>
                    <span>TOTAL DA RESERVA:</span>
                    <span>{fmtMoney(b.total)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#059669', fontSize: 13, marginTop: 4 }}>
                    <span>SINAL (50%):</span>
                    <span>R$ {fmtMoneyFull(valorSinal)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#b45309', fontSize: 13, marginTop: 2 }}>
                    <span>SALDO RESTANTE (50%):</span>
                    <span>R$ {fmtMoneyFull(valorRestante)}</span>
                  </div>
                </div>
              </div>

              <div>
                <h4 style={{ marginBottom: 8, color: 'var(--pool-deep)' }}>Assinatura Digital</h4>
                {b.contrato && b.contrato.assinado ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: '#ecfdf5', border: '1px solid #6ee7b7', padding: 12, borderRadius: 10 }}>
                    <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#fff', border: '2px solid #6ee7b7', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {b.contrato.fotoBase64 ? (
                        <img src={b.contrato.fotoBase64} alt="Selfie de Assinatura" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <span style={{ fontSize: 24, color: '#9ca3af' }}>👤</span>
                      )}
                    </div>
                    <div style={{ flex: 1, fontSize: 12, color: '#065f46' }}>
                      <strong>✓ Assinatura eletrônica por selfie realizada</strong><br />
                      Assinado em: {new Date(b.contrato.dataAssinatura).toLocaleString('pt-BR')}<br />
                      Verificação: {b.verificacao}
                    </div>
                    <button className="btn btn-primary" style={{ padding: '8px 12px', fontSize: 12, background: 'var(--pool-deep)' }} onClick={() => downloadContract(b)}>
                      📥 Baixar Contrato
                    </button>
                  </div>
                ) : (
                  <div style={{ padding: 12, background: '#FEF3C7', color: '#78350F', border: '1px solid #FCD34D', borderRadius: 10, fontSize: 13 }}>
                    ⚠️ Contrato pendente de assinatura digital pelo cliente.
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                {b.status === 'aguardando_sinal' && (
                  <button className="btn btn-primary" onClick={() => { setViewModal(false); confirmSinal(b.id); }}>Confirmar Sinal (50%)</button>
                )}
                {b.status === 'confirmada' && (
                  <button className="btn btn-primary" style={{ background: '#059669' }} onClick={() => { setViewModal(false); quitarBooking(b.id); }}>Quitar Reserva</button>
                )}
                {b.status !== 'cancelled' && (
                  <button className="btn btn-danger" onClick={() => { setViewModal(false); cancelBooking(b.id); }}>Cancelar Reserva</button>
                )}
                <button className="btn-secondary" onClick={() => setViewModal(false)}>Fechar</button>
              </div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
