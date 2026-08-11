import React from 'react';
import { Clock, CalendarDays } from 'lucide-react';
import { useLanguageStore } from '../../../stores/languageStore';

export const LiveClock: React.FC = () => {
  const { language } = useLanguageStore();
  const [now, setNow] = React.useState(new Date());

  React.useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(tick);
  }, []);

  const locale = language === 'ar' ? 'ar-SA' : 'en-US';

  return (
    <>
      <div className="flex items-center gap-1.5">
        <Clock className="w-3.5 h-3.5 text-slate-400" />
        <span className="font-bold text-slate-700 tabular-nums">
          {now.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: true })}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
        <span className="font-bold text-slate-700">
          {now.toLocaleDateString(locale, { weekday: 'long', year: 'numeric', month: '2-digit', day: '2-digit' })}
        </span>
      </div>
    </>
  );
};
