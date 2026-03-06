import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAppContext } from "../store/AppContext";

export const RegisterPage = () => {
  const { profile, register } = useAppContext();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (profile) {
    return <Navigate to="/perfil" replace />;
  }

  return (
    <div className="mx-auto max-w-md rounded-[34px] border border-white/10 bg-white/5 p-8 shadow-glow">
      <p className="text-sm uppercase tracking-[0.35em] text-aurora">Alta de usuario</p>
      <h1 className="mt-3 text-3xl font-semibold text-sand">Registrarse</h1>
      <p className="mt-3 text-sm leading-7 text-steel">La cuenta se crea en backend y deja el curso gratuito listo para empezar.</p>

      <form
        className="mt-8 grid gap-4"
        onSubmit={async (event) => {
          event.preventDefault();
          setLoading(true);
          setError(await register({ name, email, password }));
          setLoading(false);
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

      <p className="mt-5 text-sm text-steel">
        Ya tienes cuenta?{" "}
        <Link to="/iniciar-sesion" className="text-aurora">
          Inicia sesion
        </Link>
      </p>
    </div>
  );
};
