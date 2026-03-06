import { CheckCircle2, ChevronLeft, Home, LockKeyhole, PlayCircle, ShieldCheck, Sparkles, Star } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { PageLoader } from "../components/shared/PageLoader";
import { api, getErrorMessage } from "../lib/api";
import { useAppContext } from "../store/AppContext";
import type { Comment, ContentBlock, CourseDetail } from "../types";

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

const normalizeCourseDetail = (course: any): CourseDetail => ({
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
        latestPurchase: course.commerce.latestPurchase
          ? {
              id: Number(course.commerce.latestPurchase.id),
              courseId: String(course.commerce.latestPurchase.courseId),
              courseTitle: course.commerce.latestPurchase.courseTitle,
              provider: course.commerce.latestPurchase.provider,
              providerReference: course.commerce.latestPurchase.providerReference ?? null,
              status: course.commerce.latestPurchase.status,
              currency: course.commerce.latestPurchase.currency,
              subtotalAmount: Number(course.commerce.latestPurchase.subtotalAmount ?? 0),
              discountAmount: Number(course.commerce.latestPurchase.discountAmount ?? 0),
              totalAmount: Number(course.commerce.latestPurchase.totalAmount ?? 0),
              createdAt: course.commerce.latestPurchase.createdAt ?? null,
              paidAt: course.commerce.latestPurchase.paidAt ?? null
            }
          : null
      }
    : undefined,
  comments: Array.isArray(course.comments)
    ? course.comments.map(
        (comment: any): Comment => ({
          id: Number(comment.id),
          user: comment.user,
          courseId: String(comment.courseId ?? course.slug),
          body: comment.body,
          stars: Number(comment.stars ?? 5)
        })
      )
    : [],
  activity: {
    title: course.activity?.title ?? "Actividad guiada",
    prompt: course.activity?.prompt ?? "Analiza la situacion y explica la mejor decision.",
    questions: Array.isArray(course.activity?.questions) ? course.activity.questions.map(String) : []
  }
});

const celebrationStars = [
  { left: "10%", top: "18%", size: 18, delay: "0s", duration: "1.9s" },
  { left: "23%", top: "70%", size: 14, delay: "0.2s", duration: "2.2s" },
  { left: "37%", top: "14%", size: 22, delay: "0.1s", duration: "2s" },
  { left: "50%", top: "80%", size: 16, delay: "0.45s", duration: "2.3s" },
  { left: "63%", top: "16%", size: 20, delay: "0.35s", duration: "2.1s" },
  { left: "76%", top: "66%", size: 15, delay: "0.15s", duration: "1.8s" },
  { left: "88%", top: "25%", size: 19, delay: "0.5s", duration: "2.4s" }
];

