import { rdf, xsd } from "@tpluscode/rdf-ns-builders";
import type { Literal } from "@rdfjs/types";

export function rdfLiteralToNative(
  literal: Literal,
): string | number | boolean | Date {
  if (!literal.datatype) return literal.value;
  const datatype = literal.datatype?.value || literal.datatype;
  switch (datatype) {
    case rdf.langString.value:
    case xsd.string.value:
      return literal.value;
    case xsd.boolean.value:
      return literal.value === "true";
    case xsd.integer.value:
      return parseInt(literal.value);
    case xsd.decimal.value:
      return parseFloat(literal.value);
    case xsd.double.value:
      return parseFloat(literal.value);
    case xsd.date.value:
      return new Date(literal.value);
    case xsd.dateTime.value:
      return new Date(literal.value);
    default:
      throw new Error(`Unsupported literal type ${datatype}`);
  }
}
