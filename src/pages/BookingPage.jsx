/* KID PARK — Booking Wizard (multi-step) */
import { useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store';
import { useToast } from '../hooks/useToast';
import Calendar from '../components/Calendar';
import { fmtMoney, fmtMoneyFull, dateBR, dateShort, slotLabel, uid } from '../lib/utils';
import { Icon } from '../components/Icon';
import Modal from '../components/Modal';
import { supabase } from '../lib/supabase';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export default function BookingPage() {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const nav = useNavigate();
  const c = state.config;
  const ic = c.icones;

  // Initialize cart from sessionStorage (passed from home)
  const initialCart = useMemo(() => {
    try { return JSON.parse(sessionStorage.getItem('kp_cart') || '[]'); } catch { return []; }
  }, []);

  const [step, setStep] = useState(1);
  const [date, setDate] = useState(null);
  const [slot, setSlot] = useState(null);
  const [horasExtras, setHorasExtras] = useState(0);
  const [selectedItems, setSelectedItems] = useState(initialCart);
  
  // Lead details including nascimento and endereco
  const [cliente, setCliente] = useState({ 
    nome: '', 
    tel: '', 
    cpf: '', 
    nascimento: '', 
    endereco: '', 
    evento: '', 
    obs: '' 
  });
  
  const [createdBooking, setCreatedBooking] = useState(null);

  // States for Contract Signature process
  const [showContractModal, setShowContractModal] = useState(false);
  const [contractView, setContractView] = useState('read'); // 'read' | 'camera' | 'preview' | 'done'
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [cameraStream, setCameraStream] = useState(null);
  const videoRef = useRef(null);

  const formatCPF = (val) => {
    const clean = val.replace(/\D/g, '');
    if (clean.length <= 3) return clean;
    if (clean.length <= 6) return `${clean.slice(0, 3)}.${clean.slice(3)}`;
    if (clean.length <= 9) return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6)}`;
    return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6, 9)}-${clean.slice(9, 11)}`;
  };

  const calcularIdade = (nascStr) => {
    if (!nascStr) return 0;
    const hoje = new Date();
    const nasc = new Date(nascStr + 'T00:00:00');
    if (isNaN(nasc.getTime())) return 0;
    let idade = hoje.getFullYear() - nasc.getFullYear();
    const m = hoje.getMonth() - nasc.getMonth();
    if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--;
    return idade;
  };

  const validarCPF = (cpf) => {
    cpf = String(cpf || '').replace(/\D/g, '');
    if (cpf.length !== 11) return false;
    if (/^(\d)\1{10}$/.test(cpf)) return false;
    let s, r;
    s = 0;
    for (let i = 0; i < 9; i++) s += parseInt(cpf[i]) * (10 - i);
    r = (s * 10) % 11;
    if (r === 10) r = 0;
    if (r !== parseInt(cpf[9])) return false;
    s = 0;
    for (let i = 0; i < 10; i++) s += parseInt(cpf[i]) * (11 - i);
    r = (s * 10) % 11;
    if (r === 10) r = 0;
    if (r !== parseInt(cpf[10])) return false;
    return true;
  };

  const gerarCodigoVerificacao = () => {
    const ano = new Date().getFullYear();
    const seq = String(Math.floor(Math.random() * 900000) + 100000);
    return `KIDPARK-${ano}-${seq}`;
  };

  const ativos = state.items.filter(i => i.ativo).sort((a, b) => {
    const o = { pacote: 0, espaco: 1, equipamento: 2, extra: 3 };
    return (o[a.categoria] ?? 9) - (o[b.categoria] ?? 9);
  });

  const equipIds = state.items.filter(x => x.categoria === 'equipamento' && x.ativo).map(x => x.id);

  const [inclusoSet, setInclusoSet] = useState(new Set());

  const total = useMemo(() => {
    const items = selectedItems.reduce((s, id) => {
      if (inclusoSet.has(id)) return s;
      const it = state.items.find(x => x.id === id);
      return s + (it ? Number(it.preco) || 0 : 0);
    }, 0);
    return items + (horasExtras * (Number(c.precoHoraExtra) || 0));
  }, [selectedItems, horasExtras, state.items, c.precoHoraExtra, inclusoSet]);

  const totalSteps = 6;
  const dots = Array.from({ length: totalSteps }, (_, i) => {
    const n = i + 1;
    let cls = 'step-dot';
    if (n < step) cls += ' done';
    else if (n === step) cls += ' active';
    return <div key={i} className={cls} />;
  });

  const titles = { 1: 'Escolha a data', 2: 'Escolha o turno', 3: 'Monte sua reserva', 4: 'Seus dados', 5: 'Conferir e pagar', 6: 'Pagamento via PIX', 7: 'Reserva enviada' };

  const next = () => setStep(s => Math.min(s + 1, 7));
  const prev = () => setStep(s => Math.max(s - 1, 1));

  const toggleItem = id => {
    const item = state.items.find(x => x.id === id);
    if (item?.categoria === 'pacote') {
      setSelectedItems(prev => {
        const withoutPlans = prev.filter(pid => {
          const p = state.items.find(x => x.id === pid);
          return p?.categoria !== 'pacote';
        });
        const withoutInclusos = withoutPlans.filter(pid => !inclusoSet.has(pid));
        if (prev.includes(id)) {
          setInclusoSet(new Set());
          return withoutInclusos;
        }
        if (id === 'pkg3') {
          setInclusoSet(new Set(equipIds));
          const extras = withoutInclusos.filter(pid => !equipIds.includes(pid));
          return [id, ...extras, ...equipIds];
        } else {
          setInclusoSet(new Set());
          return [id, ...withoutInclusos];
        }
      });
    } else {
      if (inclusoSet.has(id)) return;
      setSelectedItems(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    }
  };

  const submitClient = () => {
    if (!cliente.nome.trim()) { toast('Preencha seu nome', 'error'); return; }
    if (!cliente.tel.trim() || cliente.tel.replace(/\D/g, '').length < 10) { toast('Preencha um WhatsApp válido', 'error'); return; }
    if (!cliente.cpf || !validarCPF(cliente.cpf)) { toast('CPF inválido', 'error'); return; }
    if (!cliente.nascimento) { toast('Informe a data de nascimento', 'error'); return; }
    const idade = calcularIdade(cliente.nascimento);
    if (idade < 18) { toast(`Você precisa ter 18 anos ou mais (idade detectada: ${idade}).`, 'error'); return; }
    if (idade > 120) { toast('Data de nascimento inválida', 'error'); return; }
    if (!cliente.endereco || cliente.endereco.trim().length < 8) { toast('Preencha seu endereço residencial completo', 'error'); return; }
    next();
  };

  const createBooking = async () => {
    const items = selectedItems.map(id => { const it = state.items.find(x => x.id === id); return { id: it.id, nome: it.nome, preco: Number(it.preco) || 0 }; });
    const bookingId = uid('RES');
    const verificacao = gerarCodigoVerificacao();
    const booking = {
      id: bookingId, 
      verificacao,
      data: date, 
      slot, 
      horasExtras, 
      precoHoraExtra: Number(c.precoHoraExtra) || 0,
      items, 
      total, 
      cliente: { ...cliente }, 
      status: 'aguardando_sinal', 
      createdAt: new Date().toISOString(),
      contrato: { assinado: false, fotoBase64: '', dataAssinatura: '' }
    };
    
    try {
      if (!supabase) {
        console.warn("Supabase not configured, saving booking to localStorage.");
        const localBookings = JSON.parse(localStorage.getItem('kp_bookings') || '[]');
        localBookings.unshift(booking);
        localStorage.setItem('kp_bookings', JSON.stringify(localBookings));

        dispatch({ type: 'ADD_BOOKING', payload: booking });
        setCreatedBooking(booking);
        sessionStorage.removeItem('kp_cart');
        next();
        return;
      }
      const { error } = await supabase.from('kp_bookings').insert([{
        id: booking.id,
        verificacao: booking.verificacao,
        data: booking.data,
        slot: booking.slot,
        horas_extras: booking.horasExtras,
        preco_hora_extra: booking.precoHoraExtra,
        items: booking.items,
        total: booking.total,
        cliente_nome: booking.cliente.nome,
        cliente_tel: booking.cliente.tel,
        cliente_cpf: booking.cliente.cpf,
        cliente_nascimento: booking.cliente.nascimento,
        cliente_endereco: booking.cliente.endereco,
        cliente_evento: booking.cliente.evento,
        cliente_obs: booking.cliente.obs,
        contrato: booking.contrato,
        status: booking.status
      }]);

      if (error) {
        toast('Erro ao salvar no Supabase: ' + error.message, 'error');
        return;
      }

      dispatch({ type: 'ADD_BOOKING', payload: booking });
      setCreatedBooking(booking);
      sessionStorage.removeItem('kp_cart');
      next();
    } catch (err) {
      console.error(err);
      toast('Erro de conexão ao salvar reserva', 'error');
    }
  };

  const copyPix = () => {
    if (!state.pix.chave) { toast('Chave PIX vazia', 'error'); return; }
    navigator.clipboard?.writeText(state.pix.chave).then(() => toast('Chave PIX copiada ✓', 'success')).catch(() => toast('Não foi possível copiar', 'error'));
  };

  const sendWhatsApp = () => {
    const b = createdBooking;
    if (!b) return;
    const tel = (c.whatsapp || '').replace(/\D/g, '');
    if (!tel) { toast('WhatsApp do admin não configurado', 'error'); return; }
    const itemsStr = b.items.map(it => `- ${it.nome}: ${fmtMoney(it.preco)}`).join('\n');
    const cobrancaTotal = c.checkoutPixType === 'total';
    const valorSinal = cobrancaTotal ? b.total : b.total / 2;
    const valorRestante = cobrancaTotal ? 0 : b.total / 2;
    const msg = cobrancaTotal
      ? `Olá! Quero confirmar minha reserva no ${c.brandName}.\n\n🎉 *Reserva ${b.id}*\n👤 ${b.cliente.nome}\n🪪 CPF: ${b.cliente.cpf}\n📱 ${b.cliente.tel}\n📅 ${dateBR(b.data)}\n⏰ ${slotLabel(b.slot, c)}\n\n*Itens:*\n${itemsStr}\n\n💰 *Total da locação (100% pago no PIX): R$ ${fmtMoneyFull(b.total)}*\n\nSegue o comprovante 👇`
      : `Olá! Quero confirmar minha reserva no ${c.brandName}.\n\n🎉 *Reserva ${b.id}*\n👤 ${b.cliente.nome}\n🪪 CPF: ${b.cliente.cpf}\n📱 ${b.cliente.tel}\n📅 ${dateBR(b.data)}\n⏰ ${slotLabel(b.slot, c)}\n\n*Itens:*\n${itemsStr}\n\n💰 *Total da locação: R$ ${fmtMoneyFull(b.total)}*\n💳 *Sinal (50% pago no PIX): R$ ${fmtMoneyFull(valorSinal)}*\n💵 *Restante (a pagar no evento): R$ ${fmtMoneyFull(valorRestante)}*\n\nSegue o comprovante 👇`;
    window.open(`https://wa.me/${tel}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // Camera Actions
  const startCamera = async () => {
    setCapturedPhoto(null);
    setContractView('camera');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 540 } },
        audio: false,
      });
      setCameraStream(stream);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            if (videoRef.current) videoRef.current.play();
          };
        }
      }, 100);
    } catch (err) {
      console.warn('Câmera:', err);
      toast('Acesso à câmera negado ou indisponível', 'error');
      setContractView('read');
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(t => t.stop());
      setCameraStream(null);
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      toast('Câmera ainda carregando...', 'error');
      return;
    }
    const w = video.videoWidth;
    const h = video.videoHeight;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, w, h);
    const photoB64 = canvas.toDataURL('image/jpeg', 0.75);
    setCapturedPhoto(photoB64);
    stopCamera();
    setContractView('preview');
  };

  const confirmSignature = async () => {
    if (!createdBooking) return;
    if (!capturedPhoto) {
      toast('Foto não capturada', 'error');
      return;
    }

    const contrato = {
      assinado: true,
      fotoBase64: capturedPhoto,
      dataAssinatura: new Date().toISOString(),
    };

    try {
      if (!supabase) {
        console.warn("Supabase not configured, updating booking signature in localStorage.");
        const localBookings = JSON.parse(localStorage.getItem('kp_bookings') || '[]');
        const idx = localBookings.findIndex(x => x.id === createdBooking.id);
        if (idx >= 0) {
          localBookings[idx].contrato = contrato;
          localStorage.setItem('kp_bookings', JSON.stringify(localBookings));
        }
        dispatch({
          type: 'UPDATE_BOOKING',
          payload: { id: createdBooking.id, contrato }
        });
        setCreatedBooking(prev => ({ ...prev, contrato }));
        toast('Contrato assinado ✓', 'success');
        setContractView('done');
        return;
      }

      const { error } = await supabase
        .from('kp_bookings')
        .update({ contrato })
        .eq('id', createdBooking.id);

      if (error) {
        toast('Erro ao salvar assinatura no Supabase: ' + error.message, 'error');
        return;
      }

      dispatch({
        type: 'UPDATE_BOOKING',
        payload: { id: createdBooking.id, contrato }
      });
      setCreatedBooking(prev => ({ ...prev, contrato }));
      toast('Contrato assinado ✓', 'success');
      setContractView('done');
    } catch (err) {
      console.error(err);
      toast('Erro de conexão ao salvar contrato', 'error');
    }
  };

  // PDF Generation Logic
  const buildContractHTMLForPDF = (b) => {
    const cl = b.cliente;
    const itemsStr = b.items.map(it => `${it.nome} (${fmtMoney(it.preco)})`).join('; ');
    const horaTxt = slotLabel(b.slot, c);
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
          Espaço Kid Park · ${c.endereco || 'Madalena · CE'}
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

  const sendContractWhats = async (b) => {
    let adminTel = (c.whatsapp || '').replace(/\D/g, '');
    if (!adminTel) {
      toast('WhatsApp do espaço não configurado', 'error');
      return;
    }
    if (adminTel.length === 10 || adminTel.length === 11) adminTel = '55' + adminTel;

    const pdf = await generateContractPDF(b);
    if (!pdf) return;

    // Trigger download first
    const url = URL.createObjectURL(pdf.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = pdf.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    const msg = `*Contrato assinado — Kid Park*\n\n*Reserva:* ${b.id}\n*Verificação:* ${b.verificacao}\n\n*Contratante:* ${b.cliente.nome}\nCPF: ${b.cliente.cpf || ''}\nWhatsApp: ${b.cliente.tel}\n\n*Evento:* ${dateBR(b.data)} · ${slotLabel(b.slot, c)}\n*Total:* ${fmtMoney(b.total)}\n\n📎 Estou anexando o contrato completo em PDF.`;
    toast('PDF baixado — abrindo WhatsApp', 'success');

    setTimeout(() => {
      window.open(`https://wa.me/${adminTel}?text=${encodeURIComponent(msg)}`, '_blank');
    }, 500);
  };

  const diaOcupado = date ? state.bookings.some(b => b.data === date && b.status !== 'cancelled') : false;

  const slots = [
    { id: 'manha', nome: 'Diurno', tempo: `${c.horaInicioManha} às ${c.horaFimManha}`, desc: 'Festa durante o dia' },
    { id: 'tarde', nome: 'Tarde/Noite', tempo: `${c.horaInicioTarde} às ${c.horaFimTarde}`, desc: 'Festa da tarde até meia-noite' },
    { id: 'dia', nome: 'Dia inteiro', tempo: `${c.horaInicioDia} às ${c.horaFimDia}`, desc: 'O dia todo, até meia-noite' },
  ];

  return (
    <div className="modal-overlay" style={{ display: 'flex' }}>
      <div className="modal-card wide">
        <div className="modal-head">
          <h3>{titles[step]}</h3>
          <button className="modal-close" onClick={() => nav('/')}>×</button>
        </div>
        <div className="modal-body">
          {step <= 6 && <div className="steps">{dots}</div>}

          {/* STEP 1: Date */}
          {step === 1 && (
            <>
              <p style={{ marginBottom: 14, color: 'var(--ink-soft)' }}>Escolha um dia livre no calendário. Datas em vermelho já estão reservadas ou bloqueadas.</p>
              <Calendar selected={date} onSelect={setDate} bookings={state.bookings} blockedDates={state.blockedDates} />
              <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <button className="btn-secondary" onClick={() => nav('/')}>Cancelar</button>
                <button className="btn btn-primary" onClick={next} disabled={!date}>Continuar →</button>
              </div>
            </>
          )}

          {/* STEP 2: Slot */}
          {step === 2 && (
            <>
              <p style={{ marginBottom: 14, color: 'var(--ink-soft)' }}><strong>{dateBR(date)}</strong><br />Escolha o horário da sua festa.</p>
              <div className="slots">
                {slots.map(s => (
                  <div key={s.id} className={`slot ${diaOcupado ? 'disabled' : ''} ${slot === s.id ? 'selected' : ''}`}
                    onClick={!diaOcupado ? () => { setSlot(s.id); if (s.id === 'dia') setHorasExtras(0); } : undefined}>
                    <div className="slot-name">{s.nome}{diaOcupado ? ' (ocupado)' : ''}</div>
                    <div className="slot-time">{s.tempo}</div>
                    <div style={{ fontSize: 11, color: 'var(--mute)', marginTop: 4 }}>{s.desc}</div>
                  </div>
                ))}
              </div>
              {slot && slot !== 'dia' && (
                <div style={{ marginTop: 20, padding: 16, background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.3)', borderRadius: 14 }}>
                  <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 14 }}>⏱️ Hora extra (opcional)</div>
                  <div style={{ fontSize: 12, color: 'var(--mute)', marginBottom: 10 }}>Cada hora extra: <strong>{fmtMoney(c.precoHoraExtra)}</strong></div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button className="btn-secondary" style={{ padding: '8px 14px' }} onClick={() => setHorasExtras(h => Math.max(0, h - 1))}>−</button>
                    <div style={{ flex: 1, textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 700 }}>{horasExtras}h</div>
                    <button className="btn-secondary" style={{ padding: '8px 14px' }} onClick={() => setHorasExtras(h => Math.min(6, h + 1))}>+</button>
                  </div>
                  {horasExtras > 0 && <div className="space-y" style={{ marginTop: 10, fontSize: 12, color: 'var(--pool-deep)', textAlign: 'center' }}>+ {fmtMoney(horasExtras * c.precoHoraExtra)} em horas extras</div>}
                </div>
              )}
              <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <button className="btn-secondary" onClick={prev}>← Voltar</button>
                <button className="btn btn-primary" onClick={next} disabled={!slot}>Continuar →</button>
              </div>
            </>
          )}

          {/* STEP 3: Items */}
          {step === 3 && (() => {
            const planos = ativos.filter(it => it.categoria === 'pacote');
            const extras = ativos.filter(it => it.categoria !== 'pacote');
            const hasPlano = selectedItems.some(id => {
              const it = state.items.find(x => x.id === id);
              return it?.categoria === 'pacote';
            });
            return (
              <>
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <span style={{ fontSize: 20 }}>⭐</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>Escolha seu plano</div>
                      <div style={{ fontSize: 12, color: 'var(--mute)' }}>Obrigatório — selecione apenas um</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {planos.map(it => {
                      const checked = selectedItems.includes(it.id);
                      const catKey = 'catPacote';
                      return (
                        <label key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 14, background: checked ? 'rgba(8,145,178,.12)' : 'var(--bg)', border: `2px solid ${checked ? 'var(--pool)' : 'transparent'}`, borderRadius: 14, cursor: 'pointer', transition: 'all .15s', boxShadow: checked ? '0 0 0 1px var(--pool)' : 'none' }}>
                          <input type="radio" name="plano" checked={checked} onChange={() => toggleItem(it.id)} style={{ width: 20, height: 20, accentColor: 'var(--pool)', cursor: 'pointer' }} />
                          {it.imagemUrl ? <img src={it.imagemUrl} alt="" style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover' }} /> : <div style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon icones={ic} name={catKey} size="24px" /></div>}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: 15 }}>{it.nome}</div>
                            <div style={{ fontSize: 12, color: 'var(--mute)' }}>{it.desc}</div>
                          </div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--pool-deep)', textAlign: 'right' }}>
                            {fmtMoney(it.preco)}
                            <div style={{ fontSize: 10, color: 'var(--mute)', fontWeight: 400 }}>{it.unidade === 'hora' ? '/h' : '/diária'}</div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                  {!hasPlano && <div style={{ marginTop: 8, padding: '8px 14px', background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.3)', borderRadius: 10, fontSize: 13, color: '#b45309' }}>⚠️ Selecione um plano para continuar.</div>}
                </div>

                {extras.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <span style={{ fontSize: 20 }}>➕</span>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15 }}>Itens extras</div>
                        <div style={{ fontSize: 12, color: 'var(--mute)' }}>Opcional — adicione quantos quiser</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 200, overflowY: 'auto', padding: 2 }}>
                      {extras.map(it => {
                        const checked = selectedItems.includes(it.id);
                        const isIncluso = inclusoSet.has(it.id);
                        const catKey = { espaco: 'catEspaco', equipamento: 'catEquip', extra: 'catExtra' }[it.categoria] || 'catExtra';
                        return (
                          <label key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 14, background: isIncluso ? 'rgba(8,145,178,.10)' : checked ? 'rgba(8,145,178,.08)' : 'var(--bg)', border: `2px solid ${checked ? 'var(--pool)' : 'transparent'}`, borderRadius: 14, cursor: isIncluso ? 'default' : 'pointer', transition: 'all .15s' }}>
                            <input type="checkbox" checked={checked} onChange={() => toggleItem(it.id)} disabled={isIncluso} style={{ width: 20, height: 20, accentColor: 'var(--pool)', cursor: isIncluso ? 'default' : 'pointer' }} />
                            {it.imagemUrl ? <img src={it.imagemUrl} alt="" style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover' }} /> : <div style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon icones={ic} name={catKey} size="24px" /></div>}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 700, fontSize: 15 }}>{it.nome} {isIncluso && <span style={{ fontSize: 11, color: 'var(--pool)', fontWeight: 600 }}>✓ Incluso no plano</span>}</div>
                              <div style={{ fontSize: 12, color: 'var(--mute)' }}>{it.desc}</div>
                            </div>
                            <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--pool-deep)', textAlign: 'right' }}>
                              {isIncluso ? <><s style={{ opacity: .4, fontSize: 13 }}>{fmtMoney(it.preco)}</s> <span style={{ color: 'var(--pool)', fontSize: 13 }}>R$ 0</span></> : fmtMoney(it.preco)}
                              <div style={{ fontSize: 10, color: 'var(--mute)', fontWeight: 400 }}>{it.unidade === 'hora' ? '/h' : '/diária'}</div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="summary" style={{ marginTop: 16 }}>
                  <div className="summary-total"><span className="k">Total</span><span className="v">{fmtMoney(total)}</span></div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <button className="btn-secondary" onClick={prev}>← Voltar</button>
                  <button className="btn btn-primary" onClick={next} disabled={!hasPlano}>Continuar →</button>
                </div>
              </>
            );
          })()}

          {/* STEP 4: Client info */}
          {step === 4 && (
            <>
              <p style={{ marginBottom: 14, color: 'var(--ink-soft)' }}>
                Precisamos dos seus dados para emitir o contrato e confirmar a reserva.
                <strong style={{ color: 'var(--pool-deep)', marginLeft: 6 }}>Você precisa ter 18 anos ou mais.</strong>
              </p>
              <div className="field"><label>Nome completo <span className="req">*</span></label><input value={cliente.nome} onChange={e => setCliente({ ...cliente, nome: e.target.value })} placeholder="Como aparece no seu documento" /></div>
              <div className="field-row">
                <div className="field"><label>CPF <span className="req">*</span></label><input value={cliente.cpf} onChange={e => setCliente({ ...cliente, cpf: formatCPF(e.target.value) })} placeholder="000.000.000-00" maxLength={14} /></div>
                <div className="field"><label>Data de nascimento <span className="req">*</span></label><input type="date" value={cliente.nascimento} onChange={e => setCliente({ ...cliente, nascimento: e.target.value })} max={new Date().toISOString().slice(0,10)} /></div>
              </div>
              <div className="field-row">
                <div className="field"><label>WhatsApp <span className="req">*</span></label><input value={cliente.tel} onChange={e => setCliente({ ...cliente, tel: e.target.value })} placeholder="(85) 9 9999-9999" inputMode="tel" /></div>
                <div className="field"><label>Tipo de evento</label><input value={cliente.evento} onChange={e => setCliente({ ...cliente, evento: e.target.value })} placeholder="Ex.: aniversário 5 anos" /></div>
              </div>
              <div className="field"><label>Endereço residencial completo <span className="req">*</span></label><input value={cliente.endereco} onChange={e => setCliente({ ...cliente, endereco: e.target.value })} placeholder="Rua, número, bairro, cidade — UF" /></div>
              <div className="field"><label>Observações (opcional)</label><textarea rows={3} value={cliente.obs} onChange={e => setCliente({ ...cliente, obs: e.target.value })} placeholder="Quantidade de convidados, decoração…" /></div>

              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 24 }}>
                <button className="btn-secondary" onClick={prev}>← Voltar</button>
                <button className="btn btn-primary" onClick={submitClient}>Continuar →</button>
              </div>
            </>
          )}

          {/* STEP 5: Review */}
          {step === 5 && (() => {
            const cobrancaTotal = c.checkoutPixType === 'total';
            const valorSinal = cobrancaTotal ? total : total / 2;
            const valorRestante = cobrancaTotal ? 0 : total / 2;
            return (
              <>
                <div className="pix-warn">⚠️ <strong>Confira tudo antes de pagar.</strong> {cobrancaTotal ? 'O pagamento do valor total garante a sua data.' : 'A reserva de 50% de sinal garante a sua data.'}</div>
                <div className="summary">
                  <div className="summary-row"><span className="k">📅 Data</span><span className="v">{dateBR(date)}</span></div>
                  <div className="summary-row"><span className="k">⏰ Turno</span><span className="v">{slotLabel(slot, c)}</span></div>
                  <div className="summary-row"><span className="k">👤 Cliente</span><span className="v">{cliente.nome}</span></div>
                  <div className="summary-row"><span className="k">🪪 CPF</span><span className="v">{cliente.cpf}</span></div>
                  <div className="summary-row"><span className="k">🎂 Nascimento</span><span className="v">{dateShort(cliente.nascimento)}</span></div>
                  <div className="summary-row"><span className="k">📱 WhatsApp</span><span className="v">{cliente.tel}</span></div>
                  <div className="summary-row"><span className="k">🏠 Endereço</span><span className="v" style={{ fontSize: 12, textAlign: 'right', maxWidth: '60%' }}>{cliente.endereco}</span></div>
                  {cliente.evento && <div className="summary-row"><span className="k">🎉 Evento</span><span className="v">{cliente.evento}</span></div>}
                  {cliente.obs && <div className="summary-row"><span className="k">📝 Obs</span><span className="v">{cliente.obs}</span></div>}
                </div>
                <div className="summary">
                  <div style={{ fontWeight: 700, marginBottom: 10 }}>Itens reservados</div>
                  {selectedItems.map(id => { const it = state.items.find(x => x.id === id); return it ? <div key={id} className="summary-row"><span className="k">{it.nome}</span><span className="v">{fmtMoney(it.preco)}</span></div> : null; })}
                  {horasExtras > 0 && <div className="summary-row"><span className="k">⏱️ {horasExtras}h extra(s)</span><span className="v">{fmtMoney(horasExtras * (c.precoHoraExtra || 0))}</span></div>}
                  <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '10px 0' }} />
                  <div className="summary-row" style={{ opacity: 0.8 }}><span className="k">Total da locação</span><span className="v">{fmtMoney(total)}</span></div>
                  {cobrancaTotal ? (
                    <div className="summary-row" style={{ color: 'var(--pool-deep)', fontWeight: 600 }}><span className="k">Valor Total (100% no PIX)</span><span className="v">R$ {fmtMoneyFull(valorSinal)}</span></div>
                  ) : (
                    <>
                      <div className="summary-row" style={{ color: 'var(--pool-deep)', fontWeight: 600 }}><span className="k">Sinal de Agendamento (50%)</span><span className="v">R$ {fmtMoneyFull(valorSinal)}</span></div>
                      <div className="summary-row" style={{ fontSize: 13, opacity: 0.7 }}><span className="k">Restante (no dia da festa)</span><span className="v">R$ {fmtMoneyFull(valorRestante)}</span></div>
                    </>
                  )}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <button className="btn-secondary" onClick={prev}>← Voltar</button>
                  <button className="btn-block success" style={{ flex: 1, maxWidth: 280 }} onClick={createBooking}>
                    {cobrancaTotal ? '✓ Reservar e Pagar Total' : '✓ Reservar e Pagar Sinal'}
                  </button>
                </div>
              </>
            );
          })()}

          {/* STEP 6: PIX */}
          {step === 6 && createdBooking && (() => {
            const cobrancaTotal = c.checkoutPixType === 'total';
            const valorSinal = cobrancaTotal ? createdBooking.total : createdBooking.total / 2;
            const assinado = createdBooking.contrato && createdBooking.contrato.assinado;

            if (!assinado) {
              return (
                <>
                  <div className="summary">
                    <div className="summary-row"><span className="k">Reserva</span><span className="v" style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{createdBooking.id}</span></div>
                    <div className="summary-row"><span className="k">Data</span><span className="v">{dateShort(createdBooking.data)} · {slotLabel(createdBooking.slot, c).split(' ')[0]}</span></div>
                    <div className="summary-row"><span className="k">Cliente</span><span className="v">{createdBooking.cliente.nome}</span></div>
                    <div className="summary-total"><span className="k">Total</span><span className="v">{fmtMoney(createdBooking.total)}</span></div>
                  </div>
                  <div className="pix-warn" style={{ background: '#FEF3C7', color: '#78350F', border: '1px solid #FCD34D' }}>
                    📝 <strong>Antes do pagamento, é preciso assinar o termo de responsabilidade.</strong>
                    <br /><span style={{ fontSize: 12, opacity: 0.8 }}>A assinatura é digital, por foto (selfie), e é necessária para liberar os dados do PIX.</span>
                  </div>
                  <button className="btn-block" style={{ background: 'var(--pool-deep)', color: 'white', fontSize: 16, padding: 18 }} onClick={startCamera}>
                    📝 Ler e assinar contrato
                  </button>
                  <div style={{ textAlign: 'center', marginTop: 14, fontSize: 12, color: 'var(--mute)' }}>
                    Você precisará permitir o acesso à câmera para fazer a assinatura por foto.
                  </div>
                </>
              );
            }

            return (
              <>
                <div style={{ background: '#D1FAE5', border: '1px solid #6EE7B7', color: '#065F46', padding: '12px 14px', borderRadius: 12, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 22 }}>✓</span>
                  <div style={{ flex: 1, fontSize: 13 }}>
                    <strong>Contrato assinado</strong> em {new Date(createdBooking.contrato.dataAssinatura).toLocaleString('pt-BR')}.<br />
                    <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}>Verificação: {createdBooking.verificacao}</span>
                  </div>
                  <button className="btn-secondary" style={{ padding: '8px 12px', fontSize: 12 }} onClick={() => downloadContract(createdBooking)}>Ver PDF</button>
                </div>

                <div className="pix-warn">⚠️ <strong>Valor do PIX:</strong> Transfira exatamente {cobrancaTotal ? 'o valor total de' : 'o sinal de'} <strong>R$ {fmtMoneyFull(valorSinal)}</strong> para confirmar o agendamento.</div>
                {(state.pix.qrBase64 || state.pix.qrUrl) ? (
                  <div className="pix-qr"><img src={state.pix.qrBase64 || state.pix.qrUrl} alt="QR Code PIX" /><div style={{ fontSize: 12, color: 'var(--mute)', marginTop: 8 }}>Aponte a câmera do seu app bancário</div></div>
                ) : <div className="empty-state" style={{ marginBottom: 14 }}><div className="ic">📱</div>QR Code não cadastrado. Use a chave PIX abaixo.</div>}
                {state.pix.chave ? (
                  <div className="pix-card">
                    <div className="pix-label">Chave PIX</div>
                    <div className="pix-key" onClick={copyPix}>{state.pix.chave}</div>
                    <div className="pix-meta">{state.pix.nomeBeneficiario && <div><strong>{state.pix.nomeBeneficiario}</strong></div>}{state.pix.banco && <div>{state.pix.banco}</div>}</div>
                    <button className="btn-block" style={{ marginTop: 14, background: 'var(--mint)', color: 'var(--ink)' }} onClick={copyPix}>📋 Copiar chave</button>
                  </div>
                ) : <div className="empty-state" style={{ background: 'var(--danger-bg)', borderColor: '#FCA5A5', color: 'var(--danger-text)' }}>Chave PIX não cadastrada. Entre em contato pelo WhatsApp.</div>}
                <div className="summary">
                  <div className="summary-row"><span className="k">Reserva</span><span className="v" style={{ fontFamily: 'var(--font-mono)' }}>{createdBooking.id}</span></div>
                  <div className="summary-row"><span className="k">Data</span><span className="v">{dateShort(createdBooking.data)}</span></div>
                  <div className="summary-row"><span className="k">Total</span><span className="v">{fmtMoney(createdBooking.total)}</span></div>
                  <div className="summary-total" style={{ color: 'var(--pool-deep)' }}><span className="k">{cobrancaTotal ? 'Pagar Total' : 'Pagar Sinal (50%)'}</span><span className="v">R$ {fmtMoneyFull(valorSinal)}</span></div>
                </div>
                <div style={{ background: 'var(--bg)', borderRadius: 12, padding: 14, marginBottom: 14, fontSize: 13, color: 'var(--ink-soft)' }}>⚠ Após o PIX, envie o comprovante e o contrato pelo WhatsApp. A data será liberada após validação.</div>
                
                <button className="btn-block" onClick={() => sendContractWhats(createdBooking)} style={{ background: 'var(--pool-deep)', color: 'white', marginBottom: 10 }}>
                  📄 Enviar contrato assinado por WhatsApp
                </button>
                <button className="btn-block" onClick={sendWhatsApp}>📎 Enviar comprovante do PIX</button>
                <button className="btn-secondary" style={{ width: '100%', marginTop: 10 }} onClick={next}>✓ Já enviei tudo</button>
              </>
            );
          })()}

          {/* STEP 7: Done */}
          {step === 7 && createdBooking && (
            <div style={{ textAlign: 'center', padding: '20px 10px' }}>
              <div style={{ fontSize: 64, marginBottom: 14 }}>🎉</div>
              <h2 className="h-display" style={{ fontSize: 32, marginBottom: 10 }}>Reserva enviada!</h2>
              <p style={{ color: 'var(--ink-soft)', marginBottom: 24 }}>Sua data está bloqueada aguardando o comprovante.<br />Em breve você receberá uma confirmação no WhatsApp.</p>
              <div className="summary" style={{ textAlign: 'left' }}>
                <div className="summary-row"><span className="k">Reserva</span><span className="v" style={{ fontFamily: 'var(--font-mono)' }}>{createdBooking.id}</span></div>
                <div className="summary-row"><span className="k">Data</span><span className="v">{dateBR(createdBooking.data)}</span></div>
                <div className="summary-row"><span className="k">Turno</span><span className="v">{slotLabel(createdBooking.slot, c)}</span></div>
                <div className="summary-row"><span className="k">Total</span><span className="v" style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{fmtMoney(createdBooking.total)}</span></div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'center', flexWrap: 'wrap' }}>
                <button className="btn btn-primary" onClick={() => nav('/')}>Fechar</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Contract Signature Modal */}
      <Modal open={showContractModal} onClose={() => { stopCamera(); setShowContractModal(false); }} title="Assinatura de Termo / Contrato" wide>
        {contractView === 'read' && createdBooking && (
          <>
            <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--ink-soft)' }}>
              Leia o termo abaixo. Para assinar, clique em <strong>Assinar com foto</strong> ao final.
            </p>
            <div className="contract-doc" dangerouslySetInnerHTML={{ __html: buildContractHTMLForPDF(createdBooking) }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 18 }}>
              <button className="btn-secondary" onClick={() => setShowContractModal(false)}>Voltar</button>
              <button className="btn btn-primary" onClick={startCamera}>
                📷 Assinar com foto
              </button>
            </div>
          </>
        )}

        {contractView === 'camera' && (
          <>
            <p className="camera-tip">
              📸 Tire uma selfie clara, olhando para a câmera. Essa foto será sua <strong>assinatura digital</strong> no contrato.
            </p>
            <div className="camera-stage">
              <video ref={videoRef} autoplay="true" playsinline="true" muted="true" style={{ width: '100%', height: '100%', objectFit: 'cover' }}></video>
              {!cameraStream && <div className="camera-overlay">Solicitando acesso à câmera…</div>}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 8 }}>
              <button className="btn-secondary" onClick={() => { stopCamera(); setContractView('read'); }}>← Voltar</button>
              <button className="btn btn-primary" onClick={capturePhoto} disabled={!cameraStream}>
                📸 Capturar foto
              </button>
            </div>
          </>
        )}

        {contractView === 'preview' && (
          <>
            <p className="camera-tip">
              Confira a foto. Se estiver boa, clique em <strong>Confirmar assinatura</strong>.
            </p>
            <div className="camera-stage">
              <img className="captured" src={capturedPhoto} alt="Foto capturada" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <div style={{ background: 'var(--bg)', padding: '10px 12px', borderRadius: 10, fontSize: 12, color: 'var(--ink-soft)', marginBottom: 12 }}>
              Ao confirmar, você declara ter lido e aceitado todos os termos do contrato. A foto e seus dados serão usados como sua assinatura digital.
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
              <button className="btn-secondary" onClick={startCamera}>↺ Tirar outra</button>
              <button className="btn btn-primary" style={{ background: '#059669' }} onClick={confirmSignature}>
                ✓ Confirmar assinatura
              </button>
            </div>
          </>
        )}

        {contractView === 'done' && createdBooking && (
          <>
            <div style={{ background: '#D1FAE5', border: '1px solid #6EE7B7', color: '#065F46', padding: 14, borderRadius: 12, marginBottom: 14, textAlignment: 'center', textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 4 }}>✓</div>
              <div style={{ fontWeight: 700 }}>Contrato assinado com sucesso!</div>
              <div style={{ fontSize: 12, marginTop: 6 }}>Código de verificação: <strong>{createdBooking.verificacao}</strong></div>
            </div>
            <div className="contract-doc" dangerouslySetInnerHTML={{ __html: buildContractHTMLForPDF(createdBooking) }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 18 }}>
              <button className="btn-block" style={{ background: 'var(--pool-deep)', color: 'white' }} onClick={() => downloadContract(createdBooking)}>
                📥 Baixar contrato em PDF
              </button>
              <button className="btn-block" style={{ background: '#22C55E', color: 'white' }} onClick={() => sendContractWhats(createdBooking)}>
                📱 Enviar pelo WhatsApp
              </button>
              <button className="btn-secondary" onClick={() => { setShowContractModal(false); }}>Fechar</button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
