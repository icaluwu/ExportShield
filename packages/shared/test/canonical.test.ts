import { describe, expect, it } from "vitest";
import { canonicalJson, hashCanonicalJson } from "../src/index";

describe("canonicalJson", () => {
  it("sorts object keys recursively while preserving array order", () => {
    expect(canonicalJson({ z: 1, a: { y: 2, b: 3 }, list: [{ c: 1, a: 2 }] })).toBe(
      '{"a":{"b":3,"y":2},"list":[{"a":2,"c":1}],"z":1}',
    );
  });

  it("produces stable hashes for semantically identical objects", () => {
    expect(hashCanonicalJson({ b: 2, a: 1 })).toBe(hashCanonicalJson({ a: 1, b: 2 }));
  });
});
