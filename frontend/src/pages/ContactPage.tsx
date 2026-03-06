export const ContactPage = () => (
  <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
    <section className="rounded-[34px] border border-white/10 bg-white/5 p-8">
      <p className="text-sm uppercase tracking-[0.35em] text-aurora">Contactanos</p>
      <h1 className="mt-4 text-4xl font-semibold text-sand">Soporte, ventas y alianzas.</h1>
      <p className="mt-5 text-base leading-8 text-steel">
        Puedes centralizar aqui soporte, dudas de compra, reclamos, contacto comercial y consultas de afiliados.
      </p>
    </section>

    <form className="rounded-[34px] border border-white/10 bg-abyss/70 p-8">
      <div className="grid gap-5">
        <input className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none" placeholder="Nombre" />
        <input className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none" placeholder="Email" />
        <textarea className="min-h-40 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none" placeholder="Mensaje" />
        <button className="rounded-full bg-sand px-5 py-3 font-medium text-abyss">Enviar consulta</button>
      </div>
    </form>
  </div>
);
