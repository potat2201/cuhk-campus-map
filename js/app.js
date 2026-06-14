(function () {
  'use strict';

  const CAMPUS_CENTER = [22.419, 114.207];
  const DEFAULT_ZOOM = 15;
  const CAMPUS_BOUNDS = [
    [22.408, 114.195],
    [22.432, 114.218],
  ];

  let map;
  let osmLayer;
  let satelliteLayer;
  let layerGroups = {};
  let activeCategories = new Set(['landmark', 'building', 'college']);

  function createMarkerIcon(category) {
    return L.divIcon({
      className: '',
      html:
        '<div class="map-marker map-marker--' + category + '">' +
        '<div class="map-marker__pin"></div>' +
        '<div class="map-marker__dot"></div>' +
        '</div>',
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32],
    });
  }

  function buildPopupContent(location) {
    return (
      '<div class="popup">' +
      '<h3 class="popup-title">' + escapeHtml(location.nameZh) + '</h3>' +
      '<p class="popup-title-en">' + escapeHtml(location.nameEn) + '</p>' +
      '<p class="popup-desc">' + escapeHtml(location.descriptionZh) + '</p>' +
      '<p class="popup-desc-en">' + escapeHtml(location.descriptionEn) + '</p>' +
      '<a class="popup-link" href="' + escapeHtml(location.url) + '" target="_blank" rel="noopener noreferrer">Learn more →</a>' +
      '</div>'
    );
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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
        icon: createMarkerIcon(category),
      });

      marker.bindPopup(buildPopupContent(location), {
        maxWidth: 300,
        className: 'cuhk-popup',
      });

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

  function init() {
    initMap();
    initFilterPanel();
    initLayerSwitcher();

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
