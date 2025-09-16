import { prefixes2sparqlPrefixDeclaration } from "@graviola/sparql-schema";
import type { Literal } from "@rdfjs/types";
import isNil from "lodash-es/isNil";

import { wikidataPrefixes } from "./prefixes";
import type { WikidataSparqlFetcher } from "./wikidataQueryFetcher";
import { createDefaultWikidataSparqlFetcher } from "./wikidataQueryFetcher";

const buildPropsQuery = (entity: string, withSubclassRelations?: boolean) => `
SELECT ?property ?propLabel ?object ?objectLabel
WHERE {

  ${entity} ${withSubclassRelations ? "wdt:P31/wdt:P279*" : "wdt:P31"} ?class .

  OPTIONAL {
    ?class wdt:P1963 ?property .
    ?property wikibase:directClaim ?directProperty .
    SERVICE wikibase:label {
        bd:serviceParam wikibase:language "de" .
        ?property rdfs:label ?propLabel .
    }
    ${entity} ?directProperty ?object  .
    OPTIONAL {
      SERVICE wikibase:label {
        bd:serviceParam wikibase:language "de" .
        ?object rdfs:label ?objectLabel .
     }
   }
 }
}`;

export type CommonPropertyValues = {
  [p: string]: {
    label: string;
    objects: (
      | Literal
      | { termType: "NamedNode"; label: string; uri: string }
    )[];
  };
};

const dedup = function (arr: any[]) {
  return arr.reduce(
    (prev, cur) =>
      (!isNil(cur.uri) && prev.find((x: any) => x.uri === cur.uri)) ||
      (!isNil(cur.value) && prev.find((x: any) => x.value === cur.value))
        ? prev
        : [...prev, cur],
    [],
  );
};

export const getCommonPropsFromWikidata: (
  thingIRI: string,
  wikidataSparqlFetcher?: WikidataSparqlFetcher,
  withSubClassRelations?: boolean,
) => Promise<undefined | CommonPropertyValues> = async (
  thingIRI,
  wikidataSparqlFetcher,
  withSubClassRelations,
) => {
  const fetcher = wikidataSparqlFetcher?.selectFetch
    ? wikidataSparqlFetcher
    : createDefaultWikidataSparqlFetcher();

  const sparqlQuery = `
    ${prefixes2sparqlPrefixDeclaration(wikidataPrefixes)}
    ${buildPropsQuery(
      thingIRI.startsWith("Q") ? `wd:${thingIRI}` : `<${thingIRI}>`,
      withSubClassRelations,
    )}
    `;

  const result = await fetcher.selectFetch(sparqlQuery);
  const bindings = result.results?.bindings || [];

  const properties = new Map<string, CommonPropertyValues>();
  for (const binding of bindings) {
    const property = binding.property?.value;
    if (!property) continue;
    const propLabel = binding.propLabel?.value;
    const object = binding.object;
    if (!object) continue;
    const objectLabel = binding.objectLabel?.value;
    const objects = properties.get(property)?.objects || ([] as any);
    if (object.type === "uri") {
      properties.set(property, {
        label: propLabel || "",
        objects: [
          ...objects,
          { termType: "NamedNode", label: objectLabel, uri: object.value },
        ],
      } as any);
    } else {
      properties.set(property, {
        label: propLabel || "",
        objects: [
          ...objects,
          {
            termType: "Literal",
            value: object.value,
            datatype: object.datatype,
          },
        ],
      } as any);
    }
  }

  //convert Map to dictionary
  const props: CommonPropertyValues = {};
  for (const [key, value] of properties.entries()) {
    // @ts-ignore
    props[key] = { label: value.label, objects: dedup(value.objects) };
  }

  return props;
};
