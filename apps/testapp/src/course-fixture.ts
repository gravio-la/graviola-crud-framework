/** Seed Turtle for the course / OER schema Oxigraph store when localStorage is empty. */
export const exampleDataTurtle = `
    PREFIX : <http://www.example.org/>
    PREFIX ex: <http://www.example.org/example/>
    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

    # ═══════════════════════════════════════════════════════════════════════════
    # Teilgebiete
    # ═══════════════════════════════════════════════════════════════════════════

    ex:ta-mechanik a :TopicArea ;
      :name "Grundlagen Mechanik" ;
      :description "Kräfte, Momente, Lager — Basis für alle weiteren Lokomodulkurse." ;
      :subTopics ( ex:ta-bremsen ex:ta-diesel ) .

    ex:ta-bremsen a :TopicArea ;
      :name "Bremsentechnik" ;
      :description "Druckluft-, Federspeicher- und Rekuperationsbremsen." ;
      :parentTopic ex:ta-mechanik .

    ex:ta-elok a :TopicArea ;
      :name "E-Lok Technik" ;
      :description "Stromabnehmer, Traktion, Schutzleitungen, Batteriesysteme." .

    ex:ta-diesel a :TopicArea ;
      :name "Diesellok Technik" ;
      :description "Dieselmotor, Kraftübertragung, Abgasnachbehandlung." ;
      :parentTopic ex:ta-mechanik .

    # ═══════════════════════════════════════════════════════════════════════════
    # Kurs
    # ═══════════════════════════════════════════════════════════════════════════

    ex:course-loko a :Course ;
      :name "Lokomotivtechnik Grundkurs" ;
      :description "Modularer Einstiegskurs: Mechanik, Bremsen, E-Lok und Diesellok — mit Prüfungsfragenpool." ;
      :modules (
        ex:mod-mechanik
        ex:mod-bremsen
        ex:mod-elok
        ex:mod-diesel
      ) .

    # ═══════════════════════════════════════════════════════════════════════════
    # Lernziele (einzeln referenzierbar)
    # ═══════════════════════════════════════════════════════════════════════════

    ex:lo-mech-1 a :LearningObjective ;
      :title "Kräfte und Momente erklären" ;
      :description "Teilnehmende ordnen Kräfte in einfachen Mechaniksystemen zu." ;
      :bloomLevel "Verstehen" .

    ex:lo-mech-2 a :LearningObjective ;
      :title "Freischnitte skizzieren" ;
      :description "Freischnitte für Achse und Rad anlegen." ;
      :bloomLevel "Anwenden" .

    ex:lo-bremse-1 a :LearningObjective ;
      :title "Bremsarten unterscheiden" ;
      :description "Hauptluft, Hilfsluft und direkte/indirekte Bremse zuordnen." ;
      :bloomLevel "Wissen" .

    ex:lo-elok-1 a :LearningObjective ;
      :title "Stromkreise der Traktion beschreiben" ;
      :description "Hauptstrom, Steuerstrom und Schutzfunktionen benennen." ;
      :bloomLevel "Verstehen" .

    ex:lo-diesel-1 a :LearningObjective ;
      :title "Motorlastpunkt wählen" ;
      :description "Wirtschaftlicher Fahrpunkt vs. Höchstleistung einordnen." ;
      :bloomLevel "Anwenden" .

    # ═══════════════════════════════════════════════════════════════════════════
    # Dozentenunterlagen (Master)
    # ═══════════════════════════════════════════════════════════════════════════

    ex:doc-instr-mechanik a :InstructorDocument ;
      :title "DU: Grundlagen Mechanik Lokomotive" ;
      :description "Vollständige Dozentenversion mit Herleitungen." ;
      :content "Kapitel 1–3: Kräfte, Lager, Achsdruck — mit Praxisbeispielen Drehgestell." ;
      :exerciseSolutions "Ü1 Lösung: Resultierende F_R = 42 kN. Ü2: Moment um A = 12,4 kNm." .

    ex:doc-instr-bremsen a :InstructorDocument ;
      :title "DU: Bremsen einer Lokomotive" ;
      :description "Dozentenhandreichung inkl. Prüfstandsprotokolle." ;
      :content "Hauptluftführung, Gleitschutz, Rekuperation — Sicherheitskreise." ;
      :exerciseSolutions "Übungsblatt B3: Lösungsschema Druckverlauf HL." .

    ex:doc-instr-elok a :InstructorDocument ;
      :title "DU: Grundlagen E-Lok Technik" ;
      :description "Traktionsstromkreis und Schutz." ;
      :content "Stromrichter, Fahrmotor, Wende — typische Störungen." ;
      :exerciseSolutions "Messprotokoll M1: erwartete Kurvenformen siehe Anhang D." .

    ex:doc-instr-diesel a :InstructorDocument ;
      :title "DU: Dieselloktechnik Aufbau" ;
      :description "Motor, Getriebe, Kühlpfad." ;
      :content "Lastdiagramm, Abgasrückführung, Partikelfilter." ;
      :exerciseSolutions "Berechnungsaufgabe D2: η = 0,41." .

    # ═══════════════════════════════════════════════════════════════════════════
    # Teilnehmerunterlagen & Präsentationen (abgeleitet)
    # ═══════════════════════════════════════════════════════════════════════════

    ex:doc-part-mechanik a :ParticipantDocument ;
      :title "TU: Grundlagen Mechanik (Teilnehmer)" ;
      :description "Kompakte Teilnehmerversion." ;
      :content "Kernbegriffe und Übungsaufgaben ohne Lösungsweg." ;
      :examples "Zusatzbeispiel: Kräfteplan Drehgestell vereinfacht." ;
      :figures "Abb. 2.1–2.4: Kräfte an Radsatz (Schemazeichnungen)." ;
      :basedOn ex:doc-instr-mechanik .

    ex:pres-mechanik a :Presentation ;
      :title "Folien: Mechanik-Grundlagen" ;
      :description "Einstieg und Übersicht." ;
      :slideCount 24 ;
      :durationMinutes 45 ;
      :basedOn ex:doc-instr-mechanik .

    ex:doc-part-bremsen a :ParticipantDocument ;
      :title "TU: Bremsen (Teilnehmer)" ;
      :description "Schemata und Merksätze." ;
      :content "Funktionsblöcke HL/Hilfsluft, Störfallmatrix." ;
      :examples "Video-Stills: Bremsprobe (ohne Ton)." ;
      :figures "Abb. B1: Hauptluftführung schematisch." ;
      :basedOn ex:doc-instr-bremsen .

    ex:pres-bremsen a :Presentation ;
      :title "Folien: Bremsen — Überblick" ;
      :description "Klassen und Prüfpunkte." ;
      :slideCount 32 ;
      :durationMinutes 50 ;
      :basedOn ex:doc-instr-bremsen .

    ex:pres-elok a :Presentation ;
      :title "Folien: E-Lok Traktion" ;
      :description "Stromrichter und Schutz." ;
      :slideCount 40 ;
      :durationMinutes 60 ;
      :basedOn ex:doc-instr-elok .

    # ═══════════════════════════════════════════════════════════════════════════
    # Module (mit Voraussetzungen)
    # ═══════════════════════════════════════════════════════════════════════════

    ex:mod-mechanik a :Module ;
      :name "Grundlagen Mechanik" ;
      :description "Statik und einfache Dynamik am Radsatz / Drehgestell." ;
      :duration 16 ;
      :course ex:course-loko ;
      :topicAreas ( ex:ta-mechanik ) ;
      :learningObjectives ( ex:lo-mech-1 ex:lo-mech-2 ) ;
      :instructorDocument ex:doc-instr-mechanik .

    ex:mod-bremsen a :Module ;
      :name "Bremsen einer Lokomotive" ;
      :description "Aufbauend auf Mechanik: Bremsen im Schienenfahrzeug." ;
      :duration 12 ;
      :course ex:course-loko ;
      :prerequisites ( ex:mod-mechanik ) ;
      :topicAreas ( ex:ta-bremsen ex:ta-mechanik ) ;
      :learningObjectives ( ex:lo-bremse-1 ) ;
      :instructorDocument ex:doc-instr-bremsen .

    ex:mod-elok a :Module ;
      :name "Grundlagen E-Lok Technik" ;
      :description "Elektrische Triebfahrzeuge — Stromkreise und Komponenten." ;
      :duration 20 ;
      :course ex:course-loko ;
      :prerequisites ( ex:mod-mechanik ) ;
      :topicAreas ( ex:ta-elok ) ;
      :learningObjectives ( ex:lo-elok-1 ) ;
      :instructorDocument ex:doc-instr-elok .

    ex:mod-diesel a :Module ;
      :name "Dieselloktechnik" ;
      :description "Verbrennungsmotor und Kraftübertragung — auf Mechanik aufbauend." ;
      :duration 18 ;
      :course ex:course-loko ;
      :prerequisites ( ex:mod-mechanik ) ;
      :topicAreas ( ex:ta-diesel ex:ta-mechanik ) ;
      :learningObjectives ( ex:lo-diesel-1 ) ;
      :instructorDocument ex:doc-instr-diesel .

    # Inverse links InstructorDocument → abgeleitete Unterlagen (optional explizit)
    ex:doc-instr-mechanik :participantDocuments ( ex:doc-part-mechanik ) ;
      :presentations ( ex:pres-mechanik ) .

    ex:doc-instr-bremsen :participantDocuments ( ex:doc-part-bremsen ) ;
      :presentations ( ex:pres-bremsen ) .

    ex:doc-instr-elok :presentations ( ex:pres-elok ) .

    # ═══════════════════════════════════════════════════════════════════════════
    # Prüfungsfragen (Pool — mehrere Teilgebiete möglich)
    # ═══════════════════════════════════════════════════════════════════════════

    ex:q-mech-1 a :Question ;
      :text "Nennen Sie die drei Newtonschen Axiome in Stichworten." ;
      :answer "1) Kraft = Masse × Beschleunigung. 2) actio = reactio. 3) Trägheit." ;
      :topicAreas ( ex:ta-mechanik ) ;
      :estimatedMinutes "3"^^xsd:decimal ;
      :difficulty "Leicht" ;
      :questionType "Freitext" ;
      :points "2"^^xsd:decimal ;
      :module ex:mod-mechanik .

    ex:q-mech-2 a :Question ;
      :text "Berechnen Sie das resultierende Moment um Punkt A für gegebene Kräfte F1=10 kN, F2=6 kN (Hebelarme siehe Skizze in Unterlage)." ;
      :answer "M_A = F1·a1 − F2·a2 (Vorzeichen je nach Hebelarm); Einheit kNm." ;
      :topicAreas ( ex:ta-mechanik ) ;
      :estimatedMinutes "8"^^xsd:decimal ;
      :difficulty "Mittel" ;
      :questionType "Berechnung" ;
      :points "5"^^xsd:decimal ;
      :module ex:mod-mechanik .

    ex:q-bremse-1 a :Question ;
      :text "Erklären Sie den Unterschied zwischen direkter und indirekter Bremse." ;
      :answer "Direkt: Gestängeweg unmittelbar vom Bremszylinder; indirekt: über Hebelübersetzung / Krafterhöhung." ;
      :topicAreas ( ex:ta-bremsen ex:ta-mechanik ) ;
      :estimatedMinutes "5"^^xsd:decimal ;
      :difficulty "Mittel" ;
      :questionType "Freitext" ;
      :points "4"^^xsd:decimal ;
      :module ex:mod-bremsen .

    ex:q-bremse-2 a :Question ;
      :text "Ordnen Sie zu: HL-Druckabfall, Blockverhältnis, Gleitschutz — welche Größe steuert was?" ;
      :answer "Tabelle: HL-Druck → Bremskraft; Gleitschutz → Schlupfregelung; Blockverhältnis → Adhäsionsnutzung." ;
      :topicAreas ( ex:ta-bremsen ) ;
      :estimatedMinutes "6"^^xsd:decimal ;
      :difficulty "Schwer" ;
      :questionType "Zuordnung" ;
      :points "6"^^xsd:decimal ;
      :module ex:mod-bremsen .

    ex:q-elok-1 a :Question ;
      :text "Welche Funktion hat der Hauptstromschalter im Traktionsstromkreis?" ;
      :answer "Trennt unter Last den Hauptstromkreis; oft mit Lichtbogenlöschung — genaue Bauart variantenabhängig." ;
      :topicAreas ( ex:ta-elok ) ;
      :estimatedMinutes "4"^^xsd:decimal ;
      :difficulty "Leicht" ;
      :questionType "Freitext" ;
      :points "3"^^xsd:decimal ;
      :module ex:mod-elok .

    ex:q-elok-2 a :Question ;
      :text "Skizzieren Sie schematisch Stromrichter — Fahrmotor — Radsatz." ;
      :answer "Blockdiagramm: Netz/Oberleitung → Stromrichter → Motor → Getriebe → Achse." ;
      :topicAreas ( ex:ta-elok ex:ta-mechanik ) ;
      :estimatedMinutes "7"^^xsd:decimal ;
      :difficulty "Mittel" ;
      :questionType "Freitext" ;
      :points "5"^^xsd:decimal ;
      :module ex:mod-elok .

    ex:q-diesel-1 a :Question ;
      :text "Nennen Sie zwei typische Abgasnachbehandlungsstufen bei modernen Dieselmotoren." ;
      :answer "z. B. SCR (Harnstoff), Partikelfilter, Oxidationskatalysator — zwei ausreichend." ;
      :topicAreas ( ex:ta-diesel ) ;
      :estimatedMinutes "3"^^xsd:decimal ;
      :difficulty "Leicht" ;
      :questionType "Freitext" ;
      :points "2"^^xsd:decimal ;
      :module ex:mod-diesel .

    ex:q-diesel-2 a :Question ;
      :text "Berechnen Sie die Motorleistung aus Drehmoment und Drehzahl (Formel angeben und einsetzen)." ;
      :answer "P = 2π n M; Werte einsetzen, Einheit kW." ;
      :topicAreas ( ex:ta-diesel ) ;
      :estimatedMinutes "6"^^xsd:decimal ;
      :difficulty "Mittel" ;
      :questionType "Berechnung" ;
      :points "5"^^xsd:decimal ;
      :module ex:mod-diesel .

    ex:q-mixed-1 a :Question ;
      :text "Warum ist Rekuperationsbremsen sowohl den Teilgebieten Bremsentechnik als auch E-Lok zuzuordnen?" ;
      :answer "Energie wird elektrisch zurückgespeist (E-Lok) und beeinflusst Bremsmomentverteilung (Bremsen)." ;
      :topicAreas ( ex:ta-bremsen ex:ta-elok ) ;
      :estimatedMinutes "5"^^xsd:decimal ;
      :difficulty "Mittel" ;
      :questionType "Freitext" ;
      :points "4"^^xsd:decimal ;
      :module ex:mod-elok .

    ex:q-mc-1 a :Question ;
      :text "Welche Aussage zur Trägheit ist korrekt? A) … B) … C) …" ;
      :answer "B — gemäß Lehrmaterial Modul Mechanik." ;
      :topicAreas ( ex:ta-mechanik ) ;
      :estimatedMinutes "2"^^xsd:decimal ;
      :difficulty "Leicht" ;
      :questionType "Multiple-Choice" ;
      :points "1"^^xsd:decimal ;
      :module ex:mod-mechanik .

`;
