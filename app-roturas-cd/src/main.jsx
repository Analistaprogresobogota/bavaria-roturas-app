import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { SessionProvider } from './contexto/SessionContext.jsx';
import App from './App.jsx';
import './estilos/estilos.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <SessionProvider>
      <App />
    </SessionProvider>
  </StrictMode>
);
