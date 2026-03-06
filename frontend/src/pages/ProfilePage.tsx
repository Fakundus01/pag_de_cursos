import { Award, CreditCard, Percent, ReceiptText, Trophy, UserRoundCheck, UsersRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAppContext } from "../store/AppContext";

export const ProfilePage = () => {
  const { profile, courses, updateProfile } = useAppContext();
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile) {
      return;
    }
    setName(profile.name);
    setAvatar(profile.avatar);
  }, [profile]);

  const enrolledCourses = useMemo(
    () => (profile ? courses.filter((course) => profile.enrolledCourseIds.includes(course.id)) : []),
    [courses, profile]
  );
  const completedCourses = useMemo(
    () => (profile ? courses.filter((course) => profile.completedCourseIds.includes(course.id)) : []),
    [courses, profile]
  );
  const recommendedCourses = useMemo(
    () => (profile ? courses.filter((course) => profile.recommendedCourseIds.includes(course.id)) : []),
    [courses, profile]
  );

  if (!profile) return null;

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

          <form
            className="mt-7 grid gap-3"
            onSubmit={async (event) => {
              event.preventDefault();
              setSaving(true);
              const result = await updateProfile({ name, avatar });
              setSaving(false);
              setMessage(result ?? "Perfil actualizado correctamente.");
            }}
          >
            <input value={name} onChange={(event) => setName(event.target.value)} className="rounded-2xl border border-white/10 bg-abyss/60 px-4 py-3 outline-none" placeholder="Nombre visible" />
            <input value={avatar} onChange={(event) => setAvatar(event.target.value.slice(0, 8).toUpperCase())} className="rounded-2xl border border-white/10 bg-abyss/60 px-4 py-3 outline-none" placeholder="Avatar corto" />
            <button disabled={saving} className="rounded-full bg-sand px-5 py-3 text-sm font-medium text-abyss disabled:opacity-60">
              {saving ? "Guardando..." : "Guardar perfil"}
            </button>
            {message && <p className="rounded-2xl bg-white/5 px-4 py-3 text-sm text-steel">{message}</p>}
          </form>
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
            <p className="mt-2 text-3xl font-semibold text-sand">{profile.referralSummary?.discountPercent ?? 10}%</p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <div className="rounded-[30px] border border-white/10 bg-white/5 p-6 xl:col-span-2">
          <h2 className="text-2xl font-semibold text-sand">Tus cursos</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {enrolledCourses.map((course) => {
              const percentage = course.sections.length === 0 ? 0 : Math.round(((profile.progressByCourse[course.id]?.length ?? 0) / course.sections.length) * 100);
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
            {!profile.savedCards.length && <p className="text-sm text-steel">Todavia no guardaste metodos de pago.</p>}
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
            {!recommendedCourses.length && <p className="text-sm text-steel">No hay recomendaciones nuevas por ahora.</p>}
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
            {!completedCourses.length && <p className="text-sm text-steel">Todavia no completaste cursos.</p>}
          </div>
        </div>

        <div className="rounded-[30px] border border-white/10 bg-white/5 p-6">
          <div className="flex items-center gap-3">
            <Trophy className="text-flare" />
            <h2 className="text-xl font-semibold text-sand">Trofeos</h2>
          </div>
          <div className="mt-5 space-y-3">
            {profile.trophies.map((trophy) => (
              <div key={trophy.id} className="rounded-2xl bg-abyss/60 px-4 py-3">
                <p>{trophy.title}</p>
                <p className="text-xs text-steel">{trophy.detail}</p>
              </div>
            ))}
            {!profile.trophies.length && <p className="text-sm text-steel">Aun no desbloqueaste trofeos.</p>}
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-[30px] border border-white/10 bg-white/5 p-6">
          <div className="flex items-center gap-3">
            <ReceiptText className="text-aurora" />
            <h2 className="text-xl font-semibold text-sand">Historial de compras</h2>
          </div>
          <div className="mt-5 space-y-3">
            {profile.purchaseHistory?.map((purchase) => (
              <div key={purchase.id} className="rounded-2xl bg-abyss/60 px-4 py-3">
                <p className="text-white">{purchase.courseTitle}</p>
                <p className="mt-1 text-xs text-steel">
                  {purchase.provider} · {purchase.currency} {purchase.totalAmount.toFixed(2)}
                  {purchase.discountAmount > 0 ? ` · descuento ${purchase.discountAmount.toFixed(2)}` : ""}
                </p>
              </div>
            ))}
            {!profile.purchaseHistory?.length && <p className="text-sm text-steel">Todavia no registraste compras premium.</p>}
          </div>
        </div>

        <div className="rounded-[30px] border border-white/10 bg-white/5 p-6">
          <div className="flex items-center gap-3">
            <UsersRound className="text-flare" />
            <h2 className="text-xl font-semibold text-sand">Referidos</h2>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl bg-abyss/60 px-4 py-4">
              <p className="text-xs text-steel">Enviados</p>
              <p className="mt-2 text-2xl font-semibold text-sand">{profile.referralSummary?.sentCount ?? 0}</p>
            </div>
            <div className="rounded-2xl bg-abyss/60 px-4 py-4">
              <p className="text-xs text-steel">Calificados</p>
              <p className="mt-2 text-2xl font-semibold text-sand">{profile.referralSummary?.qualifiedCount ?? 0}</p>
            </div>
            <div className="rounded-2xl bg-abyss/60 px-4 py-4">
              <p className="text-xs text-steel">Recompensados</p>
              <p className="mt-2 text-2xl font-semibold text-sand">{profile.referralSummary?.rewardedCount ?? 0}</p>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            {profile.referralSummary?.recent.map((referral) => (
              <div key={referral.id} className="rounded-2xl bg-abyss/60 px-4 py-3">
                <p>{referral.referredUser}</p>
                <p className="text-xs text-steel">{referral.status} · {referral.rewardPercent}%</p>
              </div>
            ))}
            {!profile.referralSummary?.recent.length && <p className="text-sm text-steel">Aun no hay referidos registrados.</p>}
          </div>
        </div>
      </section>
    </div>
  );
};
