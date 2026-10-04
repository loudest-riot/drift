/* DRIFT v0.9 field interaction cleanup. Runs after app.js. */
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

  /* Debut mode: one stable basemap. Landmarks and city labels remain useful
     overlays, but the provider-switching controls are removed for now. */
  const styleButtons = [...document.querySelectorAll('.map-style')];
  styleButtons[0]?.closest('.layer-chips')?.remove();

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

  /* Never let an approximate or distant location yank FIELD MAP out to a
     county/state view. Nearby precise fixes may frame user + signal; otherwise
     the signal itself is the map focus. */
  if (typeof focusSignalOnMap === 'function') {
    focusSignalOnMap = function (sig) {
      showView('fieldView');
      if (guidanceLine) {
        map.removeLayer(guidanceLine);
        guidanceLine = null;
      }

      const reliable = userPos && Number.isFinite(userPos.accuracy) && userPos.accuracy <= 500;
      const distance = reliable ? distanceM(userPos, sig) : Infinity;

      if (reliable && distance <= 3000) {
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

      setTimeout(() => markers.get(sig.id)?.openTooltip?.(), 80);
    };
  }

  /* Bind FIELD MAP directly when each signal detail is rendered. No document-
     level click interception; Safari gets one plain button -> one function. */
  if (typeof openSignal === 'function') {
    const originalOpenSignal = openSignal;
    openSignal = function (id) {
      originalOpenSignal(id);
      const sig = state.signals.find(item => item.id === id);
      if (!sig) return;
      const mapButton = document.querySelector('.nav-mode[data-nav="map"]');
      if (!mapButton) return;
      mapButton.onclick = event => {
        event.preventDefault();
        focusSignalOnMap(sig);
      };
    };
  }

  /* If a deep-linked signal was already rendered before this file ran, bind it too. */
  const currentMapButton = document.querySelector('.nav-mode[data-nav="map"]');
  const currentCode = document.querySelector('.detail-id')?.textContent?.split('//')[0]?.trim();
  if (currentMapButton && currentCode) {
    const currentSig = state.signals.find(item => item.code === currentCode);
    if (currentSig) currentMapButton.onclick = event => {
      event.preventDefault();
      focusSignalOnMap(currentSig);
    };
  }

  /* Location is opt-in. Approximate location can orient the map, but it is not
     trusted for proximity unlocks, tracking, or celestial calculations. */
  const geoStatus = document.getElementById('geoStatus');
  const locateBtn = document.getElementById('locateBtn');
  let locationWatchId = null;
  let centeredOnFix = false;
  let approximateNotified = false;

  if (geoStatus) geoStatus.textContent = 'LOCATION OFF // TAP ◎';

  function placeUserMarker(lat, lng) {
    if (userMarker) userMarker.setLatLng([lat, lng]);
    else {
      userMarker = L.marker([lat, lng], {
        icon: L.divIcon({
          className: '',
          html: '<div class="user-dot"></div>',
          iconSize: [14, 14],
          iconAnchor: [7, 7]
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
      placeUserMarker(lat, lng);

      if (!centeredOnFix) {
        map.setView([lat, lng], 14, { animate: false });
        centeredOnFix = true;
      }

      if (accuracy > 500) {
        userPos = null;
        if (geoStatus) geoStatus.textContent = `APPROXIMATE LOCATION // ±${accuracy} m`;
        if (!approximateNotified) {
          toast('APPROXIMATE LOCATION // MAP WORKS; SIGNAL UNLOCKS STAY OFF');
          approximateNotified = true;
        }
      } else {
        userPos = { lat, lng, accuracy };
        if (geoStatus) geoStatus.textContent = `FIELD LINK ACTIVE // ±${accuracy} m`;
        if (tracking) appendTrackPoint(userPos);
      }

      renderDeck();
      renderMarkers();
    }, err => {
      userPos = null;
      if (geoStatus) geoStatus.textContent = 'LOCATION OPTIONAL // MAP READY';
      toast('LOCATION BLOCKED // DRIFT STILL WORKS WITHOUT IT');
      console.warn('DRIFT geolocation:', err?.message || err);
    }, {
      enableHighAccuracy: true,
      maximumAge: 5000,
      timeout: 12000
    });
  }

  if (locateBtn) locateBtn.onclick = beginFieldLocation;
})();
