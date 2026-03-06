import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { initialChat, mockCourses } from "../data/mock";
import { api, getErrorMessage } from "../lib/api";
import type { ChatMessage, ContentBlock, Course, DashboardStats, PurchaseSummary, ReferralRecord, ReferralSummary, Trophy, UserProfile } from "../types";

type AuthForm = {
  email: string;
  password: string;
};

type PurchaseForm = {
  provider?: string;
  brand?: string;
  last4?: string;
};

type PurchaseResult = {
  error: string | null;
  course: Course | null;
};

type AppContextValue = {
  courses: Course[];
  profile: UserProfile | null;
  stats: DashboardStats;
  chatMessages: ChatMessage[];
  authResolved: boolean;
  login: (form: AuthForm) => Promise<string | null>;
  register: (form: AuthForm & { name: string }) => Promise<string | null>;
  logout: () => Promise<void>;
  updateProfile: (form: { name: string; avatar: string }) => Promise<string | null>;
  completeSection: (courseSlug: string, sectionId: string) => Promise<string | null>;
  purchaseCourse: (courseSlug: string, form?: PurchaseForm) => Promise<PurchaseResult>;
  addChatMessage: (body: string) => void;
};

const emptyStats: DashboardStats = {
  registeredUsers: 0,
  activeUsers: 0,
  guests: 0,
  monthlyRevenue: 0,
  premiumEnrollments: 0
};

const AppContext = createContext<AppContextValue | undefined>(undefined);
const appSyncStorageKey = "starcraft-academy-sync";

const normalizeTrophy = (trophy: any): Trophy => ({
  id: String(trophy.id),
  title: trophy.title,
  detail: trophy.detail
});

const normalizeContentBlock = (content: any): ContentBlock => ({
  id: Number(content.id),
  title: content.title,
  type: content.type,
  status: content.status,
  body: content.body,
  assetUrl: content.assetUrl ?? null,
  isPreview: Boolean(content.isPreview),
  estimatedMinutes: Number(content.estimatedMinutes ?? 0),
  metadata: typeof content.metadata === "object" && content.metadata !== null ? content.metadata : {}
});

const normalizePurchase = (purchase: any): PurchaseSummary => ({
  id: Number(purchase.id),
  courseId: String(purchase.courseId),
  courseTitle: purchase.courseTitle,
  provider: purchase.provider,
  providerReference: purchase.providerReference ?? null,
  status: purchase.status,
  currency: purchase.currency,
  subtotalAmount: Number(purchase.subtotalAmount ?? 0),
  discountAmount: Number(purchase.discountAmount ?? 0),
  totalAmount: Number(purchase.totalAmount ?? 0),
  createdAt: purchase.createdAt ?? null,
  paidAt: purchase.paidAt ?? null
});

const normalizeReferralRecord = (referral: any): ReferralRecord => ({
  id: Number(referral.id),
  code: referral.code,
  status: referral.status,
  rewardPercent: Number(referral.rewardPercent ?? 0),
  referredUser: referral.referredUser,
  createdAt: referral.createdAt ?? null,
  convertedAt: referral.convertedAt ?? null
});

const normalizeReferralSummary = (summary: any): ReferralSummary => ({
  sentCount: Number(summary.sentCount ?? 0),
  qualifiedCount: Number(summary.qualifiedCount ?? 0),
  rewardedCount: Number(summary.rewardedCount ?? 0),
  discountPercent: Number(summary.discountPercent ?? 0),
  recent: Array.isArray(summary.recent) ? summary.recent.map(normalizeReferralRecord) : []
});

