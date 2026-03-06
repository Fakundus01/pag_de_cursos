import { BarChart3, BookOpenCheck, Bot, DollarSign, ImagePlus, MessagesSquare, Plus, Save, UploadCloud, Users, Video } from "lucide-react";
import { useEffect, useState, type ChangeEvent } from "react";
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

const createInitialCourseForm = (): AdminCoursePayload => ({
  title: "",
  slug: "",
  subtitle: "Curso premium",
  description: "",
  imageUrl: "",
  level: "Intermedio",
  isFree: false,
  price: 39,
  tags: ["Premium", "Nuevo curso"],
  sections: [createEmptySection(), createEmptySection()]
});

const sanitizeSlugFragment = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const AdminPage = () => {
  const { stats, courses, createAdminCourse } = useAppContext();
  const [faqDraft, setFaqDraft] = useState("");
  const [knowledgeDraft, setKnowledgeDraft] = useState("");
  const [supportMessage, setSupportMessage] = useState<string | null>(null);
  const [savingSupport, setSavingSupport] = useState(false);
  const [courseMessage, setCourseMessage] = useState<string | null>(null);
  const [creatingCourse, setCreatingCourse] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingSectionVideo, setUploadingSectionVideo] = useState<number | null>(null);
  const [courseForm, setCourseForm] = useState<AdminCoursePayload>(createInitialCourseForm());

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

  const uploadFolderBase = () => sanitizeSlugFragment(courseForm.slug || courseForm.title || "nuevo-curso") || "nuevo-curso";

  const uploadMedia = async (file: File, kind: "image" | "video", folder: string) => {
    const payload = new FormData();
    payload.set("file", file);
    payload.set("kind", kind);
    payload.set("folder", folder);
    return api.adminUploadMedia(payload);
  };

  const handleCoverUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    setUploadingCover(true);
    try {
      const upload = await uploadMedia(file, "image", `${uploadFolderBase()}/cover`);
      setCourseForm((current) => ({ ...current, imageUrl: upload.url }));
      setCourseMessage("Portada subida correctamente. Se usara al crear el curso.");
    } catch (error) {
      setCourseMessage(getErrorMessage(error, "No se pudo subir la portada."));
    } finally {
      setUploadingCover(false);
    }
  };

  const handleSectionVideoUpload = async (index: number, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    setUploadingSectionVideo(index);
    try {
      const upload = await uploadMedia(file, "video", `${uploadFolderBase()}/section-${index + 1}`);
      updateSection(index, { videoUrl: upload.url });
      setCourseMessage(`Video de la seccion ${index + 1} subido correctamente.`);
    } catch (error) {
      setCourseMessage(getErrorMessage(error, "No se pudo subir el video de la seccion."));
    } finally {
      setUploadingSectionVideo(null);
    }
  };

  return (
    <div className="space-y-8 pb-16">
      <section className="rounded-[36px] border border-white/10 bg-white/5 p-8">
        <p className="text-sm uppercase tracking-[0.35em] text-aurora">Panel administrador</p>
        <h1 className="mt-4 text-4xl font-semibold text-sand">Control de cursos, ingresos, usuarios y base de conocimiento.</h1>
        <p className="mt-5 max-w-3xl text-base leading-8 text-steel">
          Desde aqui puedes crear nuevas rutas, subir portada y videos propios, definir videos obligatorios con resumen accesible y mantener actualizado el soporte guiado.
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
                imageUrl: courseForm.imageUrl?.trim() || "",
                tags: courseForm.tags.filter((tag) => tag.trim())
              });
              setCreatingCourse(false);
              if (result.error) {
                setCourseMessage(result.error);
                return;
              }
              setCourseMessage(`Curso creado: ${result.course?.title ?? courseForm.title}`);
              setCourseForm(createInitialCourseForm());
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
              <input value={courseForm.imageUrl ?? ""} onChange={(event) => setCourseForm((current) => ({ ...current, imageUrl: event.target.value }))} className="rounded-2xl border border-white/10 bg-abyss/60 px-4 py-3 outline-none md:col-span-2" placeholder="URL de portada o usa el upload" />
            </div>

            <div className="rounded-[26px] border border-white/10 bg-abyss/50 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <label className={`inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white ${uploadingCover ? "opacity-60" : ""}`}>
                  <ImagePlus size={16} />
                  {uploadingCover ? "Subiendo portada..." : "Subir portada"}
                  <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={handleCoverUpload} disabled={uploadingCover} />
                </label>
                {courseForm.imageUrl && (
                  <a href={courseForm.imageUrl} target="_blank" rel="noreferrer" className="text-sm text-aurora">
                    Abrir portada actual
                  </a>
                )}
                <span className="text-xs text-steel">Formatos: png, jpg, jpeg, webp, gif.</span>
              </div>
              <div className="mt-4 overflow-hidden rounded-[22px] border border-white/10 bg-black/30">
                {courseForm.imageUrl ? (
                  <img src={courseForm.imageUrl} alt="Preview de portada" className="h-48 w-full object-cover" />
                ) : (
                  <div className="flex h-48 items-center justify-center bg-[radial-gradient(circle_at_top_right,rgba(140,198,187,0.22),transparent_34%),linear-gradient(135deg,rgba(8,26,36,0.98),rgba(17,56,77,0.92))] text-sm text-steel">
                    La portada aparecera aqui cuando subas una imagen.
                  </div>
                )}
              </div>
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
                    <input value={section.videoUrl} onChange={(event) => updateSection(index, { videoUrl: event.target.value })} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none md:col-span-2" placeholder="URL del video (mp4, YouTube, Vimeo, Loom o Drive)" />
                    <div className="flex flex-wrap items-center gap-3 md:col-span-2">
                      <label className={`inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white ${uploadingSectionVideo === index ? "opacity-60" : ""}`}>
                        <UploadCloud size={16} />
                        {uploadingSectionVideo === index ? "Subiendo video..." : "Subir video propio"}
                        <input
                          type="file"
                          accept="video/mp4,video/webm,video/ogg,video/quicktime,video/x-m4v"
                          className="hidden"
                          onChange={(event) => void handleSectionVideoUpload(index, event)}
                          disabled={uploadingSectionVideo !== null}
                        />
                      </label>
                      {section.videoUrl && (
                        <a href={section.videoUrl} target="_blank" rel="noreferrer" className="text-sm text-aurora">
                          Abrir video actual
                        </a>
                      )}
                      <span className="text-xs text-steel">Puedes subir mp4/webm/ogg/mov o pegar una URL embebible.</span>
                    </div>
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
                <div key={course.id} className="rounded-2xl bg-abyss/60 p-4">
                  <div className="flex items-center gap-4">
                    {course.imageUrl ? (
                      <img src={course.imageUrl} alt={course.title} className="h-16 w-24 rounded-2xl object-cover" />
                    ) : (
                      <div className="flex h-16 w-24 items-center justify-center rounded-2xl bg-white/5 text-[11px] text-steel">Sin portada</div>
                    )}
                    <div>
                      <p className="font-medium text-white">{course.title}</p>
                      <p className="mt-1 text-xs text-steel">{course.isFree ? "Gratis" : course.isUnlocked ? "Comprado/desbloqueado" : `USD ${course.price}`} - {course.sections.length} secciones</p>
                    </div>
                  </div>
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
