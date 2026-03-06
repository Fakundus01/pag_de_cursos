import { Navigate, Route, Routes } from "react-router-dom";
import { MainLayout } from "./components/layout/MainLayout";
import { PageLoader } from "./components/shared/PageLoader";
import { RequireAdmin } from "./components/shared/RequireAdmin";
import { RequireAuth } from "./components/shared/RequireAuth";
import { AboutPage } from "./pages/AboutPage";
import { AdminPage } from "./pages/AdminPage";
import { ContactPage } from "./pages/ContactPage";
import { CoursePlayerPage } from "./pages/CoursePlayerPage";
import { CoursesPage } from "./pages/CoursesPage";
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/LoginPage";
import { ProfilePage } from "./pages/ProfilePage";
import { RegisterPage } from "./pages/RegisterPage";

const App = () => (
  <Routes>
    <Route element={<MainLayout />}>
      <Route path="/" element={<HomePage />} />
      <Route path="/cursos" element={<CoursesPage />} />
      <Route path="/quienes-somos" element={<AboutPage />} />
      <Route path="/contactanos" element={<ContactPage />} />
      <Route path="/iniciar-sesion" element={<LoginPage />} />
      <Route path="/registrarse" element={<RegisterPage />} />
      <Route
        path="/perfil"
        element={
          <RequireAuth>
            <ProfilePage />
          </RequireAuth>
        }
      />
      <Route
        path="/admin"
        element={
          <RequireAdmin>
            <AdminPage />
          </RequireAdmin>
        }
      />
    </Route>
    <Route path="/curso/:slug" element={<CoursePlayerPage />} />
    <Route path="/cargando" element={<PageLoader fullScreen />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);

export default App;
