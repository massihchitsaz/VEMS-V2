const inventory = [
  { item: "Copper Cable Scrap", quantity: "185 MT", location: "JAFZA Warehouse", status: "Available" },
  { item: "Sealing Cement", quantity: "2,000 KG", location: "Dubai", status: "Reserved" },
  { item: "Welding Alloy", quantity: "105 KG", location: "Dubai", status: "Available" },
  { item: "Pepper Powder", quantity: "28 MT", location: "Jebel Ali", status: "In Transit" },
];

export default function InventoryPage() {
  return (
    <main className="p-5 text-white md:p-8">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-400">
        Stock Control
      </p>
      <h2 className="mt-2 text-3xl font-bold">Inventory & Warehousing</h2>
      <p className="mt-2 text-sm text-slate-400">
        Monitor stock availability, reservations and physical locations.
      </p>

      <section className="mt-7 overflow-hidden rounded-2xl border border-slate-800 bg-[#0d1423]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-slate-800 bg-slate-900/80 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-4">Item</th>
                <th className="px-5 py-4">Quantity</th>
                <th className="px-5 py-4">Location</th>
                <th className="px-5 py-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {inventory.map((row) => (
                <tr key={row.item} className="border-b border-slate-800 last:border-0">
                  <td className="px-5 py-4 font-semibold">{row.item}</td>
                  <td className="px-5 py-4">{row.quantity}</td>
                  <td className="px-5 py-4 text-slate-400">{row.location}</td>
                  <td className="px-5 py-4">
                    <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs text-blue-300">
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
