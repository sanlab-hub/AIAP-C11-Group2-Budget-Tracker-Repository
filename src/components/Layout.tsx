import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, CreditCard, Target, Sparkles, Sun, Moon, LogOut, Menu, X,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';

const NAV = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/expenses', icon: CreditCard, label: 'Expenses' },
  { to: '/budgets', icon: Target, label: 'Budgets' },
  { to: '/insights', icon: Sparkles, label: 'AI Insights' },
];

/** Cropped mascot avatar – shows the sheriff character from the logo */
function SheriffAvatar({ size }: { size: 'sm' | 'md' | 'lg' }) {
  const dims = size === 'sm' ? 'w-8 h-8' : size === 'md' ? 'w-10 h-10' : 'w-14 h-14';
  return (
    <div className={`${dims} rounded-xl overflow-hidden flex-shrink-0 bg-white border border-gold-200/60 dark:border-gold-700/30 shadow-sm`}>
      <img
        src="/SpendSheriff-Budget_Tracker-New-Logo-77KB.jpg"
        alt="SpendSheriff"
        className="w-full h-full object-cover"
        style={{ objectPosition: '50% 12%', transform: 'scale(1.35)', transformOrigin: '50% 20%' }}
        loading="eager"
        decoding="async"
      />
    </div>
  );
}

function NavItem({
  to, icon: Icon, label, onClick,
}: {
  to: string; icon: typeof LayoutDashboard; label: string; onClick?: () => void;
}) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        `group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
          isActive
            ? 'bg-primary-600 text-white shadow-sm shadow-primary-900/20'
            : 'text-gray-600 dark:text-gray-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:text-primary-700 dark:hover:text-primary-300'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <Icon className={`w-5 h-5 flex-shrink-0 transition-transform duration-150 ${isActive ? '' : 'group-hover:scale-110'}`} />
          <span>{label}</span>
        </>
      )}
    </NavLink>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const initials = user?.email?.slice(0, 2).toUpperCase() ?? 'SS';

  return (
    <div className="min-h-screen flex bg-gray-50 dark:bg-gray-950">

      {/* ── Desktop sidebar ─────────────────────────────────────────── */}
      <aside className="hidden lg:flex flex-col w-64 bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 fixed inset-y-0 z-30">

        {/* Brand header */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-100 dark:border-gray-800">
          <SheriffAvatar size="md" />
          <div className="min-w-0">
            <span className="font-bold text-primary-700 dark:text-primary-300 text-[15px] leading-none tracking-tight">
              Spend<span className="text-gold-500">Sheriff</span>
            </span>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 leading-tight truncate">
              Your budget is under protection.
            </p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-600 uppercase tracking-widest px-3 mb-2">
            Navigation
          </p>
          {NAV.map(item => <NavItem key={item.to} {...item} />)}
        </nav>

        {/* Bottom controls */}
        <div className="px-3 py-3 border-t border-gray-100 dark:border-gray-800 space-y-0.5">
          <button
            onClick={toggle}
            className="w-full group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200 transition-all"
          >
            {theme === 'dark'
              ? <Sun className="w-5 h-5 group-hover:rotate-12 transition-transform" />
              : <Moon className="w-5 h-5 group-hover:-rotate-12 transition-transform" />}
            {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </button>
          <button
            onClick={handleSignOut}
            className="w-full group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-error-50 dark:hover:bg-error-900/20 hover:text-error-600 dark:hover:text-error-400 transition-all"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>

          {/* User row */}
          <div className="flex items-center gap-3 px-3 py-2.5 mt-1">
            <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center flex-shrink-0 border border-primary-200 dark:border-primary-800">
              <span className="text-xs font-bold text-primary-700 dark:text-primary-300">{initials}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{user?.email}</p>
              <p className="text-[10px] text-gray-400">Free plan</p>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Mobile top header ────────────────────────────────────────── */}
      <div className="lg:hidden fixed top-0 inset-x-0 z-40 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center justify-between px-4 h-14">
          {/* Logo row */}
          <div className="flex items-center gap-2">
            <SheriffAvatar size="sm" />
            <span className="font-bold text-primary-700 dark:text-primary-300 text-[14px] tracking-tight">
              Spend<span className="text-gold-500">Sheriff</span>
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={toggle}
              className="p-2 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button
              onClick={() => setMobileOpen(o => !o)}
              className="p-2 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile slide-down menu */}
      {mobileOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 z-30 bg-black/30 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="lg:hidden fixed top-14 left-0 right-0 z-40 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-3 py-3 shadow-xl space-y-0.5">
            {NAV.map(item => (
              <NavItem key={item.to} {...item} onClick={() => setMobileOpen(false)} />
            ))}
            <div className="h-px bg-gray-100 dark:bg-gray-800 my-2" />
            <div className="flex items-center gap-3 px-3 py-2">
              <div className="w-7 h-7 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center flex-shrink-0 border border-primary-200 dark:border-primary-800">
                <span className="text-xs font-bold text-primary-700 dark:text-primary-300">{initials}</span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate flex-1">{user?.email}</p>
              <button
                onClick={handleSignOut}
                className="text-error-500 hover:text-error-700 p-1 rounded-lg hover:bg-error-50 dark:hover:bg-error-900/20 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Mobile bottom tab bar ─────────────────────────────────────── */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border-t border-gray-100 dark:border-gray-800 flex">
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 transition-colors ${
                isActive
                  ? 'text-primary-600 dark:text-primary-400'
                  : 'text-gray-400 dark:text-gray-600'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110' : ''}`} />
                <span className={`text-[10px] font-medium ${isActive ? 'opacity-100' : 'opacity-70'}`}>
                  {label.split(' ')[0]}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>

      {/* ── Main content ──────────────────────────────────────────────── */}
      <main className="flex-1 lg:ml-64 min-h-screen">
        <div className="pt-14 pb-20 lg:pt-0 lg:pb-0">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
