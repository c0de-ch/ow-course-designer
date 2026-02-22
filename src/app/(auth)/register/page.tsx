"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const registerSchema = z.object({
  name: z.string().min(1, "Name required").max(100),
  email: z.string().email("Valid email required"),
  password: z.string().min(8, "At least 8 characters"),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type RegisterForm = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({ resolver: zodResolver(registerSchema) });

  const onSubmit = async (data: RegisterForm) => {
    setError(null);
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: data.email, password: data.password, name: data.name }),
    });
    if (!res.ok) {
      const json = await res.json();
      setError(json.error ?? "Registration failed");
      return;
    }
    router.push("/login?registered=1");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-200">
      <div className="card w-full max-w-md shadow-xl bg-base-100">
        <div className="card-body gap-4">
          <h1 className="card-title text-2xl justify-center">Create account</h1>

          {error && (
            <div className="alert alert-error">
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
            <div className="form-group">
              <label className="form-label" htmlFor="name">
                Name
              </label>
              <input
                id="name"
                type="text"
                className={`input input-block${errors.name ? " input-error" : ""}`}
                placeholder="Your name"
                {...register("name")}
              />
              {errors.name && (
                <span className="form-helper text-error">{errors.name.message}</span>
              )}
            </div>

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
                <span className="form-helper text-error">{errors.email.message}</span>
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
                placeholder="Min. 8 characters"
                {...register("password")}
              />
              {errors.password && (
                <span className="form-helper text-error">{errors.password.message}</span>
              )}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="confirmPassword">
                Confirm password
              </label>
              <input
                id="confirmPassword"
                type="password"
                className={`input input-block${errors.confirmPassword ? " input-error" : ""}`}
                placeholder="Repeat password"
                {...register("confirmPassword")}
              />
              {errors.confirmPassword && (
                <span className="form-helper text-error">{errors.confirmPassword.message}</span>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn btn-primary btn-block mt-2"
            >
              {isSubmitting ? "Creating account…" : "Create account"}
            </button>
          </form>

          <p className="text-center text-sm">
            Already have an account?{" "}
            <Link href="/login" className="link link-primary">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
