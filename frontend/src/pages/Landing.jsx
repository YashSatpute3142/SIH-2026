import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

function Landing() {
  const navigate = useNavigate();

  function handleDirectSignIn() {
    window.location.href = `${API_BASE_URL}/api/auth/google/login`;
  }

  function goToLoginPage() {
    navigate("/login");
  }

  return (
    <div className="min-h-screen bg-navy-950 text-slate-100 flex flex-col">
      <nav className="flex items-center justify-between px-8 py-6">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-risk-green animate-pulse" />
          <span className="font-semibold tracking-wide">MINE SUBSIDENCE SYSTEM</span>
        </div>
        <button
          onClick={goToLoginPage}
          className="px-5 py-2 rounded-lg bg-navy-800 hover:bg-navy-700 border border-navy-700 transition-colors text-sm"
        >
          Sign In
        </button>
      </nav>

      <main className="flex-1 flex flex-col items-center justify-center text-center px-6">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-4xl md:text-6xl font-extrabold max-w-3xl leading-tight"
        >
          AI-Enabled Smart Mine Subsidence Monitoring
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="mt-6 text-lg text-slate-400 max-w-xl"
        >
          Real-time early warning for surface subsidence above underground coal-mine
          panels — decision-support only, never a replacement for authorized mine
          safety procedure.
        </motion.p>

        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          onClick={handleDirectSignIn}
          className="mt-10 px-8 py-3 rounded-lg bg-risk-green text-navy-950 font-semibold hover:opacity-90 transition-opacity"
        >
          Sign In with Google
        </motion.button>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl w-full"
        >
          <FeatureCard
            title="Hybrid Sensor Network"
            description="Real ESP32 nodes and simulated nodes, treated identically across every feature."
          />
          <FeatureCard
            title="AI Risk Classification"
            description="Isolation Forest, XGBoost classification, and displacement forecasting."
          />
          <FeatureCard
            title="Offline-First"
            description="Local alerts continue working even when cloud connectivity is lost."
          />
        </motion.div>
      </main>

      <footer className="text-center text-slate-600 text-sm py-6">
        Prototype system. Not a substitute for statutory mine-safety procedures.
      </footer>
    </div>
  );
}

function FeatureCard({ title, description }) {
  return (
    <div className="bg-navy-900 border border-navy-700 rounded-xl p-6 text-left hover:border-navy-600 transition-colors">
      <h3 className="font-semibold mb-2">{title}</h3>
      <p className="text-sm text-slate-400">{description}</p>
    </div>
  );
}

export default Landing;
