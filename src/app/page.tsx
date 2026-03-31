import { getHomeDemoData } from "@/features/demo/application/getHomeDemoData";
import { StructureCard } from "@/features/demo/components/StructureCard";
import { getHealthStatus } from "@/server/application/getHealthStatus";

export default function Home() {
  const demoData = getHomeDemoData();
  const health = getHealthStatus();

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-6 py-12">
      <main className="w-full max-w-4xl space-y-6">
        <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h1 className="text-3xl font-bold text-zinc-900">{demoData.title}</h1>
          <p className="mt-3 text-zinc-700">{demoData.description}</p>
          <p className="mt-3 text-sm text-zinc-500">
            API demo endpoint: <code>/api/health</code>
          </p>
          {health.success ? (
            <p className="mt-1 text-sm text-emerald-600">
              Server health: {health.data.status} at {health.data.timestamp}
            </p>
          ) : (
            <p className="mt-1 text-sm text-red-600">{health.error.message}</p>
          )}
        </section>
        <StructureCard title="Layered Directory Demo" items={demoData.structure} />
      </main>
    </div>
  );
}
