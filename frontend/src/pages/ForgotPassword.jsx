import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);

    try {
      await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
    } finally {
      setLoading(false);
      setSubmitted(true);
    }
  }

  return (
    <div className="min-h-screen bg-[#090d14] text-slate-100 overflow-hidden">
  <div className="min-h-screen grid lg:grid-cols-2">

    {/* LEFT VIDEO SIDE */}
    <div className="relative hidden lg:block overflow-hidden">
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
      >
        <source
          src="/mine-login-background.mp4"
          type="video/mp4"
        />
      </video>

      {/* Natural blend into right side */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-[#090d14]" />
    </div>

    {/* RIGHT CONTENT SIDE */}
    <div className="relative flex items-center justify-center px-6 py-12 lg:px-16">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        {/* Brand */}
        <div className="flex items-center gap-3 mb-12">
          <div className="relative flex items-center justify-center w-4 h-4">
            <div className="absolute w-4 h-4 rounded-full bg-red-500/20 animate-ping" />
            <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
          </div>

          <span className="font-semibold tracking-[0.22em] text-sm">
            MINE SUBSIDENCE SYSTEM
          </span>
        </div>

        {submitted ? (
          <>
            <div className="w-12 h-1 rounded-full bg-red-400 mb-8" />

            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
              Check your{" "}
              <span className="text-red-400">email.</span>
            </h1>

            <p className="text-slate-400 text-base leading-relaxed max-w-md">
              If an account exists with that email, a password reset link has
              been sent.
            </p>
          </>
        ) : (
          <>
            <div className="w-12 h-1 rounded-full bg-red-400 mb-8" />

            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
              Reset your{" "}
              <span className="text-red-400">password.</span>
            </h1>

            <p className="text-slate-400 text-base leading-relaxed mb-10 max-w-md">
              Enter your email address and we'll send you a secure password
              reset link.
            </p>

            <div className="border border-slate-700/70 bg-[#10151e]/70 backdrop-blur-xl rounded-2xl p-6 md:p-8">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-xs font-medium tracking-[0.18em] text-slate-400 mb-3">
                    EMAIL ADDRESS
                  </label>

                  <input
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-5 py-4 rounded-xl bg-[#0b1017] border border-slate-700/80 focus:border-red-400 focus:ring-1 focus:ring-red-400 outline-none text-sm placeholder:text-slate-600 transition-all"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full px-6 py-4 rounded-xl bg-red-500 hover:bg-red-400 text-white font-semibold transition-all hover:shadow-[0_10px_40px_rgba(239,68,68,0.25)] disabled:opacity-50"
                >
                  {loading ? "Sending..." : "Send Reset Link →"}
                </button>
              </form>
            </div>
          </>
        )}

        <p className="text-sm text-slate-400 mt-8">
          <Link
            to="/login"
            className="hover:text-red-400 transition-colors"
          >
            ← Back to Sign In
          </Link>
        </p>
      </motion.div>
    </div>
  </div>
</div>
  );
}

export default ForgotPassword;
