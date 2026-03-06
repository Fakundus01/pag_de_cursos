import { CheckCircle2, ChevronLeft, LockKeyhole, Sparkles } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { saveProgress } from "../lib/storage";
import { useAppContext } from "../store/AppContext";

export const CoursePlayerPage = () => {
  const { slug } = useParams();
  const { courses, comments, refreshProgress } = useAppContext();
  const course = courses.find((item) => item.slug === slug);

  if (!course) {
    return (
      <div className="min-h-screen bg-abyss px-6 py-10 text-white">
        <p>Curso no encontrado.</p>
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
            {course.locked ? (
              <span className="inline-flex items-center gap-2 rounded-full border border-flare/40 bg-flare/10 px-4 py-2 text-sm text-flare">
                <LockKeyhole size={16} />
                Contenido premium bloqueado
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 rounded-full border border-aurora/40 bg-aurora/10 px-4 py-2 text-sm text-aurora">
                <Sparkles size={16} />
                Documento gratuito visible
              </span>
            )}
          </div>

          <p className="mt-5 max-w-3xl text-base leading-8 text-steel">{course.description}</p>
        </section>

        <section className="grid gap-8 lg:grid-cols-[1fr_0.9fr]">
          <div className="rounded-[34px] border border-white/10 bg-white/5 p-7">
            <h2 className="text-2xl font-semibold text-sand">Secciones y actividades</h2>
            <div className="mt-6 space-y-4">
              {course.sections.map((section) => (
                <div key={section.id} className="rounded-[24px] border border-white/10 bg-abyss/60 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="text-lg font-medium text-white">{section.title}</p>
                      <p className="mt-2 text-sm text-steel">{section.duration} · video, doc, actividad y mini evaluacion</p>
                    </div>
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 rounded-full bg-sand px-4 py-2 text-sm font-medium text-abyss"
                      onClick={() => {
                        saveProgress(course.id, section.id);
                        refreshProgress();
                      }}
                    >
                      <CheckCircle2 size={16} />
                      Marcar como hecha
                    </button>
                  </div>
                  <div className="mt-4 rounded-2xl bg-white/5 p-4 text-sm leading-7 text-steel">
                    Actividad IA ejemplo: segun scouting temprano, elige la reaccion correcta. Formulario propio: define build, timing y scout trigger.
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[34px] border border-white/10 bg-white/5 p-6">
              <h2 className="text-xl font-semibold text-sand">Minijuegos y metricas</h2>
              <div className="mt-5 space-y-3">
                <div className="rounded-2xl bg-abyss/60 px-4 py-3 text-sm">Reconocer build enemiga antes del minuto 3.</div>
                <div className="rounded-2xl bg-abyss/60 px-4 py-3 text-sm">Elegir el mejor counter timing en 30 segundos.</div>
                <div className="rounded-2xl bg-abyss/60 px-4 py-3 text-sm">Evaluacion de mapa y posicionamiento.</div>
              </div>
            </div>

            <div className="rounded-[34px] border border-white/10 bg-white/5 p-6">
              <h2 className="text-xl font-semibold text-sand">Comentarios y estrellas</h2>
              <div className="mt-5 space-y-3">
                {comments
                  .filter((comment) => comment.courseId === course.id)
                  .map((comment) => (
                    <div key={comment.id} className="rounded-2xl bg-abyss/60 px-4 py-3 text-sm">
                      <p className="font-medium text-white">{comment.user}</p>
                      <p className="mt-1 text-xs text-flare">{"?".repeat(comment.stars)}</p>
                      <p className="mt-2 text-steel">{comment.body}</p>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
