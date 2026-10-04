/* DRIFT v0.11 stable field bootstrap.
   Keep startup calm, preserve sane zoom, and require explicit location opt-in. */
(() => {
  if (!window.L || !L.Map) return;

  /* Restore MINIMAL as the default once for the v0.11 UI. After this migration,
     whatever map style the visitor chooses is allowed to persist. */
  try {
    const migrationKey = 'lr-drift-map-default-v11';
    if (localStorage.getItem(migrationKey) !== '1') {
      localStorage.setItem('lr-drift-map-style-v01', 'minimal');
      localStorage.setItem(migrationKey, '1');
    }
  } catch (e) {}

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

  /* Refuse absurd regional fits from broad locations/routes. */
  L.Map.prototype.fitBounds = function (bounds, options = {}) {
    const b = L.latLngBounds(bounds);
    const latSpan = Math.abs(b.getNorth() - b.getSouth());
    const lngSpan = Math.abs(b.getEast() - b.getWest());
    if (latSpan > 0.10 || lngSpan > 0.14) {
      return this.setView(b.getCenter(), 12, { animate: false });
    }
    return originalFitBounds.call(this, b, { ...options, maxZoom: 16 });
  };

  /* app.js still calls startLocation() on load. Intercept that first watch so
     Safari is not asked for location until the visitor taps ◎. */
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
