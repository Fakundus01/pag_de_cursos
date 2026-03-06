import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAppContext } from "../store/AppContext";

export const ResetPasswordPage = () => {
  const { resetPassword } = useAppContext();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!info) {
      return;
    }
    const timeoutId = window.setTimeout(() => navigate("/iniciar-sesion", { replace: true }), 1800);
    return () => window.clearTimeout(timeoutId);
  }, [info, navigate]);

  return (
    <div className="mx-auto max-w-md rounded-[34px] border border-white/10 bg-white/5 p-8 shadow-glow">
      <p className="text-sm uppercase tracking-[0.35em] text-aurora">Contrasena nueva</p>
      <h1 className="mt-3 text-3xl font-semibold text-sand">Restablecer contrasena</h1>
      <p className="mt-3 text-sm leading-7 text-steel">Define una contrasena nueva para volver a entrar a tu cuenta.</p>

      {!token ? (
        <p className="mt-8 rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-200">El enlace no incluye un token valido.</p>
      ) : (
        <form
          className="mt-8 grid gap-4"
          onSubmit={async (event) => {
            event.preventDefault();
            if (password !== confirmPassword) {
              setError("Las contrasenas no coinciden.");
              return;
            }
            setLoading(true);
            setError(null);
            const result = await resetPassword(token, password);
            setLoading(false);
            setError(result.error);
            setInfo(result.message ?? null);
          }}
        >
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Nueva contrasena" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none" />
          <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Repite la contrasena" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none" />
          {error && <p className="rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</p>}
          {info && <p className="rounded-2xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{info}</p>}
          <button disabled={loading} className="rounded-full bg-sand px-5 py-3 font-medium text-abyss disabled:opacity-60">
            {loading ? "Guardando..." : "Guardar contrasena"}
          </button>
        </form>
      )}

      <p className="mt-5 text-sm text-steel">
        Volver a {" "}
        <Link to="/iniciar-sesion" className="text-aurora">
          iniciar sesion
        </Link>
      </p>
    </div>
  );
};
