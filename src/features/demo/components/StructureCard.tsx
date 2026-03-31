type StructureCardProps = {
  title: string;
  items: string[];
};

export function StructureCard({ title, items }: StructureCardProps) {
  return (
    <section className="w-full rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-zinc-900">{title}</h2>
      <ul className="mt-4 grid gap-2 text-sm text-zinc-700 sm:grid-cols-2">
        {items.map((item) => (
          <li key={item} className="rounded-md bg-zinc-50 px-3 py-2">
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}
