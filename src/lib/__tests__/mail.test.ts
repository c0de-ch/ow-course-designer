const sendMail = jest.fn().mockResolvedValue(undefined);
jest.mock("nodemailer", () => ({ createTransport: () => ({ sendMail }) }));

function loadMailWithFrom(from: string | undefined) {
  if (from === undefined) delete process.env.SMTP_FROM;
  else process.env.SMTP_FROM = from;
  let mod: typeof import("@/lib/mail") | undefined;
  jest.isolateModules(() => {
    mod = require("@/lib/mail");
  });
  return mod!;
}

describe("mail sender address", () => {
  const original = process.env.SMTP_FROM;
  afterAll(() => {
    if (original === undefined) delete process.env.SMTP_FROM;
    else process.env.SMTP_FROM = original;
  });
  beforeEach(() => sendMail.mockClear());

  it.each([
    ['"OW Designer <noreply@example.org>"'],
    ["'OW Designer <noreply@example.org>'"],
    ["OW Designer <noreply@example.org>"],
  ])("uses %s without surrounding quotes", async (from) => {
    const { sendVerificationCode } = loadMailWithFrom(from);
    await sendVerificationCode("swimmer@example.org", "123456");
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ from: "OW Designer <noreply@example.org>" })
    );
  });

  it("falls back to the default sender when SMTP_FROM is empty", async () => {
    const { sendVerificationCode } = loadMailWithFrom("");
    await sendVerificationCode("swimmer@example.org", "123456");
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ from: "OW Course Designer <noreply@example.com>" })
    );
  });
});
