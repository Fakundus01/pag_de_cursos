import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import type { EmailDelivery } from "../types";
import { useAppContext } from "../store/AppContext";

export const RegisterPage = () => {
  const { profile, register, resendVerification } = useAppContext();
  const [name, setName] = useState("");
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
      <p className="text-sm uppercase tracking-[0.35em] text-aurora">Alta de usuario</p>
      <h1 className="mt-3 text-3xl font-semibold text-sand">Registrarse</h1>
      <p className="mt-3 text-sm leading-7 text-steel">La cuenta se crea en backend, se reserva el curso gratuito y queda pendiente de verificarse por email.</p>

      {pendingEmail ? (
        <div className="mt-8 rounded-[28px] border border-aurora/20 bg-aurora/10 p-6">
          <p className="text-lg font-semibold text-sand">Cuenta creada</p>
          <p className="mt-3 text-sm leading-7 text-steel">{info ?? "Revisa tu bandeja para verificar la cuenta antes de iniciar sesion."}</p>
          <p className="mt-3 text-sm text-white">{pendingEmail}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={resending}
              onClick={async () => {
                setResending(true);
                setError(null);
                const result = await resendVerification(pendingEmail);
                setResending(false);
                setError(result.error);
                setInfo(result.message ?? info);
                setDelivery(result.delivery ?? null);
              }}
              className="rounded-full bg-sand px-5 py-3 font-medium text-abyss disabled:opacity-60"
            >
              {resending ? "Reenviando..." : "Reenviar verificacion"}
            </button>
            <Link to="/iniciar-sesion" className="rounded-full border border-white/10 px-5 py-3 text-sm text-white">
              Ir a iniciar sesion
            </Link>
          </div>
          {delivery?.previewUrl && (
            <a href={delivery.previewUrl} target="_blank" rel="noreferrer" className="mt-5 inline-flex text-sm text-aurora underline-offset-4 hover:underline">
              Abrir enlace de verificacion
            </a>
          )}
          {error && <p className="mt-4 rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</p>}
        </div>
      ) : (
        <form
          className="mt-8 grid gap-4"
          onSubmit={async (event) => {
            event.preventDefault();
            setLoading(true);
            setError(null);
            setInfo(null);
            const result = await register({ name, email, password });
            setLoading(false);
            setError(result.error);
            if (!result.error && result.pendingVerification) {
              setPendingEmail(result.email ?? email);
              setInfo(result.message ?? "Revisa tu correo para verificar la cuenta.");
              setDelivery(result.delivery ?? null);
            }
          }}
        >
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nombre" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none" />
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Correo electronico" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none" />
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Contrasena" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none" />
          {error && <p className="rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</p>}
          <button disabled={loading} className="rounded-full bg-sand px-5 py-3 font-medium text-abyss disabled:opacity-60">
            {loading ? "Creando cuenta..." : "Crear cuenta"}
          </button>
        </form>
      )}

      <p className="mt-5 text-sm text-steel">
        Ya tienes cuenta? {" "}
        <Link to="/iniciar-sesion" className="text-aurora">
          Inicia sesion
        </Link>
      </p>
    </div>
  );
};
