import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './services/auth';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import CategoryView from './pages/CategoryView';
import EntryForm from './pages/EntryForm';
import EntryDetail from './pages/EntryDetail';
import Nominees from './pages/Nominees';
import AccessRequests from './pages/AccessRequests';
import NomineeActivate from './pages/NomineeActivate';
import RecoverAccount from './pages/RecoverAccount';

function PrivateRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" />;
}

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
      <Route path="/register" element={user ? <Navigate to="/" /> : <Register />} />
      <Route path="/recover" element={user ? <Navigate to="/" /> : <RecoverAccount />} />
      <Route path="/nominee-activate" element={<NomineeActivate />} />
      <Route element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/category/:category" element={<CategoryView />} />
        <Route path="/category/:category/new" element={<EntryForm />} />
        <Route path="/category/:category/:id" element={<EntryDetail />} />
        <Route path="/category/:category/:id/edit" element={<EntryForm />} />
        <Route path="/nominees" element={<Nominees />} />
        <Route path="/access-requests" element={<AccessRequests />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
