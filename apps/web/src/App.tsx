import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LoginPage } from './app/auth/LoginPage';
import { RegisterPage } from './app/auth/RegisterPage';
import { PosTerminal } from './app/pos/PosTerminal';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { ProductsPage } from './app/dashboard/ProductsPage';
import { CategoriesPage } from './app/dashboard/CategoriesPage';
import { InventoryPage } from './app/dashboard/InventoryPage';
import { ReportsPage } from './app/dashboard/ReportsPage';
import { UsersPage } from './app/dashboard/UsersPage';
import { CustomersPage } from './app/dashboard/CustomersPage';
import { BranchesPage } from './app/dashboard/BranchesPage';
import { SettingsPage } from './app/dashboard/SettingsPage';
import { SaasConsole } from './app/saas/SaasConsole';
import { SubscriptionGuard } from './components/guards/SubscriptionGuard';
import { useAuthStore } from './stores/authStore';

const queryClient = new QueryClient();

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const accessToken = useAuthStore((s) => s.accessToken);
  if (!accessToken) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const SuperAdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const accessToken = useAuthStore((s) => s.accessToken);
  const role = useAuthStore((s) => s.user?.role);
  if (!accessToken) return <Navigate to="/login" replace />;
  if (role !== 'SUPER_ADMIN') return <Navigate to="/pos" replace />;
  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/saas"
            element={
              <SuperAdminRoute>
                <SaasConsole />
              </SuperAdminRoute>
            }
          />
          <Route
            path="/pos"
            element={
              <ProtectedRoute>
                <SubscriptionGuard>
                  <PosTerminal />
                </SubscriptionGuard>
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/products"
            element={
              <ProtectedRoute>
                <SubscriptionGuard>
                  <DashboardLayout>
                    <ProductsPage />
                  </DashboardLayout>
                </SubscriptionGuard>
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/categories"
            element={
              <ProtectedRoute>
                <SubscriptionGuard>
                  <DashboardLayout>
                    <CategoriesPage />
                  </DashboardLayout>
                </SubscriptionGuard>
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/reports"
            element={
              <ProtectedRoute>
                <SubscriptionGuard>
                  <DashboardLayout>
                    <ReportsPage />
                  </DashboardLayout>
                </SubscriptionGuard>
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/inventory"
            element={
              <ProtectedRoute>
                <SubscriptionGuard>
                  <DashboardLayout>
                    <InventoryPage />
                  </DashboardLayout>
                </SubscriptionGuard>
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/users"
            element={
              <ProtectedRoute>
                <SubscriptionGuard>
                  <DashboardLayout>
                    <UsersPage />
                  </DashboardLayout>
                </SubscriptionGuard>
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/customers"
            element={
              <ProtectedRoute>
                <SubscriptionGuard>
                  <DashboardLayout>
                    <CustomersPage />
                  </DashboardLayout>
                </SubscriptionGuard>
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/branches"
            element={
              <ProtectedRoute>
                <SubscriptionGuard>
                  <DashboardLayout>
                    <BranchesPage />
                  </DashboardLayout>
                </SubscriptionGuard>
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/settings"
            element={
              <ProtectedRoute>
                <DashboardLayout>
                  <SettingsPage />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/pos" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
};