export const CoursePlayerPage = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { profile, authResolved, completeSection, purchaseCourse } = useAppContext();
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [savingSectionId, setSavingSectionId] = useState<string | null>(null);
  const [commentBody, setCommentBody] = useState("");
  const [commentStars, setCommentStars] = useState(5);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [purchaseProvider, setPurchaseProvider] = useState("Mercado Pago");
  const [purchaseLast4, setPurchaseLast4] = useState("");
  const [purchasing, setPurchasing] = useState(false);
  const [courseCelebration, setCourseCelebration] = useState(false);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [finalChallengeOpen, setFinalChallengeOpen] = useState(false);
  const [finalChallengeAnswers, setFinalChallengeAnswers] = useState<Record<string, number>>({});
  const [finalChallengeDone, setFinalChallengeDone] = useState(false);
  const [finalChallengeError, setFinalChallengeError] = useState<string | null>(null);
  const [requiredVideoWatched, setRequiredVideoWatched] = useState<Record<string, boolean>>({});
  const [pendingReturnAfterOpinion, setPendingReturnAfterOpinion] = useState(false);
  const commentsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!slug || typeof window === "undefined") {
      return;
    }
    setFinalChallengeDone(window.localStorage.getItem(`starcraft-course-final-${slug}`) === "done");
  }, [slug]);

  useEffect(() => {
    if (!slug) {
      setError("Curso no encontrado.");
      setLoading(false);
      return;
    }

    if (!authResolved) {
      setLoading(true);
      return;
    }

    let isActive = true;

    const loadCourse = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await api.course(slug);
        if (isActive) {
          setCourse(normalizeCourseDetail(response));
        }
      } catch (requestError) {
        if (isActive) {
          setError(getErrorMessage(requestError, "No se pudo cargar el curso."));
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    void loadCourse();

    const refreshCurrentCourse = () => {
      if (document.visibilityState === "hidden") {
        return;
      }
      void loadCourse();
    };

    window.addEventListener("focus", refreshCurrentCourse);
    document.addEventListener("visibilitychange", refreshCurrentCourse);

    return () => {
      isActive = false;
      window.removeEventListener("focus", refreshCurrentCourse);
      document.removeEventListener("visibilitychange", refreshCurrentCourse);
    };
  }, [authResolved, slug, profile?.email]);

  const completedSections = useMemo(() => new Set(profile?.progressByCourse[course?.id ?? ""] ?? []), [course?.id, profile?.progressByCourse]);
  const showLocked = course ? course.locked && !course.isUnlocked : false;
  const canAccessPremium = course ? course.isFree || Boolean(course.isUnlocked) : false;
  const canComment = authResolved && Boolean(profile) && canAccessPremium;
  const currentSection = course?.sections.find((section) => section.id === selectedSectionId) ?? null;
  const completedCount = course ? course.sections.filter((section) => section.completed || completedSections.has(section.id)).length : 0;
  const allSectionsCompleted = Boolean(course && course.sections.length > 0 && completedCount >= course.sections.length);
  const finalChallengeItems = course
    ? [
        { id: "challenge-1", question: course.activity.questions[0] ?? "Que viste en el scouting inicial?", options: ["Confirmar scouting temprano y ajustar la respuesta", "Ignorar la informacion y seguir igual", "Gastar recursos sin vision"], correct: 0 },
        { id: "challenge-2", question: course.activity.questions[1] ?? "Que ajuste de build corresponde?", options: ["Transicionar con un ajuste coherente al scouting", "Seguir con cualquier build sin revisar timings", "Cancelar economia para improvisar"], correct: 0 },
        { id: "challenge-3", question: course.activity.questions[2] ?? "Cual es el riesgo si reaccionas tarde?", options: ["Perder tempo, vision y ventanas de respuesta", "Ninguno, el rival no capitaliza", "Solo baja la estetica del plan"], correct: 0 }
      ]
    : [];
  const sectionNeedsRequiredVideo = currentSection
    ? currentSection.contentBlocks?.some((content) => content.type === "video" && (content.metadata?.videoRequired ?? true))
    : false;
  const sectionVideoReady = currentSection
    ? Boolean(requiredVideoWatched[currentSection.id] || currentSection.completed || completedSections.has(currentSection.id) || !sectionNeedsRequiredVideo)
    : true;

  if (!authResolved || loading) {
    return <PageLoader fullScreen />;
  }

  if (error || !course) {
    return (
      <div className="min-h-screen bg-abyss px-6 py-10 text-white">
        <p>{error ?? "Curso no encontrado."}</p>
      </div>
    );
  }

  return (
    <>
      {courseCelebration && (
        <div className="course-complete-overlay">
          <div className="course-complete-card text-center">
            <div className="course-complete-stars" aria-hidden="true">
              {celebrationStars.map((star, index) => (
                <Star
                  key={`${star.left}-${star.top}-${index}`}
                  className="course-complete-star fill-flare text-flare"
                  size={star.size}
                  style={{
                    left: star.left,
                    top: star.top,
                    animationDelay: star.delay,
                    animationDuration: star.duration
                  }}
                />
              ))}
            </div>
            <div className="relative z-10 mx-auto flex h-20 w-20 items-center justify-center rounded-[28px] border border-aurora/35 bg-aurora/15 text-aurora shadow-glow">
              <CheckCircle2 size={42} />
            </div>
            <p className="relative z-10 mt-6 text-xs uppercase tracking-[0.45em] text-aurora">Success</p>
            <h2 className="relative z-10 mt-4 text-4xl font-semibold text-sand">Curso completado</h2>
            <p className="relative z-10 mt-4 max-w-md text-sm leading-7 text-steel">
              Terminaste las secciones y tambien el test final. Ahora puedes volver al inicio o dejar una opinion antes de salir.
            </p>
            <div className="relative z-10 mt-8 flex flex-wrap items-center justify-center gap-3">
              <button type="button" onClick={() => navigate("/")} className="inline-flex items-center gap-2 rounded-full bg-sand px-5 py-3 text-sm font-medium text-abyss">
                <Home size={16} />
                Regresar al inicio
              </button>
              {canComment && (
                <button
                  type="button"
                  onClick={() => {
                    setCourseCelebration(false);
                    setSelectedSectionId(null);
                    setFinalChallengeOpen(false);
                    setPendingReturnAfterOpinion(true);
                    window.setTimeout(() => commentsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
                  }}
                  className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm text-white"
                >
                  Opinar y volver
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="min-h-screen bg-[linear-gradient(180deg,#07131c_0%,#0b2431_100%)] px-6 py-10 text-white">
        <div className="mx-auto max-w-6xl space-y-8">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-aurora">
            <ChevronLeft size={16} />
            Volver al inicio
          </Link>

          <section className="rounded-[36px] border border-white/10 bg-white/5 p-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.35em] text-aurora">{course.level}</p>
                <h1 className="mt-4 text-4xl font-semibold text-sand">{course.title}</h1>
              </div>
              {showLocked ? (
                <span className="inline-flex items-center gap-2 rounded-full border border-flare/40 bg-flare/10 px-4 py-2 text-sm text-flare">
                  <LockKeyhole size={16} />
                  Contenido premium bloqueado
                </span>
              ) : (
                <span className="inline-flex items-center gap-2 rounded-full border border-aurora/40 bg-aurora/10 px-4 py-2 text-sm text-aurora">
                  <Sparkles size={16} />
                  {course.isFree ? "Documento gratuito visible" : "Curso desbloqueado para tu cuenta"}
                </span>
              )}
            </div>

            <p className="mt-5 max-w-3xl text-base leading-8 text-steel">{course.description}</p>
            {feedback && <p className="mt-5 rounded-2xl bg-white/5 px-4 py-3 text-sm text-steel">{feedback}</p>}
          </section>

          {currentSection ? (
            <section className="space-y-6">
              <div className="rounded-[34px] border border-white/10 bg-white/5 p-7">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-sm uppercase tracking-[0.25em] text-aurora">Sesion abierta</p>
                    <h2 className="mt-3 text-3xl font-semibold text-sand">{currentSection.title}</h2>
                    <p className="mt-2 text-sm text-steel">{currentSection.duration} - cuando termines vuelves a la home del curso</p>
                  </div>
                  <button type="button" onClick={() => setSelectedSectionId(null)} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white">
                    Volver a la home del curso
                  </button>
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-[1fr_0.88fr]">
                <div className="space-y-4">
                  {(currentSection.contentBlocks ?? []).map((content) => {
                    const isVideo = content.type === "video";
                    const videoRequired = Boolean(content.metadata?.videoRequired ?? isVideo);
                    const videoSummary = String(content.metadata?.summary ?? content.body);
                    const canEmbedVideo = Boolean(content.assetUrl && /\.(mp4|webm|ogg)(\?.*)?$/i.test(content.assetUrl));
                    return (
                      <article key={content.id} className="rounded-[28px] border border-white/10 bg-white/5 p-5">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-lg font-medium text-white">{content.title}</p>
                            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-aurora">{content.type} - {content.estimatedMinutes} min</p>
                          </div>
                          {isVideo && videoRequired ? (
                            <span className="rounded-full border border-flare/35 bg-flare/10 px-3 py-1 text-xs text-flare">Video obligatorio</span>
                          ) : (
                            <span className="rounded-full border border-aurora/35 bg-aurora/10 px-3 py-1 text-xs text-aurora">Disponible</span>
                          )}
                        </div>

                        {isVideo ? (
                          <div className="mt-4 space-y-4">
                            {canEmbedVideo ? (
                              <video
                                controls
                                className="w-full rounded-[22px] border border-white/10 bg-black/40"
                                src={content.assetUrl ?? undefined}
                                onEnded={() => setRequiredVideoWatched((current) => ({ ...current, [currentSection.id]: true }))}
                              />
                            ) : (
                              <div className="rounded-[22px] border border-white/10 bg-abyss/60 p-5">
                                <p className="text-sm text-white">Video cargado por el admin</p>
                                <p className="mt-2 text-sm leading-7 text-steel">Si el admin agrega un mp4 se reproduce aqui. Mientras tanto puedes abrir el recurso manualmente y confirmar que lo viste.</p>
                                {content.assetUrl && (
                                  <a href={content.assetUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex rounded-full bg-sand px-4 py-2 text-sm font-medium text-abyss">
                                    Abrir video
                                  </a>
                                )}
                              </div>
                            )}
                            <div className="rounded-[22px] border border-aurora/20 bg-aurora/10 p-4">
                              <p className="text-xs uppercase tracking-[0.22em] text-aurora">Resumen accesible</p>
                              <p className="mt-3 text-sm leading-7 text-steel">{videoSummary}</p>
                            </div>
                            {videoRequired && !(requiredVideoWatched[currentSection.id] || currentSection.completed || completedSections.has(currentSection.id)) && (
                              <button
                                type="button"
                                onClick={() => setRequiredVideoWatched((current) => ({ ...current, [currentSection.id]: true }))}
                                className="rounded-full bg-sand px-4 py-2 text-sm font-medium text-abyss"
                              >
                                Confirmar video visto
                              </button>
                            )}
                          </div>
                        ) : (
                          <p className="mt-4 text-sm leading-7 text-steel">{content.body}</p>
                        )}
                      </article>
                    );
                  })}
                </div>

                <div className="space-y-6">
                  <div className="rounded-[30px] border border-white/10 bg-white/5 p-6">
                    <p className="text-sm uppercase tracking-[0.25em] text-aurora">Avance</p>
                    <h3 className="mt-3 text-2xl font-semibold text-sand">Cierre de seccion</h3>
                    <p className="mt-4 text-sm leading-7 text-steel">
                      Para terminar la sesion debes completar el video obligatorio si existe. Luego vuelves a la home del curso para abrir la siguiente seccion.
                    </p>
                    <button
                      type="button"
                      disabled={savingSectionId === currentSection.id || currentSection.completed || completedSections.has(currentSection.id) || !canAccessPremium || !sectionVideoReady}
                      className="mt-6 inline-flex items-center gap-2 rounded-full bg-sand px-5 py-3 text-sm font-medium text-abyss disabled:opacity-60"
                      onClick={async () => {
                        setSavingSectionId(currentSection.id);
                        const result = await completeSection(course.slug, currentSection.id);
                        setSavingSectionId(null);
                        if (result) {
                          setFeedback(result);
                          return;
                        }

                        setCourse((current) =>
                          current
                            ? {
                                ...current,
                                sections: current.sections.map((item) => (item.id === currentSection.id ? { ...item, completed: true } : item))
                              }
                            : current
                        );
                        setSelectedSectionId(null);
                        const nextCompletedCount = completedCount + (currentSection.completed || completedSections.has(currentSection.id) ? 0 : 1);
                        if (nextCompletedCount >= course.sections.length) {
                          setFeedback("Seccion terminada. Ya tienes disponible el test final del curso.");
                        } else {
                          setFeedback("Seccion marcada como completada y regreso a la home del curso.");
                        }
                      }}
                    >
                      <CheckCircle2 size={16} />
                      {currentSection.completed || completedSections.has(currentSection.id)
                        ? "Completada"
                        : savingSectionId === currentSection.id
                          ? "Guardando..."
                          : sectionVideoReady
                            ? "Terminar seccion"
                            : "Debes confirmar el video"}
                    </button>
                  </div>

                  <div className="rounded-[30px] border border-white/10 bg-white/5 p-6">
                    <h3 className="text-xl font-semibold text-sand">Estado del curso</h3>
                    <p className="mt-4 text-sm leading-7 text-steel">{completedCount}/{course.sections.length} secciones terminadas.</p>
                    <div className="mt-4 h-2 rounded-full bg-white/10">
                      <div className="h-2 rounded-full bg-gradient-to-r from-aurora to-flare" style={{ width: `${course.sections.length ? Math.round((completedCount / course.sections.length) * 100) : 0}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            </section>
          ) : finalChallengeOpen ? (
            <section className="space-y-6">
              <div className="rounded-[34px] border border-white/10 bg-white/5 p-7">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-sm uppercase tracking-[0.25em] text-aurora">Test final</p>
                    <h2 className="mt-3 text-3xl font-semibold text-sand">Juego tactico de cierre</h2>
                    <p className="mt-2 text-sm text-steel">Responde y cierras el curso completo antes de volver al inicio.</p>
                  </div>
                  <button type="button" onClick={() => setFinalChallengeOpen(false)} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white">
                    Volver a la home del curso
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                {finalChallengeItems.map((item) => (
                  <article key={item.id} className="rounded-[28px] border border-white/10 bg-white/5 p-5">
                    <p className="text-lg font-medium text-white">{item.question}</p>
                    <div className="mt-4 grid gap-3">
                      {item.options.map((option, optionIndex) => (
                        <button
                          key={`${item.id}-${option}`}
                          type="button"
                          onClick={() => {
                            setFinalChallengeError(null);
                            setFinalChallengeAnswers((current) => ({ ...current, [item.id]: optionIndex }));
                          }}
                          className={`rounded-2xl border px-4 py-3 text-left text-sm transition ${finalChallengeAnswers[item.id] === optionIndex ? "border-aurora bg-aurora/10 text-white" : "border-white/10 bg-abyss/60 text-steel hover:border-white/20 hover:text-white"}`}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  </article>
                ))}
              </div>

              <div className="rounded-[30px] border border-white/10 bg-white/5 p-6">
                {finalChallengeError && <p className="rounded-2xl bg-white/5 px-4 py-3 text-sm text-steel">{finalChallengeError}</p>}
                <button
                  type="button"
                  className="mt-4 inline-flex items-center gap-2 rounded-full bg-sand px-5 py-3 text-sm font-medium text-abyss"
                  onClick={() => {
                    if (finalChallengeItems.some((item) => finalChallengeAnswers[item.id] === undefined)) {
                      setFinalChallengeError("Responde todas las preguntas antes de cerrar el curso.");
                      return;
                    }
                    const score = finalChallengeItems.reduce((accumulator, item) => accumulator + (finalChallengeAnswers[item.id] === item.correct ? 1 : 0), 0);
                    if (score < 2) {
                      setFinalChallengeError("Necesitas al menos 2 respuestas correctas para aprobar el test final. Puedes intentarlo otra vez.");
                      return;
                    }
                    if (typeof window !== "undefined") {
                      window.localStorage.setItem(`starcraft-course-final-${course.slug}`, "done");
                    }
                    setFinalChallengeDone(true);
                    setFinalChallengeOpen(false);
                    setCourseCelebration(true);
                    setFeedback(`Test final aprobado con ${score}/${finalChallengeItems.length}.`);
                  }}
                >
                  <PlayCircle size={16} />
                  Entregar test final
                </button>
              </div>
            </section>
          ) : (
            <section className="grid gap-8 lg:grid-cols-[1fr_0.9fr]">
              <div className="space-y-6">
                <div className="rounded-[34px] border border-white/10 bg-white/5 p-7">
                  <h2 className="text-2xl font-semibold text-sand">Home del curso</h2>
                  <p className="mt-4 text-sm leading-7 text-steel">Abre cada seccion en esta misma pestana, completa el video obligatorio cuando exista y vuelve aqui para seguir avanzando.</p>
                  <div className="mt-6 space-y-4">
                    {course.sections.map((section, index) => {
                      const isCompleted = section.completed || completedSections.has(section.id);
                      const rawPreviewText = section.contentBlocks?.find((content) => content.type === "video")?.metadata?.summary;
                      const previewText = typeof rawPreviewText === "string" ? rawPreviewText : null;
                      return (
                        <button
                          key={section.id}
                          type="button"
                          disabled={!canAccessPremium}
                          onClick={() => {
                            setSelectedSectionId(section.id);
                            setFeedback(null);
                          }}
                          className="w-full rounded-[24px] border border-white/10 bg-abyss/60 p-5 text-left transition hover:border-aurora/35 disabled:opacity-60"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-4">
                            <div>
                              <p className="text-xs uppercase tracking-[0.22em] text-aurora">Seccion {index + 1}</p>
                              <p className="mt-2 text-lg font-medium text-white">{section.title}</p>
                              <p className="mt-2 text-sm text-steel">{section.duration}</p>
                            </div>
                            {isCompleted ? (
                              <span className="inline-flex items-center gap-2 rounded-full border border-aurora/35 bg-aurora/10 px-3 py-1 text-xs text-aurora">
                                <CheckCircle2 size={14} />
                                Hecha
                              </span>
                            ) : (
                              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white">Abrir seccion</span>
                            )}
                          </div>
                          {previewText && <p className="mt-4 text-sm leading-7 text-steel">{String(previewText)}</p>}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-[34px] border border-white/10 bg-white/5 p-6">
                  <h2 className="text-xl font-semibold text-sand">Test final y juego tactico</h2>
                  <p className="mt-4 text-sm leading-7 text-steel">Se habilita al terminar todas las secciones. Es el cierre antes de salir del curso.</p>
                  <div className="mt-5 rounded-[24px] border border-white/10 bg-abyss/60 p-5">
                    <p className="text-sm text-white">{course.activity.title}</p>
                    <p className="mt-3 text-sm leading-7 text-steel">{course.activity.prompt}</p>
                    <button
                      type="button"
                      disabled={!allSectionsCompleted || finalChallengeDone}
                      className="mt-5 rounded-full bg-sand px-5 py-3 text-sm font-medium text-abyss disabled:opacity-60"
                      onClick={() => {
                        setFinalChallengeOpen(true);
                        setFinalChallengeError(null);
                      }}
                    >
                      {finalChallengeDone ? "Test final ya aprobado" : allSectionsCompleted ? "Abrir test final" : "Completa todas las secciones primero"}
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                {showLocked ? (
                  <div className="rounded-[34px] border border-white/10 bg-white/5 p-6">
                    <div className="flex items-center gap-3">
                      <ShieldCheck className="text-aurora" />
                      <h2 className="text-xl font-semibold text-sand">Desbloquear curso</h2>
                    </div>
                    <p className="mt-4 text-sm leading-7 text-steel">
                      La sesion ya se verifica con cookie antes de cargar esta vista. Si compras desde aqui, el acceso premium se habilita en esta pestana y en el resto al volver a enfocarlas.
                    </p>

                    {!profile ? (
                      <div className="mt-5 rounded-2xl bg-abyss/60 p-4 text-sm text-steel">
                        <p>Inicia sesion para comprar y desbloquear el resto del contenido.</p>
                        <div className="mt-4 flex gap-3">
                          <Link to="/iniciar-sesion" className="rounded-full bg-sand px-4 py-2 text-sm font-medium text-abyss">
                            Iniciar sesion
                          </Link>
                          <Link to="/registrarse" className="rounded-full border border-white/10 px-4 py-2 text-sm text-white">
                            Registrarse
                          </Link>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-5 space-y-4 rounded-2xl bg-abyss/60 p-4">
                        <div className="grid gap-2 sm:grid-cols-3">
                          {["Mercado Pago", "Visa", "Mastercard"].map((provider) => (
                            <button
                              key={provider}
                              type="button"
                              onClick={() => setPurchaseProvider(provider)}
                              className={`rounded-2xl px-4 py-3 text-sm ${purchaseProvider === provider ? "bg-sand text-abyss" : "bg-white/10 text-white"}`}
                            >
                              {provider}
                            </button>
                          ))}
                        </div>
                        {purchaseProvider !== "Mercado Pago" && (
                          <input
                            value={purchaseLast4}
                            onChange={(event) => setPurchaseLast4(event.target.value.replace(/\D/g, "").slice(0, 4))}
                            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none"
                            placeholder="Ultimos 4 digitos de la tarjeta"
                          />
                        )}
                        <div className="rounded-2xl border border-aurora/25 bg-aurora/10 p-4 text-sm text-steel">
                          <p>
                            {course.isUnlocked && !course.isFree ? "Comprado" : `${course.commerce?.currency ?? "USD"} ${course.price}`}
                            {profile.referralSummary?.qualifiedCount ? ` - hasta ${profile.referralSummary.discountPercent}% de descuento por referido activo` : ""}
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={purchasing}
                          className="w-full rounded-full bg-sand px-5 py-3 text-sm font-medium text-abyss disabled:opacity-60"
                          onClick={async () => {
                            setPurchasing(true);
                            const result = await purchaseCourse(course.slug, {
                              provider: purchaseProvider,
                              brand: purchaseProvider,
                              last4: purchaseProvider === "Mercado Pago" ? "0000" : purchaseLast4
                            });
                            setPurchasing(false);
                            if (result.error) {
                              setFeedback(result.error);
                              return;
                            }
                            if (result.course) {
                              setCourse((current) =>
                                current
                                  ? {
                                      ...current,
                                      ...result.course,
                                      comments: current.comments,
                                      activity: current.activity
                                    }
                                  : current
                              );
                            }
                            setFeedback("Pago registrado y curso marcado como comprado para tu cuenta.");
                          }}
                        >
                          {purchasing ? "Procesando compra..." : "Comprar y desbloquear"}
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-[34px] border border-white/10 bg-white/5 p-6">
                    <h2 className="text-xl font-semibold text-sand">Estado de acceso</h2>
                    <p className="mt-4 text-sm leading-7 text-steel">
                      {course.isFree
                        ? "Esta guia queda abierta como muestra publica del campus."
                        : `Curso comprado${course.commerce?.latestPurchase ? ` por ${course.commerce.latestPurchase.provider}` : ""}. Ya puedes avanzar por secciones, test final y comentarios.`}
                    </p>
                  </div>
                )}

                <div className="rounded-[34px] border border-white/10 bg-white/5 p-6">
                  <h2 className="text-xl font-semibold text-sand">Progreso del curso</h2>
                  <div className="mt-5 h-2 rounded-full bg-white/10">
                    <div className="h-2 rounded-full bg-gradient-to-r from-aurora to-flare" style={{ width: `${course.sections.length ? Math.round((completedCount / course.sections.length) * 100) : 0}%` }} />
                  </div>
                  <p className="mt-4 text-sm leading-7 text-steel">{completedCount}/{course.sections.length} secciones hechas{finalChallengeDone ? " - test final aprobado" : ""}.</p>
                </div>

                <div ref={commentsRef} className="rounded-[34px] border border-white/10 bg-white/5 p-6">
                  <h2 className="text-xl font-semibold text-sand">Comentarios y estrellas</h2>
                  <form
                    className="mt-5 space-y-4 rounded-2xl bg-abyss/60 p-4"
                    onSubmit={async (event) => {
                      event.preventDefault();
                      if (!commentBody.trim()) {
                        setFeedback("Escribe un comentario antes de enviarlo.");
                        return;
                      }
                      if (!slug) {
                        return;
                      }

                      setSubmittingComment(true);
                      try {
                        const response = await api.addComment(slug, { body: commentBody, stars: commentStars });
                        const comment: Comment = {
                          id: Number(response.comment.id),
                          user: response.comment.user,
                          courseId: String(response.comment.courseId ?? slug),
                          body: response.comment.body,
                          stars: Number(response.comment.stars ?? commentStars)
                        };
                        setCourse((current) => (current ? { ...current, comments: [...current.comments, comment] } : current));
                        setCommentBody("");
                        setCommentStars(5);
                        if (pendingReturnAfterOpinion) {
                          setPendingReturnAfterOpinion(false);
                          setFeedback("Comentario publicado. Regresando al inicio...");
                          window.setTimeout(() => navigate("/"), 1100);
                        } else {
                          setFeedback("Comentario publicado correctamente.");
                        }
                      } catch (requestError) {
                        setFeedback(getErrorMessage(requestError, "No se pudo publicar el comentario."));
                      } finally {
                        setSubmittingComment(false);
                      }
                    }}
                  >
                    <textarea
                      value={commentBody}
                      onChange={(event) => setCommentBody(event.target.value)}
                      className="min-h-28 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none"
                      placeholder={!authResolved ? "Verificando sesion..." : !profile ? "Inicia sesion para comentar" : canAccessPremium ? "Comparte tu opinion sobre el curso" : "Debes desbloquear el curso para comentar"}
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      {[1, 2, 3, 4, 5].map((value) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setCommentStars(value)}
                          className={`rounded-full px-3 py-2 text-sm ${commentStars === value ? "bg-sand text-abyss" : "bg-white/10 text-white"}`}
                        >
                          {value} estrella{value > 1 ? "s" : ""}
                        </button>
                      ))}
                    </div>
                    <button disabled={submittingComment || !canComment} className="rounded-full bg-sand px-5 py-3 text-sm font-medium text-abyss disabled:opacity-60">
                      {submittingComment ? "Enviando..." : pendingReturnAfterOpinion ? "Publicar y volver" : "Publicar comentario"}
                    </button>
                  </form>

                  <div className="mt-5 space-y-3">
                    {course.comments.map((comment) => (
                      <div key={comment.id} className="rounded-2xl bg-abyss/60 px-4 py-3 text-sm">
                        <p className="font-medium text-white">{comment.user}</p>
                        <div className="mt-1 flex gap-1 text-flare">
                          {Array.from({ length: comment.stars }).map((_, index) => (
                            <Star key={`${comment.id}-${index}`} size={14} className="fill-flare text-flare" />
                          ))}
                        </div>
                        <p className="mt-2 text-steel">{comment.body}</p>
                      </div>
                    ))}
                    {!course.comments.length && <p className="text-sm text-steel">Todavia no hay comentarios para este curso.</p>}
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  );
};
