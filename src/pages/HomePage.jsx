/* KID PARK — Landing Page */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store';
import { Icon } from '../components/Icon';
import { RevealDiv } from '../hooks/useReveal';
import { fmtMoney } from '../lib/utils';

export default function HomePage() {
  const { state } = useStore();
  const c = state.config;
  const ic = c.icones;
  const nav = useNavigate();
  const [cart, setCart] = useState({});
  const [mobileOpen, setMobileOpen] = useState(false);

  const equipIds = state.items.filter(x => x.categoria === 'equipamento' && x.ativo).map(x => x.id);

  const toggle = id => setCart(prev => {
    const n = { ...prev };
    const item = state.items.find(x => x.id === id);
    if (item?.categoria === 'pacote') {
      // Planos são mutuamente exclusivos: desmarcar outros pacotes
      state.items.filter(x => x.categoria === 'pacote').forEach(p => { delete n[p.id]; });
      // Remover extras auto-selecionados do plano anterior
      equipIds.forEach(eid => { delete n[eid]; });
      if (!prev[id]) {
        n[id] = true;
        // Plano 3 (Tudo incluso): auto-selecionar todos os equipamentos
        if (id === 'pkg3') {
          equipIds.forEach(eid => { n[eid] = 'incluso'; });
        }
      }
    } else {
      // Não deixar desmarcar extras inclusos no Plano 3
      if (prev[id] === 'incluso') return n;
      if (n[id]) delete n[id]; else n[id] = true;
    }
    return n;
  });
  const cartIds = Object.keys(cart);
  const cartTotal = cartIds.reduce((s, id) => {
    if (cart[id] === 'incluso') return s; // já incluso no plano, não cobrar
    const it = state.items.find(x => x.id === id);
    return s + (it ? Number(it.preco) || 0 : 0);
  }, 0);

  const goBooking = () => {
    sessionStorage.setItem('kp_cart', JSON.stringify(cartIds));
    nav('/booking');
  };
  const scrollTo = id => { document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }); setMobileOpen(false); };

  const ativos = state.items.filter(i => i.ativo).sort((a, b) => {
    const o = { pacote: 0, espaco: 1, equipamento: 2, extra: 3 };
    return (o[a.categoria] ?? 9) - (o[b.categoria] ?? 9);
  });

  const contacts = [
    c.whatsapp && { key: 'contactWA', lbl: 'WhatsApp', val: c.whatsappLabel || c.whatsapp, href: `https://wa.me/${c.whatsapp.replace(/\D/g, '')}` },
    c.instagram && { key: 'contactIG', lbl: 'Instagram', val: c.instagramLabel || '@kidpark', href: c.instagram },
    c.youtube && { key: 'contactYT', lbl: 'YouTube', val: c.youtubeLabel || '@kidpark', href: c.youtube },
    c.endereco && { key: 'contactAddr', lbl: 'Endereço', val: c.endereco, href: `https://maps.google.com/?q=${encodeURIComponent(c.endereco)}` },
  ].filter(Boolean);

  const gal = state.gallery.slice(0, 3);
  const heroKeys = ['heroEmpty1', 'heroEmpty2', 'heroEmpty3'];
  const heroSlots = ['c1', 'c2', 'c3'];

  return (
    <>
      {/* HEADER */}
      <header className="topbar">
        <div className="wrap topbar-inner">
          <div className="logo" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="logo-mark"><Icon icones={ic} name="logo" size="24px" /></div>
            <span>{c.brandName}</span>
          </div>
          <nav className="nav-cta">
            <button className="btn btn-ghost" onClick={() => scrollTo('items')}>Espaços</button>
            <button className="btn btn-ghost" onClick={() => scrollTo('contact')}>Contato</button>
            <button className="btn btn-primary" onClick={goBooking}>📅 <span>Reservar</span></button>
            <button className="hamburger" onClick={() => setMobileOpen(!mobileOpen)}>☰</button>
          </nav>
        </div>
      </header>

      {mobileOpen && (
        <div className="mobile-nav show">
          <button className="btn btn-ghost" onClick={() => scrollTo('items')}>Espaços</button>
          <button className="btn btn-ghost" onClick={() => scrollTo('contact')}>Contato</button>
          <button className="btn btn-primary" onClick={goBooking}>📅 Reservar minha data</button>
        </div>
      )}

      {/* HERO */}
      <section className="hero">
        <div className="wrap">
          <div className="hero-grid">
            <div className="hero-copy">
              <RevealDiv><div className="eyebrow">Espaço de festas em Madalena · CE</div></RevealDiv>
              <RevealDiv delay={1}>
                <h1 style={{ marginTop: 14 }}>
                  A festa começa na <em>água</em>.<br />
                  <span className="splash">Termina na</span> memória.
                </h1>
              </RevealDiv>
              <RevealDiv delay={2}><p className="hero-lede">{c.heroLede}</p></RevealDiv>
              <RevealDiv delay={3}>
                <div className="hero-actions">
                  <button className="btn btn-sun" onClick={goBooking} style={{ padding: '14px 24px', fontSize: 15 }}>📅 Reservar minha data</button>
                  <button className="btn btn-ghost" onClick={() => scrollTo('items')} style={{ padding: '14px 24px', fontSize: 15 }}>Ver espaços ↓</button>
                </div>
              </RevealDiv>
              <RevealDiv delay={3}>
                <div className="hero-stats">
                  <div className="hero-stat"><div className="num">{c.stat1}</div><div className="lbl">{c.stat1lbl}</div></div>
                  <div className="hero-stat"><div className="num">{c.stat2}</div><div className="lbl">{c.stat2lbl}</div></div>
                  <div className="hero-stat"><div className="num">{c.stat3}</div><div className="lbl">{c.stat3lbl}</div></div>
                </div>
              </RevealDiv>
            </div>
            <div className="hero-media">
              {heroSlots.map((cls, i) => {
                const g = gal[i];
                if (!g) return <div key={i} className={`hero-card ${cls}`}><div className="empty"><Icon icones={ic} name={heroKeys[i]} size="72px" /></div></div>;
                if (g.tipo === 'video') return <div key={i} className={`hero-card ${cls}`}><video src={g.url} muted loop autoPlay playsInline /></div>;
                return <div key={i} className={`hero-card ${cls}`}><img src={g.url} alt={c.brandName} loading="lazy" /></div>;
              })}
            </div>
          </div>
        </div>
        <svg className="waves" viewBox="0 0 1440 80" preserveAspectRatio="none" aria-hidden="true">
          <path fill="currentColor" d="M0,40 C240,80 480,0 720,40 C960,80 1200,0 1440,40 L1440,80 L0,80 Z" />
        </svg>
      </section>

      {/* HOW IT WORKS */}
      <section className="how" id="how">
        <div className="wrap">
          <div className="section-head">
            <div>
              <RevealDiv><div className="eyebrow">Como funciona</div></RevealDiv>
              <RevealDiv delay={1}><h2 className="h-display" style={{ marginTop: 8 }}>Três passos. Festa garantida.</h2></RevealDiv>
            </div>
          </div>
          <div className="how-grid">
            {[{ key: 'step1', num: '01', title: 'Escolha a data', desc: 'Veja o calendário em tempo real e clique numa data livre. Diurno, tarde/noite ou dia inteiro — você decide.' },
              { key: 'step2', num: '02', title: 'Monte seu combo', desc: 'Salão, piscinas, som, freezer, fogão… escolha o que precisa. O total atualiza na hora.' },
              { key: 'step3', num: '03', title: 'Pague por PIX', desc: 'Recebe a chave e o QR Code. Após o comprovante no WhatsApp, sua data está reservada.' }
            ].map((s, i) => (
              <RevealDiv key={s.key} delay={i} className="how-card">
                <div className="how-icon"><Icon icones={ic} name={s.key} size="40px" /></div>
                <div className="how-num">PASSO {s.num}</div>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </RevealDiv>
            ))}
          </div>
        </div>
      </section>

      {/* ITEMS */}
      <section className="items-section" id="items">
        <div className="wrap">
          <div className="section-head">
            <div>
              <RevealDiv><div className="eyebrow">Pacotes & Espaços</div></RevealDiv>
              <RevealDiv delay={1}><h2 className="h-display" style={{ marginTop: 8 }}>Escolha o que combina com sua festa</h2></RevealDiv>
            </div>
            <RevealDiv><button className="btn btn-primary" onClick={goBooking} style={{ padding: '14px 22px' }}>Reservar agora →</button></RevealDiv>
          </div>
          {(() => {
            const hasPlanSelected = ativos.some(it => it.categoria === 'pacote' && cart[it.id]);
            return (
              <div className={`items-grid ${hasPlanSelected ? 'has-plan-selected' : ''}`}>
                {ativos.length === 0 ? (
                  <div className="empty-state" style={{ gridColumn: '1/-1' }}><div className="ic">📦</div>Nenhum item cadastrado ainda.</div>
                ) : ativos.map((it, i) => {
                  const isPkg = it.categoria === 'pacote';
                  const isSelected = !!cart[it.id];
                  const isIncluso = cart[it.id] === 'incluso';
                  const catKey = { pacote: 'catPacote', espaco: 'catEspaco', equipamento: 'catEquip', extra: 'catExtra' }[it.categoria] || 'catExtra';
                  // Label dinâmico para planos e extras
                  let btnLabel;
                  if (isPkg) {
                    if (isSelected) btnLabel = '✓ Plano escolhido';
                    else if (hasPlanSelected) btnLabel = 'Trocar plano';
                    else btnLabel = 'Escolher plano';
                  } else if (isIncluso) {
                    btnLabel = '✓ Incluso no plano';
                  } else {
                    btnLabel = isSelected ? 'Selecionado' : 'Adicionar';
                  }
                  return (
                    <RevealDiv key={it.id} delay={Math.min(i, 3)} className={`item-card ${isSelected ? 'selected' : ''} ${isPkg ? 'is-package' : ''} ${isIncluso ? 'is-included' : ''}`}>
                      <div className="item-media">
                        {isPkg && <span className="item-badge pkg">{isSelected ? '✓ Escolhido' : '★ Pacote'}</span>}
                        {isIncluso && <span className="item-badge" style={{ background: 'var(--pool)', color: '#fff' }}>✓ Incluso</span>}
                        {it.imagemUrl ? <img src={it.imagemUrl} alt={it.nome} loading="lazy" /> : <div className="placeholder"><Icon icones={ic} name={catKey} size="72px" /></div>}
                      </div>
                      <div className="item-body">
                        <div className="item-name">{it.nome}</div>
                        <div className="item-desc">{it.desc}</div>
                        <div className="item-foot">
                          <div className="item-price">
                            {isIncluso ? <><s style={{ opacity: .5 }}>{fmtMoney(it.preco)}</s> <span style={{ color: 'var(--pool)', fontSize: 13, fontWeight: 600 }}>R$ 0</span></> : fmtMoney(it.preco)}
                            <small>{it.unidade === 'hora' ? 'por hora' : 'por diária'}</small>
                          </div>
                          <button className={`toggle-btn ${isSelected ? 'on' : ''} ${isIncluso ? 'included' : ''}`} onClick={() => toggle(it.id)} style={isIncluso ? { cursor: 'default', opacity: .85 } : {}}>
                            {btnLabel}
                          </button>
                        </div>
                      </div>
                    </RevealDiv>
                  );
                })}
              </div>
            );
          })()}
        </div>
      </section>

      {/* CONTACT */}
      <section className="contact-section" id="contact">
        <div className="wrap">
          <RevealDiv><div className="eyebrow" style={{ color: 'var(--sun)' }}>Vamos conversar</div></RevealDiv>
          <RevealDiv delay={1}><h2 style={{ marginTop: 10 }}>Fale com a gente.</h2></RevealDiv>
          <RevealDiv delay={2}><p className="lede">Dúvida sobre data, capacidade, decoração? Chama no WhatsApp ou mande DM no Instagram.</p></RevealDiv>
          <div className="contact-grid">
            {contacts.map((ct, i) => (
              <RevealDiv key={ct.key} delay={Math.min(i + 1, 3)}>
                <a href={ct.href} target="_blank" rel="noopener noreferrer" className="contact-card">
                  <div className="ic"><Icon icones={ic} name={ct.key} size="42px" /></div>
                  <div className="lbl">{ct.lbl}</div>
                  <div className="val">{ct.val}</div>
                </a>
              </RevealDiv>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="footer">
        <div className="wrap">
          © {new Date().getFullYear()} {c.brandName} · Reservas online · <Link to="/admin">Admin</Link>
        </div>
      </footer>

      {/* CART BAR */}
      <div className={`cart-bar ${cartIds.length > 0 ? 'show' : ''}`}>
        <div className="wrap cart-inner">
          <div className="cart-info">
            <div className="cart-count">{cartIds.length}</div>
            <div className="cart-total">
              <span className="lbl">Total estimado</span>
              <span className="val">{fmtMoney(cartTotal)}</span>
            </div>
          </div>
          <button className="btn btn-sun" onClick={goBooking} style={{ padding: '13px 22px', fontSize: 15 }}>Continuar reserva →</button>
        </div>
      </div>
    </>
  );
}
