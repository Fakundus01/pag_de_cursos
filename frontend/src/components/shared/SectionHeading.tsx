export const SectionHeading = ({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) => (
  <div className="max-w-2xl">
    <p className="text-sm uppercase tracking-[0.35em] text-aurora">{eyebrow}</p>
    <h2 className="mt-3 text-3xl font-semibold text-sand md:text-4xl">{title}</h2>
    <p className="mt-4 text-base leading-7 text-steel">{body}</p>
  </div>
);
