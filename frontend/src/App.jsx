import { useState } from "react";
import { AuthProvider } from "./contexts/AuthContext";
import { useAuth } from "./contexts/useAuth";
import Login from "./components/Login";
import Register from "./components/Register";
import ParkingMapTest from "./components/ParkingMapTest"; // THÊM DÒNG NÀY

function AppContent() {
  const { user, loading, logout } = useAuth();
  const [showRegister, setShowRegister] = useState(false);
  const [showMapTest, setShowMapTest] = useState(false); // THÊM DÒNG NÀY

  if (loading) return <p>Đang tải...</p>;

  if (!user) {
    return showRegister ? (
      <Register onSwitchToLogin={() => setShowRegister(false)} />
    ) : (
      <Login onSwitchToRegister={() => setShowRegister(true)} />
    );
  }

  // THÊM 3 DÒNG NÀY: nếu đang bật chế độ test thì render ParkingMapTest, có nút quay lại
  if (showMapTest) {
    return (
      <div>
        <button onClick={() => setShowMapTest(false)}>← Quay lại trang chính</button>
        <ParkingMapTest />
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem" }}>
      <h1>Smart Parking</h1>
      <p>
        Xin chào <b>{user.full_name}</b> ({user.role})
      </p>
      <button onClick={logout}>Đăng xuất</button>
      <button onClick={() => setShowMapTest(true)}>Test Grid Realtime</button> {/* THÊM DÒNG NÀY */}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}