import { useState } from 'react';
import { login } from '../../datos/usuariosProveedor.js';
import { useSession } from '../../contexto/useSession.js';

export function VistaLogin() {
  const { entrar } = useSession();
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    if (!usuario || !password) {
      setError('Escribe usuario y contraseña.');
      return;
    }
    setCargando(true);
    setError('');
    try {
      const encontrado = await login(usuario, password);
      if (!encontrado) {
        setError('Usuario o contraseña incorrectos.');
        return;
      }
      entrar(encontrado);
    } catch {
      setError('No se pudo validar el usuario. Intenta de nuevo.');
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="loginwrap">
      <form className="logincard" onSubmit={enviar}>
        <div className="logo">IM</div>
        <h1>App de Roturas · CD</h1>
        <p className="sub" style={{ textAlign: 'center' }}>
          Ingeniería en Manualidades &amp; Logística · Progreso
        </p>
        <label>Usuario</label>
        <input
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
          placeholder="tu usuario"
          autoComplete="username"
          autoCapitalize="none"
        />
        <label>Contraseña</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••"
          autoComplete="current-password"
        />
        {error && <div className="loginerr">{error}</div>}
        <div className="navbtns">
          <button type="submit" className="btn btn-p" disabled={cargando}>
            {cargando ? 'Entrando…' : 'Entrar'}
          </button>
        </div>
      </form>
    </div>
  );
}
