import { CheckCircle2, ChevronLeft, LockKeyhole, ShieldCheck, Sparkles, Star } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
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

export const CoursePlayerPage = () => {
  const { slug } = useParams();
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

        <section className="grid gap-8 lg:grid-cols-[1fr_0.9fr]">
          <div className="rounded-[34px] border border-white/10 bg-white/5 p-7">
            <h2 className="text-2xl font-semibold text-sand">Secciones y actividades</h2>
            <div className="mt-6 space-y-4">
              {course.sections.map((section) => {
                const isCompleted = completedSections.has(section.id) || section.completed;
                return (
                  <div key={section.id} className="rounded-[24px] border border-white/10 bg-abyss/60 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <p className="text-lg font-medium text-white">{section.title}</p>
                        <p className="mt-2 text-sm text-steel">{section.duration} · video, doc, actividad y mini evaluacion</p>
                      </div>
                      <button
                        type="button"
                        disabled={savingSectionId === section.id || isCompleted || !canAccessPremium}
                        className="inline-flex items-center gap-2 rounded-full bg-sand px-4 py-2 text-sm font-medium text-abyss disabled:opacity-60"
                        onClick={async () => {
                          setSavingSectionId(section.id);
                          const result = await completeSection(course.slug, section.id);
                          setSavingSectionId(null);
                          if (result) {
                            setFeedback(result);
                            return;
                          }
                          setCourse((current) =>
                            current
                              ? {
                                  ...current,
                                  sections: current.sections.map((item) => (item.id === section.id ? { ...item, completed: true } : item))
                                }
                              : current
                          );
                          setFeedback("Seccion marcada como completada y sincronizada con tu perfil.");
                        }}
                      >
                        <CheckCircle2 size={16} />
                        {isCompleted ? "Completada" : savingSectionId === section.id ? "Guardando..." : "Marcar como hecha"}
                      </button>
                    </div>

                    <div className="mt-4 grid gap-3">
                      {(section.contentBlocks ?? []).map((content) => {
                        const isVisible = canAccessPremium || content.isPreview;
                        return (
                          <div key={content.id} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="font-medium text-white">{content.title}</p>
                                <p className="mt-1 text-xs uppercase tracking-[0.18em] text-aurora">{content.type} · {content.estimatedMinutes} min</p>
                              </div>
                              {isVisible ? (
                                <span className="rounded-full border border-aurora/40 bg-aurora/10 px-3 py-1 text-xs text-aurora">
                                  {content.isPreview && showLocked ? "Preview" : "Disponible"}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-2 rounded-full border border-flare/35 bg-flare/10 px-3 py-1 text-xs text-flare">
                                  <LockKeyhole size={12} />
                                  Bloqueado
                                </span>
                              )}
                            </div>
                            <p className="mt-3 leading-7 text-steel">{isVisible ? content.body : "Disponible al confirmar el pago del curso premium."}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[34px] border border-white/10 bg-white/5 p-6">
              <h2 className="text-xl font-semibold text-sand">Actividad guiada</h2>
              <p className="mt-4 text-sm leading-7 text-steel">{course.activity.title}</p>
              <div className="mt-5 space-y-3">
                {course.activity.questions.map((question) => (
                  <div key={question} className="rounded-2xl bg-abyss/60 px-4 py-3 text-sm">
                    {question}
                  </div>
                ))}
              </div>
            </div>

            {showLocked ? (
              <div className="rounded-[34px] border border-white/10 bg-white/5 p-6">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="text-aurora" />
                  <h2 className="text-xl font-semibold text-sand">Desbloquear curso</h2>
                </div>
                <p className="mt-4 text-sm leading-7 text-steel">
                  La sesion ya se verifica con cookie antes de cargar esta vista. Si compras desde aqui, el acceso premium se habilita en esta pestaña y en el resto al volver a enfocarlas.
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
                        {course.commerce?.currency ?? "USD"} {course.price}
                        {profile.referralSummary?.qualifiedCount ? ` · hasta ${profile.referralSummary.discountPercent}% de descuento por referido activo` : ""}
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
                        setFeedback("Pago registrado y curso desbloqueado para tu cuenta.");
                      }}
                    >
                      {purchasing ? "Procesando compra..." : `Comprar y desbloquear por ${course.commerce?.currency ?? "USD"} ${course.price}`}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-[34px] border border-white/10 bg-white/5 p-6">
                <h2 className="text-xl font-semibold text-sand">Acceso confirmado</h2>
                <p className="mt-4 text-sm leading-7 text-steel">
                  {course.isFree
                    ? "Esta guia queda abierta como muestra publica del campus."
                    : `Compra confirmada${course.commerce?.latestPurchase ? ` por ${course.commerce.latestPurchase.provider}` : ""}. Ya puedes completar actividades y comentar.`}
                </p>
              </div>
            )}

            <div className="rounded-[34px] border border-white/10 bg-white/5 p-6">
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
                    setFeedback("Comentario publicado correctamente.");
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
                  {submittingComment ? "Enviando..." : "Publicar comentario"}
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
      </div>
    </div>
  );
};
