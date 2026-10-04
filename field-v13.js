/* DRIFT v0.13 — stable field controls. Loaded after app.js. */
(() => {
  const signalDeck = document.getElementById('signalDeck');
  const placeSelect = document.getElementById('hinesPlaceSelect');
  const geoStatus = document.getElementById('geoStatus');
  const locateBtn = document.getElementById('locateBtn');

  if (signalDeck) signalDeck.hidden = true;

  /* The place control is now static HTML, so it exists even if JS is unhappy. */
  placeSelect?.addEventListener('change', () => {
    const option = placeSelect.options[placeSelect.selectedIndex];
    const lat = Number(option?.dataset?.lat);
    const lng = Number(option?.dataset?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    map.setView([lat, lng], 14, { animate: false });
    placeSelect.blur();
  });

  function slabHTML({ kicker, name, note, meta }) {
    return `<div class="location-slab">
      <div class="slab-kicker">${esc(kicker || 'HINES PARK')}</div>
      <strong>${esc(name || '')}</strong>
      ${meta ? `<div class="slab-meta">${esc(meta)}</div>` : ''}
      ${note ? `<p>${esc(note)}</p>` : ''}
    </div>`;
  }

  function closeAllSlabs(except = null) {
    try {
      landmarkLayer?.eachLayer?.(layer => { if (layer !== except) layer.closeTooltip?.(); });
      markers?.forEach?.(marker => { if (marker !== except) marker.closeTooltip?.(); });
    } catch (e) {}
  }

  function bindSlab(marker, html) {
    if (!marker) return;
    marker.unbindPopup?.();
    marker.unbindTooltip?.();
    marker.bindTooltip(html, {
      direction: 'top',
      offset: [0, -11],
      className: 'location-slab-tooltip',
      opacity: 1,
      permanent: false,
      interactive: false
    });

    /* Remove the original signal-card navigation click. FIELD stays a map. */
    marker.off('mouseover');
    marker.off('mouseout');
    marker.off('click');

    marker.on('mouseover', () => {
      closeAllSlabs(marker);
      marker.openTooltip();
    });
    marker.on('mouseout', () => marker.closeTooltip());
    marker.on('click', event => {
      if (event?.originalEvent) L.DomEvent.stopPropagation(event.originalEvent);
      const alreadyOpen = marker.isTooltipOpen?.();
      closeAllSlabs(alreadyOpen ? null : marker);
      if (alreadyOpen) marker.closeTooltip();
      else marker.openTooltip();
    });
  }

  function applyLandmarkSlabs() {
    const layers = landmarkLayer?.getLayers?.() || [];
    layers.forEach((marker, index) => {
      const place = landmarks?.[index];
      if (!place) return;
      bindSlab(marker, slabHTML({
        kicker: place.sensitive ? `${place.kind} // SENSITIVE` : place.kind,
        name: place.name,
        note: place.note
      }));
    });
  }

  function applySignalSlabs() {
    state?.signals?.filter(sig => !sig.jp && sig.lat != null).forEach(sig => {
      const marker = markers?.get?.(sig.id);
      if (!marker) return;
      const st = signalState(sig);
      bindSlab(marker, slabHTML({
        kicker: `${sig.code} // SIGNAL`,
        name: sig.name,
        meta: st.d == null ? sig.status : `${fmtDistance(st.d)} // ${st.label}`,
        note: sig.transmission
      }));
    });
  }

  const originalRenderLandmarks = typeof renderLandmarks === 'function' ? renderLandmarks : null;
  if (originalRenderLandmarks) {
    renderLandmarks = function () {
      originalRenderLandmarks();
      applyLandmarkSlabs();
    };
  }

  const originalRenderMarkers = typeof renderMarkers === 'function' ? renderMarkers : null;
  if (originalRenderMarkers) {
    renderMarkers = function () {
      originalRenderMarkers();
      applySignalSlabs();
    };
  }

  applyLandmarkSlabs();
  applySignalSlabs();
  map?.on?.('click', () => closeAllSlabs());

  /* Deep-linked signal pages can still return to the field map cleanly. */
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
    };
  }

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

  /* Location is explicit opt-in. Broad iOS fixes never move the map. */
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
