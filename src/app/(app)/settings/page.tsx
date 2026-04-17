"use client";

import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password required"),
    newPassword: z.string().min(8, "New password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type PasswordForm = z.infer<typeof passwordSchema>;

export default function SettingsPage() {
  const { data: session } = useSession();
  const [pwSuccess, setPwSuccess] = useState<string | null>(null);
  const [pwError, setPwError] = useState<string | null>(null);

  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PasswordForm>({ resolver: zodResolver(passwordSchema) });

  const onChangePassword = async (data: PasswordForm) => {
    setPwError(null);
    setPwSuccess(null);
    const res = await fetch("/api/account/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setPwError(
        typeof body.error === "string"
          ? body.error
          : "Failed to change password"
      );
      return;
    }
    setPwSuccess("Password changed.");
    reset();
  };

  const onDelete = async () => {
    setDeleteError(null);
    setDeleting(true);
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: deletePassword || undefined }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDeleteError(
          typeof body.error === "string"
            ? body.error
            : "Failed to delete account"
        );
        setDeleting(false);
        return;
      }
      await signOut({ callbackUrl: "/" });
    } catch {
      setDeleteError("Network error. Try again.");
      setDeleting(false);
    }
  };

  const email = session?.user?.email ?? "";

  return (
    <div className="min-h-screen bg-base-200">
      <div className="navbar bg-base-100 shadow">
        <div className="flex-1">
          <Link href="/dashboard" className="btn btn-ghost text-xl font-bold">
            OW Course Designer
          </Link>
        </div>
        <div className="flex-none gap-2">
          <span className="text-sm hidden sm:block">
            {session?.user?.name ?? email}
          </span>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="btn btn-ghost btn-sm"
          >
            Sign out
          </button>
        </div>
      </div>

      <main className="max-w-2xl mx-auto p-6 flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="btn btn-ghost btn-sm">
            ← Dashboard
          </Link>
          <h1 className="text-2xl font-bold">Account settings</h1>
        </div>

        {/* Account info */}
        <div className="card bg-base-100 shadow">
          <div className="card-body">
            <h2 className="card-title text-lg">Account</h2>
            <p className="text-sm text-base-content/70">
              Signed in as <span className="font-mono">{email}</span>
            </p>
          </div>
        </div>

        {/* Change password */}
        <div className="card bg-base-100 shadow">
          <div className="card-body">
            <h2 className="card-title text-lg">Change password</h2>

            {pwSuccess && (
              <div className="alert alert-success">
                <span>{pwSuccess}</span>
              </div>
            )}
            {pwError && (
              <div className="alert alert-error">
                <span>{pwError}</span>
              </div>
            )}

            <form
              onSubmit={handleSubmit(onChangePassword)}
              className="flex flex-col gap-3"
            >
              <div className="form-group">
                <label className="form-label" htmlFor="currentPassword">
                  Current password
                </label>
                <input
                  id="currentPassword"
                  type="password"
                  className={`input input-block${errors.currentPassword ? " input-error" : ""}`}
                  autoComplete="current-password"
                  {...register("currentPassword")}
                />
                {errors.currentPassword && (
                  <span className="form-helper text-error">
                    {errors.currentPassword.message}
                  </span>
                )}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="newPassword">
                  New password
                </label>
                <input
                  id="newPassword"
                  type="password"
                  className={`input input-block${errors.newPassword ? " input-error" : ""}`}
                  autoComplete="new-password"
                  {...register("newPassword")}
                />
                {errors.newPassword && (
                  <span className="form-helper text-error">
                    {errors.newPassword.message}
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
                  className={`input input-block${errors.confirmPassword ? " input-error" : ""}`}
                  autoComplete="new-password"
                  {...register("confirmPassword")}
                />
                {errors.confirmPassword && (
                  <span className="form-helper text-error">
                    {errors.confirmPassword.message}
                  </span>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="btn btn-primary mt-2 self-start"
              >
                {isSubmitting ? "Saving..." : "Change password"}
              </button>
            </form>
          </div>
        </div>

        {/* Danger zone */}
        <div className="card bg-base-100 shadow border border-error/30">
          <div className="card-body">
            <h2 className="card-title text-lg text-error">Delete account</h2>
            <p className="text-sm text-base-content/70">
              Permanently deletes your account and all of your courses,
              snapshots, and flyover videos. This cannot be undone.
            </p>

            {deleteError && (
              <div className="alert alert-error">
                <span>{deleteError}</span>
              </div>
            )}

            <div className="form-group">
              <label className="form-label" htmlFor="deleteConfirm">
                Type <span className="font-mono">DELETE</span> to confirm
              </label>
              <input
                id="deleteConfirm"
                type="text"
                className="input input-block"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                autoComplete="off"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="deletePassword">
                Password (leave blank for Google-only accounts)
              </label>
              <input
                id="deletePassword"
                type="password"
                className="input input-block"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>

            <button
              type="button"
              onClick={onDelete}
              disabled={deleteConfirm !== "DELETE" || deleting}
              className="btn btn-error mt-2 self-start"
            >
              {deleting ? "Deleting..." : "Delete my account"}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
