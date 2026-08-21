import Link from "next/link";

export default function SettingsPage() {
  const sections = [
    {title:"Company Profile",detail:"VTC Group entities, addresses and registration details",status:"Managed in company master data"},
    {title:"Currencies & Rates",detail:"Base currencies, pricing rules and Treasury limits",href:"/fx",action:"Open FX Control"},
    {title:"Approval Matrix",detail:"Commercial, Treasury, finance and management approvals",href:"/approvals",action:"Open Approvals"},
    {title:"Notifications",detail:"Email, platform and escalation preferences",href:"/notifications",action:"Open Notifications"},
    {title:"Roles & Permissions",detail:"Access controls for dealers, managers and administrators",href:"/admin/roles",action:"Open Access Control"},
    {title:"Integrations",detail:"Accounting, banking, email, shipping and AI connections",status:"No editable integration secret is exposed in the browser"},
  ];
  return <main className="p-5 text-white md:p-8"><p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-400">Administration</p><h2 className="mt-2 text-3xl font-bold">Platform Settings</h2><p className="mt-2 max-w-3xl text-sm text-slate-400">Operating controls are routed only to implemented workspaces. Settings without a production editor are shown as information instead of decorative Configure buttons.</p><section className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{sections.map(section=><article key={section.title} className="rounded-2xl border border-slate-800 bg-[#0d1423] p-6"><h3 className="text-lg font-semibold">{section.title}</h3><p className="mt-2 text-sm leading-6 text-slate-400">{section.detail}</p>{section.href?<Link href={section.href} className="mt-5 inline-flex rounded-xl border border-blue-700/60 bg-blue-500/10 px-4 py-2 text-sm font-semibold text-blue-200 hover:bg-blue-500/20">{section.action}</Link>:<p className="mt-5 rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3 text-xs text-slate-500">{section.status}</p>}</article>)}</section></main>
}
