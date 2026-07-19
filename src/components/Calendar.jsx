/* KID PARK — Calendar component */
import { useState } from 'react';
import { pad, todayStr } from '../lib/utils';

const MONTHS = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const WD = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

export default function Calendar({ selected, onSelect, bookings = [], blockedDates = [] }) {
  const [cursor, setCursor] = useState(new Date());
  const y = cursor.getFullYear(), m = cursor.getMonth();
  const firstDay = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const daysPrev = new Date(y, m, 0).getDate();
  const today = todayStr();

  const cells = [];
  for (let i = firstDay - 1; i >= 0; i--) cells.push({ day: daysPrev - i, other: true });
  for (let d = 1; d <= daysInMonth; d++) {
    const ymd = `${y}-${pad(m + 1)}-${pad(d)}`;
    const past = ymd < today;
    const blocked = blockedDates.includes(ymd);
    const hasBooking = bookings.some(b => b.data === ymd && b.status !== 'cancelled');
    cells.push({ day: d, ymd, past, blocked, fullDay: hasBooking, isToday: ymd === today });
  }
  while (cells.length % 7 !== 0) cells.push({ day: cells.length - daysInMonth - firstDay + 1, other: true });

  return (
    <div className="cal">
      <div className="cal-head">
        <button className="cal-nav" onClick={() => setCursor(new Date(y, m - 1, 1))}>‹</button>
        <div className="cal-title">{MONTHS[m]} de {y}</div>
        <button className="cal-nav" onClick={() => setCursor(new Date(y, m + 1, 1))}>›</button>
      </div>
      <div className="cal-grid">
        {WD.map(w => <div key={w} className="cal-wd">{w}</div>)}
        {cells.map((c, i) => {
          if (c.other) return <div key={`o${i}`} className="cal-day other">{c.day}</div>;
          let cls = 'cal-day';
          if (c.past) cls += ' past';
          else if (c.blocked || c.fullDay) cls += ' blocked';
          if (c.isToday) cls += ' today';
          if (selected === c.ymd) cls += ' selected';
          const clickable = !c.past && !c.blocked && !c.fullDay;
          return (
            <div key={c.ymd} className={cls} onClick={clickable ? () => onSelect(c.ymd) : undefined}>
              {c.day}
            </div>
          );
        })}
      </div>
      <div className="cal-legend">
        <span><i style={{ background: '#fff', border: '1px solid var(--line-strong)' }} />Livre</span>
        <span><i style={{ background: 'var(--danger-bg)' }} />Indisponível</span>
        <span><i style={{ background: 'var(--pool)' }} />Selecionado</span>
      </div>
    </div>
  );
}
