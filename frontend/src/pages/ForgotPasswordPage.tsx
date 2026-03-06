import { useState } from "react";
import { Link } from "react-router-dom";
import type { EmailDelivery } from "../types";
import { useAppContext } from "../store/AppContext";

export const ForgotPasswordPage = () => {
  const { requestPasswordReset } = useAppContext();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [delivery, setDelivery] = useState<EmailDelivery | null>(null);
  const [loading, setLoading] = useState(false);

  return (
    <div className="mx-auto max-w-md rounded-[34px] border border-white/10 bg-white/5 p-8 shadow-glow">
      <p className="text-sm uppercase tracking-[0.35em] text-aurora">Recuperacion</p>
      <h1 className="mt-3 text-3xl font-semibold text-sand">Recuperar contrasena</h1>
      <p className="mt-3 text-sm leading-7 text-steel">Ingresa tu email y te enviaremos un enlace para definir una contrasena nueva.</p>

      <form
        className="mt-8 grid gap-4"
        onSubmit={async (event) => {
          event.preventDefault();
          setLoading(true);
          setError(null);
          const result = await requestPasswordReset(email);
          setLoading(false);
          setError(result.error);
          setInfo(result.message ?? null);
          setDelivery(result.delivery ?? null);
        }}
      >
        <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Correo electronico" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none" />
        {error && <p className="rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</p>}
        {info && <p className="rounded-2xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{info}</p>}
        <button disabled={loading} className="rounded-full bg-sand px-5 py-3 font-medium text-abyss disabled:opacity-60">
          {loading ? "Enviando..." : "Enviar enlace"}
        </button>
      </form>

      {delivery?.previewUrl && (
        <a href={delivery.previewUrl} target="_blank" rel="noreferrer" className="mt-5 inline-flex text-sm text-aurora underline-offset-4 hover:underline">
          Abrir enlace de recuperacion
        </a>
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
