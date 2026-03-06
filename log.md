# Entwicklungs-Log (Changelog)

Dieses Dokument hält die Entwicklungsschritte und neuen Funktionen der IHK KI-Quiz App fest.

---

### Version 1.3.1 (Aktuell)
*   **Feature**: Ein `log.md` wurde hinzugefügt, um den Entwicklungsstand zu dokumentieren.
*   **Fix**: Die Seite scrollt nun nach dem Klick auf "Weiter" automatisch nach oben, um die neuen Fragen direkt anzuzeigen.

---

### Version 1.3.0
*   **Feature**: Ein Schieberegler wurde auf dem Startbildschirm hinzugefügt, um die Anzeige der Anzahl korrekter Antworten zu aktivieren/deaktivieren (Standard: aus).
*   **Feature**: Die Ergebnisse der letzten 5 Versuche werden im `localStorage` gespeichert und auf der Startseite als Verlaufsliste angezeigt.
*   **UI**: Ein Button zum Löschen des Verlaufs wurde hinzugefügt.

---

### Version 1.2.0
*   **Feature**: Die App ist nun vollständig "responsive" und passt sich automatisch an Desktop-, Tablet- und Smartphone-Bildschirme an.
*   **Feature**: Bei falschen Antworten wird nun eine Erklärung (Rationale) angezeigt, um den Lerneffekt zu steigern. Diese wird auch im PDF-Export berücksichtigt.

---

### Version 1.1.0
*   **Feature**: Die Auswertung wurde grundlegend überarbeitet und ist nun deutlich aussagekräftiger:
    *   Ein detailliertes Statistik-Raster zeigt Richtig, Falsch, Quote und Zeit.
    *   Eine visuelle Analyse nach Themengebieten (Balkendiagramme) wurde hinzugefügt.
*   **Feature**: Der PDF-Export wurde erweitert und enthält nun ebenfalls die neuen, detaillierten Statistiken und die Themen-Analyse.

---

### Version 1.0.0
*   **Initiales Setup**:
    *   Grundlegende Quiz-Struktur mit HTML, CSS und JavaScript.
    *   Laden der Fragen aus der `quiz-data.js`.
    *   Timer-Funktion für die Prüfungssimulation.
    *   Batch-Verarbeitung der Fragen (5 pro Seite).
    *   Einfache Ergebnisanzeige mit Punktzahl.