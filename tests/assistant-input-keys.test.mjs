import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const PAGE = "avatar/BrandyCards.Desktop/MainPage.xaml.cs";
const XAML = "avatar/BrandyCards.Desktop/MainPage.xaml";

test("die Eingabetaste wird abgefangen, bevor die TextBox sie verarbeitet", async () => {
  const xaml = await read(XAML);
  const feld = xaml.match(/<TextBox x:Name="AssistantInputTextBox"[\s\S]*?\/>/u)?.[0] ?? "";
  // `KeyDown` bubbelt und kaeme zu spaet: Die TextBox haette den Umbruch dann
  // bereits eingefuegt, und er liesse sich nur noch nachtraeglich entfernen.
  assert.match(feld, /PreviewKeyDown="AssistantInputTextBox_PreviewKeyDown"/u);
  assert.doesNotMatch(feld, /[^w]KeyDown="/u, "ein bubbelnder Handler waere zu spaet");
  // Mehrzeilig bleibt das Feld -- Alt+Enter braucht etwas, worin es umbrechen kann.
  assert.match(feld, /AcceptsReturn="True"/u);
});

test("Enter sendet, Alt+Enter bricht um, und beides gilt als behandelt", async () => {
  const page = await read(PAGE);
  const handler = page.match(/private async void AssistantInputTextBox_PreviewKeyDown[\s\S]*?\n    \}/u)?.[0] ?? "";
  assert.ok(handler, "der Handler fehlt");

  assert.match(handler, /if \(e\.Key != VirtualKey\.Enter\) return;/u, "andere Tasten bleiben unberuehrt");
  // Der Zustand der Alt-Taste **zum Zeitpunkt dieses Anschlags**, nicht ein
  // spaeterer Blick auf die Tastatur.
  assert.match(handler, /e\.KeyStatus\.IsMenuKeyDown/u);
  // In beiden Zweigen behandelt, sonst faengt die TextBox zusaetzlich an.
  assert.match(handler, /e\.Handled = true;[\s\S]*if \(e\.KeyStatus\.IsMenuKeyDown\)/u,
    "die Markierung muss vor der Verzweigung stehen, damit sie fuer beide Wege gilt");
  assert.match(handler, /InsertNewlineAtCaret\(\);/u);
  assert.match(handler, /await SendTypedMessageAsync\(\);/u);
});

test("Knopf und Eingabetaste teilen sich denselben Sendepfad", async () => {
  const page = await read(PAGE);
  // Zwei Wege in die Unterhaltung sind in Ordnung, zwei Sendewege nicht --
  // sie liefen sonst irgendwann auseinander.
  assert.match(page, /private async void SendAssistantButton_Click\(object sender, RoutedEventArgs e\) => await SendTypedMessageAsync\(\);/u);
  assert.equal((page.match(/private async Task SendTypedMessageAsync\(\)/gu) ?? []).length, 1);
  // Und die Zusicherung aus Phase 4 gilt weiter: getippt wie diktiert endet
  // alles in SendAssistantMessageAsync.
  assert.match(page, /SendTypedMessageAsync[\s\S]*await SendAssistantMessageAsync\(message\)/u);
});

test("der Umbruch ersetzt die Auswahl und sprengt die Laengengrenze nicht", async () => {
  const page = await read(PAGE);
  const einfuegen = page.match(/private void InsertNewlineAtCaret\(\)[\s\S]*?\n    \}/u)?.[0] ?? "";
  assert.ok(einfuegen, "InsertNewlineAtCaret fehlt");

  // Eine markierte Auswahl wird ersetzt, wie in jedem Textfeld.
  assert.match(einfuegen, /text\.Remove\(start, laenge\)\.Insert\(start, "\\r"\)/u);
  // WinUI fuehrt Umbrueche als \r; ein \n kaeme beim Auslesen anders zurueck.
  assert.doesNotMatch(einfuegen, /Insert\(start, "\\n"\)|Environment\.NewLine/u);
  // MaxLength gilt nur fuer getippte Zeichen -- ohne Pruefung liesse sich die
  // Grenze mit Umbruechen ueberschreiten.
  assert.match(einfuegen, />= AssistantInputTextBox\.MaxLength\) return;/u);
  // Die Einfuegemarke steht danach hinter dem Umbruch, nicht davor.
  assert.match(einfuegen, /SelectionStart = start \+ 1;[\s\S]*SelectionLength = 0;/u);
});

test("die Tastenbelegung steht im Hilfetext, sonst findet sie niemand", async () => {
  const xaml = await read(XAML);
  const feld = xaml.match(/<TextBox x:Name="AssistantInputTextBox"[\s\S]*?\/>/u)?.[0] ?? "";
  assert.match(feld, /AutomationProperties\.HelpText="[^"]*Eingabetaste sendet[^"]*neue Zeile/u);
});
