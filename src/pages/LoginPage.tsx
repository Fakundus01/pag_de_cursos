import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAppContext } from "../store/AppContext";

export const LoginPage = () => {
  const { profile, login } = useAppContext();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (profile) {
    return <Navigate to="/perfil" replace />;
  }

  return (
    <div className="mx-auto max-w-md rounded-[34px] border border-white/10 bg-white/5 p-8 shadow-glow">
      <p className="text-sm uppercase tracking-[0.35em] text-aurora">Acceso</p>
      <h1 className="mt-3 text-3xl font-semibold text-sand">Iniciar sesion</h1>
      <p className="mt-3 text-sm leading-7 text-steel">Base preparada para auth con cookies, validacion de email y sesiones persistentes.</p>

      <form
        className="mt-8 grid gap-4"
        onSubmit={async (event) => {
          event.preventDefault();
          setError(await login({ email, password }));
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
        <button className="rounded-full bg-sand px-5 py-3 font-medium text-abyss">Entrar</button>
      </form>

      <p className="mt-5 text-sm text-steel">
        No tienes cuenta?{" "}
        <Link to="/registrarse" className="text-aurora">
          Registrate
        </Link>
      </p>
    </div>
  );
};
