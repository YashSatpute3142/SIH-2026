import { useState } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");

  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, new_password: newPassword }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || "Reset failed");
      }

      setSuccess(true);
      setTimeout(() => navigate("/login"), 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-navy-950 text-slate-100 flex items-center justify-center px-6">
        <p className="text-risk-red">Missing reset token. Please request a new link.</p>
      </div>
    );
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

      {/* Natural transition between video and content */}
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

        {success ? (
          <>
            <div className="w-12 h-1 rounded-full bg-red-400 mb-8" />

            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
              Password reset{" "}
              <span className="text-red-400">successful.</span>
            </h1>

            <p className="text-red-400 text-base leading-relaxed">
              Password reset successfully. Redirecting to sign in...
            </p>
          </>
        ) : (
          <>
            <div className="w-12 h-1 rounded-full bg-red-400 mb-8" />

            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
              Set a new{" "}
              <span className="text-red-400">password.</span>
            </h1>

            <p className="text-slate-400 text-base leading-relaxed mb-10">
              Choose a new secure password for your account.
            </p>

            <div className="border border-slate-700/70 bg-[#10151e]/70 backdrop-blur-xl rounded-2xl p-6 md:p-8">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-xs font-medium tracking-[0.18em] text-slate-400 mb-3">
                    NEW PASSWORD
                  </label>

                  <input
                    type="password"
                    placeholder="Enter your new password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={8}
                    className="w-full px-5 py-4 rounded-xl bg-[#0b1017] border border-slate-700/80 focus:border-red-400 focus:ring-1 focus:ring-red-400 outline-none text-sm placeholder:text-slate-600 transition-all"
                  />
                </div>

                {error && (
                  <p className="text-risk-red text-sm">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full px-6 py-4 rounded-xl bg-red-500 hover:bg-red-400 text-white font-semibold transition-all hover:shadow-[0_10px_40px_rgba(239,68,68,0.25)] disabled:opacity-50"
                >
                  {loading ? "Resetting..." : "Reset Password →"}
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

export default ResetPassword;
