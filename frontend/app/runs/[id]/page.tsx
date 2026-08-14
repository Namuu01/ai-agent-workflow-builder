"use client";

import { useParams } from "next/navigation";

export default function RunDetailsPage() {
  const params = useParams();

  return (
    <main style={{ padding: "2rem" }}>
      <h1>Workflow Run</h1>
      <p>Run ID: {params?.id}</p>
    </main>
  );
}
