"use client";

interface Props {
  name: string;
}

export default function ReadyCTA({ name }: Props) {
  return (
    <div className="rounded-2xl bg-blue-600 text-white p-6 flex flex-col justify-center">
      <h3 className="text-lg font-bold mb-2">Ready to move forward?</h3>
      <p className="text-sm text-blue-100 mb-4">
        This offer is tailored for {name}&apos;s home and goals.
      </p>
      <button className="inline-flex items-center gap-2 rounded-lg bg-white text-blue-600 font-semibold px-5 py-2.5 text-sm hover:bg-blue-50 transition-colors w-fit">
        Next steps
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
        </svg>
      </button>
    </div>
  );
}
