export type CourseSection = {
  id: string;
  title: string;
  duration: string;
  completed?: boolean;
};

export type Activity = {
  title: string;
  prompt: string;
  questions: string[];
};

export type Course = {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  level: string;
  isFree: boolean;
  price: number;
  rating: number;
  students: number;
  locked: boolean;
  isUnlocked?: boolean;
  tags: string[];
  sections: CourseSection[];
};

export type Comment = {
  id: number;
  user: string;
  courseId: string;
  body: string;
  stars: number;
};

export type CourseDetail = Course & {
  comments: Comment[];
  activity: Activity;
};

export type Trophy = {
  id: string;
  title: string;
  detail: string;
};

export type UserProfile = {
  name: string;
  email: string;
  avatar: string;
  streakDays: number;
  referralCode: string;
  enrolledCourseIds: string[];
  completedCourseIds: string[];
  recommendedCourseIds: string[];
  savedCards: string[];
  progressByCourse: Record<string, string[]>;
  trophies: Trophy[];
  isAdmin: boolean;
};

export type DashboardStats = {
  registeredUsers: number;
  activeUsers: number;
  guests: number;
  monthlyRevenue: number;
  premiumEnrollments: number;
};

export type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  body: string;
};
