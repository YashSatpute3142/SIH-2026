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

        {success ? (
          <p className="text-risk-green text-sm text-center">
            Password reset successfully. Redirecting to sign in...
          </p>
        ) : (
          <>
            <h1 className="text-xl font-bold mb-1 text-center">Set a new password</h1>
            <p className="text-slate-400 text-sm mb-6 text-center">
              Choose a new password for your account
            </p>

            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                type="password"
                placeholder="New password (min 8 characters)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                className="w-full px-4 py-2.5 rounded-lg bg-navy-800 border border-navy-700 focus:border-risk-green outline-none text-sm"
              />

              {error && <p className="text-risk-red text-sm">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full px-6 py-3 rounded-lg bg-risk-green text-navy-950 font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {loading ? "Resetting..." : "Reset Password"}
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

export default ResetPassword;
