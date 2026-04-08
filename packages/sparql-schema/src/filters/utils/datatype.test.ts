/**
 * Test inferDatatype utility to verify it creates proper typed literals
 */

import { describe, test, expect } from "bun:test";
import { inferDatatype } from "./datatype";

describe("inferDatatype", () => {
  test("boolean true should create xsd:boolean typed literal", () => {
    const literal = inferDatatype(true, "boolean");

    console.log("Boolean literal:", literal);
    console.log("Value:", literal.value);
    console.log("Datatype:", literal.datatype?.value);

    expect(literal.value).toBe("true");
    expect(literal.datatype).toBeTruthy();
    expect(literal.datatype.value).toContain("boolean");
  });

  test("boolean false should create xsd:boolean typed literal", () => {
    const literal = inferDatatype(false, "boolean");

    expect(literal.value).toBe("false");
    expect(literal.datatype).toBeTruthy();
    expect(literal.datatype.value).toContain("boolean");
  });

  test("boolean without schemaType should infer from JS type", () => {
    const literal = inferDatatype(true);

    expect(literal.value).toBe("true");
    expect(literal.datatype).toBeTruthy();
    expect(literal.datatype.value).toContain("boolean");
  });

  test("number should create xsd:integer typed literal", () => {
    const literal = inferDatatype(42, "number");

    console.log("Number literal:", literal);
    console.log("Datatype:", literal.datatype?.value);

    expect(literal.value).toBe("42");
    expect(literal.datatype).toBeTruthy();
    expect(literal.datatype.value).toContain("integer");
  });
});
