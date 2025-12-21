import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col justify-center gap-4 p-6">
      <h1 className="text-3xl font-semibold">Dojogram</h1>
      <p className="text-muted-foreground">
        Foundations setup in progress. Sign in to continue.
      </p>
      <div className="flex gap-3">
        <Link className="underline" href="/setup">
          Setup (first run)
        </Link>
        <Link className="underline" href="/sign-in">
          Sign in
        </Link>
      </div>
    </main>
  );
}
