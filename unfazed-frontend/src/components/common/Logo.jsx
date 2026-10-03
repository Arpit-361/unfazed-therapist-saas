import { Link } from 'react-router-dom';

export default function Logo({ to = '/', light = false, className = '' }) {
  return (
    <Link to={to} className={`inline-flex items-center gap-2 ${className}`}>
      <svg viewBox="0 0 64 64" className="h-8 w-8" aria-hidden="true">
        <rect width="64" height="64" rx="16" fill="#0d7e74" />
        <path d="M18 20v14a14 14 0 0 0 28 0V20" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" />
        <circle cx="46" cy="14" r="4" fill="#5bd6c4" />
      </svg>
      <span className={`text-lg font-bold tracking-tight ${light ? 'text-white' : 'text-slate-900'}`}>unfazed</span>
    </Link>
  );
}