const normalizeCourse = (course: any): Course => ({
  id: String(course.id ?? course.slug),
  slug: String(course.slug),
  title: course.title,
  subtitle: course.subtitle,
  description: course.description,
  level: course.level,
  isFree: Boolean(course.isFree),
  price: Number(course.price ?? 0),
  rating: Number(course.rating ?? 0),
  students: Number(course.students ?? 0),
  locked: Boolean(course.locked),
  isUnlocked: Boolean(course.isUnlocked ?? course.isFree),
  tags: Array.isArray(course.tags) ? course.tags.map(String) : [],
  sections: Array.isArray(course.sections)
    ? course.sections.map((section: any) => ({
        id: String(section.id),
        title: section.title,
        duration: section.duration,
        completed: Boolean(section.completed),
        contentBlocks: Array.isArray(section.contentBlocks) ? section.contentBlocks.map(normalizeContentBlock) : []
      }))
    : [],
  commerce: course.commerce
    ? {
        currency: course.commerce.currency ?? "USD",
        providers: Array.isArray(course.commerce.providers) ? course.commerce.providers.map(String) : [],
        latestPurchase: course.commerce.latestPurchase ? normalizePurchase(course.commerce.latestPurchase) : null
      }
    : undefined
});

const normalizeProfile = (profile: any): UserProfile => ({
  name: profile.name,
  email: profile.email,
  avatar: profile.avatar,
  streakDays: Number(profile.streakDays ?? 0),
  referralCode: profile.referralCode,
  enrolledCourseIds: Array.isArray(profile.enrolledCourseIds) ? profile.enrolledCourseIds.map(String) : [],
  completedCourseIds: Array.isArray(profile.completedCourseIds) ? profile.completedCourseIds.map(String) : [],
  recommendedCourseIds: Array.isArray(profile.recommendedCourseIds) ? profile.recommendedCourseIds.map(String) : [],
  savedCards: Array.isArray(profile.savedCards) ? profile.savedCards.map(String) : [],
  progressByCourse: Object.fromEntries(
    Object.entries(profile.progressByCourse ?? {}).map(([courseId, sectionIds]) => [courseId, Array.isArray(sectionIds) ? sectionIds.map(String) : []])
  ),
  trophies: Array.isArray(profile.trophies) ? profile.trophies.map(normalizeTrophy) : [],
  isAdmin: Boolean(profile.isAdmin),
  purchaseHistory: Array.isArray(profile.purchaseHistory) ? profile.purchaseHistory.map(normalizePurchase) : [],
  referralSummary: profile.referralSummary ? normalizeReferralSummary(profile.referralSummary) : null
});

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [courses, setCourses] = useState<Course[]>(mockCourses);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<DashboardStats>(emptyStats);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(initialChat);
  const [authResolved, setAuthResolved] = useState(false);

  const mergeCourse = (nextCourse: Course) => {
    setCourses((current) => {
      const exists = current.some((course) => course.slug === nextCourse.slug);
      if (!exists) {
        return [...current, nextCourse];
      }
      return current.map((course) => (course.slug === nextCourse.slug ? nextCourse : course));
    });
  };

  const refreshCourses = async () => {
    try {
      const courseResponse = await api.courses();
      setCourses(courseResponse.map(normalizeCourse));
    } catch {
      // Keep local fallback catalog if the API is not reachable.
    }
  };

  const refreshSession = async () => {
    try {
      const meResponse = await api.me();
      setProfile(meResponse.profile ? normalizeProfile(meResponse.profile) : null);
    } catch {
      setProfile(null);
    } finally {
      setAuthResolved(true);
    }
  };

  const syncTabs = (reason: string) => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.setItem(appSyncStorageKey, JSON.stringify({ reason, at: Date.now() }));
    } catch {
      // Ignore storage errors and keep local state updates.
    }
  };

  useEffect(() => {
    void refreshCourses();
  }, []);

  useEffect(() => {
    void refreshSession();
  }, []);

  useEffect(() => {
    const refreshVisibleState = () => {
      void refreshCourses();
      void refreshSession();
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === appSyncStorageKey) {
        refreshVisibleState();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshVisibleState();
      }
    };

    window.addEventListener("focus", refreshVisibleState);
    window.addEventListener("storage", handleStorage);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", refreshVisibleState);
      window.removeEventListener("storage", handleStorage);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (!profile?.isAdmin) {
      setStats(emptyStats);
      return;
    }

    void (async () => {
      try {
        const statsResponse = await api.stats();
        setStats({
          registeredUsers: Number(statsResponse.registeredUsers ?? 0),
          activeUsers: Number(statsResponse.activeUsers ?? 0),
          guests: Number(statsResponse.guests ?? 0),
          monthlyRevenue: Number(statsResponse.monthlyRevenue ?? 0),
          premiumEnrollments: Number(statsResponse.premiumEnrollments ?? 0)
        });
      } catch {
        setStats(emptyStats);
      }
    })();
  }, [profile?.isAdmin]);

  const value = useMemo<AppContextValue>(
    () => ({
      courses,
      profile,
      stats,
      chatMessages,
      authResolved,
      login: async ({ email, password }) => {
        if (!email.includes("@")) return "Email invalido.";
        if (password.length < 6) return "La contrasena debe tener al menos 6 caracteres.";

        try {
          const response = await api.login({ email, password });
          setProfile(normalizeProfile(response.profile));
          await refreshCourses();
          syncTabs("session");
          return null;
        } catch (error) {
          return getErrorMessage(error, "No se pudo iniciar sesion.");
        }
      },
      register: async ({ name, email, password }) => {
        if (!name.trim()) return "El nombre es obligatorio.";
        if (!email.includes("@")) return "Email invalido.";
        if (password.length < 6) return "La contrasena debe tener al menos 6 caracteres.";

        try {
          const response = await api.register({ name, email, password });
          setProfile(normalizeProfile(response.profile));
          await refreshCourses();
          syncTabs("session");
          return null;
        } catch (error) {
          return getErrorMessage(error, "No se pudo crear la cuenta.");
        }
      },
      logout: async () => {
        try {
          await api.logout();
        } catch {
          // If the session is already invalid, clear the local state anyway.
        }
        setProfile(null);
        setStats(emptyStats);
        await refreshCourses();
        syncTabs("session");
      },
      updateProfile: async ({ name, avatar }) => {
        if (!profile) {
          return "Debes iniciar sesion para editar tu perfil.";
        }

        try {
          const response = await api.updateProfile({ name, avatar });
          setProfile(normalizeProfile(response.profile));
          syncTabs("profile");
          return null;
        } catch (error) {
          return getErrorMessage(error, "No se pudo actualizar el perfil.");
        }
      },
      completeSection: async (courseSlug, sectionId) => {
        if (!profile) {
          return "Debes iniciar sesion para guardar progreso.";
        }

        try {
          const response = await api.completeSection(courseSlug, { sectionId });
          setProfile(normalizeProfile(response.profile));
          syncTabs("progress");
          return null;
        } catch (error) {
          return getErrorMessage(error, "No se pudo guardar el progreso.");
        }
      },
      purchaseCourse: async (courseSlug, form = {}) => {
        if (!profile) {
          return { error: "Debes iniciar sesion para desbloquear cursos premium.", course: null };
        }

        try {
          const response = await api.purchaseCourse(courseSlug, form);
          const normalizedProfile = normalizeProfile(response.profile);
          const normalizedCourse = normalizeCourse(response.course);
          setProfile(normalizedProfile);
          mergeCourse(normalizedCourse);
          syncTabs("purchase");
          return { error: null, course: normalizedCourse };
        } catch (error) {
          return { error: getErrorMessage(error, "No se pudo procesar la compra."), course: null };
        }
      },
      addChatMessage: (body) => {
        const userMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: "user",
          body
        };
        const lowered = body.toLowerCase();
        let answer = "Puedo ayudarte con acceso, pagos, progreso, cursos o soporte.";
        if (lowered.includes("pago")) answer = "Puedes desbloquear cursos con Mercado Pago, Visa o Mastercard desde la vista del curso.";
        if (lowered.includes("gratis")) answer = "El documento gratuito sirve como muestra. Los bloques premium se desbloquean al confirmar la compra.";
        if (lowered.includes("admin")) answer = "El panel admin controla cursos, materiales, analitica, FAQ del chat y base de conocimiento.";

        const assistantMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          body: answer
        };
        setChatMessages((current) => [...current, userMessage, assistantMessage]);
      }
    }),
    [authResolved, chatMessages, courses, profile, stats]
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
