import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"

import { AdminDashboardPage } from "./pages/AdminDashboardPage"
import { AdminLoginPage } from "./pages/AdminLoginPage"
import { MotherIntakePage } from "./pages/MotherIntakePage"
import { PublicBirthNoticePage } from "./pages/PublicBirthNoticePage"
import { PublicLobbyPage } from "./pages/PublicLobbyPage"
import { PublicMealTrainPage } from "./pages/PublicMealTrainPage"

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PublicLobbyPage />} />
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/admin" element={<AdminDashboardPage />} />
        <Route path="/birth-notice" element={<PublicBirthNoticePage />} />
        <Route path="/intake/:token" element={<MotherIntakePage />} />
        <Route path="/t/:publicToken" element={<PublicMealTrainPage />} />
        <Route path="*" element={<Navigate replace to="/" />} />
      </Routes>
    </BrowserRouter>
  )
}
