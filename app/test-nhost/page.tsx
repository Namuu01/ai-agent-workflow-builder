"use client";

import { nhost } from "../lib/nhost";

export default function TestNhostPage() {
  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-3xl font-bold">
          Nhost Test
        </h1>

        <p className="mt-4">
          Nhost client initialized successfully.
        </p>
      </div>
    </main>
  );
}