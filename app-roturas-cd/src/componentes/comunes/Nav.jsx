export function Nav({ tabs, activo, onCambiar }) {
  if (tabs.length <= 1) return null;
  return (
    <nav>
      {tabs.map((t) => (
        <button key={t.id} className={activo === t.id ? 'on' : ''} onClick={() => onCambiar(t.id)}>
          <span className="ic">{t.icono}</span>
          {t.etiqueta}
        </button>
      ))}
    </nav>
  );
}
