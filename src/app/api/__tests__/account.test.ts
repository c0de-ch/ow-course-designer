/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mocks — jest.mock factories are hoisted, so define inline
// ---------------------------------------------------------------------------

jest.mock("@/lib/auth", () => ({
  auth: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

jest.mock("bcryptjs", () => ({
  hash: jest.fn().mockResolvedValue("$2a$12$newhash"),
  compare: jest.fn(),
}));

jest.mock("@/lib/logger", () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Imports — after mocks
// ---------------------------------------------------------------------------
import { POST as changePasswordPOST } from "../account/change-password/route";
import { POST as deleteAccountPOST } from "../account/delete/route";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { _resetRateLimitsForTests } from "@/lib/rate-limit";

const mockAuth = auth as unknown as jest.Mock;
const mockPrisma = prisma as unknown as {
  user: {
    findUnique: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
};
const mockCompare = bcrypt.compare as unknown as jest.Mock;

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost:3000/api/account/x", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  _resetRateLimitsForTests();
});

// ===========================================================================
// POST /api/account/change-password
// ===========================================================================
describe("POST /api/account/change-password", () => {
  const validBody = {
    currentPassword: "oldpass123",
    newPassword: "newpass456",
  };

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await changePasswordPOST(makeRequest(validBody));
    expect(res.status).toBe(401);
  });

  it("changes password when current password matches", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      passwordHash: "$2a$12$oldhash",
    });
    mockCompare.mockResolvedValue(true);
    mockPrisma.user.update.mockResolvedValue({ id: "user-1" });

    const res = await changePasswordPOST(makeRequest(validBody));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.message).toBe("Password changed");
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { passwordHash: "$2a$12$newhash" },
    });
  });

  it("returns 400 when current password is wrong", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      passwordHash: "$2a$12$oldhash",
    });
    mockCompare.mockResolvedValue(false);

    const res = await changePasswordPOST(makeRequest(validBody));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("Current password");
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("returns 400 for OAuth-only accounts (no passwordHash)", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      passwordHash: null,
    });

    const res = await changePasswordPOST(makeRequest(validBody));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("no password");
  });

  it("returns 400 when new password is too short", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    const res = await changePasswordPOST(
      makeRequest({ currentPassword: "ok", newPassword: "short" })
    );
    expect(res.status).toBe(400);
  });

  it("rate limits at 5/min/IP", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      passwordHash: "$2a$12$oldhash",
    });
    mockCompare.mockResolvedValue(true);
    mockPrisma.user.update.mockResolvedValue({ id: "user-1" });

    for (let i = 0; i < 5; i++) {
      await changePasswordPOST(makeRequest(validBody));
    }
    const res = await changePasswordPOST(makeRequest(validBody));
    expect(res.status).toBe(429);
  });
});

// ===========================================================================
// POST /api/account/delete
// ===========================================================================
describe("POST /api/account/delete", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await deleteAccountPOST(makeRequest({ password: "x" }));
    expect(res.status).toBe(401);
  });

  it("deletes credentials user with correct password", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      passwordHash: "$2a$12$hash",
    });
    mockCompare.mockResolvedValue(true);
    mockPrisma.user.delete.mockResolvedValue({ id: "user-1" });

    const res = await deleteAccountPOST(makeRequest({ password: "pw" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.message).toBe("Account deleted");
    expect(mockPrisma.user.delete).toHaveBeenCalledWith({
      where: { id: "user-1" },
    });
  });

  it("rejects credentials user with wrong password", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      passwordHash: "$2a$12$hash",
    });
    mockCompare.mockResolvedValue(false);

    const res = await deleteAccountPOST(makeRequest({ password: "wrong" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("incorrect");
    expect(mockPrisma.user.delete).not.toHaveBeenCalled();
  });

  it("requires password for credentials user", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      passwordHash: "$2a$12$hash",
    });

    const res = await deleteAccountPOST(makeRequest({}));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("Password required");
    expect(mockPrisma.user.delete).not.toHaveBeenCalled();
  });

  it("allows OAuth-only user to delete without password", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      passwordHash: null,
    });
    mockPrisma.user.delete.mockResolvedValue({ id: "user-1" });

    const res = await deleteAccountPOST(makeRequest({}));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.message).toBe("Account deleted");
  });

  it("rate limits at 3/min/IP", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      passwordHash: null,
    });
    mockPrisma.user.delete.mockResolvedValue({ id: "user-1" });

    for (let i = 0; i < 3; i++) {
      await deleteAccountPOST(makeRequest({}));
    }
    const res = await deleteAccountPOST(makeRequest({}));
    expect(res.status).toBe(429);
  });
});
