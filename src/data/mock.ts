import type { ChatMessage, Comment, Course, DashboardStats, Trophy, UserProfile } from "../types";

export const mockCourses: Course[] = [
  {
    id: "fundamentos-terran",
    slug: "fundamentos-terran",
    title: "Fundamentos Terran",
    subtitle: "Documento gratuito",
    description: "Introduccion accesible para mostrar el nivel de profundidad y estilo del campus.",
    level: "Inicial",
    isFree: true,
    price: 0,
    rating: 4.8,
    students: 1420,
    locked: false,
    isUnlocked: true,
    tags: ["Build orders", "Economia", "Gratis"],
    sections: [
      { id: "f1", title: "Vision general de Terran", duration: "8 min" },
      { id: "f2", title: "Macro basica y SCV uptime", duration: "12 min" },
      { id: "f3", title: "Primer scouting efectivo", duration: "10 min" }
    ]
  },
  {
    id: "zerg-ladder-control",
    slug: "zerg-ladder-control",
    title: "Zerg Ladder Control",
    subtitle: "Curso premium",
    description: "Curso pago con videos, actividades IA y evaluaciones dinamicas para mejorar timing y reaccion.",
    level: "Intermedio",
    isFree: false,
    price: 39,
    rating: 4.9,
    students: 312,
    locked: true,
    isUnlocked: false,
    tags: ["Premium", "IA", "Actividades"],
    sections: [
      { id: "z1", title: "Overlord paths", duration: "11 min" },
      { id: "z2", title: "Inject discipline", duration: "15 min" },
      { id: "z3", title: "Mid game transitions", duration: "18 min" }
    ]
  },
  {
    id: "protoss-pressure",
    slug: "protoss-pressure",
    title: "Protoss Pressure Systems",
    subtitle: "Curso premium",
    description: "Sesion de practica con formularios propios, minijuegos y seguimiento detallado del progreso.",
    level: "Avanzado",
    isFree: false,
    price: 49,
    rating: 4.7,
    students: 204,
    locked: true,
    isUnlocked: false,
    tags: ["Premium", "Minijuegos", "Analitica"],
    sections: [
      { id: "p1", title: "Warp prism windows", duration: "14 min" },
      { id: "p2", title: "Pressure without overcommit", duration: "17 min" },
      { id: "p3", title: "Replay review method", duration: "13 min" }
    ]
  }
];

export const mockTrophies: Trophy[] = [
  { id: "t1", title: "Cadena de 7 dias", detail: "Iniciaste sesion durante una semana." },
  { id: "t2", title: "Primer curso", detail: "Completaste tu primer ruta gratuita." },
  { id: "t3", title: "Estratega", detail: "Terminaste un minijuego de decision tactica." }
];

export const mockProfile: UserProfile = {
  name: "Sarah Kerrigan",
  email: "sarah@starcraft.academy",
  avatar: "SK",
  streakDays: 7,
  referralCode: "ZERG-10",
  enrolledCourseIds: ["fundamentos-terran", "zerg-ladder-control"],
  completedCourseIds: ["fundamentos-terran"],
  recommendedCourseIds: ["protoss-pressure"],
  savedCards: ["Visa terminada en 4242", "Mastercard terminada en 1288"],
  progressByCourse: {
    "fundamentos-terran": ["f1", "f2", "f3"],
    "zerg-ladder-control": ["z1"]
  },
  trophies: mockTrophies,
  isAdmin: true
};

export const mockStats: DashboardStats = {
  registeredUsers: 1842,
  activeUsers: 597,
  guests: 326,
  monthlyRevenue: 12840,
  premiumEnrollments: 418
};

export const mockComments: Comment[] = [
  { id: 1, user: "Raynor", courseId: "fundamentos-terran", body: "La doc gratis ya muestra bastante nivel y engancha.", stars: 5 },
  { id: 2, user: "Artanis", courseId: "protoss-pressure", body: "Buen ritmo y buenos ejercicios de toma de decisiones.", stars: 4 },
  { id: 3, user: "Zeratul", courseId: "zerg-ladder-control", body: "Las practicas dinamicas ayudan a fijar timings.", stars: 5 }
];

export const initialChat: ChatMessage[] = [
  { id: "c1", role: "assistant", body: "Hola. Puedo orientarte con cursos, pagos, progreso o dudas frecuentes." }
];
