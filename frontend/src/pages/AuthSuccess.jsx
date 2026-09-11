import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuthActions } from "../store/authStore.js";

function AuthSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const { setToken } = useAuthActions();

  useEffect(() => {
    const token = searchParams.get("token");

    if (token) {
      setToken(token);
      navigate("/dashboard", { replace: true });
    } else {
      navigate("/login", { replace: true });
    }
  }, [searchParams, navigate, setToken]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-navy-950">
      <p className="text-slate-400">Signing you in...</p>
    </div>
  );
}

export default AuthSuccess;