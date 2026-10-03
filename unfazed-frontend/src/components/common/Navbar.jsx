import Logo from './Logo';
import Button from './Button';
import { useAuth } from '../../context/AuthContext';

export default function Navbar() {
  const { user, isTherapist } = useAuth();
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <nav className="flex items-center gap-2">
          {user ? (
            <Button to={isTherapist ? '/dashboard' : '/portal'} size="sm">
              {isTherapist ? 'Go to dashboard' : 'My portal'}
            </Button>
          ) : (
            <>
              <Button to="/portal/login" variant="ghost" size="sm" className="max-sm:hidden">
                Client login
              </Button>
              <Button to="/login" variant="secondary" size="sm">
                Therapist login
              </Button>
              <Button to="/register" size="sm" className="max-sm:hidden">
                Start free
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
