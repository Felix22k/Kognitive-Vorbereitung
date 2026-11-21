export function Simulation() {
  const items = [
    [
      'Kurzsimulation',
      '30 min, Testmodus, adaptiv, ohne Pause: Zahlenreihen, Matrizen, Mentale Rotation, Kopfrechnen, Wortanalogien, Determination.',
      7,
    ],
    [
      'Vollsimulation',
      'ca. 2,5 h in 9 Blöcken mit Anleitungsseiten, wahlweise ohne Pause („Ernstfall“).',
      7,
    ],
    ['Vigilanz einzeln', '5, 15 oder 30 min Vigilanz-Uhr mit Auswertung pro Drittel.', 5],
    [
      'Belastungsmodus',
      'Test direkt nach körperlicher Belastung (extern, geführte Intervalle in der App oder im Wechsel), Vergleich ausgeruht gegen belastet.',
      7,
    ],
  ] as const;
  return (
    <div className="page">
      <h1>Simulation</h1>
      <p className="muted">
        Längere Durchgänge unter Testbedingungen. Diese Funktionen werden in späteren Meilensteinen
        gebaut.
      </p>
      <div className="grid cols-2">
        {items.map(([t, d, ms]) => (
          <div key={t} className="card module-row disabled">
            <div>
              <div style={{ fontWeight: 600 }}>{t}</div>
              <div className="muted small">{d}</div>
            </div>
            <span className="pill">Meilenstein {ms}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
