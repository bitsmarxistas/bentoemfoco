import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';
import { ProvedorTema } from './contextos/TemaContexto';
import './estilos.css';

const raiz = document.getElementById('raiz');
if (!raiz) throw new Error('elemento #raiz não encontrado');

createRoot(raiz).render(
  <StrictMode>
    <ProvedorTema>
      <App />
    </ProvedorTema>
  </StrictMode>,
);
