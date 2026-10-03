export default function Tabs({ tabs, value, onChange, className = '' }) {
  return (
    <div className={`-mx-1 mb-5 flex gap-1 overflow-x-auto border-b border-slate-200 px-1 ${className}`}>
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            onClick={() => onChange(tab.value)}
            className={`relative -mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition ${
              active ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {tab.icon && <tab.icon className="h-4 w-4" />}
            {tab.label}
            {tab.count !== undefined && (
              <span className={`rounded-full px-1.5 text-xs ${active ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-500'}`}>{tab.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
