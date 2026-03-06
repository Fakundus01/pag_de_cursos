import { Award, CreditCard, Percent, Trophy, UserRoundCheck } from "lucide-react";
import { useAppContext } from "../store/AppContext";

export const ProfilePage = () => {
  const { profile, courses, trophies, progress } = useAppContext();

  if (!profile) return null;

  const enrolledCourses = courses.filter((course) => profile.enrolledCourseIds.includes(course.id));
  const completedCourses = courses.filter((course) => profile.completedCourseIds.includes(course.id));
  const recommendedCourses = courses.filter((course) => !profile.enrolledCourseIds.includes(course.id));

  return (
    <div className="space-y-8 pb-16">
      <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[34px] border border-white/10 bg-white/5 p-7">
          <div className="flex items-center gap-4">
            <div className="grid h-20 w-20 place-items-center rounded-3xl bg-gradient-to-br from-aurora to-sand text-2xl font-semibold text-abyss">
              {profile.avatar}
            </div>
            <div>
              <h1 className="text-3xl font-semibold text-sand">{profile.name}</h1>
              <p className="mt-1 text-steel">{profile.email}</p>
            </div>
          </div>

          <div className="mt-7 grid gap-3">
            <div className="rounded-2xl bg-abyss/60 px-4 py-3 text-sm">Perfil editable, avatar, bio, idioma y preferencias de estudio.</div>
            <div className="rounded-2xl bg-abyss/60 px-4 py-3 text-sm">Sesion persistente con cookies y email validado desde backend.</div>
            <div className="rounded-2xl bg-abyss/60 px-4 py-3 text-sm">Cards guardadas para autocompletar futuras compras.</div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-[30px] border border-white/10 bg-white/5 p-6">
            <UserRoundCheck className="text-aurora" />
            <p className="mt-5 text-sm text-steel">Cursos inscriptos</p>
            <p className="mt-2 text-3xl font-semibold text-sand">{enrolledCourses.length}</p>
          </div>
          <div className="rounded-[30px] border border-white/10 bg-white/5 p-6">
            <Award className="text-flare" />
            <p className="mt-5 text-sm text-steel">Racha activa</p>
            <p className="mt-2 text-3xl font-semibold text-sand">{profile.streakDays} dias</p>
          </div>
          <div className="rounded-[30px] border border-white/10 bg-white/5 p-6">
            <Percent className="text-sand" />
            <p className="mt-5 text-sm text-steel">Descuento por referidos</p>
            <p className="mt-2 text-3xl font-semibold text-sand">10%</p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <div className="rounded-[30px] border border-white/10 bg-white/5 p-6 xl:col-span-2">
          <h2 className="text-2xl font-semibold text-sand">Tus cursos</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {enrolledCourses.map((course) => {
              const percentage = Math.round(((progress[course.id]?.length ?? 0) / course.sections.length) * 100);
              return (
                <div key={course.id} className="rounded-[24px] bg-abyss/70 p-5">
                  <p className="text-lg font-semibold text-sand">{course.title}</p>
                  <p className="mt-2 text-sm text-steel">{course.subtitle}</p>
                  <div className="mt-4 h-2 rounded-full bg-white/10">
                    <div className="h-2 rounded-full bg-gradient-to-r from-aurora to-flare" style={{ width: `${percentage}%` }} />
                  </div>
                  <p className="mt-2 text-xs text-steel">{percentage}% completado</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-[30px] border border-white/10 bg-white/5 p-6">
          <div className="flex items-center gap-3">
            <CreditCard className="text-aurora" />
            <h2 className="text-xl font-semibold text-sand">Tarjetas guardadas</h2>
          </div>
          <div className="mt-5 space-y-3">
            {profile.savedCards.map((card) => (
              <div key={card} className="rounded-2xl bg-abyss/60 px-4 py-3 text-sm text-white">
                {card}
              </div>
            ))}
          </div>
          <p className="mt-5 text-sm text-steel">Link de referido: academy.gg/invite/{profile.referralCode}</p>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-[30px] border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-semibold text-sand">Cursos recomendados</h2>
          <div className="mt-5 space-y-3">
            {recommendedCourses.map((course) => (
              <div key={course.id} className="rounded-2xl bg-abyss/60 px-4 py-3">
                <p>{course.title}</p>
                <p className="text-xs text-steel">{course.level}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[30px] border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-semibold text-sand">Cursos completados</h2>
          <div className="mt-5 space-y-3">
            {completedCourses.map((course) => (
              <div key={course.id} className="rounded-2xl bg-abyss/60 px-4 py-3">
                <p>{course.title}</p>
                <p className="text-xs text-steel">Completado</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[30px] border border-white/10 bg-white/5 p-6">
          <div className="flex items-center gap-3">
            <Trophy className="text-flare" />
            <h2 className="text-xl font-semibold text-sand">Trofeos</h2>
          </div>
          <div className="mt-5 space-y-3">
            {trophies.map((trophy) => (
              <div key={trophy.id} className="rounded-2xl bg-abyss/60 px-4 py-3">
                <p>{trophy.title}</p>
                <p className="text-xs text-steel">{trophy.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};
