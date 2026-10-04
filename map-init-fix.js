/* DRIFT v0.6 bootstrap guard.
   app.js asks Leaflet for center/zoom before the map has its first view.
   Supply a safe Hines corridor fallback only during that pre-load moment. */
(() => {
  if (!window.L || !L.Map) return;
  const originalGetCenter = L.Map.prototype.getCenter;
  const originalGetZoom = L.Map.prototype.getZoom;

  L.Map.prototype.getCenter = function () {
    if (!this._loaded) return L.latLng(42.3775, -83.3725);
    return originalGetCenter.call(this);
  };

  L.Map.prototype.getZoom = function () {
    if (!this._loaded || !Number.isFinite(this._zoom)) return 11;
    return originalGetZoom.call(this);
  };
})();
