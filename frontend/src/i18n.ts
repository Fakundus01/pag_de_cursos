import i18n from "i18next";
import { initReactI18next } from "react-i18next";

const resources = {
  es: {
    translation: {
      home: "Home",
      courses: "Cursos",
      about: "Quienes somos",
      contact: "Contactanos",
      login: "Iniciar sesion",
      register: "Registrarse",
      profile: "Perfil",
      admin: "Admin",
      heroTitle: "Entrena tu macro, micro y lectura de mapa como un comandante de StarCraft.",
      heroBody:
        "Documentacion gratuita para atraer usuarios, rutas premium bloqueadas, progreso persistente y una experiencia lista para crecer con IA, pagos y panel administrativo.",
      freeDoc: "Ver doc gratis",
      premiumCourses: "Cursos premium",
      progress: "Progreso",
      recommended: "Recomendados",
      completed: "Completados",
      trophies: "Trofeos",
      comments: "Comentarios",
      rating: "Valoracion",
      save: "Guardar",
      logout: "Cerrar sesion",
      language: "Idioma"
    }
  },
  en: {
    translation: {
      home: "Home",
      courses: "Courses",
      about: "About us",
      contact: "Contact us",
      login: "Log in",
      register: "Sign up",
      profile: "Profile",
      admin: "Admin",
      heroTitle: "Train your macro, micro, and map awareness like a StarCraft commander.",
      heroBody:
        "Free documentation for visibility, locked premium paths, persistent progress, and a platform ready to grow with AI, payments, and admin tooling.",
      freeDoc: "Open free guide",
      premiumCourses: "Premium courses",
      progress: "Progress",
      recommended: "Recommended",
      completed: "Completed",
      trophies: "Trophies",
      comments: "Comments",
      rating: "Rating",
      save: "Save",
      logout: "Log out",
      language: "Language"
    }
  },
  pt: {
    translation: {
      home: "Inicio",
      courses: "Cursos",
      about: "Quem somos",
      contact: "Contato",
      login: "Entrar",
      register: "Registrar",
      profile: "Perfil",
      admin: "Admin",
      heroTitle: "Treine macro, micro e leitura de mapa como um comandante de StarCraft.",
      heroBody:
        "Documentacao gratuita para visibilidade, trilhas premium bloqueadas, progresso persistente e uma plataforma pronta para crescer com IA, pagamentos e administracao.",
      freeDoc: "Abrir guia gratis",
      premiumCourses: "Cursos premium",
      progress: "Progresso",
      recommended: "Recomendados",
      completed: "Concluidos",
      trophies: "Trofeus",
      comments: "Comentarios",
      rating: "Avaliacao",
      save: "Salvar",
      logout: "Sair",
      language: "Idioma"
    }
  }
};

i18n.use(initReactI18next).init({
  resources,
  lng: "es",
  fallbackLng: "es",
  interpolation: {
    escapeValue: false
  }
});

export default i18n;
