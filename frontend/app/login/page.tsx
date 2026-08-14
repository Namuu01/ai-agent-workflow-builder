"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { nhost } from "../lib/nhost";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function checkSession() {
      try {
        const session = await nhost.auth.getSession();

        if (mounted && session) {
          router.replace("/builder");
          return;
        }
      } catch {
        // No active session.
      } finally {
        if (mounted) {
          setChecking(false);
        }
      }
    }

    checkSession();

    return () => {
      mounted = false;
    };
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");

    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }

    setLoading(true);

    try {
      const result = await nhost.auth.signInEmailPassword({
        email: email.trim(),
        password,
      });

      if (result.error) {
        setError(result.error.message);
        return;
      }

      router.replace("/builder");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to sign in. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <main className="auth-page">
        <div className="auth-card">
          <div className="auth-brand">AI WORKFLOW STUDIO</div>
          <h1>Checking session...</h1>
          <p className="auth-subtitle">
            Please wait while we verify your authentication.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="auth-icon">AI</div>

        <div className="auth-brand">AI WORKFLOW STUDIO</div>

        <h1>Welcome back</h1>

        <p className="auth-subtitle">
          Sign in to build and run your AI workflows.
        </p>

        <form onSubmit={handleSubmit} className="auth-form">
          <label htmlFor="email">Email</label>

          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={loading}
          />

          <label htmlFor="password">Password</label>

          <input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="Your password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={loading}
          />

          {error && <div className="auth-error">{error}</div>}

          <button type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="auth-footer">
          Authentication is powered by Nhost.
        </p>
      </div>
    </main>
  );
}
