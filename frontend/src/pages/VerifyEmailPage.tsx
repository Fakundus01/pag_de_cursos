import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useAppContext } from "../store/AppContext";

export const VerifyEmailPage = () => {
  const { profile, verifyEmail } = useAppContext();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") ?? "";
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setError("El enlace no incluye un token de verificacion valido.");
      setLoading(false);
      return;
    }

    let active = true;
    void (async () => {
      const result = await verifyEmail(token);
      if (!active) {
        return;
      }
      setError(result.error);
      setMessage(result.message ?? null);
      setLoading(false);
      if (!result.error) {
        window.setTimeout(() => navigate("/perfil", { replace: true }), 1800);
      }
    })();

    return () => {
      active = false;
    };
  }, [navigate, token, verifyEmail]);

  if (profile?.emailVerified) {
    return <Navigate to="/perfil" replace />;
  }

  return (
    <div className="mx-auto max-w-md rounded-[34px] border border-white/10 bg-white/5 p-8 shadow-glow">
      <p className="text-sm uppercase tracking-[0.35em] text-aurora">Verificacion</p>
      <h1 className="mt-3 text-3xl font-semibold text-sand">Verificando email</h1>
      <p className="mt-3 text-sm leading-7 text-steel">Validamos tu enlace para activar la cuenta y dejar la sesion lista.</p>

      {loading && <p className="mt-8 rounded-2xl bg-white/5 px-4 py-3 text-sm text-steel">Procesando enlace...</p>}
      {error && <p className="mt-8 rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</p>}
      {message && <p className="mt-8 rounded-2xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{message}</p>}

      <p className="mt-5 text-sm text-steel">
        Si algo falla, puedes volver a {" "}
        <Link to="/iniciar-sesion" className="text-aurora">
          iniciar sesion
        </Link>
        {" "}y reenviar el email.
      </p>
    </div>
  );
};
