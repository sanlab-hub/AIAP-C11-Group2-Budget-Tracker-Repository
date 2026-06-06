import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import { ThemeProvider } from './hooks/useTheme';
import { ToastProvider } from './components/Toast';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Dashboard } from './pages/Dashboard';
import { Expenses } from './pages/Expenses';
import { Budgets } from './pages/Budgets';
import { Insights } from './pages/Insights';

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Layout><Dashboard /></Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/expenses"
                element={
                  <ProtectedRoute>
                    <Layout><Expenses /></Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/budgets"
                element={
                  <ProtectedRoute>
                    <Layout><Budgets /></Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/insights"
                element={
                  <ProtectedRoute>
                    <Layout><Insights /></Layout>
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
