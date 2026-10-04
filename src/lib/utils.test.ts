import { describe, expect, test } from "bun:test";

import { toDate } from "./utils";

describe("toDate", () => {
  test("reads Unix seconds, which the database stores", () => {
    expect(toDate(1_791_100_000).getUTCFullYear()).toBe(2026);
  });

  test("still reads older millisecond values", () => {
    expect(toDate(1_791_100_000_000).getUTCFullYear()).toBe(2026);
  });
});
