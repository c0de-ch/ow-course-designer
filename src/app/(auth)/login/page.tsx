"use client";

import { Suspense, useEffect, useState } from "react";
import { getProviders, signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email("Valid email required"),
  password: z.string().min(1, "Password required"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";
  const verified = searchParams.get("verified");
  const [error, setError] = useState<string | null>(null);
  const [googleEnabled, setGoogleEnabled] = useState(false);

  // Only offer Google sign-in when the server has it configured
  useEffect(() => {
    getProviders().then((p) => setGoogleEnabled(!!p?.google)).catch(() => {});
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (data: LoginForm) => {
    setError(null);
    const result = await signIn("credentials", {
      email: data.email,
      password: data.password,
      redirect: false,
      callbackUrl,
    });
    if (result?.error) {
      if (result.error.includes("EMAIL_NOT_VERIFIED")) {
        setError(
          "Your email is not verified. Please check your inbox or register again to receive a new code."
        );
      } else {
        setError("Invalid email or password");
      }
    } else {
      router.push(callbackUrl);
    }
  };

  return (
      <div className="card w-full max-w-none shadow-2xl bg-base-100">
        <div className="card-body gap-4">
          <h1 className="card-title text-2xl justify-center mb-1">Sign in</h1>

          {verified && (
            <div className="alert alert-success">
              <span>Email verified! You can now sign in.</span>
            </div>
          )}

          {error && (
            <div className="alert alert-error">
              <span>{error}</span>
            </div>
          )}

          <form
            onSubmit={handleSubmit(onSubmit)}
            className="flex flex-col gap-3"
          >
            <div className="form-group">
              <label className="form-label" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                className={`input input-block${errors.email ? " input-error" : ""}`}
                placeholder="you@example.com"
                autoComplete="email"
                autoFocus
                {...register("email")}
              />
              {errors.email && (
                <span className="form-helper text-error">
                  {errors.email.message}
                </span>
              )}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                className={`input input-block${errors.password ? " input-error" : ""}`}
                placeholder="••••••••"
                autoComplete="current-password"
                {...register("password")}
              />
              {errors.password && (
                <span className="form-helper text-error">
                  {errors.password.message}
                </span>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn btn-primary btn-block mt-2"
            >
              {isSubmitting ? "Signing in..." : "Sign in"}
            </button>

            <p className="text-center text-sm">
              <Link href="/forgot-password" className="link link-primary">
                Forgot password?
              </Link>
            </p>
          </form>

          {googleEnabled && (
            <>
              <div className="flex items-center gap-3 text-xs text-base-content/50">
                <span className="h-px flex-1 bg-base-300" />
                or
                <span className="h-px flex-1 bg-base-300" />
              </div>
              <button
                type="button"
                onClick={() => signIn("google", { callbackUrl })}
                className="btn btn-outline btn-block gap-2"
              >
                <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                  <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/>
                  <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
                  <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
                  <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/>
                </svg>
                Continue with Google
              </button>
            </>
          )}

          <p className="text-center text-sm">
            No account?{" "}
            <Link href="/register" className="link link-primary">
              Register
            </Link>
          </p>
        </div>
      </div>
  );
}
