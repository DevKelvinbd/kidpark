-- Criar tabela de configurações gerais
CREATE TABLE IF NOT EXISTS kp_settings (
  id INT PRIMARY KEY,
  config JSONB NOT NULL,
  pix JSONB NOT NULL,
  blocked_dates JSONB NOT NULL,
  gallery JSONB NOT NULL,
  items JSONB NOT NULL
);

-- Inserir dados padrão caso a tabela esteja vazia
INSERT INTO kp_settings (id, config, pix, blocked_dates, gallery, items)
VALUES (1, '{
  "brandName": "Kid Park",
  "heroLede": "Duas piscinas, salão amplo, cozinha equipada e estrutura completa pra você só se preocupar com os convidados.",
  "stat1": "2", "stat1lbl": "Piscinas",
  "stat2": "120", "stat2lbl": "Convidados",
  "stat3": "8h", "stat3lbl": "de festa",
  "whatsapp": "5585999999999",
  "whatsappLabel": "(85) 99999-9999",
  "instagram": "https://instagram.com/kidpark",
  "instagramLabel": "@kidpark",
  "youtube": "https://youtube.com/@kidpark",
  "youtubeLabel": "@kidpark",
  "email": "contato@kidpark.com.br",
  "endereco": "Av. das Festas, 100 — Madalena, CE",
  "adminPass": "kidpark2026",
  "horaInicioManha": "08:00", "horaFimManha": "17:00",
  "horaInicioTarde": "12:00", "horaFimTarde": "00:00",
  "horaInicioDia": "08:00", "horaFimDia": "00:00",
  "precoHoraExtra": 100,
  "contratoText": "CONTRATO DE LOCAÇÃO DE ESPAÇO PARA EVENTOS\n\n1. OBJETO\nO presente contrato tem por objeto a locação temporária do espaço Kid Park para a realização do evento indicado pelo contratante.\n\n2. VALOR E PAGAMENTO\nO valor total da locação é definido de acordo com o plano e itens adicionais selecionados.\nO agendamento só é confirmado mediante o pagamento de um SINAL correspondente a 50% (cinquenta por cento) do valor total.\nO saldo restante de 50% deverá ser pago impreterivelmente até o dia do evento, antes da liberação da entrada.\n\n3. CANCELAMENTO E DESISTÊNCIA\nEm caso de desistência por parte do contratante, o valor do sinal não será devolvido, podendo ser utilizado para reagendamento futuro conforme disponibilidade, desde que solicitado com no mínimo 15 dias de antecedência.\n\n4. RESPONSABILIDADE POR DANOS\nO contratante responsabiliza-se por quaisquer danos causados ao patrimônio do Kid Park durante o período da locação.",
  "icones": {
    "logo": {"def": "🏊", "url": ""},
    "step1": {"def": "🗓️", "url": ""},
    "step2": {"def": "🎉", "url": ""},
    "step3": {"def": "💳", "url": ""},
    "contactWA": {"def": "💬", "url": ""},
    "contactIG": {"def": "📷", "url": ""},
    "contactYT": {"def": "▶️", "url": ""},
    "contactAddr": {"def": "📍", "url": ""},
    "catPacote": {"def": "📦", "url": ""},
    "catEspaco": {"def": "🏊", "url": ""},
    "catEquip": {"def": "🔌", "url": ""},
    "catExtra": {"def": "✨", "url": ""},
    "heroEmpty1": {"def": "🏊", "url": ""},
    "heroEmpty2": {"def": "🎈", "url": ""},
    "heroEmpty3": {"def": "🎂", "url": ""}
  }
}', '{}', '[]', '[]', '[
  {"id": "pkg1", "nome": "Plano 1 · Salão", "categoria": "pacote", "desc": "Salão amplo, sem piscinas. Ideal pra reuniões e festas menores.", "preco": 450, "unidade": "diaria", "ativo": true, "imagemUrl": ""},
  {"id": "pkg2", "nome": "Plano 2 · Salão + 2 piscinas", "categoria": "pacote", "desc": "A festa completa: salão com as duas piscinas liberadas.", "preco": 800, "unidade": "diaria", "ativo": true, "imagemUrl": ""},
  {"id": "pkg3", "nome": "Plano 3 · Tudo incluso", "categoria": "pacote", "desc": "Salão + piscinas + mesas, cadeiras, som, fogão e freezer.", "preco": 1200, "unidade": "diaria", "ativo": true, "imagemUrl": ""},
  {"id": "esp1", "nome": "Mesas e cadeiras", "categoria": "equipamento", "desc": "10 mesas + 60 cadeiras de plástico, prontas para o evento.", "preco": 120, "unidade": "diaria", "ativo": true, "imagemUrl": ""},
  {"id": "esp2", "nome": "Som ambiente", "categoria: "equipamento", "desc": "Caixa de som amplificada com microfone e cabo auxiliar.", "preco": 150, "unidade": "diaria", "ativo": true, "imagemUrl": ""},
  {"id": "esp3", "nome": "Fogão + botijão", "categoria": "equipamento", "desc": "Fogão de 4 bocas com gás incluso. Pronto pra cozinhar no local.", "preco": 80, "unidade": "diaria", "ativo": true, "imagemUrl": ""},
  {"id": "esp4", "nome": "Freezer", "categoria": "equipamento", "desc": "Freezer 300L pra bebidas e gelo. Liga e usa.", "preco": 70, "unidade": "diaria", "ativo": true, "imagemUrl": ""}
]')
ON CONFLICT (id) DO NOTHING;

-- Criar tabela de reservas
CREATE TABLE IF NOT EXISTS kp_bookings (
  id TEXT PRIMARY KEY,
  verificacao TEXT NOT NULL,
  data TEXT NOT NULL,
  slot TEXT NOT NULL,
  horas_extras INT NOT NULL DEFAULT 0,
  preco_hora_extra NUMERIC NOT NULL DEFAULT 0,
  items JSONB NOT NULL DEFAULT '[]',
  total NUMERIC NOT NULL,
  cliente_nome TEXT NOT NULL,
  cliente_tel TEXT NOT NULL,
  cliente_cpf TEXT NOT NULL,
  cliente_nascimento TEXT NOT NULL,
  cliente_endereco TEXT NOT NULL,
  cliente_evento TEXT,
  cliente_obs TEXT,
  contrato JSONB NOT NULL DEFAULT '{"assinado": false, "fotoBase64": "", "dataAssinatura": ""}',
  status TEXT NOT NULL DEFAULT 'aguardando_sinal',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
