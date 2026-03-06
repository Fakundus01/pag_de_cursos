import { ChevronDown, LockKeyhole } from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";
import { useAppContext } from "../../store/AppContext";

export const CourseDropdown = () => {
  const { courses } = useAppContext();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onClick={() => setOpen((current) => !current)}
        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white"
      >
        Explorar cursos
        <ChevronDown size={16} className={`transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          className="absolute left-0 top-14 z-10 w-80 rounded-3xl border border-white/10 bg-abyss/95 p-4 shadow-glow"
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
        >
          <p className="mb-3 text-xs uppercase tracking-[0.25em] text-aurora">Cursos disponibles</p>
          <div className="space-y-2">
            {courses.map((course) => (
              <Link
                key={course.id}
                to="/cursos"
                className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/5 px-4 py-3 text-sm transition hover:border-aurora/35 hover:bg-white/[0.08]"
              >
                <div>
                  <p className="font-medium text-sand">{course.title}</p>
                  <p className="text-xs text-steel">{course.isFree ? "Acceso gratis" : `USD ${course.price}`}</p>
                </div>
                {course.locked ? <LockKeyhole size={16} className="text-flare" /> : <span className="text-xs text-aurora">Free</span>}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

