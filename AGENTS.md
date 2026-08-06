# Hinweise für KI-Agenten

Die Anweisungen für dieses Repository stehen in [CLAUDE.md](CLAUDE.md). Diese
Datei existiert, damit Werkzeuge, die `AGENTS.md` lesen, sie ebenfalls finden.

Das Wichtigste vorweg, weil es leicht übersehen wird:

**Vor** dem ersten schreibenden oder ausführenden Schritt eines Auftrags wird das
Vorhaben in [docs/ai-handover.md](docs/ai-handover.md) eingetragen. **Nach** dem
Durchlauf wird das Ergebnis nachgetragen — auch bei Fehlschlag oder Abbruch.

So kann die nächste Sitzung eine unterbrochene Arbeit aufnehmen, etwa wenn das
Token-Kontingent mitten im Auftrag aufgebraucht war.

Der Arbeitsvorrat für kommende Sitzungen steht in
[docs/ai-todo.md](docs/ai-todo.md).
