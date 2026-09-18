import { useContext } from "react";
import { AuthContext } from "./auth-context-object";

export function useAuth() {
  return useContext(AuthContext);
}