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

        {submitted ? (
          <>
            <h1 className="text-xl font-bold mb-2 text-center">Check your email</h1>
            <p className="text-slate-400 text-sm text-center">
              If an account exists with that email, a password reset link has been sent.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold mb-1 text-center">Reset your password</h1>
            <p className="text-slate-400 text-sm mb-6 text-center">
              Enter your email and we'll send you a reset link
            </p>

            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-2.5 rounded-lg bg-navy-800 border border-navy-700 focus:border-risk-green outline-none text-sm"
              />

              <button
                type="submit"
                disabled={loading}
                className="w-full px-6 py-3 rounded-lg bg-risk-green text-navy-950 font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {loading ? "Sending..." : "Send Reset Link"}
              </button>
            </form>
          </>
        )}

        <p className="text-center text-sm text-slate-400 mt-6">
          <Link to="/login" className="text-risk-green hover:underline">
            Back to Sign In
          </Link>
        </p>
      </motion.div>
    </div>
  );
}

export default ForgotPassword;
