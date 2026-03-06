import { LockKeyhole, Sparkles, Star } from "lucide-react";
import { SectionHeading } from "../components/shared/SectionHeading";
import { useAppContext } from "../store/AppContext";

export const CoursesPage = () => {
  const { courses } = useAppContext();

  return (
    <div className="space-y-10 pb-16">
      <SectionHeading
        eyebrow="Catalogo"
        title="Cursos con dropdown, muestra gratis y rutas bloqueadas"
        body="La pagina separa el contenido abierto del contenido premium, y deja claro el valor, formato y dificultad de cada ruta."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {courses.map((course) => {
          const showLocked = course.locked && !course.isUnlocked;
          return (
            <article key={course.id} className="rounded-[32px] border border-white/10 bg-white/5 p-7">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.25em] text-aurora">{course.level}</p>
                  <h2 className="mt-2 text-3xl font-semibold text-sand">{course.title}</h2>
                </div>
                {showLocked ? (
                  <span className="inline-flex items-center gap-2 rounded-full border border-flare/40 bg-flare/10 px-3 py-1 text-xs text-flare">
                    <LockKeyhole size={14} />
                    Bloqueado
                  </span>
                ) : (
                  <span className="rounded-full border border-aurora/40 bg-aurora/10 px-3 py-1 text-xs text-aurora">{course.isFree ? "Gratis" : "Desbloqueado"}</span>
                )}
              </div>

              <p className="mt-4 text-sm leading-7 text-steel">{course.description}</p>

              <div className="mt-6 grid gap-3">
                {course.sections.map((section) => (
                  <div key={section.id} className="flex items-center justify-between rounded-2xl bg-abyss/60 px-4 py-3">
                    <span>{section.title}</span>
                    <span className="text-xs text-steel">{section.duration}</span>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-steel">
                <span className="inline-flex items-center gap-2">
                  <Star size={16} className="fill-flare text-flare" />
                  {course.rating}
                </span>
                <span className="inline-flex items-center gap-2">
                  <Sparkles size={16} className="text-aurora" />
                  {course.students} estudiantes
                </span>
                <span>{course.isFree ? "Gratis" : `USD ${course.price}`}</span>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
};
