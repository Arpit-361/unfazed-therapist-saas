import { Compass } from 'lucide-react';
import Button from '../../components/common/Button';
import Logo from '../../components/common/Logo';

export default function NotFound({ message }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 text-center">
      <Logo className="mb-10" />
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
        <Compass className="h-7 w-7" />
      </div>
      <h1 className="text-2xl font-bold text-slate-900">Page not found</h1>
      <p className="mt-2 max-w-sm text-sm text-slate-500">{message || "The page you're looking for doesn't exist or may have moved."}</p>
      <Button to="/" className="mt-6">
        Back to home
      </Button>
    </div>
  );
}
