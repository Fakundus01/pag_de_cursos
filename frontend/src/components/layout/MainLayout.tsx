import { Globe, ShieldUser, UserRound } from "lucide-react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { GuidedChat } from "../shared/GuidedChat";
import { useAppContext } from "../../store/AppContext";

const navClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-full px-4 py-2 text-sm transition ${isActive ? "bg-white/[0.18] text-white" : "text-steel hover:bg-white/10 hover:text-white"}`;

export const MainLayout = () => {
  const { t, i18n } = useTranslation();
  const { profile, logout } = useAppContext();

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#1a4b62_0%,#0b1d29_45%,#07131c_100%)] text-white">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-abyss/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
          <Link to="/" className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-aurora to-nebula font-semibold text-abyss shadow-glow">
              SC
            </div>
            <div>
              <p className="font-semibold tracking-wide text-sand">Starcraft Academy</p>
              <p className="text-xs text-steel">Campus premium con doc gratuita</p>
            </div>
          </Link>

          <nav className="hidden items-center gap-2 lg:flex">
            <NavLink to="/" className={navClass}>
              {t("home")}
            </NavLink>
            <NavLink to="/cursos" className={navClass}>
              {t("courses")}
            </NavLink>
            <NavLink to="/quienes-somos" className={navClass}>
              {t("about")}
            </NavLink>
            <NavLink to="/contactanos" className={navClass}>
              {t("contact")}
            </NavLink>
          </nav>

          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 p-1 sm:flex">
              <button className="rounded-full px-3 py-1 text-xs text-steel hover:bg-white/10" onClick={() => i18n.changeLanguage("es")}>
                ES
              </button>
              <button className="rounded-full px-3 py-1 text-xs text-steel hover:bg-white/10" onClick={() => i18n.changeLanguage("en")}>
                EN
              </button>
              <button className="rounded-full px-3 py-1 text-xs text-steel hover:bg-white/10" onClick={() => i18n.changeLanguage("pt")}>
                PT
              </button>
              <Globe size={16} className="mr-2 text-aurora" />
            </div>

            {profile ? (
              <>
                {profile.isAdmin && (
                  <Link to="/admin" className="hidden rounded-full border border-aurora/40 bg-aurora/10 px-4 py-2 text-sm text-aurora hover:bg-aurora/20 md:inline-flex">
                    <ShieldUser size={16} className="mr-2" />
                    {t("admin")}
                  </Link>
                )}
                <Link to="/perfil" className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.08] px-4 py-2 text-sm text-white hover:bg-white/[0.14]">
                  <UserRound size={16} className="mr-2" />
                  {t("profile")}
                </Link>
                <button className="rounded-full bg-sand px-4 py-2 text-sm font-medium text-abyss" onClick={logout}>
                  {t("logout")}
                </button>
              </>
            ) : (
              <>
                <Link to="/iniciar-sesion" className="rounded-full border border-white/10 px-4 py-2 text-sm text-white">
                  {t("login")}
                </Link>
                <Link to="/registrarse" className="rounded-full bg-sand px-4 py-2 text-sm font-medium text-abyss">
                  {t("register")}
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <Outlet />
      </main>

      <GuidedChat />
    </div>
  );
};

