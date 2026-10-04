/* DRIFT v0.12 field interaction cleanup. Runs after app.js. */
(() => {
  const signalDeck = document.getElementById('signalDeck');

  /* FIELD is a map, not a card carousel. */
  if (signalDeck) signalDeck.hidden = true;

  /* HINES PLACES lives in Leaflet beside the existing HINES control, so it
     cannot get buried inside map-head on small Safari viewports. */
  if (typeof L !== 'undefined' && typeof map !== 'undefined' && typeof landmarks !== 'undefined') {
    const HinesPlacesControl = L.Control.extend({
      options: { position: 'topright' },
      onAdd() {
        const wrap = L.DomUtil.create('div', 'leaflet-bar hines-place-control');
        const select = L.DomUtil.create('select', '', wrap);
        select.id = 'hinesPlaceSelect';
        select.setAttribute('aria-label', 'Choose a Hines Park place');
        select.innerHTML = '<option value="">HINES PLACES ▾</option>';

        landmarks.forEach((place, index) => {
          const option = document.createElement('option');
          option.value = String(index);
          option.textContent = place.name.toUpperCase();
          select.appendChild(option);
        });

        L.DomEvent.disableClickPropagation(wrap);
        L.DomEvent.disableScrollPropagation(wrap);

        select.addEventListener('change', () => {
          if (select.value === '') return;
          const place = landmarks[Number(select.value)];
          if (!place) return;
          map.setView([place.lat, place.lng], 14, { animate: false });
          select.blur();
        });
        return wrap;
      }
    });
    map.addControl(new HinesPlacesControl());
  }

  /* Slabs are contextual, not permanent UI. Desktop gets hover; touch devices
     get tap because phones, despite their many achievements, do not hover. */
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
      const open = marker.isTooltipOpen?.();
      closeAllSlabs(open ? null : marker);
      if (open) marker.closeTooltip();
      else marker.openTooltip();
    });
  }

  function applyLandmarkSlabs() {
    if (typeof landmarkLayer === 'undefined' || typeof landmarks === 'undefined') return;
    const layers = landmarkLayer.getLayers?.() || [];
    layers.forEach((marker, index) => {
      const place = landmarks[index];
      if (!place) return;
      bindSlab(marker, slabHTML({
        kicker: place.sensitive ? `${place.kind} // SENSITIVE` : place.kind,
        name: place.name,
        note: place.note
      }));
    });
  }

  function applySignalSlabs() {
    if (typeof state === 'undefined' || typeof markers === 'undefined') return;
    state.signals.filter(sig => !sig.jp && sig.lat != null).forEach(sig => {
      const marker = markers.get(sig.id);
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

  if (typeof renderLandmarks === 'function') {
    const originalRenderLandmarks = renderLandmarks;
    renderLandmarks = function () {
      originalRenderLandmarks();
      applyLandmarkSlabs();
    };
  }
  applyLandmarkSlabs();

  if (typeof renderMarkers === 'function') {
    const originalRenderMarkers = renderMarkers;
    renderMarkers = function () {
      originalRenderMarkers();
      applySignalSlabs();
    };
  }
  applySignalSlabs();

  map?.on?.('click', () => closeAllSlabs());

  /* FIELD MAP remains available for deep-linked signal pages, but returning to
     FIELD never creates a persistent slab. */
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

  /* Location stays opt-in. Approximate iOS fixes never move the map. */
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