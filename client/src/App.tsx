import { Navigate, Route, Routes } from 'react-router-dom';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { RequireAuth } from '@/auth/RequireAuth';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { HomePage } from '@/pages/HomePage';
import { ServicesPage } from '@/pages/ServicesPage';
import { CategoryPage } from '@/pages/CategoryPage';
import { ProvidersPage } from '@/pages/ProvidersPage';
import { ProviderProfilePage } from '@/pages/ProviderProfilePage';
import { HowItWorksPage } from '@/pages/HowItWorksPage';
import { BecomeProviderPage } from '@/pages/BecomeProviderPage';
import { PrivacyPage } from '@/pages/PrivacyPage';
import { TermsPage } from '@/pages/TermsPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { LoginPage } from '@/pages/auth/LoginPage';
import { RegisterPage } from '@/pages/auth/RegisterPage';
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from '@/pages/auth/ResetPasswordPage';
import { VerifyEmailPage } from '@/pages/auth/VerifyEmailPage';
import { CustomerDashboardPage } from '@/pages/customer/CustomerDashboardPage';
import { CustomerRequestsPage } from '@/pages/customer/CustomerRequestsPage';
import { NewRequestPage } from '@/pages/customer/NewRequestPage';
import { FavoritesPage } from '@/pages/customer/FavoritesPage';
import { CustomerProfilePage } from '@/pages/customer/CustomerProfilePage';
import { RequestDetailPage } from '@/pages/requests/RequestDetailPage';
import { ProviderDashboardPage } from '@/pages/provider/ProviderDashboardPage';
import { ProviderRequestsPage } from '@/pages/provider/ProviderRequestsPage';
import { ProviderServicesPage } from '@/pages/provider/ProviderServicesPage';
import { ProviderReviewsPage } from '@/pages/provider/ProviderReviewsPage';
import { ProviderVerificationPage } from '@/pages/provider/ProviderVerificationPage';
import { ProviderProfileSettingsPage } from '@/pages/provider/ProviderProfileSettingsPage';
import { AdminDashboardPage } from '@/pages/admin/AdminDashboardPage';
import { AdminUsersPage } from '@/pages/admin/AdminUsersPage';
import { AdminProvidersPage } from '@/pages/admin/AdminProvidersPage';
import { AdminVerificationsPage } from '@/pages/admin/AdminVerificationsPage';
import { AdminCategoriesPage } from '@/pages/admin/AdminCategoriesPage';
import { AdminLocationsPage } from '@/pages/admin/AdminLocationsPage';
import { AdminReviewsPage } from '@/pages/admin/AdminReviewsPage';
import { AdminReportsPage } from '@/pages/admin/AdminReportsPage';
import { AdminAuditPage } from '@/pages/admin/AdminAuditPage';

export function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<HomePage />} />
        <Route path="services" element={<ServicesPage />} />
        <Route path="services/:categorySlug" element={<CategoryPage />} />
        <Route path="providers" element={<ProvidersPage />} />
        <Route path="providers/:providerId" element={<ProviderProfilePage />} />
        <Route path="how-it-works" element={<HowItWorksPage />} />
        <Route path="become-a-provider" element={<BecomeProviderPage />} />
        <Route path="privacy" element={<PrivacyPage />} />
        <Route path="terms" element={<TermsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />

      <Route element={<RequireAuth roles={['CUSTOMER']} />}>
        <Route element={<DashboardLayout role="CUSTOMER" />}>
          <Route path="/customer" element={<Navigate to="/customer/dashboard" replace />} />
          <Route path="/customer/dashboard" element={<CustomerDashboardPage />} />
          <Route path="/customer/requests" element={<CustomerRequestsPage />} />
          <Route path="/customer/requests/new" element={<NewRequestPage />} />
          <Route path="/customer/requests/:requestId" element={<RequestDetailPage />} />
          <Route path="/customer/favorites" element={<FavoritesPage />} />
          <Route path="/customer/profile" element={<CustomerProfilePage />} />
        </Route>
      </Route>

      <Route element={<RequireAuth roles={['PROVIDER']} />}>
        <Route element={<DashboardLayout role="PROVIDER" />}>
          <Route path="/provider" element={<Navigate to="/provider/dashboard" replace />} />
          <Route path="/provider/dashboard" element={<ProviderDashboardPage />} />
          <Route path="/provider/requests" element={<ProviderRequestsPage />} />
          <Route path="/provider/requests/:requestId" element={<RequestDetailPage />} />
          <Route path="/provider/services" element={<ProviderServicesPage />} />
          <Route path="/provider/reviews" element={<ProviderReviewsPage />} />
          <Route path="/provider/verification" element={<ProviderVerificationPage />} />
          <Route path="/provider/profile" element={<ProviderProfileSettingsPage />} />
        </Route>
      </Route>

      <Route element={<RequireAuth roles={['ADMIN']} />}>
        <Route element={<DashboardLayout role="ADMIN" />}>
          <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
          <Route path="/admin/providers" element={<AdminProvidersPage />} />
          <Route path="/admin/verifications" element={<AdminVerificationsPage />} />
          <Route path="/admin/users" element={<AdminUsersPage />} />
          <Route path="/admin/reports" element={<AdminReportsPage />} />
          <Route path="/admin/reviews" element={<AdminReviewsPage />} />
          <Route path="/admin/categories" element={<AdminCategoriesPage />} />
          <Route path="/admin/locations" element={<AdminLocationsPage />} />
          <Route path="/admin/audit" element={<AdminAuditPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
