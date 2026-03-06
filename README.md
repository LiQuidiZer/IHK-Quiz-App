# IHK KI-Quiz Simulation

Eine interaktive Web-App zur Vorbereitung auf IHK-Prüfungen im Bereich Künstliche Intelligenz, Projektmanagement und neue Technologien. Diese Anwendung simuliert eine Prüfungsumgebung mit verschiedenen Fragetypen und detaillierten Auswertungen.

## Funktionen

*   **Themenbereiche**: Fragen zu GenAI & LLMs, Evaluierung & Delegation, Prompting & Compliance, KI Projektplanung, Umsetzung & Diligence, Design & Präsentation sowie Agenten & MCPs.
*   **Prüfungssimulation**:
    *   **Timer**: Einstellbare Zeitbegrenzung (Standard: 20 Minuten).
    *   **Fragenanzahl**: Wählbar (z.B. 40 Fragen).
    *   **Schwierigkeitsgrad**: Option zum Ausblenden von Hinweisen (Anzahl korrekter Antworten), um eine echte Prüfungssituation zu simulieren.
*   **Interaktives Quiz**:
    *   Multiple-Choice Fragen.
    *   Fortschrittsanzeige und Live-Status.
    *   Batch-Verarbeitung der Fragen (immer 5 auf einer Seite).
*   **Detaillierte Auswertung**:
    *   Visuelle Darstellung des Ergebnisses (Score-Ring).
    *   Statistik-Raster (Richtig, Falsch, Quote, Zeit).
    *   **Themen-Analyse**: Balkendiagramme zeigen Stärken und Schwächen pro Kategorie.
    *   **Fehleranalyse**: Anzeige der falsch beantworteten Fragen inklusive korrekter Lösung und Erklärung (Rationale).
*   **PDF-Export**: Generierung eines detaillierten Ergebnisberichts als PDF-Datei.
*   **Verlauf**: Die letzten Ergebnisse werden lokal im Browser gespeichert und auf der Startseite angezeigt.
*   **Responsive Design**: Optimierte Darstellung für Desktop, Tablet und Smartphone.

## Changelog

Eine detaillierte Übersicht über alle Entwicklungsschritte und neuen Funktionen findest du im
[**Entwicklungs-Log (log.md)**](./log.md).

## Installation & Nutzung

Da die Anwendung auf reinem HTML, CSS und JavaScript basiert, ist keine Server-Installation notwendig.

1.  Laden Sie das Projektverzeichnis herunter.
2.  Öffnen Sie die Datei `index.html` in einem modernen Webbrowser (Chrome, Firefox, Edge, Safari).

## Technologien

*   **Frontend**: HTML5, CSS3, JavaScript (ES6+)
*   **Bibliotheken**:
    *   jsPDF (für den PDF-Export)
*   **Fonts**: Inter (via Google Fonts)

## Projektstruktur

*   `index.html`: Hauptstruktur und Layout.
*   `style.css`: Design und Responsive Styles.
*   `app.js`: Anwendungslogik (Quiz-Steuerung, Timer, Auswertung, PDF-Export).
*   `quiz-data.js`: Enthält den Fragenkatalog im JSON-Format.