"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
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
    <div className="min-h-screen flex items-center justify-center bg-base-200">
      <div className="card w-full max-w-md shadow-xl bg-base-100">
        <div className="card-body gap-4">
          <h1 className="card-title text-2xl justify-center">Sign in</h1>

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
          </form>

          <button
            type="button"
            onClick={() => signIn("google", { callbackUrl })}
            className="btn btn-outline btn-block"
          >
            Continue with Google
          </button>

          <p className="text-center text-sm">
            No account?{" "}
            <Link href="/register" className="link link-primary">
              Register
            </Link>
          </p>
        </div>
      </div>
      <p className="mt-4 text-xs text-base-content/40">
        v{process.env.NEXT_PUBLIC_APP_VERSION}
      </p>
    </div>
  );
}
