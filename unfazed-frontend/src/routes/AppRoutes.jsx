import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import DashboardLayout from '../components/layout/DashboardLayout';
import PortalLayout from '../components/layout/PortalLayout';
import { FullScreenLoader } from '../components/common/Loader';

import Landing from '../pages/public/Landing';
import PublicProfile from '../pages/public/PublicProfile';
import NotFound from '../pages/public/NotFound';

import Login from '../pages/auth/Login';
import Register from '../pages/auth/Register';
import ClientLogin from '../pages/auth/ClientLogin';
import ClientRegister from '../pages/auth/ClientRegister';
import AcceptInvite from '../pages/auth/AcceptInvite';

// Authenticated areas are code-split so public profile pages stay light.
const Dashboard = lazy(() => import('../pages/therapist/Dashboard'));
const Schedule = lazy(() => import('../pages/therapist/Schedule'));
const Clients = lazy(() => import('../pages/therapist/Clients'));
const ClientDetail = lazy(() => import('../pages/therapist/ClientDetail'));
const Notes = lazy(() => import('../pages/therapist/Notes'));
const Payments = lazy(() => import('../pages/therapist/Payments'));
const Messages = lazy(() => import('../pages/therapist/Messages'));
const Leads = lazy(() => import('../pages/therapist/Leads'));
const Analytics = lazy(() => import('../pages/therapist/Analytics'));
const Settings = lazy(() => import('../pages/therapist/Settings'));

const ClientPortal = lazy(() => import('../pages/client/ClientPortal'));
const BookingPage = lazy(() => import('../pages/client/BookingPage'));
const Onboarding = lazy(() => import('../pages/client/Onboarding'));
const Payment = lazy(() => import('../pages/client/Payment'));
const SharedNotes = lazy(() => import('../pages/client/SharedNotes'));
const ClientMessages = lazy(() => import('../pages/client/ClientMessages'));

export default function AppRoutes() {
  return (
    <Suspense fallback={<FullScreenLoader />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/portal/login" element={<ClientLogin />} />
        <Route path="/portal/invite/:token" element={<AcceptInvite />} />

        <Route element={<ProtectedRoute role="therapist" />}>
          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="schedule" element={<Schedule />} />
            <Route path="clients" element={<Clients />} />
            <Route path="clients/:id" element={<ClientDetail />} />
            <Route path="notes" element={<Notes />} />
            <Route path="payments" element={<Payments />} />
            <Route path="messages" element={<Messages />} />
            <Route path="leads" element={<Leads />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute role="client" />}>
          <Route path="/portal" element={<PortalLayout />}>
            <Route index element={<ClientPortal />} />
            <Route path="book" element={<BookingPage />} />
            <Route path="onboarding" element={<Onboarding />} />
            <Route path="payments" element={<Payment />} />
            <Route path="notes" element={<SharedNotes />} />
            <Route path="messages" element={<ClientMessages />} />
          </Route>
        </Route>

        <Route path="/:slug" element={<PublicProfile />} />
        <Route path="/:slug/join" element={<ClientRegister />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
