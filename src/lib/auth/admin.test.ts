import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { emailIsAdmin, parseAdminEmails } from "./admin.ts";

describe("admin email lock", () => {
  it("parses comma/space lists and ignores junk", () => {
    assert.deepEqual(parseAdminEmails(undefined), []);
    assert.deepEqual(parseAdminEmails("  "), []);
    assert.deepEqual(parseAdminEmails("you@example.com"), ["you@example.com"]);
    assert.deepEqual(parseAdminEmails("A@x.com, b@y.com;C@z.com"), [
      "a@x.com",
      "b@y.com",
      "c@z.com",
    ]);
  });

  it("empty allowlist lets anyone through; a list is exact match", () => {
    assert.equal(emailIsAdmin("anyone@x.com", []), true);
    assert.equal(emailIsAdmin("you@example.com", ["you@example.com"]), true);
    assert.equal(emailIsAdmin("YOU@example.com", ["you@example.com"]), true);
    assert.equal(emailIsAdmin("other@example.com", ["you@example.com"]), false);
    assert.equal(emailIsAdmin(null, ["you@example.com"]), false);
  });
});
