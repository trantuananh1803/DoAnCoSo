import { useState, useEffect } from "react";
import { AuthContext } from "./auth-context-object";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [loading, setLoading] = useState(true);

  // Khi app khởi động, nếu đã có token trong localStorage -> gọi /auth/me để lấy lại thông tin user
  useEffect(() => {
  if (!token) {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- early-return hợp lệ, không phải setState đồng bộ gây cascading render thật sự
    setLoading(false);
    return;
  }

    let cancelled = false;

    fetch("http://localhost:3000/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error("token invalid");
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setUser(data.user);
      })
      .catch(() => {
        if (!cancelled) {
          localStorage.removeItem("token");
          setToken(null);
          setUser(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  function login(newToken, newUser) {
    localStorage.setItem("token", newToken);
    setToken(newToken);
    setUser(newUser);
  }

  function logout() {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}