/* DRIFT v0.11 field interaction cleanup. Runs after app.js. */
(() => {
  const fieldView = document.getElementById('fieldView');
  const mapHead = document.querySelector('.map-head');
  const signalDeck = document.getElementById('signalDeck');

  /* FIELD is a map, not a card carousel. Keep signal data, remove the tiles. */
  if (signalDeck) signalDeck.hidden = true;

  /* HINES PLACE picker: every named Hines landmark in one compact control. */
  if (mapHead && typeof landmarks !== 'undefined') {
    const picker = document.createElement('label');
    picker.className = 'place-picker';
    picker.innerHTML = '<span>HINES PLACE</span><select id="hinesPlaceSelect" aria-label="Choose a Hines Park place"><option value="">CHOOSE A PLACE…</option></select>';

    const select = picker.querySelector('select');
    landmarks.forEach((place, index) => {
      const option = document.createElement('option');
      option.value = String(index);
      option.textContent = place.name.toUpperCase();
      select.appendChild(option);
    });

    select.addEventListener('change', () => {
      if (select.value === '') return;
      const place = landmarks[Number(select.value)];
      if (!place) return;

      map.setView([place.lat, place.lng], 14, { animate: false });

      /* If this named place is also an active signal, expose its marker label. */
      if (typeof state !== 'undefined' && typeof markers !== 'undefined') {
        const sig = state.signals.find(item => item.lat != null && (
          item.name === place.name || distanceM(item, place) < 60
        ));
        if (sig) setTimeout(() => markers.get(sig.id)?.openTooltip?.(), 80);
      }
    });

    const status = mapHead.querySelector('.statusline');
    status?.insertAdjacentElement('afterend', picker);
  }

  /* Add readable signal labels to field markers. */
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

      setTimeout(() => markers.get(sig.id)?.openTooltip?.(), 80);
    };
  }

  /* Bind FIELD MAP directly when a signal detail is rendered. */
  if (typeof openSignal === 'function') {
    const originalOpenSignal = openSignal;
    openSignal = function (id) {
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

  /* Location is opt-in. Approximate iOS fixes never move the map. */
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

      if (accuracy > 250) {
        userPos = null;
        removeUserMarker();
        if (geoStatus) geoStatus.textContent = `APPROXIMATE // ±${accuracy} m // MAP UNCHANGED`;
        if (!approximateNotified) {
          toast('LOCATION TOO BROAD // KEEPING HINES MAP IN PLACE');
          approximateNotified = true;
        }
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
