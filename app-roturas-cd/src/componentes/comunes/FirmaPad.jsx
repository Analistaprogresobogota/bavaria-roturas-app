import { useEffect, useRef, useState } from 'react';

// Firma electrónica dibujada a mano (mouse o dedo) sobre un <canvas>, se
// entrega al padre como PNG en base64 vía onChange. Usa un `key` distinto
// desde el padre si necesitas forzar que quede en blanco de nuevo (p.ej.
// después de guardar un reporte) — no expone un método de "reset" propio.
export function FirmaPad({ onChange, error }) {
  const canvasRef = useRef(null);
  const dibujando = useRef(false);
  const [vacio, setVacio] = useState(true);

  useEffect(() => {
    const ctx = canvasRef.current.getContext('2d');
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#1b2733';
  }, []);

  function posicion(e) {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const punto = e.touches ? e.touches[0] : e;
    return {
      x: ((punto.clientX - rect.left) / rect.width) * canvas.width,
      y: ((punto.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function empezar(e) {
    e.preventDefault();
    dibujando.current = true;
    const { x, y } = posicion(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function mover(e) {
    if (!dibujando.current) return;
    e.preventDefault();
    const { x, y } = posicion(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.lineTo(x, y);
    ctx.stroke();
    setVacio(false);
  }

  function terminar() {
    if (!dibujando.current) return;
    dibujando.current = false;
    onChange(canvasRef.current.toDataURL('image/png'));
  }

  function limpiar() {
    const canvas = canvasRef.current;
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    setVacio(true);
    onChange('');
  }

  return (
    <div>
      <div className={`firmabox ${error ? 'err' : ''}`}>
        <canvas
          ref={canvasRef}
          width={600}
          height={200}
          onMouseDown={empezar}
          onMouseMove={mover}
          onMouseUp={terminar}
          onMouseLeave={terminar}
          onTouchStart={empezar}
          onTouchMove={mover}
          onTouchEnd={terminar}
        />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
        <span className="help">{vacio ? 'Dibuja la firma con el dedo o el mouse' : '✓ Firma capturada'}</span>
        <button type="button" className="linkbtn" onClick={limpiar}>
          Limpiar
        </button>
      </div>
    </div>
  );
}
