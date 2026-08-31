import { useState } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { saveToken } from "../utils/auth.js";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  function handleGoogleSignIn() {
    window.location.href = `${API_BASE_URL}/api/auth/google/login`;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || "Login failed");
      }

      const data = await response.json();
      saveToken(data.token);
      navigate("/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-navy-950 text-slate-100 flex items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-sm bg-navy-900 border border-navy-700 rounded-xl p-8"
      >
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="w-2 h-2 rounded-full bg-risk-green animate-pulse" />
          <span className="font-semibold tracking-wide text-sm">
            MINE SUBSIDENCE SYSTEM
          </span>
        </div>

        <h1 className="text-xl font-bold mb-1 text-center">Sign in to continue</h1>
        <p className="text-slate-400 text-sm mb-6 text-center">
          Access the command center
        </p>

        <button
          onClick={handleGoogleSignIn}
          className="w-full px-6 py-3 rounded-lg bg-navy-800 hover:bg-navy-700 border border-navy-700 font-medium transition-colors mb-4"
        >
          Sign In with Google
        </button>

        <div className="flex items-center gap-3 my-4">
          <div className="h-px flex-1 bg-navy-700" />
          <span className="text-xs text-slate-500">OR</span>
          <div className="h-px flex-1 bg-navy-700" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-4 py-2.5 rounded-lg bg-navy-800 border border-navy-700 focus:border-risk-green outline-none text-sm"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-4 py-2.5 rounded-lg bg-navy-800 border border-navy-700 focus:border-risk-green outline-none text-sm"
          />

          <div className="text-right">
            <Link to="/forgot-password" className="text-xs text-slate-400 hover:text-risk-green">
              Forgot password?
            </Link>
          </div>

          {error && <p className="text-risk-red text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full px-6 py-3 rounded-lg bg-risk-green text-navy-950 font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className="text-center text-sm text-slate-400 mt-6">
          Don't have an account?{" "}
          <Link to="/register" className="text-risk-green hover:underline">
            Register
          </Link>
        </p>
      </motion.div>
    </div>
  );
}

export default Login;
