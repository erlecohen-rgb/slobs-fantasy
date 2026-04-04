import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function Home() {
  const { userId } = await auth();
  if (userId) {
    redirect("/dashboard");
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-green-900 text-white">
      <div className="text-center max-w-2xl px-4">
        <h1 className="text-6xl font-bold mb-4 tracking-tight">SLOBS</h1>
        <p className="text-xl text-green-200 mb-2">Fantasy Baseball League</p>
        <p className="text-green-300 mb-8">
          Custom threshold-based scoring since the 1980s.
          <br />
          Now with automatic stat tracking.
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/sign-in"
            className="bg-white text-green-900 px-6 py-3 rounded-lg font-semibold hover:bg-green-100 transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/sign-up"
            className="border border-green-300 text-green-100 px-6 py-3 rounded-lg font-semibold hover:bg-green-800 transition-colors"
          >
            Sign Up
          </Link>
        </div>
      </div>
    </div>
  );
}
