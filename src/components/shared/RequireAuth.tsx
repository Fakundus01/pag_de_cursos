import type { ReactElement } from "react";
import { Navigate } from "react-router-dom";
import { useAppContext } from "../../store/AppContext";

export const RequireAuth = ({ children }: { children: ReactElement }) => {
  const { profile } = useAppContext();
  return profile ? children : <Navigate to="/iniciar-sesion" replace />;
};
