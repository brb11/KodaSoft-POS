import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { useLanguageStore } from './stores/languageStore';
import './index.css';

const { language } = useLanguageStore.getState();
document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
document.documentElement.lang = language;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
