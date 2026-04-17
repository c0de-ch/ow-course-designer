import { checkRateLimit, getRequestIp } from "../rate-limit";

describe("checkRateLimit", () => {
  it("allows up to `limit` requests in the window", () => {
    const k = `t:${Math.random()}`;
    for (let i = 0; i < 3; i++) {
      expect(checkRateLimit(k, 3, 60_000).allowed).toBe(true);
    }
    expect(checkRateLimit(k, 3, 60_000).allowed).toBe(false);
  });

  it("reports retryAfterSec when rejecting", () => {
    const k = `t:${Math.random()}`;
    checkRateLimit(k, 1, 60_000);
    const r = checkRateLimit(k, 1, 60_000);
    expect(r.allowed).toBe(false);
    expect(r.retryAfterSec).toBeGreaterThan(0);
    expect(r.retryAfterSec).toBeLessThanOrEqual(60);
  });

  it("decrements remaining on each allowed call", () => {
    const k = `t:${Math.random()}`;
    expect(checkRateLimit(k, 3, 60_000).remaining).toBe(2);
    expect(checkRateLimit(k, 3, 60_000).remaining).toBe(1);
    expect(checkRateLimit(k, 3, 60_000).remaining).toBe(0);
  });

  it("isolates separate keys", () => {
    const a = `a:${Math.random()}`;
    const b = `b:${Math.random()}`;
    checkRateLimit(a, 1, 60_000);
    expect(checkRateLimit(a, 1, 60_000).allowed).toBe(false);
    expect(checkRateLimit(b, 1, 60_000).allowed).toBe(true);
  });

  it("resets after the window elapses", () => {
    const k = `t:${Math.random()}`;
    checkRateLimit(k, 1, 10);
    expect(checkRateLimit(k, 1, 10).allowed).toBe(false);
    return new Promise<void>((res) =>
      setTimeout(() => {
        expect(checkRateLimit(k, 1, 10).allowed).toBe(true);
        res();
      }, 20)
    );
  });
});

describe("getRequestIp", () => {
  it("reads the first entry of x-forwarded-for", () => {
    const h = new Headers({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" });
    expect(getRequestIp(h)).toBe("1.2.3.4");
  });

  it("falls back to x-real-ip", () => {
    const h = new Headers({ "x-real-ip": "9.9.9.9" });
    expect(getRequestIp(h)).toBe("9.9.9.9");
  });

  it('returns "unknown" when no header is present', () => {
    expect(getRequestIp(new Headers())).toBe("unknown");
  });
});
