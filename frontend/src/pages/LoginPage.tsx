import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import type { EmailDelivery } from "../types";
import { useAppContext } from "../store/AppContext";

export const LoginPage = () => {
  const { profile, login, resendVerification } = useAppContext();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [delivery, setDelivery] = useState<EmailDelivery | null>(null);

  if (profile) {
    return <Navigate to="/perfil" replace />;
  }

  return (
    <div className="mx-auto max-w-md rounded-[34px] border border-white/10 bg-white/5 p-8 shadow-glow">
      <p className="text-sm uppercase tracking-[0.35em] text-aurora">Acceso</p>
      <h1 className="mt-3 text-3xl font-semibold text-sand">Iniciar sesion</h1>
      <p className="mt-3 text-sm leading-7 text-steel">Autenticacion con cookies, verificacion de email y recuperacion real desde Flask.</p>

      <form
        className="mt-8 grid gap-4"
        onSubmit={async (event) => {
          event.preventDefault();
          setLoading(true);
          setError(null);
          setInfo(null);
          setDelivery(null);
          const result = await login({ email, password });
          setLoading(false);
          setError(result.error);
          if (result.verificationRequired) {
            setPendingEmail(result.email ?? email);
            setInfo("Tu cuenta existe pero todavia no verificaste el email. Revisa el enlace o reenviarlo desde aqui.");
          } else {
            setPendingEmail(null);
          }
        }}
      >
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Correo electronico"
          className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none"
        />
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Contrasena"
          className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none"
        />
        {error && <p className="rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</p>}
        {info && <p className="rounded-2xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{info}</p>}
        <button disabled={loading} className="rounded-full bg-sand px-5 py-3 font-medium text-abyss disabled:opacity-60">
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>

      {pendingEmail && (
        <div className="mt-5 rounded-[28px] border border-aurora/20 bg-aurora/10 p-5">
          <p className="text-sm font-medium text-sand">Verificacion pendiente</p>
          <p className="mt-2 text-sm leading-7 text-steel">{pendingEmail}</p>
          <button
            type="button"
            disabled={resending}
            onClick={async () => {
              setResending(true);
              setError(null);
              const result = await resendVerification(pendingEmail);
              setResending(false);
              setError(result.error);
              setInfo(result.message ?? "Revisa tu correo para continuar.");
              setDelivery(result.delivery ?? null);
            }}
            className="mt-4 rounded-full border border-white/10 px-4 py-2 text-sm text-white disabled:opacity-60"
          >
            {resending ? "Reenviando..." : "Reenviar verificacion"}
          </button>
          {delivery?.previewUrl && (
            <a href={delivery.previewUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex text-sm text-aurora underline-offset-4 hover:underline">
              Abrir enlace de verificacion
            </a>
          )}
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm text-steel">
        <p>
          No tienes cuenta? {" "}
          <Link to="/registrarse" className="text-aurora">
            Registrate
          </Link>
        </p>
        <Link to="/recuperar-contrasena" className="text-aurora">
          Olvide mi contrasena
        </Link>
      </div>
    </div>
  );
};
