/* DRIFT v0.10 field interaction cleanup. Runs after app.js. */
(() => {
  const fieldView = document.getElementById('fieldView');
  const isJpCard = card => /\/\/\s*JP PICK/i.test(card.textContent || '');

  function cleanSignalDeck() {
    document.querySelectorAll('.signal-card').forEach(card => {
      if (isJpCard(card)) card.remove();
    });
  }

  if (typeof renderDeck === 'function') {
    const originalRenderDeck = renderDeck;
    renderDeck = function () {
      originalRenderDeck();
      cleanSignalDeck();
    };
    renderDeck();
  } else cleanSignalDeck();

  /* One stable basemap for field testing. */
  const styleButtons = [...document.querySelectorAll('.map-style')];
  styleButtons[0]?.closest('.layer-chips')?.remove();

  /* Clean map mode: touching/zooming the map hides chrome and cards. */
  const mapUiToggle = document.createElement('button');
  mapUiToggle.id = 'mapUiToggle';
  mapUiToggle.className = 'map-ui-toggle';
  mapUiToggle.type = 'button';
  mapUiToggle.textContent = 'SIGNALS';
  mapUiToggle.setAttribute('aria-label', 'Show signal cards and map controls');
  fieldView?.appendChild(mapUiToggle);

  function collapseFieldUI() {
    fieldView?.classList.add('map-clean');
  }
  function expandFieldUI() {
    fieldView?.classList.remove('map-clean');
  }
  mapUiToggle.onclick = e => {
    e.preventDefault();
    e.stopPropagation();
    expandFieldUI();
  };

  const mapContainer = map?.getContainer?.();
  mapContainer?.addEventListener('pointerdown', collapseFieldUI, { passive: true });
  mapContainer?.addEventListener('touchstart', collapseFieldUI, { passive: true });
  map?.on?.('zoomstart', collapseFieldUI);

  function addSignalTooltips() {
    if (typeof state === 'undefined' || typeof markers === 'undefined') return;
    state.signals.filter(sig => !sig.jp && sig.lat != null).forEach(sig => {
      const marker = markers.get(sig.id);
      if (!marker || marker.getTooltip()) return;
      marker.bindTooltip(`${sig.code} // ${sig.name}`, {
        direction: 'top', offset: [0, -10], className: 'drift-signal-label'
      });
    });
  }

  if (typeof renderMarkers === 'function') {
    const originalRenderMarkers = renderMarkers;
    renderMarkers = function () {
      originalRenderMarkers();
      addSignalTooltips();
    };
    renderMarkers();
  } else addSignalTooltips();

  /* FIELD MAP: destination first, never a wild regional fit. */
  if (typeof focusSignalOnMap === 'function') {
    focusSignalOnMap = function (sig) {
      showView('fieldView');
      if (guidanceLine) {
        map.removeLayer(guidanceLine);
        guidanceLine = null;
      }

      const reliable = userPos && Number.isFinite(userPos.accuracy) && userPos.accuracy <= 250;
      const distance = reliable ? distanceM(userPos, sig) : Infinity;

      if (reliable && distance <= 2500) {
        guidanceLine = L.polyline(
          [[userPos.lat, userPos.lng], [sig.lat, sig.lng]],
          { weight: 2, dashArray: '5,7', opacity: .8 }
        ).addTo(map);
        map.fitBounds(
          L.latLngBounds([[userPos.lat, userPos.lng], [sig.lat, sig.lng]]),
          { padding: [60, 60], maxZoom: 15, animate: false }
        );
        if (map.getZoom() < 13) map.setZoom(13, { animate: false });
      } else {
        map.setView([sig.lat, sig.lng], 14, { animate: false });
      }

      collapseFieldUI();
      setTimeout(() => markers.get(sig.id)?.openTooltip?.(), 80);
    };
  }

  /* Direct FIELD MAP button binding. */
  if (typeof openSignal === 'function') {
    const originalOpenSignal = openSignal;
    openSignal = function (id) {
      expandFieldUI();
      originalOpenSignal(id);
      const sig = state.signals.find(item => item.id === id);
      const mapButton = document.querySelector('.nav-mode[data-nav="map"]');
      if (!sig || !mapButton) return;
      mapButton.onclick = event => {
        event.preventDefault();
        focusSignalOnMap(sig);
      };
    };
  }

  const currentMapButton = document.querySelector('.nav-mode[data-nav="map"]');
  const currentCode = document.querySelector('.detail-id')?.textContent?.split('//')[0]?.trim();
  if (currentMapButton && currentCode) {
    const currentSig = state.signals.find(item => item.code === currentCode);
    if (currentSig) currentMapButton.onclick = event => {
      event.preventDefault();
      focusSignalOnMap(currentSig);
    };
  }

  /* Location is opt-in. Critically: validate accuracy BEFORE moving the map. */
  const geoStatus = document.getElementById('geoStatus');
  const locateBtn = document.getElementById('locateBtn');
  let locationWatchId = null;
  let centeredOnPreciseFix = false;
  let approximateNotified = false;

  if (geoStatus) geoStatus.textContent = 'LOCATION OFF // TAP ◎';

  function removeUserMarker() {
    if (!userMarker) return;
    try { map.removeLayer(userMarker); } catch (e) {}
    userMarker = null;
  }

  function placeUserMarker(lat, lng) {
    if (userMarker) userMarker.setLatLng([lat, lng]);
    else {
      userMarker = L.marker([lat, lng], {
        icon: L.divIcon({
          className: '', html: '<div class="user-dot"></div>',
          iconSize: [14, 14], iconAnchor: [7, 7]
        })
      }).addTo(map);
    }
  }

  function beginFieldLocation() {
    if (!navigator.geolocation) {
      if (geoStatus) geoStatus.textContent = 'LOCATION UNAVAILABLE';
      toast('LOCATION UNAVAILABLE // FIELD MAP STILL WORKS');
      return;
    }

    window.__driftLocationRequested = true;

    if (locationWatchId !== null) {
      if (userPos) map.setView([userPos.lat, userPos.lng], 14, { animate: false });
      return;
    }

    if (geoStatus) geoStatus.textContent = 'ACQUIRING LOCATION';
    const watch = window.__driftOriginalWatchPosition || navigator.geolocation.watchPosition.bind(navigator.geolocation);

    locationWatchId = watch(pos => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const accuracy = Math.round(pos.coords.accuracy || 9999);

      /* Approximate iOS location is informational only. It NEVER moves the map. */
      if (accuracy > 250) {
        userPos = null;
        removeUserMarker();
        if (geoStatus) geoStatus.textContent = `APPROXIMATE // ±${accuracy} m // MAP UNCHANGED`;
        if (!approximateNotified) {
          toast('LOCATION TOO BROAD // KEEPING HINES MAP IN PLACE');
          approximateNotified = true;
        }
        renderDeck();
        renderMarkers();
        return;
      }

      userPos = { lat, lng, accuracy };
      placeUserMarker(lat, lng);
      if (geoStatus) geoStatus.textContent = `FIELD LINK ACTIVE // ±${accuracy} m`;

      if (!centeredOnPreciseFix) {
        map.setView([lat, lng], 14, { animate: false });
        centeredOnPreciseFix = true;
      }

      if (tracking) appendTrackPoint(userPos);
      renderDeck();
      renderMarkers();
    }, err => {
      userPos = null;
      removeUserMarker();
      if (geoStatus) geoStatus.textContent = 'LOCATION OPTIONAL // MAP READY';
      toast('LOCATION BLOCKED // DRIFT STILL WORKS WITHOUT IT');
      console.warn('DRIFT geolocation:', err?.message || err);
    }, {
      enableHighAccuracy: true,
      maximumAge: 3000,
      timeout: 12000
    });
  }

  if (locateBtn) locateBtn.onclick = beginFieldLocation;
})();
