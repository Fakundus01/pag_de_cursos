const COURSE_PROGRESS_KEY = "starcraft-course-progress";

export const loadProgress = (): Record<string, string[]> => {
  const raw = localStorage.getItem(COURSE_PROGRESS_KEY);
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw) as Record<string, string[]>;
  } catch {
    return {};
  }
};

export const saveProgress = (courseId: string, sectionId: string) => {
  const progress = loadProgress();
  const current = new Set(progress[courseId] ?? []);
  current.add(sectionId);
  progress[courseId] = Array.from(current);
  localStorage.setItem(COURSE_PROGRESS_KEY, JSON.stringify(progress));
};
