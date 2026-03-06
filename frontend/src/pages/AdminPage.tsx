import { BarChart3, BookOpenCheck, Bot, DollarSign, MessagesSquare, Users } from "lucide-react";
import { useAppContext } from "../store/AppContext";

export const AdminPage = () => {
  const { stats, courses } = useAppContext();

  return (
    <div className="space-y-8 pb-16">
      <section className="rounded-[36px] border border-white/10 bg-white/5 p-8">
        <p className="text-sm uppercase tracking-[0.35em] text-aurora">Panel administrador</p>
        <h1 className="mt-4 text-4xl font-semibold text-sand">Control de cursos, ingresos, usuarios y base de conocimiento.</h1>
        <p className="mt-5 max-w-3xl text-base leading-8 text-steel">
          Este panel deja preparada la UX para editar cursos, subir videos, imagenes, documentos, actividades, FAQ del chat y nuevas fuentes para la IA.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {[
          { icon: Users, label: "Usuarios registrados", value: stats.registeredUsers },
          { icon: BarChart3, label: "Usuarios activos", value: stats.activeUsers },
          { icon: BookOpenCheck, label: "Inscripciones premium", value: stats.premiumEnrollments },
          { icon: DollarSign, label: "Ingreso mensual", value: `$${stats.monthlyRevenue}` },
          { icon: Users, label: "Invitados", value: stats.guests }
        ].map((item) => (
          <div key={item.label} className="rounded-[28px] border border-white/10 bg-white/5 p-5">
            <item.icon className="text-aurora" />
            <p className="mt-4 text-sm text-steel">{item.label}</p>
            <p className="mt-2 text-3xl font-semibold text-sand">{item.value}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[30px] border border-white/10 bg-white/5 p-6">
          <h2 className="text-2xl font-semibold text-sand">Editor de cursos</h2>
          <div className="mt-5 space-y-3">
            {courses.map((course) => (
              <div key={course.id} className="rounded-2xl bg-abyss/60 px-4 py-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-white">{course.title}</p>
                    <p className="text-xs text-steel">{course.isFree ? "Gratis" : "Pago"} · {course.sections.length} secciones</p>
                  </div>
                  <button className="rounded-full bg-sand px-4 py-2 text-sm font-medium text-abyss">Editar</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-[30px] border border-white/10 bg-white/5 p-6">
            <div className="flex items-center gap-3">
              <MessagesSquare className="text-aurora" />
              <h2 className="text-xl font-semibold text-sand">FAQ del chat</h2>
            </div>
            <textarea
              className="mt-5 min-h-36 w-full rounded-2xl border border-white/10 bg-abyss/60 px-4 py-3 outline-none"
              defaultValue={"- Como pagar\n- Como desbloquear cursos\n- Como funciona el progreso"}
            />
          </div>

          <div className="rounded-[30px] border border-white/10 bg-white/5 p-6">
            <div className="flex items-center gap-3">
              <Bot className="text-flare" />
              <h2 className="text-xl font-semibold text-sand">Base de conocimiento IA</h2>
            </div>
            <textarea
              className="mt-5 min-h-36 w-full rounded-2xl border border-white/10 bg-abyss/60 px-4 py-3 outline-none"
              defaultValue={"Nueva info de matchups, build orders, timings y respuestas frecuentes del soporte."}
            />
          </div>
        </div>
      </section>
    </div>
  );
};
