import assert from "node:assert/strict";
import { test } from "node:test";

const realFetch = globalThis.fetch;

test("sendEmail skips when Resend env is missing", async () => {
  delete process.env.RESEND_API_KEY;
  delete process.env.EMAIL_FROM;
  const { sendEmail } = await import(`./email.js?skip=${Date.now()}`);

  const result = await sendEmail({ html: "<p>Hi</p>", subject: "Test", to: "test@example.com" });

  assert.deepEqual(result, { skipped: true });
});

test("sendEmail calls Resend when configured", async () => {
  process.env.RESEND_API_KEY = "re_test";
  process.env.EMAIL_FROM = "TuneBoss <noreply@example.com>";
  const calls: Array<{ body: unknown; headers: Headers; method: string; url: string }> = [];

  globalThis.fetch = async (input, init) => {
    calls.push({
      body: init?.body ? JSON.parse(String(init.body)) : null,
      headers: new Headers(init?.headers),
      method: init?.method ?? "GET",
      url: typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
    });
    return new Response(JSON.stringify({ id: "email-test" }), { status: 200 });
  };

  try {
    const { sendEmail } = await import(`./email.js?send=${Date.now()}`);
    const result = await sendEmail({ html: "<p>Hi</p>", subject: "Test", to: "test@example.com" });

    assert.deepEqual(result, { skipped: false });
    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.url, "https://api.resend.com/emails");
    assert.equal(calls[0]?.method, "POST");
    assert.equal(calls[0]?.headers.get("authorization"), "Bearer re_test");
    assert.deepEqual(calls[0]?.body, {
      from: "TuneBoss <noreply@example.com>",
      html: "<p>Hi</p>",
      subject: "Test",
      to: "test@example.com",
    });
  } finally {
    globalThis.fetch = realFetch;
  }
});
