"use client";

const reasons = [
  {
    icon: (
      <svg className="w-7 h-7 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
    title: "More savings, more control",
    description: "Store your solar energy and use it when prices are high.",
  },
  {
    icon: (
      <svg className="w-7 h-7 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    title: "Protection from price hikes",
    description: "Lock in your energy costs and reduce dependence on the grid.",
  },
  {
    icon: (
      <svg className="w-7 h-7 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
    title: "Stronger ROI",
    description: "The optimal balance of upfront investment and long-term returns.",
  },
];

export default function WhyRecommended() {
  return (
    <div>
      <h3 className="text-lg font-bold mb-4">Why the recommended offer is the smartest choice</h3>
      <div className="grid gap-4 md:grid-cols-3">
        {reasons.map((r, i) => (
          <div key={i} className="rounded-xl border bg-card p-5 flex flex-col items-start gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
              {r.icon}
            </div>
            <div>
              <h4 className="text-sm font-semibold">{r.title}</h4>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{r.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
