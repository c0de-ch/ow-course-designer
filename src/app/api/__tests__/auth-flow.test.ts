/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mocks — jest.mock factories are hoisted, so define inline
// ---------------------------------------------------------------------------

jest.mock("@/lib/mail", () => ({
  sendVerificationCode: jest.fn().mockResolvedValue(undefined),
  sendAdminNewUserNotification: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    emailVerificationCode: {
      findFirst: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock("bcryptjs", () => ({
  hash: jest.fn().mockResolvedValue("$2a$12$hashedpassword"),
  compare: jest.fn().mockResolvedValue(true),
}));

// ---------------------------------------------------------------------------
// Imports — after mocks
// ---------------------------------------------------------------------------
import { POST as registerPOST } from "../register/route";
import { POST as verifyPOST } from "../verify-email/route";
import { POST as resendPOST } from "../resend-code/route";
import { prisma } from "@/lib/prisma";
import {
  sendVerificationCode,
  sendAdminNewUserNotification,
} from "@/lib/mail";

// Cast to jest mocks for type safety
const mockPrisma = prisma as unknown as {
  user: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
  emailVerificationCode: {
    findFirst: jest.Mock;
    create: jest.Mock;
    deleteMany: jest.Mock;
  };
  $transaction: jest.Mock;
};
const mockSendVerificationCode = sendVerificationCode as jest.Mock;
const mockSendAdminNotification = sendAdminNewUserNotification as jest.Mock;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost:3000/api/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------
beforeEach(() => {
  jest.clearAllMocks();
});

// ===========================================================================
// POST /api/register
// ===========================================================================
describe("POST /api/register", () => {
  const validBody = {
    email: "test@example.com",
    password: "securepass123",
    name: "Test User",
  };

  it("creates a new user, stores code, sends email, returns 201", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({
      id: "user-1",
      email: "test@example.com",
      name: "Test User",
    });
    mockPrisma.emailVerificationCode.deleteMany.mockResolvedValue({
      count: 0,
    });
    mockPrisma.emailVerificationCode.create.mockResolvedValue({
      id: "code-1",
    });

    const res = await registerPOST(makeRequest(validBody));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.email).toBe("test@example.com");
    expect(body.emailSent).toBe(true);
    expect(mockPrisma.user.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.emailVerificationCode.create).toHaveBeenCalledTimes(1);
    expect(mockSendVerificationCode).toHaveBeenCalledWith(
      "test@example.com",
      expect.stringMatching(/^\d{6}$/)
    );
  });

  it("returns 201 even when email sending fails (SMTP down)", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({
      id: "user-1",
      email: "test@example.com",
    });
    mockPrisma.emailVerificationCode.deleteMany.mockResolvedValue({
      count: 0,
    });
    mockPrisma.emailVerificationCode.create.mockResolvedValue({
      id: "code-1",
    });
    mockSendVerificationCode.mockRejectedValueOnce(
      new Error("connect ECONNREFUSED ::1:587")
    );

    const consoleSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const res = await registerPOST(makeRequest(validBody));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.emailSent).toBe(false);
    expect(body.email).toBe("test@example.com");
    expect(consoleSpy).toHaveBeenCalledWith(
      "Failed to send verification email:",
      expect.any(Error)
    );

    consoleSpy.mockRestore();
  });

  it("returns 409 when email is already verified", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "test@example.com",
      emailVerified: new Date(),
    });

    const res = await registerPOST(makeRequest(validBody));
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toBe("Email already registered");
  });

  it("re-registers unverified user by updating password and resending code", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "test@example.com",
      emailVerified: null,
      name: "Old Name",
    });
    mockPrisma.user.update.mockResolvedValue({
      id: "user-1",
      email: "test@example.com",
    });
    mockPrisma.emailVerificationCode.deleteMany.mockResolvedValue({
      count: 1,
    });
    mockPrisma.emailVerificationCode.create.mockResolvedValue({
      id: "code-2",
    });

    const res = await registerPOST(makeRequest(validBody));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.email).toBe("test@example.com");
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { passwordHash: "$2a$12$hashedpassword", name: "Test User" },
    });
    expect(mockPrisma.user.create).not.toHaveBeenCalled();
    expect(mockSendVerificationCode).toHaveBeenCalledTimes(1);
  });

  it("returns 400 for invalid email", async () => {
    const res = await registerPOST(
      makeRequest({ email: "not-an-email", password: "securepass123" })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for short password", async () => {
    const res = await registerPOST(
      makeRequest({ email: "test@example.com", password: "short" })
    );
    expect(res.status).toBe(400);
  });
});

