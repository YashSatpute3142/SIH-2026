import { useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import ForgotPassword from "./pages/ForgotPassword.jsx";
import ResetPassword from "./pages/ResetPassword.jsx";
import AuthSuccess from "./pages/AuthSuccess.jsx";
import Overview from "./pages/Overview.jsx";
import LiveMapPage from "./pages/LiveMapPage.jsx";
import NodesPage from "./pages/NodesPage.jsx";
import NodeDetailsPage from "./pages/NodeDetailsPage.jsx";
import ZonesPage from "./pages/ZonesPage.jsx";
import ZoneDetailsPage from "./pages/ZoneDetailsPage.jsx";
import AlertsPage from "./pages/AlertsPage.jsx";
import AnalyticsPage from "./pages/AnalyticsPage.jsx";
import SystemHealthPage from "./pages/SystemHealthPage.jsx";
import ProtectedRoute from "./components/layout/ProtectedRoute.jsx";
import CommandCenterShell from "./components/layout/CommandCenterShell.jsx";
import { useTheme } from "./store/themeStore.js";

function App() {
  const theme = useTheme();

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/auth/success" element={<AuthSuccess />} />

      <Route path="/dashboard" element={<ProtectedRoute />}>
        <Route element={<CommandCenterShell />}>
          <Route index element={<Overview />} />
          <Route path="map" element={<LiveMapPage />} />
          <Route path="nodes" element={<NodesPage />} />
          <Route path="nodes/:nodeIdParam" element={<NodeDetailsPage />} />
          <Route path="zones" element={<ZonesPage />} />
          <Route path="zones/:zoneCode" element={<ZoneDetailsPage />} />
          <Route path="alerts" element={<AlertsPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="system-health" element={<SystemHealthPage />} />
        </Route>
      </Route>
    </Routes>
  );
}

export default App;
