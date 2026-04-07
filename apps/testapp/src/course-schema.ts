import type { JSONSchema7 } from "json-schema";
import { bringDefinitionToTop } from "@graviola/json-schema-utils";
import { generateDefaultUISchema } from "@graviola/edb-ui-utils";
import type { SchemaConfig } from "./schemaTypes";
import { exampleDataTurtle } from "./course-fixture";

const type = (name: string) => ({
  type: "string",
  const: `http://www.example.org/example/${name}`,
});

export const schema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  definitions: {
    TopicArea: {
      type: "object",
      properties: {
        "@id": { type: "string" },
        "@type": type("TopicArea"),
        name: { type: "string", title: "Bezeichnung" },
        description: { type: "string", title: "Beschreibung" },
        parentTopic: {
          $ref: "#/definitions/TopicArea",
          title: "Übergeordnetes Teilgebiet",
        },
        subTopics: {
          type: "array",
          title: "Untergeordnete Teilgebiete",
          items: { $ref: "#/definitions/TopicArea" },
          "x-inverseOf": {
            inverseOf: ["#/definitions/TopicArea/properties/parentTopic"],
          },
        },
      },
      required: ["name"],
    },
    Course: {
      type: "object",
      properties: {
        "@id": { type: "string" },
        "@type": type("Course"),
        name: { type: "string", title: "Kursname" },
        description: { type: "string", title: "Beschreibung" },
        modules: {
          type: "array",
          title: "Module",
          items: { $ref: "#/definitions/Module" },
        },
      },
      required: ["name"],
    },
    Module: {
      type: "object",
      properties: {
        "@id": { type: "string" },
        "@type": type("Module"),
        name: { type: "string", title: "Modulname" },
        description: { type: "string", title: "Beschreibung" },
        duration: {
          type: "number",
          title: "Dauer (Unterrichtseinheiten)",
          minimum: 0,
        },
        course: {
          $ref: "#/definitions/Course",
          title: "Kurs",
          "x-inverseOf": {
            inverseOf: ["#/definitions/Course/properties/modules"],
          },
        },
        prerequisites: {
          type: "array",
          title: "Vorausgesetzte Module",
          items: { $ref: "#/definitions/Module" },
        },
        topicAreas: {
          type: "array",
          title: "Teilgebiete",
          items: { $ref: "#/definitions/TopicArea" },
        },
        learningObjectives: {
          type: "array",
          title: "Lernziele",
          items: { $ref: "#/definitions/LearningObjective" },
        },
        instructorDocument: {
          $ref: "#/definitions/InstructorDocument",
          title: "Dozentenunterlage",
        },
      },
      required: ["name"],
    },
    LearningObjective: {
      type: "object",
      properties: {
        "@id": { type: "string" },
        "@type": type("LearningObjective"),
        title: { type: "string", title: "Titel" },
        description: { type: "string", title: "Beschreibung" },
        bloomLevel: {
          type: "string",
          title: "Bloom-Stufe",
          enum: [
            "Wissen",
            "Verstehen",
            "Anwenden",
            "Analysieren",
            "Bewerten",
            "Erschaffen",
          ],
        },
      },
      required: ["title"],
    },
    InstructorDocument: {
      type: "object",
      properties: {
        "@id": { type: "string" },
        "@type": type("InstructorDocument"),
        title: { type: "string", title: "Titel" },
        description: { type: "string", title: "Kurzbeschreibung" },
        content: { type: "string", title: "Inhalt (Dozentenversion)" },
        exerciseSolutions: {
          type: "string",
          title: "Lösungen zu Übungsaufgaben",
        },
        participantDocuments: {
          type: "array",
          title: "Abgeleitete Teilnehmerunterlagen",
          items: { $ref: "#/definitions/ParticipantDocument" },
          "x-inverseOf": {
            inverseOf: ["#/definitions/ParticipantDocument/properties/basedOn"],
          },
        },
        presentations: {
          type: "array",
          title: "Präsentationen",
          items: { $ref: "#/definitions/Presentation" },
          "x-inverseOf": {
            inverseOf: ["#/definitions/Presentation/properties/basedOn"],
          },
        },
      },
      required: ["title"],
    },
    ParticipantDocument: {
      type: "object",
      properties: {
        "@id": { type: "string" },
        "@type": type("ParticipantDocument"),
        title: { type: "string", title: "Titel" },
        description: { type: "string", title: "Kurzbeschreibung" },
        content: { type: "string", title: "Inhalt" },
        examples: {
          type: "string",
          title: "Weitere Beispiele / Vertiefung",
        },
        figures: {
          type: "string",
          title: "Abbildungen / Bildnachweise",
        },
        basedOn: {
          $ref: "#/definitions/InstructorDocument",
          title: "Basierend auf (Dozentenunterlage)",
        },
      },
      required: ["title"],
    },
    Presentation: {
      type: "object",
      properties: {
        "@id": { type: "string" },
        "@type": type("Presentation"),
        title: { type: "string", title: "Titel" },
        description: { type: "string", title: "Kurzbeschreibung" },
        slideCount: { type: "number", title: "Anzahl Folien", minimum: 0 },
        durationMinutes: {
          type: "number",
          title: "Dauer (Minuten)",
          minimum: 0,
        },
        basedOn: {
          $ref: "#/definitions/InstructorDocument",
          title: "Basierend auf (Dozentenunterlage)",
        },
      },
      required: ["title"],
    },
    Question: {
      type: "object",
      properties: {
        "@id": { type: "string" },
        "@type": type("Question"),
        text: { type: "string", title: "Fragestellung" },
        answer: { type: "string", title: "Musterlösung / Antwort" },
        topicAreas: {
          type: "array",
          title: "Teilgebiete (eine oder mehrere)",
          items: { $ref: "#/definitions/TopicArea" },
        },
        estimatedMinutes: {
          type: "number",
          title: "Bearbeitungszeit (Minuten)",
          minimum: 0,
          multipleOf: 0.5,
        },
        difficulty: {
          type: "string",
          title: "Schwierigkeit",
          enum: ["Leicht", "Mittel", "Schwer"],
        },
        questionType: {
          type: "string",
          title: "Frageart",
          enum: ["Freitext", "Multiple-Choice", "Zuordnung", "Berechnung"],
        },
        points: { type: "number", title: "Punkte", minimum: 0 },
        module: {
          $ref: "#/definitions/Module",
          title: "Bezugsmodul",
        },
      },
      required: ["text"],
    },
  },
};

