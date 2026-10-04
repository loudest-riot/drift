/* DRIFT v0.7 stable field bootstrap.
   Keep startup calm: one dependable basemap, sane zoom, and no automatic
   geolocation request before the visitor explicitly taps the locate button. */
(() => {
  if (!window.L || !L.Map) return;

  /* Use the plain OSM layer for the debut. Other providers can come back after
     field testing; fewer third-party requests means fewer Safari surprises. */
  try { localStorage.setItem('lr-drift-map-style-v01', 'standard'); } catch (e) {}

  const originalGetCenter = L.Map.prototype.getCenter;
  const originalGetZoom = L.Map.prototype.getZoom;
  const originalFitBounds = L.Map.prototype.fitBounds;

  L.Map.prototype.getCenter = function () {
    if (!this._loaded) return L.latLng(42.3775, -83.3725);
    return originalGetCenter.call(this);
  };

  L.Map.prototype.getZoom = function () {
    if (!this._loaded || !Number.isFinite(this._zoom)) return 12;
    return originalGetZoom.call(this);
  };

  /* Leaflet's automatic fit can zoom absurdly far out when an approximate
     location or long route is included. Large extents get a useful field view
     instead of a regional weather-map impression. */
  L.Map.prototype.fitBounds = function (bounds, options = {}) {
    const b = L.latLngBounds(bounds);
    const latSpan = Math.abs(b.getNorth() - b.getSouth());
    const lngSpan = Math.abs(b.getEast() - b.getWest());
    if (latSpan > 0.10 || lngSpan > 0.14) {
      return this.setView(b.getCenter(), 12, { animate: false });
    }
    return originalFitBounds.call(this, b, { ...options, maxZoom: 16 });
  };

  /* app.js currently calls startLocation() on load. Intercept that first watch
     so Safari is not asked for location until the visitor actually chooses it. */
  const geo = navigator.geolocation;
  if (geo && typeof geo.watchPosition === 'function') {
    const originalWatch = geo.watchPosition.bind(geo);
    window.__driftLocationRequested = false;
    window.__driftOriginalWatchPosition = originalWatch;
    try {
      geo.watchPosition = function (...args) {
        if (!window.__driftLocationRequested) return -1;
        return originalWatch(...args);
      };
    } catch (e) {}
  }
})();
