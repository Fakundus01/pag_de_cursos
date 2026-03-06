import { ArrowRight, CheckCircle2, LockKeyhole, PlayCircle, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CourseCard } from "../components/shared/CourseCard";
import { CourseDropdown } from "../components/shared/CourseDropdown";
import { SectionHeading } from "../components/shared/SectionHeading";
import { useAppContext } from "../store/AppContext";

export const HomePage = () => {
  const { t } = useTranslation();
  const { courses, progress } = useAppContext();
  const freeCourse = courses.find((course) => course.isFree)!;
  const premiumCourses = courses.filter((course) => !course.isFree);

  return (
    <div className="space-y-20 pb-20">
      <section className="grid gap-10 lg:grid-cols-[1.25fr_0.75fr] lg:items-center">
        <div className="animate-reveal">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-sm text-aurora">
            <Sparkles size={16} />
            Plataforma de cursos con muestra gratis, premium y progreso
          </div>
          <h1 className="max-w-3xl text-5xl font-semibold leading-tight text-sand md:text-6xl">{t("heroTitle")}</h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-steel">{t("heroBody")}</p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link to={`/curso/${freeCourse.slug}`} target="_blank" rel="noreferrer" className="rounded-full bg-sand px-6 py-3 font-medium text-abyss">
              {t("freeDoc")}
            </Link>
            <CourseDropdown />
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {[
              "Auth con cookies y perfil editable",
              "Cursos pagos con candado y comentarios",
              "Admin con analitica, FAQ y base IA"
            ].map((item) => (
              <div key={item} className="rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-white/90">
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="relative animate-float">
          <div className="absolute inset-4 rounded-[36px] bg-aurora/20 blur-3xl" />
          <div className="relative rounded-[36px] border border-white/10 bg-white/[0.07] p-6 shadow-glow backdrop-blur-xl">
            <p className="text-sm uppercase tracking-[0.35em] text-aurora">Ruta visible</p>
            <h2 className="mt-3 text-2xl font-semibold text-sand">{freeCourse.title}</h2>
            <p className="mt-4 text-sm leading-7 text-steel">{freeCourse.description}</p>

            <div className="mt-6 space-y-3">
              {freeCourse.sections.map((section) => (
                <div key={section.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <PlayCircle size={16} className="text-aurora" />
                    <span>{section.title}</span>
                  </div>
                  <span className="text-xs text-steel">{section.duration}</span>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-3xl bg-gradient-to-r from-aurora/20 to-flare/20 p-4 text-sm text-white">
              Al completar una seccion desde la ventana del curso, el home actualiza el progreso automaticamente.
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-8">
        <SectionHeading
          eyebrow="Muestra + venta"
          title="Una doc gratuita arriba, luego los cursos premium bloqueados"
          body="La primera experiencia da confianza. Debajo aparecen las rutas pagas con precio, valoracion, mini progreso y bloqueo visual claro."
        />
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {courses.map((course) => {
            const completedSections = progress[course.id]?.length ?? 0;
            const sectionCount = course.sections.length;
            const percentage = Math.round((completedSections / sectionCount) * 100);
            return <CourseCard key={course.id} course={course} progress={percentage} />;
          })}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-[30px] border border-white/10 bg-white/5 p-6">
          <CheckCircle2 className="text-aurora" />
          <h3 className="mt-4 text-xl font-semibold text-sand">Actividades variables</h3>
          <p className="mt-3 text-sm leading-7 text-steel">
            Base para actividades generadas por IA entrenada con conocimiento de StarCraft y formularios creados por el equipo.
          </p>
        </div>
        <div className="rounded-[30px] border border-white/10 bg-white/5 p-6">
          <LockKeyhole className="text-flare" />
          <h3 className="mt-4 text-xl font-semibold text-sand">Pago y desbloqueo</h3>
          <p className="mt-3 text-sm leading-7 text-steel">
            Estructura preparada para Mercado Pago, Visa y Mastercard con cards guardadas y programa de referidos.
          </p>
        </div>
        <div className="rounded-[30px] border border-white/10 bg-white/5 p-6">
          <ArrowRight className="text-sand" />
          <h3 className="mt-4 text-xl font-semibold text-sand">Seguimiento y trofeos</h3>
          <p className="mt-3 text-sm leading-7 text-steel">
            Recomendaciones, cursos completados, dias seguidos, minijuegos y progreso por curso desde el perfil.
          </p>
        </div>
      </section>

      <section className="rounded-[36px] border border-white/10 bg-white/5 p-8">
        <SectionHeading
          eyebrow="Premium"
          title={t("premiumCourses")}
          body="Los cursos pagos se muestran siempre con candado. El acceso real se habilita cuando el backend confirme la compra."
        />
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {premiumCourses.map((course) => (
            <div key={course.id} className="rounded-[28px] border border-white/10 bg-abyss/60 p-5">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-sand">{course.title}</h3>
                <span className="rounded-full border border-flare/40 bg-flare/10 px-3 py-1 text-xs text-flare">Candado activo</span>
              </div>
              <p className="mt-3 text-sm text-steel">{course.description}</p>
              <div className="mt-4 flex items-center justify-between text-sm">
                <span className="text-white">USD {course.price}</span>
                <Link to="/registrarse" className="text-aurora">
                  Crear cuenta
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

