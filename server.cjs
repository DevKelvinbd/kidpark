const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3002;
const DB_PATH = path.join(__dirname, 'db.json');

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const DEFAULT_STATE = {
  config: {
    brandName: 'Kid Park',
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

// Helper function to read DB
function readDb() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      writeDb(DEFAULT_STATE);
      return DEFAULT_STATE;
    }
    const raw = fs.readFileSync(DB_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    
    // Ensure all default structures exist (fallback merge)
    return {
      ...DEFAULT_STATE,
      ...parsed,
      config: { ...DEFAULT_STATE.config, ...(parsed.config || {}) },
      pix: { ...DEFAULT_STATE.pix, ...(parsed.pix || {}) },
      items: parsed.items || DEFAULT_STATE.items,
      gallery: parsed.gallery || DEFAULT_STATE.gallery,
      bookings: parsed.bookings || DEFAULT_STATE.bookings,
      blockedDates: parsed.blockedDates || DEFAULT_STATE.blockedDates,
    };
  } catch (err) {
    console.error('Error reading DB:', err);
    return DEFAULT_STATE;
  }
}

// Helper function to write DB
function writeDb(data) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing DB:', err);
  }
}

// --- API ROUTES ---

// Get complete state
app.get('/api/state', (req, res) => {
  res.json(readDb());
});

// Update full configuration
app.put('/api/config', (req, res) => {
  const db = readDb();
  db.config = { ...db.config, ...req.body };
  writeDb(db);
  res.json({ success: true, config: db.config });
});

// Update PIX info
app.put('/api/pix', (req, res) => {
  const db = readDb();
  db.pix = { ...db.pix, ...req.body };
  writeDb(db);
  res.json({ success: true, pix: db.pix });
});

// Manage Items
app.post('/api/items', (req, res) => {
  const db = readDb();
  const newItem = req.body;
  db.items.push(newItem);
  writeDb(db);
  res.json({ success: true, item: newItem });
});

app.put('/api/items/:id', (req, res) => {
  const db = readDb();
  const { id } = req.params;
  db.items = db.items.map(item => item.id === id ? { ...item, ...req.body } : item);
  writeDb(db);
  res.json({ success: true, items: db.items });
});

app.delete('/api/items/:id', (req, res) => {
  const db = readDb();
  const { id } = req.params;
  db.items = db.items.filter(item => item.id !== id);
  writeDb(db);
  res.json({ success: true });
});

// Manage Bookings
app.post('/api/bookings', (req, res) => {
  const db = readDb();
  const newBooking = req.body;
  // Prepend to display latest first
  db.bookings = [newBooking, ...db.bookings];
  writeDb(db);
  res.json({ success: true, booking: newBooking });
});

app.put('/api/bookings/:id', (req, res) => {
  const db = readDb();
  const { id } = req.params;
  db.bookings = db.bookings.map(b => b.id === id ? { ...b, ...req.body } : b);
  writeDb(db);
  res.json({ success: true });
});

// Manage Blocked Dates
app.post('/api/blocked-dates', (req, res) => {
  const db = readDb();
  const { date } = req.body;
  if (date && !db.blockedDates.includes(date)) {
    db.blockedDates.push(date);
    writeDb(db);
  }
  res.json({ success: true, blockedDates: db.blockedDates });
});

app.delete('/api/blocked-dates/:date', (req, res) => {
  const db = readDb();
  const { date } = req.params;
  db.blockedDates = db.blockedDates.filter(d => d !== date);
  writeDb(db);
  res.json({ success: true, blockedDates: db.blockedDates });
});

// Manage Gallery
app.post('/api/gallery', (req, res) => {
  const db = readDb();
  const newImage = req.body; // { tipo, url }
  db.gallery.push(newImage);
  writeDb(db);
  res.json({ success: true, gallery: db.gallery });
});

app.delete('/api/gallery/:index', (req, res) => {
  const db = readDb();
  const idx = parseInt(req.params.index);
  if (!isNaN(idx)) {
    db.gallery = db.gallery.filter((_, i) => i !== idx);
    writeDb(db);
  }
  res.json({ success: true, gallery: db.gallery });
});

app.put('/api/gallery/reorder', (req, res) => {
  const db = readDb();
  const { from, to } = req.body;
  const g = [...db.gallery];
  if (from >= 0 && from < g.length && to >= 0 && to < g.length) {
    [g[from], g[to]] = [g[to], g[from]];
    db.gallery = g;
    writeDb(db);
  }
  res.json({ success: true, gallery: db.gallery });
});

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
