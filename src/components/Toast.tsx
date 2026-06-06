import { createContext, useCallback, useContext, useState, ReactNode, useEffect, useRef } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextType {
  toast: (type: ToastType, message: string) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextType>({
  toast: () => {},
  success: () => {},
  error: () => {},
  warning: () => {},
  info: () => {},
});

const ICONS: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle className="w-4 h-4 text-success-500 flex-shrink-0" />,
  error: <XCircle className="w-4 h-4 text-error-500 flex-shrink-0" />,
  warning: <AlertTriangle className="w-4 h-4 text-warning-500 flex-shrink-0" />,
  info: <Info className="w-4 h-4 text-primary-500 flex-shrink-0" />,
};

const STYLES: Record<ToastType, string> = {
  success: 'border-success-200 dark:border-success-800/50',
  error: 'border-error-200 dark:border-error-800/50',
  warning: 'border-warning-200 dark:border-warning-800/50',
  info: 'border-primary-200 dark:border-primary-800/50',
};

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: () => void }) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    timerRef.current = setTimeout(() => {
      setVisible(false);
      setTimeout(onRemove, 300);
    }, 4000);
    return () => clearTimeout(timerRef.current);
  }, []);

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-900 border rounded-xl shadow-lg shadow-black/5 transition-all duration-300 min-w-[280px] max-w-sm ${
        STYLES[toast.type]
      } ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}
    >
      {ICONS[toast.type]}
      <p className="text-sm text-gray-700 dark:text-gray-200 flex-1">{toast.message}</p>
      <button
        onClick={() => { setVisible(false); setTimeout(onRemove, 300); }}
        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex-shrink-0"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = useCallback((type: ToastType, message: string) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts(prev => [...prev.slice(-4), { id, type, message }]);
  }, []);

  const value: ToastContextType = {
    toast,
    success: (m) => toast('success', m),
    error: (m) => toast('error', m),
    warning: (m) => toast('warning', m),
    info: (m) => toast('info', m),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem toast={t} onRemove={() => remove(t.id)} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
