"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const registerSchema = z
  .object({
    name: z.string().min(1, "Name required").max(100),
    email: z.string().email("Valid email required"),
    password: z.string().min(8, "At least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type RegisterForm = z.infer<typeof registerSchema>;

const codeSchema = z.object({
  code: z.string().length(6, "Enter the 6-digit code"),
});

type CodeForm = z.infer<typeof codeSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<"register" | "verify">("register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [resendMsg, setResendMsg] = useState<string | null>(null);
  // false when the server could not send the verification email
  const [emailSent, setEmailSent] = useState(true);
  const [resending, setResending] = useState(false);

  const regForm = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  });

  const codeForm = useForm<CodeForm>({
    resolver: zodResolver(codeSchema),
  });

  const onRegister = async (data: RegisterForm) => {
    setError(null);
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: data.email,
        password: data.password,
        name: data.name,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Registration failed");
      return;
    }
    setEmail(data.email);
    setPassword(data.password);
    setEmailSent(json.emailSent !== false);
    setResendMsg(null);
    setStep("verify");
  };

  const onVerify = async (data: CodeForm) => {
    setError(null);
    const res = await fetch("/api/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code: data.code }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Verification failed");
      return;
    }

    // Auto-login after verification
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    if (result?.error) {
      // Verification succeeded but auto-login failed — send to login page
      router.push("/login?verified=1");
    } else {
      router.push("/dashboard");
    }
  };

  const onResend = async () => {
    setError(null);
    setResendMsg(null);
    setResending(true);
    try {
      const res = await fetch("/api/resend-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof json.error === "string" ? json.error : "Could not resend the code. Please try again.");
        return;
      }
      setEmailSent(true);
      setResendMsg("A new code is on its way. Check your inbox and spam folder.");
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setResending(false);
    }
  };

  return (
      <div className="card w-full max-w-none shadow-2xl bg-base-100">
        <div className="card-body gap-4">
          {step === "register" ? (
            <>
              <h1 className="card-title text-2xl justify-center mb-1">
                Create account
              </h1>

              {error && (
                <div className="alert alert-error text-sm">
                  <span>{error}</span>
                </div>
              )}

              <form
                onSubmit={regForm.handleSubmit(onRegister)}
                className="flex flex-col gap-3"
              >
                <div className="form-group">
                  <label className="form-label" htmlFor="name">
                    Name
                  </label>
                  <input
                    id="name"
                    autoComplete="name"
                    type="text"
                    className={`input input-block${regForm.formState.errors.name ? " input-error" : ""}`}
                    placeholder="Your name"
                    {...regForm.register("name")}
                  />
                  {regForm.formState.errors.name && (
                    <span className="form-helper text-error">
                      {regForm.formState.errors.name.message}
                    </span>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="email">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    className={`input input-block${regForm.formState.errors.email ? " input-error" : ""}`}
                    placeholder="you@example.com"
                    {...regForm.register("email")}
                  />
                  {regForm.formState.errors.email && (
                    <span className="form-helper text-error">
                      {regForm.formState.errors.email.message}
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
                    autoComplete="new-password"
                    className={`input input-block${regForm.formState.errors.password ? " input-error" : ""}`}
                    placeholder="Min. 8 characters"
                    {...regForm.register("password")}
                  />
                  {regForm.formState.errors.password && (
                    <span className="form-helper text-error">
                      {regForm.formState.errors.password.message}
                    </span>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="confirmPassword">
                    Confirm password
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    className={`input input-block${regForm.formState.errors.confirmPassword ? " input-error" : ""}`}
                    placeholder="Repeat password"
                    {...regForm.register("confirmPassword")}
                  />
                  {regForm.formState.errors.confirmPassword && (
                    <span className="form-helper text-error">
                      {regForm.formState.errors.confirmPassword.message}
                    </span>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={regForm.formState.isSubmitting}
                  className="btn btn-primary btn-block mt-2"
                >
                  {regForm.formState.isSubmitting
                    ? "Creating account..."
                    : "Create account"}
                </button>
              </form>

              <p className="text-center text-sm">
                Already have an account?{" "}
                <Link href="/login" className="link link-primary">
                  Sign in
                </Link>
              </p>
            </>
          ) : (
            <>
              <h1 className="card-title text-2xl justify-center mb-1">
                Verify your email
              </h1>

              {emailSent ? (
                <p className="text-center text-sm text-content2">
                  We sent a 6-digit code to <strong>{email}</strong>. It can take a
                  minute to arrive; check your spam folder too.
                </p>
              ) : (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900" role="alert">
                  <p className="font-semibold">We could not send the verification email</p>
                  <p className="mt-1">
                    Your account for <strong>{email}</strong> was created, but the email
                    with your code did not go out. Try sending it again. If it keeps
                    failing, please try again later.
                  </p>
                </div>
              )}

              {error && (
                <div className="alert alert-error text-sm">
                  <span>{error}</span>
                </div>
              )}

              {resendMsg && (
                <div className="alert alert-success text-sm">
                  <span>{resendMsg}</span>
                </div>
              )}

              {!emailSent && (
                <button
                  type="button"
                  onClick={onResend}
                  disabled={resending}
                  className="btn btn-primary btn-block"
                >
                  {resending ? "Sending…" : "Send the code again"}
                </button>
              )}

              {emailSent && (
              <form
                onSubmit={codeForm.handleSubmit(onVerify)}
                className="flex flex-col gap-3"
              >
                <div className="form-group">
                  <label className="form-label" htmlFor="code">
                    Verification code
                  </label>
                  <input
                    id="code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    className={`input input-block text-center text-2xl tracking-widest${codeForm.formState.errors.code ? " input-error" : ""}`}
                    placeholder="000000"
                    {...codeForm.register("code")}
                  />
                  {codeForm.formState.errors.code && (
                    <span className="form-helper text-error">
                      {codeForm.formState.errors.code.message}
                    </span>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={codeForm.formState.isSubmitting}
                  className="btn btn-primary btn-block mt-2"
                >
                  {codeForm.formState.isSubmitting
                    ? "Verifying..."
                    : "Verify & sign in"}
                </button>
              </form>
              )}

              {emailSent && (
                <button
                  type="button"
                  onClick={onResend}
                  disabled={resending}
                  className="btn btn-ghost btn-sm"
                >
                  {resending ? "Sending…" : "Didn't get it? Resend code"}
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setStep("register");
                  setError(null);
                  setResendMsg(null);
                }}
                className="btn btn-ghost btn-sm"
              >
                Back to registration
              </button>
            </>
          )}
        </div>
      </div>
  );
}
