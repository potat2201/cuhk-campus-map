(function () {
  'use strict';

  const CAMPUS_CENTER = [22.419, 114.207];
  const DEFAULT_ZOOM = 16;
  const CAMPUS_BOUNDS = [
    [22.408, 114.195],
    [22.432, 114.218],
  ];
  const FALLBACK_IMAGE = 'images/pavilion-of-harmony.jpg';

  let map;
  let osmLayer;
  let satelliteLayer;
  let layerGroups = {};
  let activeCategories = new Set(['landmark', 'building', 'college']);
  let activeMarkerEl = null;
  let detailPanel;
  let detailCloseBtn;

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function getLocationImage(location) {
    return location.image || FALLBACK_IMAGE;
  }

  function createMarkerIcon(location) {
    const category = location.category;
    const imageUrl = escapeHtml(getLocationImage(location));
    const alt = escapeHtml(location.nameZh);

    return L.divIcon({
      className: '',
      html:
        '<div class="map-marker map-marker--' + category + '" data-location-id="' + escapeHtml(location.id) + '">' +
        '<div class="map-marker__preview" aria-hidden="true">' +
        '<div class="map-marker__preview-frame">' +
        '<img class="map-marker__preview-img" src="' + imageUrl + '" alt="' + alt + '" loading="lazy">' +
        '</div>' +
        '</div>' +
        '<div class="map-marker__pin"></div>' +
        '<div class="map-marker__dot"></div>' +
        '</div>',
      iconSize: [32, 32],
      iconAnchor: [16, 32],
    });
  }

  function setMarkerHovered(markerEl, isHovered) {
    if (!markerEl) return;
    const inner = markerEl.querySelector('.map-marker');
    if (inner) {
      inner.classList.toggle('is-hovered', isHovered);
    }
  }

  function clearActiveMarker() {
    if (activeMarkerEl) {
      setMarkerHovered(activeMarkerEl, false);
      activeMarkerEl = null;
    }
  }

  function showLocationDetail(location) {
    const imageUrl = getLocationImage(location);

    document.getElementById('location-detail-title-zh').textContent = location.nameZh;
    document.getElementById('location-detail-title-en').textContent = location.nameEn;
    document.getElementById('location-detail-desc-zh').textContent = location.descriptionZh;
    document.getElementById('location-detail-desc-en').textContent = location.descriptionEn;

    const img = document.getElementById('location-detail-image');
    img.src = imageUrl;
    img.alt = location.nameZh;

    const link = document.getElementById('location-detail-link');
    link.href = location.url;
    link.textContent = 'Learn more →';

    detailPanel.classList.remove('is-hidden');
    detailPanel.setAttribute('aria-hidden', 'false');
  }

  function hideLocationDetail() {
    detailPanel.classList.add('is-hidden');
    detailPanel.setAttribute('aria-hidden', 'true');
    clearActiveMarker();
  }

  function initMap() {
    map = L.map('map', {
      center: CAMPUS_CENTER,
      zoom: DEFAULT_ZOOM,
      maxBounds: CAMPUS_BOUNDS,
      minZoom: 14,
      maxZoom: 19,
      zoomControl: false,
    });

    osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    });

    satelliteLayer = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        attribution: 'Tiles &copy; Esri',
        maxZoom: 19,
      }
    );

    osmLayer.addTo(map);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
  }

  function isMobileView() {
    return window.matchMedia('(max-width: 600px)').matches;
  }

  function panToLocation(location) {
    const latlng = L.latLng(location.lat, location.lng);

    if (!isMobileView()) {
      map.panTo(latlng, { animate: true, duration: 0.35 });
      return;
    }

    const offsetY = Math.round(window.innerHeight * 0.2);
    const zoom = map.getZoom();
    const point = map.project(latlng, zoom);
    const newCenter = map.unproject(L.point(point.x, point.y + offsetY), zoom);
    map.panTo(newCenter, { animate: true, duration: 0.35 });
  }

  function bindMarkerInteractions(marker, location) {
    marker.on('mouseover', function () {
      const el = marker.getElement();
      if (!el) return;
      if (activeMarkerEl && activeMarkerEl !== el) {
        setMarkerHovered(activeMarkerEl, false);
      }
      activeMarkerEl = el;
      setMarkerHovered(el, true);
    });

    marker.on('mouseout', function () {
      const el = marker.getElement();
      if (el && activeMarkerEl === el && detailPanel.classList.contains('is-hidden')) {
        setMarkerHovered(el, false);
        activeMarkerEl = null;
      }
    });

    marker.on('click', function (e) {
      L.DomEvent.stopPropagation(e);
      const el = marker.getElement();
      if (el) {
        if (activeMarkerEl && activeMarkerEl !== el) {
          setMarkerHovered(activeMarkerEl, false);
        }
        activeMarkerEl = el;
        setMarkerHovered(el, true);
      }
      showLocationDetail(location);
      panToLocation(location);
    });
  }

  function createMarkers(locations) {
    layerGroups = {
      landmark: L.layerGroup(),
      building: L.layerGroup(),
      college: L.layerGroup(),
    };

    locations.forEach(function (location) {
      const category = location.category;
      if (!layerGroups[category]) return;

      const marker = L.marker([location.lat, location.lng], {
        icon: createMarkerIcon(location),
        riseOnHover: true,
      });

      bindMarkerInteractions(marker, location);
      layerGroups[category].addLayer(marker);
    });

    activeCategories.forEach(function (category) {
      if (layerGroups[category]) {
        layerGroups[category].addTo(map);
      }
    });
  }

  function toggleCategory(category) {
    const btn = document.querySelector('[data-category="' + category + '"]');
    const group = layerGroups[category];
    if (!btn || !group) return;

    if (activeCategories.has(category)) {
      activeCategories.delete(category);
      map.removeLayer(group);
      btn.classList.remove('active');
      btn.setAttribute('aria-pressed', 'false');
    } else {
      activeCategories.add(category);
      group.addTo(map);
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
    }
  }

  function initFilterPanel() {
    const panel = document.getElementById('filter-panel');
    const closeBtn = document.getElementById('filter-close');
    const openBtn = document.getElementById('filter-open');
    const filterItems = document.querySelectorAll('.filter-item');

    closeBtn.addEventListener('click', function () {
      panel.classList.add('collapsed');
      openBtn.hidden = false;
    });

    openBtn.addEventListener('click', function () {
      panel.classList.remove('collapsed');
      openBtn.hidden = true;
    });

    filterItems.forEach(function (btn) {
      btn.addEventListener('click', function () {
        toggleCategory(btn.dataset.category);
      });
    });

    if (isMobileView()) {
      panel.classList.add('collapsed');
      openBtn.hidden = false;
    }
  }

  function initLayerSwitcher() {
    const mapBtn = document.getElementById('layer-map');
    const satelliteBtn = document.getElementById('layer-satellite');

    mapBtn.addEventListener('click', function () {
      if (map.hasLayer(satelliteLayer)) {
        map.removeLayer(satelliteLayer);
      }
      if (!map.hasLayer(osmLayer)) {
        osmLayer.addTo(map);
      }
      mapBtn.classList.add('active');
      mapBtn.setAttribute('aria-pressed', 'true');
      satelliteBtn.classList.remove('active');
      satelliteBtn.setAttribute('aria-pressed', 'false');
    });

    satelliteBtn.addEventListener('click', function () {
      if (map.hasLayer(osmLayer)) {
        map.removeLayer(osmLayer);
      }
      if (!map.hasLayer(satelliteLayer)) {
        satelliteLayer.addTo(map);
      }
      satelliteBtn.classList.add('active');
      satelliteBtn.setAttribute('aria-pressed', 'true');
      mapBtn.classList.remove('active');
      mapBtn.setAttribute('aria-pressed', 'false');
    });
  }

  function initDetailPanel() {
    detailPanel = document.getElementById('location-detail');
    detailCloseBtn = document.getElementById('location-detail-close');

    detailCloseBtn.addEventListener('click', hideLocationDetail);

    map.on('click', function () {
      if (!detailPanel.classList.contains('is-hidden')) {
        hideLocationDetail();
      }
    });
  }

  function init() {
    initMap();
    initFilterPanel();
    initLayerSwitcher();
    initDetailPanel();

    fetch('data/locations.json')
      .then(function (response) {
        if (!response.ok) throw new Error('Failed to load locations');
        return response.json();
      })
      .then(function (locations) {
        createMarkers(locations);
      })
      .catch(function (err) {
        console.error(err);
        alert('Could not load location data. Please run a local server (see README).');
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
