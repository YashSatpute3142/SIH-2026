import { useState } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { saveToken } from "../utils/auth.js";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || "Registration failed");
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
    <div className="min-h-screen overflow-hidden bg-[#05080D] text-slate-100">
      <div className="grid min-h-screen lg:grid-cols-[55%_45%]">
        {/* LEFT SIDE - FORM */}
        <div className="relative flex items-center justify-center px-6 py-12 lg:px-16 xl:px-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-md"
          >
            <div className="mb-12 flex items-center gap-3">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#39AFFF] opacity-60" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#39AFFF]" />
              </span>
              <span className="text-xs font-semibold tracking-[0.22em] text-slate-300">
                MINE SUBSIDENCE SYSTEM
              </span>
            </div>

            <div className="mb-8 h-1 w-14 rounded-full bg-[#39AFFF]" />

            <h1 className="mb-4 text-4xl font-bold tracking-tight text-slate-100 md:text-5xl">
              Create access.
            </h1>

            <p className="mb-10 max-w-sm text-base leading-7 text-slate-400">
              Create your account for the Mine Subsidence Monitoring System.
            </p>

            <div className="rounded-2xl border border-slate-700/60 bg-white/[0.025] p-6 shadow-2xl backdrop-blur-xl md:p-8">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="mb-2 block text-[10px] font-medium tracking-[0.2em] text-slate-400">
                    NAME
                  </label>

                  <input
                    type="text"
                    placeholder="Enter your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="w-full rounded-xl border border-slate-700/60 bg-black/25 px-4 py-3.5 text-sm text-slate-100 outline-none transition-all duration-300 placeholder:text-slate-600 focus:border-[#39AFFF] focus:bg-white/[0.03] focus:ring-1 focus:ring-[#39AFFF]/40"
                  />
                </div>

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
                    placeholder="Create a password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    className="w-full rounded-xl border border-slate-700/60 bg-black/25 px-4 py-3.5 text-sm text-slate-100 outline-none transition-all duration-300 placeholder:text-slate-600 focus:border-[#39AFFF] focus:bg-white/[0.03] focus:ring-1 focus:ring-[#39AFFF]/40"
                  />
                </div>

                {error && <p className="text-sm text-red-400">{error}</p>}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl border border-[#39AFFF]/50 bg-black/30 px-6 py-3.5 font-semibold text-white transition-all duration-300 hover:border-[#39AFFF] hover:bg-[#39AFFF] hover:text-[#05080D] hover:shadow-[0_8px_30px_rgba(57,175,255,0.22)] disabled:opacity-50"
                >
                  {loading ? "Creating account..." : "Create Account  →"}
                </button>
              </form>

              <p className="mt-7 text-center text-sm text-slate-400">
                Already have an account?{" "}
                <Link
                  to="/login"
                  className="font-medium text-[#39AFFF] transition-colors hover:text-[#6FC5FF]"
                >
                  Sign in
                </Link>
              </p>
            </div>
          </motion.div>
        </div>

        {/* RIGHT SIDE - IMAGE (desktop) */}
        <div className="relative hidden overflow-hidden lg:block">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: "url('/assets/login-2.jpg')" }}
          />

          {/* subtle blue tint, keeping the hexagonal pattern legible */}
          <div className="absolute inset-0 bg-[#1E4A6B] mix-blend-color opacity-35" />

          <div className="absolute inset-0 bg-[#05080D]/25" />

          {/* gradient toward the form side, on the left edge of this panel */}
          <div className="absolute inset-0 bg-gradient-to-l from-transparent via-transparent to-[#05080D]" />
          <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-[#05080D]/40 to-transparent" />

          <div className="absolute right-10 top-12 h-px w-32 bg-gradient-to-l from-[#39AFFF] to-transparent" />
        </div>

        {/* MOBILE-ONLY TOP BANNER */}
        <div className="relative order-first block h-40 w-full overflow-hidden lg:hidden">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: "url('/assets/login-2.jpg')" }}
          />
          <div className="absolute inset-0 bg-[#05080D]/55" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#05080D]" />
        </div>
      </div>
    </div>
  );
}

export default Register;
