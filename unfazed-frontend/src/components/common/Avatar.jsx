import { initials } from '../../utils/format';

const PALETTE = ['bg-brand-100 text-brand-800', 'bg-sky-100 text-sky-800', 'bg-violet-100 text-violet-800', 'bg-amber-100 text-amber-800', 'bg-rose-100 text-rose-800', 'bg-emerald-100 text-emerald-800'];
const SIZES = { xs: 'h-7 w-7 text-[10px]', sm: 'h-9 w-9 text-xs', md: 'h-11 w-11 text-sm', lg: 'h-16 w-16 text-lg', xl: 'h-28 w-28 text-3xl' };

export default function Avatar({ name = '', src, size = 'md', className = '' }) {
  const color = PALETTE[[...name].reduce((sum, c) => sum + c.charCodeAt(0), 0) % PALETTE.length];
  if (src) {
    return <img src={src} alt={name} className={`shrink-0 rounded-full object-cover ${SIZES[size]} ${className}`} />;
  }
  return (
    <div className={`flex shrink-0 items-center justify-center rounded-full font-semibold ${color} ${SIZES[size]} ${className}`}>
      {initials(name) || '?'}
    </div>
  );
}
