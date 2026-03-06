export type ContentBlock = {
  id: number;
  title: string;
  type: string;
  status: string;
  body: string;
  assetUrl?: string | null;
  isPreview: boolean;
  estimatedMinutes: number;
  metadata?: Record<string, unknown>;
};

export type CourseSection = {
  id: string;
  title: string;
  duration: string;
  completed?: boolean;
  contentBlocks?: ContentBlock[];
};

export type Activity = {
  title: string;
  prompt: string;
  questions: string[];
};

export type PurchaseSummary = {
  id: number;
  courseId: string;
  courseTitle: string;
  provider: string;
  providerReference?: string | null;
  status: string;
  currency: string;
  subtotalAmount: number;
  discountAmount: number;
  totalAmount: number;
  createdAt?: string | null;
  paidAt?: string | null;
};

export type ReferralRecord = {
  id: number;
  code: string;
  status: string;
  rewardPercent: number;
  referredUser: string;
  createdAt?: string | null;
  convertedAt?: string | null;
};

export type ReferralSummary = {
  sentCount: number;
  qualifiedCount: number;
  rewardedCount: number;
  discountPercent: number;
  recent: ReferralRecord[];
};

export type CourseCommerce = {
  currency: string;
  providers: string[];
  latestPurchase?: PurchaseSummary | null;
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
  commerce?: CourseCommerce;
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
  purchaseHistory?: PurchaseSummary[];
  referralSummary?: ReferralSummary | null;
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
