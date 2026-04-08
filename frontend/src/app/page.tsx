import LeadForm from "@/components/LeadForm";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center p-6 md:p-12">
      <div className="mb-10 text-center">
        <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
          AI Sales Coach
        </h1>
        <p className="mt-3 text-lg text-muted-foreground max-w-md mx-auto">
          Enter a lead&apos;s details and get a personalised, data-driven sales briefing
          in seconds.
        </p>
      </div>
      <LeadForm />
    </main>
  );
}
