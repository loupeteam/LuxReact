import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { MachineProvider } from 'lux-react';
import { App } from './App';
import { machine } from './machine';

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

createRoot(root).render(
  // <StrictMode>
    <BrowserRouter>
      <MachineProvider id="demo" machine={machine}>
        <App />
      </MachineProvider>
    </BrowserRouter>
  // </StrictMode>,
);
