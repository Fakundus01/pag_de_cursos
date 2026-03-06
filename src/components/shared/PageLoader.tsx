export const PageLoader = ({ fullScreen = false }: { fullScreen?: boolean }) => (
  <div className={`${fullScreen ? "min-h-screen" : "min-h-[280px]"} grid place-items-center`}>
    <div className="rounded-[28px] border border-white/10 bg-white/5 p-10 text-center shadow-glow backdrop-blur-xl">
      <div className="mx-auto h-14 w-14 animate-spin rounded-full border-4 border-aurora/30 border-t-aurora" />
      <p className="mt-5 text-sm text-steel">Cargando experiencia estrategica...</p>
    </div>
  </div>
);
