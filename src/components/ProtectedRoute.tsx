import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-primary-900 flex flex-col items-center justify-center gap-4">
        <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-gold-400/40 shadow-xl bg-white">
          <img
            src="/SpendSheriff-Budget_Tracker-New-Logo-77KB.jpg"
            alt="SpendSheriff"
            className="w-full h-full object-cover"
            style={{ objectPosition: '50% 10%', transform: 'scale(1.25)', transformOrigin: '50% 15%' }}
          />
        </div>
        <div className="flex flex-col items-center gap-1">
          <p className="text-lg font-bold text-white tracking-tight">
            Spend<span className="text-gold-400">Sheriff</span>
          </p>
          <div className="w-6 h-6 border-2 border-gold-400 border-t-transparent rounded-full animate-spin mt-2" />
        </div>
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