const courseJsonSchema = schema as unknown as JSONSchema7;

export const courseSchemaConfig: SchemaConfig = {
  schemaName: "course-schema",
  label: "Kurs- & OER-Planung",
  description:
    "Modulare Kurse, Dozenten- und Teilnehmerunterlagen, Präsentationen und Prüfungsfragenpool.",
  version: "0.1.0",
  cardImage: "/course-schema-card.jpg",
  color: "#6a1b9a",
  icon: "🎓",
  storageKey: "testapp-courses",
  initialData: exampleDataTurtle,
  baseIRI: "http://www.example.org/",
  entityBaseIRI: "http://www.example.org/example/",
  schema: courseJsonSchema,
  primaryFields: {
    TopicArea: {
      label: "name",
      description: "description",
    },
    Course: {
      label: "name",
      description: "description",
    },
    Module: {
      label: "name",
      description: "description",
    },
    LearningObjective: {
      label: "title",
      description: "description",
    },
    InstructorDocument: {
      label: "title",
      description: "description",
    },
    ParticipantDocument: {
      label: "title",
      description: "description",
    },
    Presentation: {
      label: "title",
      description: "description",
    },
    Question: {
      label: "text",
      description: "answer",
    },
  },
  typeNameLabelMap: {
    TopicArea: "Teilgebiet",
    Course: "Kurs",
    Module: "Modul",
    LearningObjective: "Lernziel",
    InstructorDocument: "Dozentenunterlage",
    ParticipantDocument: "Teilnehmerunterlage",
    Presentation: "Präsentation",
    Question: "Prüfungsfrage",
  },
  typeNameUiSchemaOptionsMap: {
    TopicArea: {
      dropdown: true,
    },
    Module: {
      dropdown: true,
    },
    Question: {
      chips: true,
    },
  },
  uischemata: {
    TopicArea: generateDefaultUISchema(
      bringDefinitionToTop(courseJsonSchema as any, "TopicArea") as any,
      {
        scopeOverride: {
          "#/properties/subTopics": {
            type: "Control",
            scope: "#/properties/subTopics",
            options: {
              dropdown: true,
              chips: true,
            },
          },
        },
      },
    ),
    Course: generateDefaultUISchema(
      bringDefinitionToTop(courseJsonSchema as any, "Course") as any,
      {
        scopeOverride: {
          "#/properties/modules": {
            type: "Control",
            scope: "#/properties/modules",
            options: {
              dropdown: true,
              chips: true,
            },
          },
        },
      },
    ),
    Module: generateDefaultUISchema(
      bringDefinitionToTop(courseJsonSchema as any, "Module") as any,
      {
        scopeOverride: {
          "#/properties/prerequisites": {
            type: "Control",
            scope: "#/properties/prerequisites",
            options: {
              dropdown: true,
              chips: true,
            },
          },
          "#/properties/topicAreas": {
            type: "Control",
            scope: "#/properties/topicAreas",
            options: {
              dropdown: true,
              chips: true,
            },
          },
          "#/properties/learningObjectives": {
            type: "Control",
            scope: "#/properties/learningObjectives",
            options: {
              chips: true,
            },
          },
          "#/properties/course": {
            type: "Control",
            scope: "#/properties/course",
            options: {
              dropdown: true,
            },
          },
          "#/properties/instructorDocument": {
            type: "Control",
            scope: "#/properties/instructorDocument",
            options: {
              dropdown: true,
            },
          },
        },
      },
    ),
    InstructorDocument: generateDefaultUISchema(
      bringDefinitionToTop(
        courseJsonSchema as any,
        "InstructorDocument",
      ) as any,
      {
        scopeOverride: {
          "#/properties/participantDocuments": {
            type: "Control",
            scope: "#/properties/participantDocuments",
            options: {
              dropdown: true,
              chips: true,
            },
          },
          "#/properties/presentations": {
            type: "Control",
            scope: "#/properties/presentations",
            options: {
              dropdown: true,
              chips: true,
            },
          },
        },
      },
    ),
    ParticipantDocument: generateDefaultUISchema(
      bringDefinitionToTop(
        courseJsonSchema as any,
        "ParticipantDocument",
      ) as any,
      {
        scopeOverride: {
          "#/properties/basedOn": {
            type: "Control",
            scope: "#/properties/basedOn",
            options: {
              dropdown: true,
            },
          },
        },
      },
    ),
    Presentation: generateDefaultUISchema(
      bringDefinitionToTop(courseJsonSchema as any, "Presentation") as any,
      {
        scopeOverride: {
          "#/properties/basedOn": {
            type: "Control",
            scope: "#/properties/basedOn",
            options: {
              dropdown: true,
            },
          },
        },
      },
    ),
    Question: generateDefaultUISchema(
      bringDefinitionToTop(courseJsonSchema as any, "Question") as any,
      {
        scopeOverride: {
          "#/properties/topicAreas": {
            type: "Control",
            scope: "#/properties/topicAreas",
            options: {
              chips: true,
              dropdown: true,
            },
          },
          "#/properties/module": {
            type: "Control",
            scope: "#/properties/module",
            options: {
              dropdown: true,
            },
          },
        },
      },
    ),
  },
};
