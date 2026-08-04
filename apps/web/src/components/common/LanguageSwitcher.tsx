import React from 'react';
import { useLanguageStore } from '../../stores/languageStore';
import { Globe } from 'lucide-react';

export const LanguageSwitcher: React.FC = () => {
  const { language, setLanguage } = useLanguageStore();

  return (
    <button
      onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-extrabold transition-all border border-slate-200"
      title="Switch Language / تغيير اللغة"
    >
      <Globe className="w-3.5 h-3.5 text-cyan-600" />
      <span>{language === 'ar' ? 'English' : 'العربية'}</span>
    </button>
  );
};
