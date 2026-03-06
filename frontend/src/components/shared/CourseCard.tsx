import { CheckCircle2, LockKeyhole, Star } from "lucide-react";
import { Link } from "react-router-dom";
import type { Course } from "../../types";

export const CourseCard = ({ course, progress = 0 }: { course: Course; progress?: number }) => {
  const showLocked = course.locked && !course.isUnlocked;
  const isCompleted = progress >= 100;

  return (
    <article className="group relative overflow-hidden rounded-[30px] border border-white/10 bg-white/[0.06] p-6 shadow-glow backdrop-blur-xl transition hover:-translate-y-1 hover:border-aurora/35">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(140,198,187,0.18),transparent_35%)] opacity-0 transition group-hover:opacity-100" />
      <div className="relative">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-aurora">{course.level}</span>
            <h3 className="mt-4 text-2xl font-semibold text-sand">{course.title}</h3>
            <p className="mt-2 text-sm text-steel">{course.subtitle}</p>
          </div>
          {isCompleted ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-aurora/35 bg-aurora/10 px-3 py-1 text-xs text-aurora">
              <CheckCircle2 size={14} />
              Completado
            </span>
          ) : showLocked ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-flare/35 bg-flare/10 px-3 py-1 text-xs text-flare">
              <LockKeyhole size={14} />
              Premium
            </span>
          ) : (
            <span className="rounded-full border border-aurora/40 bg-aurora/10 px-3 py-1 text-xs text-aurora">
              {course.isFree ? "Free" : "Activo"}
            </span>
          )}
        </div>

        <p className="mt-5 text-sm leading-7 text-steel">{course.description}</p>

        <div className="mt-5 flex flex-wrap gap-2">
          {course.tags.map((tag) => (
            <span key={tag} className="rounded-full bg-white/[0.08] px-3 py-1 text-xs text-white/85">
              {tag}
            </span>
          ))}
        </div>

        <div className="mt-6 flex items-center justify-between text-sm text-steel">
          <span className="inline-flex items-center gap-2">
            <Star size={16} className="fill-flare text-flare" />
            {course.rating}
          </span>
          <span>{course.students} alumnos</span>
        </div>

        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between text-xs text-steel">
            <span>Progreso</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 rounded-full bg-white/10">
            <div className="h-2 rounded-full bg-gradient-to-r from-aurora to-flare" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-3 text-xs text-steel">{isCompleted ? "Ruta dominada. Ya aparece como hecha en tu perfil." : "Sigue avanzando para completar toda la ruta."}</p>
        </div>

        <div className="mt-7 flex items-center justify-between">
          <span className="text-lg font-semibold text-white">{course.isFree ? "Gratis" : `USD ${course.price}`}</span>
          <Link
            to={`/curso/${course.slug}`}
            target="_blank"
            rel="noreferrer"
            className={`rounded-full px-4 py-2 text-sm font-medium ${showLocked ? "bg-white/10 text-white" : "bg-sand text-abyss"}`}
          >
            {showLocked ? "Ver demo" : isCompleted ? "Repasar curso" : "Abrir curso"}
          </Link>
        </div>
      </div>
    </article>
  );
};
