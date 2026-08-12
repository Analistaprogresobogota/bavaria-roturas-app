import { useEffect, useState } from 'react';
import { listarUsuarios, crearUsuario, actualizarUsuario } from '../../datos/usuariosProveedor.js';
import { mostrarToast } from '../comunes/Toast.jsx';

const VACIO = { nombre: '', usuario: '', password: '', rol: 'operativo' };

export function VistaUsuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [form, setForm] = useState(VACIO);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  async function recargar() {
    setUsuarios(await listarUsuarios());
    setCargando(false);
  }

  useEffect(() => {
    recargar();
  }, []);

  async function crear(e) {
    e.preventDefault();
    if (!form.nombre || !form.usuario || !form.password) {
      mostrarToast('Completa nombre, usuario y contraseña', 'err');
      return;
    }
    setGuardando(true);
    try {
      await crearUsuario(form);
      mostrarToast(`✓ Usuario "${form.usuario}" creado`, 'ok');
      setForm(VACIO);
      recargar();
    } catch (err) {
      mostrarToast(err.message?.includes('duplicate') ? 'Ese usuario ya existe' : 'No se pudo crear el usuario', 'err');
    } finally {
      setGuardando(false);
    }
  }

  async function cambiarRol(u, rol) {
    await actualizarUsuario(u.id, { rol });
    recargar();
  }

  async function alternarActivo(u) {
    await actualizarUsuario(u.id, { activo: !u.activo });
    mostrarToast(u.activo ? 'Usuario desactivado' : 'Usuario activado', u.activo ? 'err' : 'ok');
    recargar();
  }

  return (
    <section className="section on">
      <div className="card">
        <div className="modtag">
          <i>👥</i>Cuentas
        </div>
        <h2 className="ct">Nuevo usuario</h2>
        <p className="sub">Cualquier persona que necesite entrar a la app (operativo, supervisor o admin) necesita una cuenta aquí.</p>
        <form onSubmit={crear} className="grid">
          <div>
            <label>Nombre completo</label>
            <input value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} placeholder="Nombre y apellido" />
          </div>
          <div>
            <label>Usuario (login)</label>
            <input value={form.usuario} onChange={(e) => setForm((f) => ({ ...f, usuario: e.target.value }))} placeholder="ej. jperez" autoCapitalize="none" />
          </div>
          <div>
            <label>Contraseña</label>
            <input value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} placeholder="Contraseña" />
          </div>
          <div>
            <label>Rol</label>
            <select value={form.rol} onChange={(e) => setForm((f) => ({ ...f, rol: e.target.value }))}>
              <option value="operativo">Operativo</option>
              <option value="supervisor">Supervisor</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="full navbtns">
            <button className="btn btn-p" type="submit" disabled={guardando}>
              {guardando ? 'Creando…' : '+ Crear usuario'}
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <div className="modtag">
          <i>{usuarios.length}</i>Cuentas existentes
        </div>
        <h2 className="ct">Usuarios</h2>
        {cargando ? (
          <p className="help">Cargando…</p>
        ) : (
          <div className="tablewrap" style={{ boxShadow: 'none' }}>
            <table className="userstable">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Usuario</th>
                  <th>Rol</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map((u) => (
                  <tr key={u.id} className={u.activo ? '' : 'inactivo'}>
                    <td>{u.nombre}</td>
                    <td>{u.usuario}</td>
                    <td>
                      <select value={u.rol} onChange={(e) => cambiarRol(u, e.target.value)}>
                        <option value="operativo">Operativo</option>
                        <option value="supervisor">Supervisor</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td>
                      <span className={`rolechip ${u.activo ? 'operativo' : ''}`}>{u.activo ? 'Activo' : 'Inactivo'}</span>
                    </td>
                    <td>
                      <button className={`linkbtn ${u.activo ? 'danger' : ''}`} onClick={() => alternarActivo(u)}>
                        {u.activo ? 'Desactivar' : 'Activar'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
