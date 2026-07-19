/* KID PARK — Icon component */
export function Icon({ icones, name, size = '1em', className = '' }) {
  const ic = icones?.[name] || {};
  if (ic.url) {
    return <img src={ic.url} alt="" className={`kp-icon ${className}`} style={{ width: size, height: size, objectFit: 'contain', verticalAlign: 'middle', display: 'inline-block' }} />;
  }
  return <span className={`kp-icon ${className}`} style={{ fontSize: size, lineHeight: 1 }}>{ic.def || '•'}</span>;
}
