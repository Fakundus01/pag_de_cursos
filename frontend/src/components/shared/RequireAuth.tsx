import type { ReactElement } from "react";
import { Navigate } from "react-router-dom";
import { useAppContext } from "../../store/AppContext";
import { PageLoader } from "./PageLoader";

export const RequireAuth = ({ children }: { children: ReactElement }) => {
  const { profile, authResolved } = useAppContext();

  if (!authResolved) {
    return <PageLoader />;
  }

  return profile ? children : <Navigate to="/iniciar-sesion" replace />;
};
