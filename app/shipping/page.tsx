import Link from "next/link";

const cards = [
  ["Active Shipments", "12", "4 require attention"],
  ["Containers in Transit", "38", "7 arriving this week"],
  ["Customs Pending", "5", "Documents under review"],
  ["Delivery Delays", "3", "Escalation required"],
];

export default function ShippingPage() {
  return (
    <main className="p-5 text-white md:p-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-400">
            VTC Logistics Control
          </p>
          <h2 className="mt-2 text-3xl font-bold">Shipping Operations</h2>
          <p className="mt-2 text-sm text-slate-400">
            Central workspace for shipments, containers, customs and delivery follow-up.
          </p>
        </div>
        <Link href="/" className="rounded-xl border border-slate-700 px-5 py-3 text-sm font-semibold">
          Dashboard
        </Link>
      </div>

      <section className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([title, value, detail]) => (
          <article key={title} className="rounded-2xl border border-slate-800 bg-[#0d1423] p-5">
            <p className="text-sm text-slate-400">{title}</p>
            <p className="mt-4 text-3xl font-bold">{value}</p>
            <p className="mt-2 text-xs text-slate-500">{detail}</p>
          </article>
        ))}
      </section>

      <section className="mt-6 rounded-2xl border border-slate-800 bg-[#0d1423] p-6">
        <h3 className="text-xl font-semibold">Operational Workflow</h3>
        <div className="mt-5 grid gap-3 md:grid-cols-4">
          {["New Shipment", "Container Tracking", "Customs Documents", "Delivery Confirmation"].map((item, index) => (
            <div key={item} className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
              <p className="text-xs text-blue-400">STEP {index + 1}</p>
              <p className="mt-2 font-semibold">{item}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
