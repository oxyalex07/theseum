import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { MemoryProvider } from './state/memory-context';
import { AppProvider } from './state/app-context';
import { SamplePreviewProvider } from './state/sample-preview';
import './styles.css';
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><SamplePreviewProvider><MemoryProvider><AppProvider><App/></AppProvider></MemoryProvider></SamplePreviewProvider></React.StrictMode>);
