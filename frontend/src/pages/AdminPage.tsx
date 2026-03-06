import { BarChart3, BookOpenCheck, Bot, DollarSign, MessagesSquare, Plus, Save, Users, Video } from "lucide-react";
import { useEffect, useState } from "react";
import { api, getErrorMessage } from "../lib/api";
import { useAppContext } from "../store/AppContext";
import type { AdminCoursePayload, AdminCourseSectionPayload } from "../types";

const createEmptySection = (): AdminCourseSectionPayload => ({
  title: "",
  duration: "10 min",
  isPreview: false,
  documentBody: "",
  videoUrl: "",
  videoSummary: "",
  activityBody: "",
  quizBody: ""
});

export const AdminPage = () => {
  const { stats, courses, createAdminCourse } = useAppContext();
  const [faqDraft, setFaqDraft] = useState("");
  const [knowledgeDraft, setKnowledgeDraft] = useState("");
  const [supportMessage, setSupportMessage] = useState<string | null>(null);
  const [savingSupport, setSavingSupport] = useState(false);
  const [courseMessage, setCourseMessage] = useState<string | null>(null);
  const [creatingCourse, setCreatingCourse] = useState(false);
  const [courseForm, setCourseForm] = useState<AdminCoursePayload>({
    title: "",
    slug: "",
    subtitle: "Curso premium",
    description: "",
    level: "Intermedio",
    isFree: false,
    price: 39,
    tags: ["Premium", "Nuevo curso"],
    sections: [createEmptySection(), createEmptySection()]
  });

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await api.supportContent();
        if (!active) {
          return;
        }
        setFaqDraft(response.faq.join("\n"));
        setKnowledgeDraft(response.knowledge.join("\n"));
      } catch {
        if (!active) {
          return;
        }
        setFaqDraft("Como pagar\nComo desbloquear cursos\nComo funciona el progreso");
        setKnowledgeDraft("Nueva info de matchups, build orders, timings y respuestas frecuentes del soporte.");
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const updateSection = (index: number, patch: Partial<AdminCourseSectionPayload>) => {
    setCourseForm((current) => ({
      ...current,
      sections: current.sections.map((section, sectionIndex) => (sectionIndex === index ? { ...section, ...patch } : section))
    }));
  };

  return (
    <div className="space-y-8 pb-16">
      <section className="rounded-[36px] border border-white/10 bg-white/5 p-8">
        <p className="text-sm uppercase tracking-[0.35em] text-aurora">Panel administrador</p>
        <h1 className="mt-4 text-4xl font-semibold text-sand">Control de cursos, ingresos, usuarios y base de conocimiento.</h1>
        <p className="mt-5 max-w-3xl text-base leading-8 text-steel">
          Desde aqui puedes crear nuevas rutas, definir videos obligatorios con resumen accesible y mantener actualizado el soporte guiado que aparece abajo a la izquierda.
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

      <section className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="rounded-[30px] border border-white/10 bg-white/5 p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-sand">Crear curso nuevo</h2>
              <p className="mt-2 text-sm leading-7 text-steel">Cada seccion crea documento, video obligatorio, resumen accesible, actividad y quiz tactico.</p>
            </div>
            <button
              type="button"
              onClick={() => setCourseForm((current) => ({ ...current, sections: [...current.sections, createEmptySection()] }))}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white"
            >
              <Plus size={16} />
              Agregar seccion
            </button>
          </div>

          <form
            className="mt-6 space-y-5"
            onSubmit={async (event) => {
              event.preventDefault();
              setCreatingCourse(true);
              const result = await createAdminCourse({
                ...courseForm,
                tags: courseForm.tags.filter((tag) => tag.trim())
              });
              setCreatingCourse(false);
              if (result.error) {
                setCourseMessage(result.error);
                return;
              }
              setCourseMessage(`Curso creado: ${result.course?.title ?? courseForm.title}`);
              setCourseForm({
                title: "",
                slug: "",
                subtitle: "Curso premium",
                description: "",
                level: "Intermedio",
                isFree: false,
                price: 39,
                tags: ["Premium", "Nuevo curso"],
                sections: [createEmptySection(), createEmptySection()]
              });
            }}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <input value={courseForm.title} onChange={(event) => setCourseForm((current) => ({ ...current, title: event.target.value }))} className="rounded-2xl border border-white/10 bg-abyss/60 px-4 py-3 outline-none" placeholder="Titulo del curso" />
              <input value={courseForm.slug ?? ""} onChange={(event) => setCourseForm((current) => ({ ...current, slug: event.target.value }))} className="rounded-2xl border border-white/10 bg-abyss/60 px-4 py-3 outline-none" placeholder="Slug opcional" />
              <input value={courseForm.subtitle} onChange={(event) => setCourseForm((current) => ({ ...current, subtitle: event.target.value }))} className="rounded-2xl border border-white/10 bg-abyss/60 px-4 py-3 outline-none" placeholder="Subtitulo" />
              <input value={courseForm.level} onChange={(event) => setCourseForm((current) => ({ ...current, level: event.target.value }))} className="rounded-2xl border border-white/10 bg-abyss/60 px-4 py-3 outline-none" placeholder="Nivel" />
              <input
                value={courseForm.tags.join(", ")}
                onChange={(event) => setCourseForm((current) => ({ ...current, tags: event.target.value.split(",").map((tag) => tag.trim()).filter(Boolean) }))}
                className="rounded-2xl border border-white/10 bg-abyss/60 px-4 py-3 outline-none md:col-span-2"
                placeholder="Tags separadas por coma"
              />
              <textarea value={courseForm.description} onChange={(event) => setCourseForm((current) => ({ ...current, description: event.target.value }))} className="min-h-28 rounded-2xl border border-white/10 bg-abyss/60 px-4 py-3 outline-none md:col-span-2" placeholder="Descripcion del curso" />
            </div>

            <div className="flex flex-wrap items-center gap-4 rounded-3xl border border-white/10 bg-abyss/40 px-4 py-4">
              <label className="inline-flex items-center gap-3 text-sm text-white">
                <input type="checkbox" checked={courseForm.isFree} onChange={(event) => setCourseForm((current) => ({ ...current, isFree: event.target.checked, price: event.target.checked ? 0 : current.price || 39 }))} />
                Curso gratuito
              </label>
              <input
                type="number"
                min={0}
                value={courseForm.price}
                disabled={courseForm.isFree}
                onChange={(event) => setCourseForm((current) => ({ ...current, price: Number(event.target.value) }))}
                className="w-40 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 outline-none disabled:opacity-60"
                placeholder="Precio"
              />
            </div>

            <div className="space-y-4">
              {courseForm.sections.map((section, index) => (
                <div key={`section-${index}`} className="rounded-[26px] border border-white/10 bg-abyss/55 p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm uppercase tracking-[0.25em] text-aurora">Seccion {index + 1}</p>
                      <p className="mt-2 text-lg font-medium text-white">Video obligatorio + resumen accesible</p>
                    </div>
                    {courseForm.sections.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setCourseForm((current) => ({ ...current, sections: current.sections.filter((_, sectionIndex) => sectionIndex !== index) }))}
                        className="rounded-full border border-white/10 px-3 py-2 text-xs text-white"
                      >
                        Quitar
                      </button>
                    )}
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <input value={section.title} onChange={(event) => updateSection(index, { title: event.target.value })} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none" placeholder="Titulo de la seccion" />
                    <input value={section.duration} onChange={(event) => updateSection(index, { duration: event.target.value })} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none" placeholder="Duracion" />
                    <input value={section.videoUrl} onChange={(event) => updateSection(index, { videoUrl: event.target.value })} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none md:col-span-2" placeholder="URL del video (mp4 o enlace embebible)" />
                    <textarea value={section.videoSummary} onChange={(event) => updateSection(index, { videoSummary: event.target.value })} className="min-h-24 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none md:col-span-2" placeholder="Resumen accesible del video para usuarios sordos o para repaso rapido" />
                    <textarea value={section.documentBody} onChange={(event) => updateSection(index, { documentBody: event.target.value })} className="min-h-24 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none" placeholder="Explicacion/documento de la seccion" />
                    <textarea value={section.activityBody} onChange={(event) => updateSection(index, { activityBody: event.target.value })} className="min-h-24 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none" placeholder="Actividad guiada" />
                    <textarea value={section.quizBody} onChange={(event) => updateSection(index, { quizBody: event.target.value })} className="min-h-24 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none md:col-span-2" placeholder="Quiz o test corto de la seccion" />
                    <label className="inline-flex items-center gap-3 text-sm text-white md:col-span-2">
                      <input type="checkbox" checked={Boolean(section.isPreview)} onChange={(event) => updateSection(index, { isPreview: event.target.checked })} />
                      Dejar documento de esta seccion visible como preview
                    </label>
                  </div>
                </div>
              ))}
            </div>

            <button disabled={creatingCourse} className="inline-flex items-center gap-2 rounded-full bg-sand px-5 py-3 text-sm font-medium text-abyss disabled:opacity-60">
              <Video size={16} />
              {creatingCourse ? "Creando curso..." : "Crear curso"}
            </button>
            {courseMessage && <p className="rounded-2xl bg-white/5 px-4 py-3 text-sm text-steel">{courseMessage}</p>}
          </form>
        </div>

        <div className="space-y-6">
          <div className="rounded-[30px] border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-semibold text-sand">Cursos actuales</h2>
            <div className="mt-5 space-y-3">
              {courses.map((course) => (
                <div key={course.id} className="rounded-2xl bg-abyss/60 px-4 py-4">
                  <p className="font-medium text-white">{course.title}</p>
                  <p className="mt-1 text-xs text-steel">{course.isFree ? "Gratis" : course.isUnlocked ? "Comprado/desbloqueado" : `USD ${course.price}`} · {course.sections.length} secciones</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[30px] border border-white/10 bg-white/5 p-6">
            <div className="flex items-center gap-3">
              <MessagesSquare className="text-aurora" />
              <h2 className="text-xl font-semibold text-sand">FAQ del chat</h2>
            </div>
            <textarea className="mt-5 min-h-36 w-full rounded-2xl border border-white/10 bg-abyss/60 px-4 py-3 outline-none" value={faqDraft} onChange={(event) => setFaqDraft(event.target.value)} />
          </div>

          <div className="rounded-[30px] border border-white/10 bg-white/5 p-6">
            <div className="flex items-center gap-3">
              <Bot className="text-flare" />
              <h2 className="text-xl font-semibold text-sand">Base de conocimiento IA</h2>
            </div>
            <textarea className="mt-5 min-h-36 w-full rounded-2xl border border-white/10 bg-abyss/60 px-4 py-3 outline-none" value={knowledgeDraft} onChange={(event) => setKnowledgeDraft(event.target.value)} />
            <button
              type="button"
              disabled={savingSupport}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-sand px-5 py-3 text-sm font-medium text-abyss disabled:opacity-60"
              onClick={async () => {
                setSavingSupport(true);
                try {
                  const response = await api.adminSaveSupport({
                    faq: faqDraft.split("\n").map((line) => line.trim()).filter(Boolean),
                    knowledge: knowledgeDraft.split("\n").map((line) => line.trim()).filter(Boolean)
                  });
                  setFaqDraft(response.faq.join("\n"));
                  setKnowledgeDraft(response.knowledge.join("\n"));
                  setSupportMessage("Soporte guiado actualizado correctamente.");
                } catch (error) {
                  setSupportMessage(getErrorMessage(error, "No se pudo guardar el contenido del soporte."));
                } finally {
                  setSavingSupport(false);
                }
              }}
            >
              <Save size={16} />
              {savingSupport ? "Guardando soporte..." : "Guardar soporte guiado"}
            </button>
            {supportMessage && <p className="mt-4 rounded-2xl bg-white/5 px-4 py-3 text-sm text-steel">{supportMessage}</p>}
          </div>
        </div>
      </section>
    </div>
  );
};
