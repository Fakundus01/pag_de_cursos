import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { initialChat, mockComments, mockCourses, mockProfile, mockStats, mockTrophies } from "../data/mock";
import { api } from "../lib/api";
import { loadProgress } from "../lib/storage";
import type { ChatMessage, Comment, Course, DashboardStats, Trophy, UserProfile } from "../types";

type AuthForm = {
  email: string;
  password: string;
};

type AppContextValue = {
  courses: Course[];
  profile: UserProfile | null;
  stats: DashboardStats;
  trophies: Trophy[];
  comments: Comment[];
  chatMessages: ChatMessage[];
  progress: Record<string, string[]>;
  login: (form: AuthForm) => Promise<string | null>;
  register: (form: AuthForm & { name: string }) => Promise<string | null>;
  logout: () => Promise<void>;
  addChatMessage: (body: string) => void;
  refreshProgress: () => void;
};

const AppContext = createContext<AppContextValue | undefined>(undefined);

const normalizeCourse = (course: any): Course => ({
  id: String(course.id ?? course.slug),
  slug: String(course.slug),
  title: course.title,
  subtitle: course.subtitle,
  description: course.description,
  level: course.level,
  isFree: course.isFree,
  price: course.price,
  rating: course.rating,
  students: course.students,
  locked: course.locked,
  tags: course.tags,
  sections: (course.sections ?? []).map((section: any) => ({
    id: String(section.id),
    title: section.title,
    duration: section.duration
  }))
});

const normalizeProfile = (profile: any): UserProfile => ({
  name: profile.name,
  email: profile.email,
  avatar: profile.avatar,
  streakDays: profile.streakDays,
  referralCode: profile.referralCode,
  enrolledCourseIds: (profile.enrolledCourseIds ?? []).map(String),
  completedCourseIds: (profile.completedCourseIds ?? []).map(String),
  savedCards: profile.savedCards,
  isAdmin: profile.isAdmin
});

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [courses, setCourses] = useState<Course[]>(mockCourses);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<DashboardStats>(mockStats);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(initialChat);
  const [progress, setProgress] = useState<Record<string, string[]>>({});

  useEffect(() => {
    setProgress(loadProgress());
  }, []);

  useEffect(() => {
    const onStorage = () => setProgress(loadProgress());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const [courseResponse, meResponse] = await Promise.all([api.courses(), api.me()]);
        setCourses(courseResponse.map(normalizeCourse));
        if (meResponse.profile) {
          setProfile(normalizeProfile(meResponse.profile));
        }
      } catch {
        // Fallback to local demo data when backend is not running.
      }
    })();
  }, []);

  useEffect(() => {
    if (!profile?.isAdmin) {
      return;
    }

    void (async () => {
      try {
        const statsResponse = await api.stats();
        setStats(statsResponse);
      } catch {
        // Keep mock dashboard data as fallback.
      }
    })();
  }, [profile?.isAdmin]);

  const value = useMemo<AppContextValue>(
    () => ({
      courses,
      profile,
      stats,
      trophies: mockTrophies,
      comments: mockComments,
      chatMessages,
      progress,
      login: async ({ email, password }) => {
        if (!email.includes("@")) return "Email invalido.";
        if (password.length < 6) return "La contrasena debe tener al menos 6 caracteres.";
        try {
          const response = await api.login({ email, password });
          setProfile(normalizeProfile(response.profile));
          return null;
        } catch {
          setProfile(mockProfile);
          return null;
        }
      },
      register: async ({ name, email, password }) => {
        if (!name.trim()) return "El nombre es obligatorio.";
        if (!email.includes("@")) return "Email invalido.";
        if (password.length < 6) return "La contrasena debe tener al menos 6 caracteres.";
        try {
          const response = await api.register({ name, email, password });
          setProfile(normalizeProfile(response.profile));
          return null;
        } catch {
          setProfile({
            ...mockProfile,
            name,
            email
          });
          return null;
        }
      },
      logout: async () => {
        try {
          await api.logout();
        } catch {
          // Ignore API logout errors in mock mode.
        }
        setProfile(null);
      },
      addChatMessage: (body) => {
        const userMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: "user",
          body
        };
        const lowered = body.toLowerCase();
        let answer = "Puedo ayudarte con acceso, pagos, progreso, cursos o soporte.";
        if (lowered.includes("pago")) answer = "Aceptaremos Mercado Pago, Visa y Mastercard. Puedes guardar tarjetas para compras futuras.";
        if (lowered.includes("gratis")) answer = "El documento gratuito sirve como muestra. Los cursos premium mantienen candado hasta completar el pago.";
        if (lowered.includes("admin")) answer = "El panel admin controla cursos, materiales, analitica, FAQ del chat y base de conocimiento.";

        const assistantMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          body: answer
        };
        setChatMessages((current) => [...current, userMessage, assistantMessage]);
      },
      refreshProgress: () => setProgress(loadProgress())
    }),
    [chatMessages, courses, profile, progress, stats]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useAppContext must be used within AppProvider");
  }
  return context;
};

