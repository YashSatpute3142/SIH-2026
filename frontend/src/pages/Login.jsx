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
  <div className="relative min-h-screen overflow-hidden bg-[#07090d] text-slate-100">
  <div className="flex min-h-screen">
    {/* LEFT SIDE - LOGIN */}
    <div className="relative z-20 flex w-full items-center justify-center px-6 py-12 lg:w-1/2 lg:px-16 xl:px-24">
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="mb-10">
          <div className="mb-6 h-1 w-14 rounded-full bg-risk-red" />

          <h1 className="text-4xl font-bold tracking-tight text-slate-100 md:text-5xl">
            Welcome <span className="text-risk-red">back.</span>
          </h1>

          <p className="mt-4 max-w-sm text-base leading-7 text-slate-400">
            Authenticate to access the mine monitoring command center.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-7 shadow-2xl backdrop-blur-sm md:p-8">
          <button
            onClick={handleGoogleSignIn}
            className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-6 py-3.5 font-medium text-slate-200 transition-all duration-300 hover:border-white/20 hover:bg-white/[0.08]"
          >
            G&nbsp;&nbsp; Sign In with Google
          </button>

          <div className="my-6 flex items-center gap-4">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-[10px] font-medium tracking-[0.25em] text-slate-500">
              OR
            </span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="mb-2 block text-[10px] font-medium tracking-[0.2em] text-slate-400">
                EMAIL ADDRESS
              </label>

              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3.5 text-sm text-slate-100 outline-none transition-all duration-300 placeholder:text-slate-600 focus:border-risk-red/70 focus:bg-white/[0.03]"
              />
            </div>

            <div>
              <label className="mb-2 block text-[10px] font-medium tracking-[0.2em] text-slate-400">
                PASSWORD
              </label>

              <input
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3.5 text-sm text-slate-100 outline-none transition-all duration-300 placeholder:text-slate-600 focus:border-risk-red/70 focus:bg-white/[0.03]"
              />

              <div className="mt-3 text-right">
                <Link
                  to="/forgot-password"
                  className="text-xs text-slate-400 transition-colors hover:text-risk-red"
                >
                  Forgot password?
                </Link>
              </div>
            </div>

            {error && <p className="text-sm text-risk-red">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-risk-red px-6 py-3.5 font-semibold text-white shadow-lg shadow-red-500/10 transition-all duration-300 hover:brightness-110 hover:shadow-red-500/20 disabled:opacity-50"
            >
              {loading ? "Signing in..." : "Sign In  →"}
            </button>
          </form>

          <p className="mt-7 text-center text-sm text-slate-400">
            Don't have an account?{" "}
            <Link
              to="/register"
              className="font-medium text-risk-red transition-colors hover:text-red-400"
            >
              Register
            </Link>
          </p>
        </div>
      </motion.div>
    </div>

    {/* RIGHT SIDE - VIDEO */}
    <div className="relative hidden w-1/2 overflow-hidden lg:block">
      <video
        autoPlay
        muted
        loop
        playsInline
        className="absolute inset-0 h-full w-full object-cover"
      >
        <source src="/mine-login-background.mp4" type="video/mp4" />
      </video>

      {/* Natural connection between dark panel and video */}
      <div className="absolute inset-y-0 left-0 w-40 bg-gradient-to-r from-[#07090d] via-[#07090d]/60 to-transparent" />

      {/* Bottom readability gradient */}
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />

      {/* Decorative line */}
      <div className="absolute left-10 top-12 h-px w-32 bg-gradient-to-r from-risk-red to-transparent" />

      {/* Video content */}
      <motion.div
        initial={{ opacity: 0, y: 25 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.2 }}
        className="absolute bottom-16 left-16 right-12"
      >
       
      </motion.div>
    </div>
  </div>
</div>
);
}

export default Login;
