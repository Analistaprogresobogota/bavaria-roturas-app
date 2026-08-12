// Proceso principal de Electron: abre una ventana con la app ya compilada
// (dist/index.html, version autocontenida). CommonJS (.cjs) a proposito.
const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

function crearVentana() {
  const ventana = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'App Roturas CD',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  Menu.setApplicationMenu(null);
  ventana.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
}

app.whenReady().then(crearVentana);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) crearVentana();
});
