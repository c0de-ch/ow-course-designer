"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const emailSchema = z.object({
  email: z.string().email("Valid email required"),
});
type EmailForm = z.infer<typeof emailSchema>;

const resetSchema = z
  .object({
    code: z.string().length(6, "Enter the 6-digit code"),
    password: z.string().min(8, "At least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
type ResetForm = z.infer<typeof resetSchema>;

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<"request" | "reset">("request");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const emailForm = useForm<EmailForm>({ resolver: zodResolver(emailSchema) });
  const resetForm = useForm<ResetForm>({ resolver: zodResolver(resetSchema) });

  const onRequest = async (data: EmailForm) => {
    setError(null);
    setInfo(null);
    const res = await fetch("/api/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: data.email }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Request failed");
      return;
    }
    setEmail(data.email);
    setStep("reset");
    setInfo(json.message);
  };

  const onReset = async (data: ResetForm) => {
    setError(null);
    const res = await fetch("/api/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        code: data.code,
        password: data.password,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Reset failed");
      return;
    }

    // Auto-login with the new password.
    const result = await signIn("credentials", {
      email,
      password: data.password,
      redirect: false,
    });
    if (result?.error) {
      router.push("/login");
    } else {
      router.push("/dashboard");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-200">
      <div className="card w-full max-w-md shadow-xl bg-base-100">
        <div className="card-body gap-4">
          {step === "request" ? (
            <>
              <h1 className="card-title text-2xl justify-center">
                Forgot password
              </h1>
              <p className="text-center text-sm text-content2">
                Enter your email and we&apos;ll send you a 6-digit code to reset
                your password.
              </p>

              {error && (
                <div className="alert alert-error">
                  <span>{error}</span>
                </div>
              )}

              <form
                onSubmit={emailForm.handleSubmit(onRequest)}
                className="flex flex-col gap-3"
              >
                <div className="form-group">
                  <label className="form-label" htmlFor="email">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    className={`input input-block${emailForm.formState.errors.email ? " input-error" : ""}`}
                    placeholder="you@example.com"
                    {...emailForm.register("email")}
                  />
                  {emailForm.formState.errors.email && (
                    <span className="form-helper text-error">
                      {emailForm.formState.errors.email.message}
                    </span>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={emailForm.formState.isSubmitting}
                  className="btn btn-primary btn-block mt-2"
                >
                  {emailForm.formState.isSubmitting
                    ? "Sending code..."
                    : "Send reset code"}
                </button>
              </form>

              <p className="text-center text-sm">
                Remembered it?{" "}
                <Link href="/login" className="link link-primary">
                  Sign in
                </Link>
              </p>
            </>
          ) : (
            <>
              <h1 className="card-title text-2xl justify-center">
                Reset password
              </h1>

              <p className="text-center text-sm text-content2">
                We sent a 6-digit code to <strong>{email}</strong>. Enter it
                along with your new password.
              </p>

              {info && (
                <div className="alert alert-success">
                  <span>{info}</span>
                </div>
              )}

              {error && (
                <div className="alert alert-error">
                  <span>{error}</span>
                </div>
              )}

              <form
                onSubmit={resetForm.handleSubmit(onReset)}
                className="flex flex-col gap-3"
              >
                <div className="form-group">
                  <label className="form-label" htmlFor="code">
                    Reset code
                  </label>
                  <input
                    id="code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    className={`input input-block text-center text-2xl tracking-widest${resetForm.formState.errors.code ? " input-error" : ""}`}
                    placeholder="000000"
                    {...resetForm.register("code")}
                  />
                  {resetForm.formState.errors.code && (
                    <span className="form-helper text-error">
                      {resetForm.formState.errors.code.message}
                    </span>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="password">
                    New password
                  </label>
                  <input
                    id="password"
                    type="password"
                    className={`input input-block${resetForm.formState.errors.password ? " input-error" : ""}`}
                    placeholder="Min. 8 characters"
                    {...resetForm.register("password")}
                  />
                  {resetForm.formState.errors.password && (
                    <span className="form-helper text-error">
                      {resetForm.formState.errors.password.message}
                    </span>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="confirmPassword">
                    Confirm new password
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    className={`input input-block${resetForm.formState.errors.confirmPassword ? " input-error" : ""}`}
                    placeholder="Repeat password"
                    {...resetForm.register("confirmPassword")}
                  />
                  {resetForm.formState.errors.confirmPassword && (
                    <span className="form-helper text-error">
                      {resetForm.formState.errors.confirmPassword.message}
                    </span>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={resetForm.formState.isSubmitting}
                  className="btn btn-primary btn-block mt-2"
                >
                  {resetForm.formState.isSubmitting
                    ? "Resetting..."
                    : "Reset password & sign in"}
                </button>
              </form>

              <button
                type="button"
                onClick={() => {
                  setStep("request");
                  setError(null);
                  setInfo(null);
                }}
                className="btn btn-ghost btn-sm"
              >
                Use a different email
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
