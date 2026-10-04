/* DRIFT v0.6 interaction cleanup. Runs after app.js. */
(() => {
  const isJpCard = card => /\/\/\s*JP PICK/i.test(card.textContent || '');

  function cleanSignalDeck() {
    document.querySelectorAll('.signal-card').forEach(card => {
      if (isJpCard(card)) card.remove();
    });
  }

  /* Keep JP picks out of the public FIELD deck while preserving their data. */
  if (typeof renderDeck === 'function') {
    const originalRenderDeck = renderDeck;
    renderDeck = function () {
      originalRenderDeck();
      cleanSignalDeck();
    };
    renderDeck();
  } else {
    cleanSignalDeck();
  }

  /* Add readable signal labels to field markers. */
  function addSignalTooltips() {
    if (typeof state === 'undefined' || typeof markers === 'undefined') return;
    state.signals.filter(sig => !sig.jp && sig.lat != null).forEach(sig => {
      const marker = markers.get(sig.id);
      if (!marker) return;
      if (!marker.getTooltip()) {
        marker.bindTooltip(`${sig.code} // ${sig.name}`, {
          direction: 'top',
          offset: [0, -10],
          className: 'drift-signal-label'
        });
      }
    });
  }

  if (typeof renderMarkers === 'function') {
    const originalRenderMarkers = renderMarkers;
    renderMarkers = function () {
      originalRenderMarkers();
      addSignalTooltips();
    };
    renderMarkers();
  } else {
    addSignalTooltips();
  }

  /* FIELD MAP should mean exactly that: one tap opens the map. */
  document.addEventListener('click', event => {
    const button = event.target.closest('.nav-mode[data-nav="map"]');
    if (!button) return;

    const code = document.querySelector('.detail-id')?.textContent?.split('//')[0]?.trim();
    if (!code || typeof state === 'undefined' || typeof focusSignalOnMap !== 'function') return;
    const sig = state.signals.find(item => item.code === code);
    if (!sig) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    focusSignalOnMap(sig);
    requestAnimationFrame(() => {
      const marker = typeof markers !== 'undefined' ? markers.get(sig.id) : null;
      marker?.openTooltip?.();
    });
  }, true);
})();
