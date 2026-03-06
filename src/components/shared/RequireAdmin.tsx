import type { ReactElement } from "react";
import { Navigate } from "react-router-dom";
import { useAppContext } from "../../store/AppContext";

export const RequireAdmin = ({ children }: { children: ReactElement }) => {
  const { profile } = useAppContext();
  return profile?.isAdmin ? children : <Navigate to="/" replace />;
};
