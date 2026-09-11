import { useState } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { useAuthActions } from "../store/authStore.js";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const { setToken } = useAuthActions();

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

      // Update both sessionStorage and Zustand auth state
      setToken(data.token);

      navigate("/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#05080D] text-slate-100">
      <div className="flex min-h-screen flex-col lg:flex-row">
        {/* MOBILE-ONLY TOP BANNER */}
        <div className="relative h-40 w-full overflow-hidden lg:hidden">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: "url('/assets/login-1.jpg')" }}
          />
          <div className="absolute inset-0 bg-[#05080D]/55" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#05080D]" />
        </div>

        {/* LEFT SIDE - IMAGE (desktop) */}
        <div className="relative hidden overflow-hidden lg:block lg:w-[45%]">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: "url('/assets/login-1.jpg')" }}
          />

          {/* subtle blue tint */}
          <div className="absolute inset-0 bg-[#1E4A6B] mix-blend-color opacity-40" />

          {/* dark overlay, kept light enough to preserve detail */}
          <div className="absolute inset-0 bg-[#05080D]/30" />

          {/* gradient toward the form side so the transition feels integrated */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-[#05080D]" />
          <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-[#05080D]/40 to-transparent" />

          <div className="absolute left-10 top-12 h-px w-32 bg-gradient-to-r from-[#39AFFF] to-transparent" />
        </div>

        {/* RIGHT SIDE - LOGIN FORM */}
        <div className="relative z-20 flex w-full flex-1 items-center justify-center px-6 py-12 lg:w-[55%] lg:px-16 xl:px-24">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-md"
          >
            <div className="mb-10">
              <div className="mb-6 flex items-center gap-3">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#39AFFF] opacity-60" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#39AFFF]" />
                </span>
                <span className="text-xs font-semibold tracking-[0.22em] text-slate-300">
                  MINE SUBSIDENCE SYSTEM
                </span>
              </div>

              <div className="mb-6 h-1 w-14 rounded-full bg-[#39AFFF]" />

              <h1 className="text-4xl font-bold tracking-tight text-slate-100 md:text-5xl">
                Welcome back.
              </h1>

              <p className="mt-4 max-w-sm text-base leading-7 text-slate-400">
                Access the Mine Subsidence Monitoring System.
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
                    className="w-full rounded-xl border border-slate-700/60 bg-black/25 px-4 py-3.5 text-sm text-slate-100 outline-none transition-all duration-300 placeholder:text-slate-600 focus:border-[#39AFFF] focus:bg-white/[0.03] focus:ring-1 focus:ring-[#39AFFF]/40"
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
                    className="w-full rounded-xl border border-slate-700/60 bg-black/25 px-4 py-3.5 text-sm text-slate-100 outline-none transition-all duration-300 placeholder:text-slate-600 focus:border-[#39AFFF] focus:bg-white/[0.03] focus:ring-1 focus:ring-[#39AFFF]/40"
                  />

                  <div className="mt-3 text-right">
                    <Link
                      to="/forgot-password"
                      className="text-xs text-slate-400 transition-colors hover:text-[#39AFFF]"
                    >
                      Forgot password?
                    </Link>
                  </div>
                </div>

                {error && (
                  <p className="text-sm text-red-400">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl border border-[#39AFFF]/50 bg-black/30 px-6 py-3.5 font-semibold text-white transition-all duration-300 hover:border-[#39AFFF] hover:bg-[#39AFFF] hover:text-[#05080D] hover:shadow-[0_8px_30px_rgba(57,175,255,0.22)] disabled:opacity-50"
                >
                  {loading ? "Signing in..." : "Sign In  →"}
                </button>
              </form>

              <p className="mt-7 text-center text-sm text-slate-400">
                Don't have an account?{" "}
                <Link
                  to="/register"
                  className="font-medium text-[#39AFFF] transition-colors hover:text-[#6FC5FF]"
                >
                  Register
                </Link>
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

export default Login;