// ===========================================================================
// POST /api/verify-email
// ===========================================================================
describe("POST /api/verify-email", () => {
  it("verifies valid code and activates account", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "test@example.com",
      name: "Test User",
      emailVerified: null,
    });
    mockPrisma.emailVerificationCode.findFirst.mockResolvedValue({
      id: "code-1",
      userId: "user-1",
      code: "123456",
      expires: new Date(Date.now() + 10 * 60 * 1000),
    });
    mockPrisma.$transaction.mockResolvedValue([{}, {}]);

    const res = await verifyPOST(
      makeRequest({ email: "test@example.com", code: "123456" })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.verified).toBe(true);
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("sends admin notification after verification", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "test@example.com",
      name: "Test User",
      emailVerified: null,
    });
    mockPrisma.emailVerificationCode.findFirst.mockResolvedValue({
      id: "code-1",
      userId: "user-1",
      code: "123456",
      expires: new Date(Date.now() + 10 * 60 * 1000),
    });
    mockPrisma.$transaction.mockResolvedValue([{}, {}]);

    await verifyPOST(
      makeRequest({ email: "test@example.com", code: "123456" })
    );

    // Wait for non-blocking notification
    await new Promise((r) => setTimeout(r, 10));

    expect(mockSendAdminNotification).toHaveBeenCalledWith(
      "Test User",
      "test@example.com"
    );
  });

  it("returns 400 for invalid code", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "test@example.com",
      emailVerified: null,
    });
    mockPrisma.emailVerificationCode.findFirst.mockResolvedValue(null);

    const res = await verifyPOST(
      makeRequest({ email: "test@example.com", code: "999999" })
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Invalid verification code");
  });

  it("returns 400 for expired code", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "test@example.com",
      emailVerified: null,
    });
    mockPrisma.emailVerificationCode.findFirst.mockResolvedValue({
      id: "code-1",
      userId: "user-1",
      code: "123456",
      expires: new Date(Date.now() - 1000),
    });

    const res = await verifyPOST(
      makeRequest({ email: "test@example.com", code: "123456" })
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Verification code expired");
  });

  it("returns 404 for non-existent user", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const res = await verifyPOST(
      makeRequest({ email: "nobody@example.com", code: "123456" })
    );
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe("User not found");
  });

  it("returns 400 for already verified user", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "test@example.com",
      emailVerified: new Date(),
    });

    const res = await verifyPOST(
      makeRequest({ email: "test@example.com", code: "123456" })
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Email already verified");
  });

  it("returns 400 for malformed input (code too short)", async () => {
    const res = await verifyPOST(
      makeRequest({ email: "test@example.com", code: "123" })
    );
    expect(res.status).toBe(400);
  });
});

// ===========================================================================
// POST /api/resend-code
// ===========================================================================
describe("POST /api/resend-code", () => {
  it("sends a new code for unverified user", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "test@example.com",
      emailVerified: null,
    });
    mockPrisma.emailVerificationCode.findFirst.mockResolvedValue(null);
    mockPrisma.emailVerificationCode.deleteMany.mockResolvedValue({
      count: 1,
    });
    mockPrisma.emailVerificationCode.create.mockResolvedValue({
      id: "code-2",
    });

    const res = await resendPOST(
      makeRequest({ email: "test@example.com" })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.message).toBe("Verification code sent");
    expect(mockSendVerificationCode).toHaveBeenCalledWith(
      "test@example.com",
      expect.stringMatching(/^\d{6}$/)
    );
  });

  it("returns 502 when email sending fails", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "test@example.com",
      emailVerified: null,
    });
    mockPrisma.emailVerificationCode.findFirst.mockResolvedValue(null);
    mockPrisma.emailVerificationCode.deleteMany.mockResolvedValue({
      count: 0,
    });
    mockPrisma.emailVerificationCode.create.mockResolvedValue({
      id: "code-2",
    });
    mockSendVerificationCode.mockRejectedValueOnce(
      new Error("connect ECONNREFUSED ::1:587")
    );

    const consoleSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const res = await resendPOST(
      makeRequest({ email: "test@example.com" })
    );
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(body.error).toContain("Failed to send email");

    consoleSpy.mockRestore();
  });

  it("returns 429 when rate limited (code sent within 60s)", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "test@example.com",
      emailVerified: null,
    });
    mockPrisma.emailVerificationCode.findFirst.mockResolvedValue({
      id: "code-1",
      createdAt: new Date(),
    });

    const res = await resendPOST(
      makeRequest({ email: "test@example.com" })
    );
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(body.error).toContain("60 seconds");
    expect(mockSendVerificationCode).not.toHaveBeenCalled();
  });

  it("does not reveal user existence for non-existent email", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const res = await resendPOST(
      makeRequest({ email: "nobody@example.com" })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.message).toContain("If the email exists");
    expect(mockSendVerificationCode).not.toHaveBeenCalled();
  });

  it("does not reveal status for already verified user", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "test@example.com",
      emailVerified: new Date(),
    });

    const res = await resendPOST(
      makeRequest({ email: "test@example.com" })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.message).toContain("If the email exists");
    expect(mockSendVerificationCode).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid email format", async () => {
    const res = await resendPOST(makeRequest({ email: "not-an-email" }));
    expect(res.status).toBe(400);
  });
});
