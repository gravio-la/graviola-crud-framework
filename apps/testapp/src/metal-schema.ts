export const schema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  definitions: {
    Person: {
      type: "object",
      properties: {
        firstName: { type: "string", title: "Vorname" },
        lastName: { type: "string", title: "Nachname" },
        employeeId: { type: "string", title: "Mitarbeiternummer" },
        qualification: {
          type: "string",
          title: "Qualifikation",
          enum: ["Schweißer", "Schweißfachingenieur", "Prüfer", "Meister"],
        },
        certification: {
          type: "array",
          title: "Zertifizierungen",
          items: {
            type: "object",
            properties: {
              type: { type: "string", title: "Art" },
              number: { type: "string", title: "Nummer" },
              validUntil: {
                type: "string",
                format: "date",
                title: "Gültig bis",
              },
            },
          },
        },
      },
      required: ["firstName", "lastName", "employeeId"],
    },
    QualityCheck: {
      type: "object",
      properties: {
        type: {
          type: "string",
          title: "Prüfart",
          enum: [
            "Sichtprüfung",
            "Durchstrahlungsprüfung",
            "Ultraschallprüfung",
            "Druckprüfung",
          ],
        },
        result: {
          type: "string",
          title: "Ergebnis",
          enum: ["Bestanden", "Nicht bestanden", "Mit Einschränkungen"],
        },
        inspector: { $ref: "#/definitions/Person", title: "Prüfer" },
        date: { type: "string", format: "date", title: "Prüfdatum" },
        notes: { type: "string", title: "Bemerkungen" },
      },
    },
    Defect: {
      type: "object",
      properties: {
        type: {
          type: "string",
          title: "Mangelart",
          enum: [
            "Poren",
            "Risse",
            "Schlackeneinschlüsse",
            "Bindefehler",
            "Unterwälzungen",
          ],
        },
        location: { type: "string", title: "Position" },
        severity: {
          type: "string",
          title: "Schweregrad",
          enum: ["Kritisch", "Hoch", "Mittel", "Niedrig"],
        },
        status: {
          type: "string",
          title: "Status",
          enum: ["Offen", "In Bearbeitung", "Behoben", "Nicht behoben"],
        },
        repairMethod: { type: "string", title: "Reparaturmethode" },
        repairDate: { type: "string", format: "date", title: "Reparaturdatum" },
      },
    },
    Documentation: {
      type: "object",
      properties: {
        type: {
          type: "string",
          title: "Dokumenttyp",
          enum: [
            "Schweißanweisung",
            "Prüfbericht",
            "Reparaturbericht",
            "Zertifikat",
          ],
        },
        file: { type: "string", title: "Datei" },
        date: { type: "string", format: "date", title: "Datum" },
      },
    },
    WeldedComponent: {
      type: "object",
      properties: {
        name: { type: "string", title: "Bauteilbezeichnung" },
        drawingNumber: { type: "string", title: "Zeichnungsnummer" },
        material: { type: "string", title: "Werkstoff" },
        thickness: { type: "number", title: "Materialstärke (mm)" },
        weldingProcess: {
          type: "string",
          title: "Schweißverfahren",
          enum: ["MIG/MAG", "WIG", "E-Hand", "Unterpulver", "Laser"],
        },
        welder: { $ref: "#/definitions/Person", title: "Schweißer" },
        weldingDate: { type: "string", format: "date", title: "Schweißdatum" },
        qualityChecks: {
          type: "array",
          title: "Qualitätsprüfungen",
          items: { $ref: "#/definitions/QualityCheck" },
        },
        defects: {
          type: "array",
          title: "Mängel",
          items: { $ref: "#/definitions/Defect" },
        },
        documentation: {
          type: "array",
          title: "Dokumentation",
          items: { $ref: "#/definitions/Documentation" },
        },
      },
      required: [
        "name",
        "drawingNumber",
        "material",
        "weldingProcess",
        "welder",
        "weldingDate",
      ],
    },
  },
};
