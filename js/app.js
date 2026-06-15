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
  let mtrChapelLayer;
  let customWalkLayer;
  let routeStops = [];
  let markersById = {};
  let activeLocation = null;
  let selectedCheckpointA = null;
  let customWalkEndpoints = null;
  let pathPickerEl;
  let pathPickerTextEl;
  let pathPickerClearBtn;
  let activeCategories = new Set(['landmark', 'building', 'college']);
  let activeMarkerEl = null;
  let detailPanel;
  let detailCloseBtn;
  let detailPrevBtn;
  let detailNextBtn;

  function setCheckpointHighlight(location, isSelected) {
    if (!location) return;
    const marker = markersById[location.id];
    if (!marker) return;
    const el = marker.getElement();
    if (!el) return;
    const inner = el.querySelector('.map-marker');
    if (inner) {
      inner.classList.toggle('is-checkpoint-selected', isSelected);
    }
  }

  function clearCheckpointHighlights() {
    if (selectedCheckpointA) {
      setCheckpointHighlight(selectedCheckpointA, false);
    }
    if (customWalkEndpoints) {
      setCheckpointHighlight(customWalkEndpoints.from, false);
      setCheckpointHighlight(customWalkEndpoints.to, false);
    }
  }

  function updatePathPickerUI(state) {
    if (!pathPickerEl || !pathPickerTextEl) return;

    if (state === 'hidden') {
      pathPickerEl.classList.add('is-hidden');
      if (pathPickerClearBtn) pathPickerClearBtn.hidden = true;
      return;
    }

    pathPickerEl.classList.remove('is-hidden');

    if (state === 'pick-second') {
      pathPickerTextEl.textContent =
        'Stop ' + selectedCheckpointA.routeOrder + ' selected — tap another numbered stop for walking directions';
      if (pathPickerClearBtn) pathPickerClearBtn.hidden = false;
      return;
    }

    if (state === 'route-ready' && customWalkEndpoints) {
      const from = customWalkEndpoints.from.routeOrder;
      const to = customWalkEndpoints.to.routeOrder;
      const meta = customWalkEndpoints.meta || {};
      const distanceText = meta.distanceM ? ' · ~' + meta.distanceM + ' m' : '';
      const durationText = meta.durationMin ? ' · ~' + meta.durationMin + ' min' : '';
      pathPickerTextEl.textContent = 'Walking route: ' + from + ' → ' + to + distanceText + durationText;
      if (pathPickerClearBtn) pathPickerClearBtn.hidden = false;
    }
  }

  function clearCustomWalkRoute() {
    if (customWalkLayer) {
      map.removeLayer(customWalkLayer);
      customWalkLayer = null;
    }
    clearCheckpointHighlights();
    selectedCheckpointA = null;
    customWalkEndpoints = null;
    updatePathPickerUI('hidden');
  }

  function addWalkPolylines(layer, latlngs, color) {
    const outline = L.polyline(latlngs, {
      color: '#ffffff',
      weight: 10,
      opacity: 0.92,
      lineCap: 'round',
      lineJoin: 'round',
    });

    const line = L.polyline(latlngs, {
      color: color,
      weight: 6,
      opacity: 0.95,
      lineCap: 'round',
      lineJoin: 'round',
    });

    layer.addLayer(outline);
    layer.addLayer(line);
  }

  function drawCustomWalkRoute(from, to, path, meta) {
    clearCustomWalkRoute();

    customWalkLayer = L.layerGroup();
    addWalkPolylines(customWalkLayer, path, '#ea580c');
    customWalkLayer.addTo(map);

    customWalkEndpoints = { from: from, to: to, meta: meta };
    setCheckpointHighlight(from, true);
    setCheckpointHighlight(to, true);
    selectedCheckpointA = null;
    updatePathPickerUI('route-ready');

    const bounds = L.latLngBounds(path);
    map.fitBounds(bounds, { padding: [80, 80], maxZoom: 17 });
  }

  function decodePolyline(encoded, precisionDigits) {
    var factor = Math.pow(10, -(precisionDigits || 6));
    var index = 0;
    var lat = 0;
    var lng = 0;
    var coordinates = [];

    while (index < encoded.length) {
      var shift = 0;
      var result = 0;
      var byte;

      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);

      var deltaLat = (result & 1) ? ~(result >> 1) : (result >> 1);
      lat += deltaLat;

      shift = 0;
      result = 0;

      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);

      var deltaLng = (result & 1) ? ~(result >> 1) : (result >> 1);
      lng += deltaLng;

      coordinates.push([lat * factor, lng * factor]);
    }

    return coordinates;
  }

  function pathFromValhallaTrip(trip) {
    var path = [];

    trip.legs.forEach(function (leg) {
      if (!leg.shape) return;
      decodePolyline(leg.shape, 6).forEach(function (point) {
        path.push(point);
      });
    });

    return path;
  }

  function fetchWalkRouteBetween(from, to) {
    if (pathPickerEl) pathPickerEl.classList.remove('is-hidden');
    if (pathPickerTextEl) {
      pathPickerTextEl.textContent =
        'Calculating walking route ' + from.routeOrder + ' → ' + to.routeOrder + '…';
    }
    if (pathPickerClearBtn) pathPickerClearBtn.hidden = true;

    fetch('https://valhalla1.openstreetmap.de/route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        locations: [
          { lat: from.lat, lon: from.lng },
          { lat: to.lat, lon: to.lng },
        ],
        costing: 'pedestrian',
        costing_options: {
          pedestrian: {
            shortest: true,
            use_hills: 1.0,
            use_tracks: 1.0,
            use_living_streets: 1.0,
            walkway_factor: 0.1,
          },
        },
        directions_options: { units: 'meters' },
      }),
    })
      .then(function (response) {
        if (!response.ok) throw new Error('Routing request failed');
        return response.json();
      })
      .then(function (data) {
        if (!data.trip || !data.trip.legs || !data.trip.legs.length) {
          throw new Error('No walking route found');
        }

        const path = pathFromValhallaTrip(data.trip);
        if (path.length < 2) throw new Error('Empty walking route');

        const summary = data.trip.summary || {};
        const distanceKm = summary.length || 0;
        const meta = {
          distanceM: Math.round(distanceKm * 1000),
          durationMin: Math.max(1, Math.round((summary.time || 0) / 60)),
        };

        drawCustomWalkRoute(from, to, path, meta);
      })
      .catch(function (err) {
        console.error(err);
        fetchWalkRouteBetweenOsrmFallback(from, to);
      });
  }

  function fetchWalkRouteBetweenOsrmFallback(from, to) {
    const url =
      'https://router.project-osrm.org/route/v1/foot/' +
      from.lng + ',' + from.lat + ';' +
      to.lng + ',' + to.lat +
      '?overview=full&geometries=geojson';

    fetch(url)
      .then(function (response) {
        if (!response.ok) throw new Error('Routing request failed');
        return response.json();
      })
      .then(function (data) {
        if (data.code !== 'Ok' || !data.routes || !data.routes.length) {
          throw new Error('No walking route found');
        }

        const coords = data.routes[0].geometry.coordinates;
        const path = coords.map(function (coord) {
          return [coord[1], coord[0]];
        });
        const meta = {
          distanceM: Math.round(data.routes[0].distance),
          durationMin: Math.max(1, Math.round(data.routes[0].duration / 60)),
        };

        drawCustomWalkRoute(from, to, path, meta);
      })
      .catch(function (err) {
        console.error(err);
        clearCustomWalkRoute();
        alert('Could not find a walking route between stops ' + from.routeOrder + ' and ' + to.routeOrder + '.');
      });
  }

  function handleCheckpointSelection(location) {
    if (!location.routeOrder) return;

    if (customWalkLayer && !selectedCheckpointA) {
      clearCustomWalkRoute();
    }

    if (!selectedCheckpointA) {
      selectedCheckpointA = location;
      setCheckpointHighlight(location, true);
      updatePathPickerUI('pick-second');
      return;
    }

    if (selectedCheckpointA.id === location.id) {
      clearCustomWalkRoute();
      return;
    }

    const from = selectedCheckpointA;
    setCheckpointHighlight(from, false);
    fetchWalkRouteBetween(from, location);
  }

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
    const markerBadge = location.routeOrder
      ? '<div class="map-marker__number" aria-label="Stop ' + location.routeOrder + '">' + location.routeOrder + '</div>'
      : '<div class="map-marker__dot"></div>';
    const routeClass = location.routeOrder ? ' map-marker--route' : '';

    return L.divIcon({
      className: '',
      html:
        '<div class="map-marker map-marker--' + category + routeClass + '" data-location-id="' + escapeHtml(location.id) + '">' +
        '<div class="map-marker__preview" aria-hidden="true">' +
        '<div class="map-marker__preview-frame">' +
        '<img class="map-marker__preview-img" src="' + imageUrl + '" alt="' + alt + '" loading="lazy">' +
        '</div>' +
        '</div>' +
        '<div class="map-marker__pin"></div>' +
        markerBadge +
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

  function updateRouteNav(location) {
    if (!detailPrevBtn || !detailNextBtn) return;

    const headerRow = document.querySelector('.location-detail__header-row');
    const isRouteStop = Boolean(location.routeOrder);

    if (headerRow) {
      headerRow.classList.toggle('location-detail__header-row--route', isRouteStop);
    }

    if (!isRouteStop) {
      detailPrevBtn.hidden = true;
      detailNextBtn.hidden = true;
      detailPrevBtn.classList.remove('is-inactive');
      detailNextBtn.classList.remove('is-inactive');
      return;
    }

    detailPrevBtn.hidden = false;
    detailNextBtn.hidden = false;
    detailPrevBtn.disabled = location.routeOrder <= 1;
    detailNextBtn.disabled = location.routeOrder >= routeStops.length;
    detailPrevBtn.classList.toggle('is-inactive', location.routeOrder <= 1);
    detailNextBtn.classList.toggle('is-inactive', location.routeOrder >= routeStops.length);
  }

  function showLocationDetail(location) {
    const imageUrl = getLocationImage(location);

    document.getElementById('location-detail-title-zh').textContent =
      location.routeOrder ? location.routeOrder + '. ' + location.nameZh : location.nameZh;
    document.getElementById('location-detail-title-en').textContent = location.nameEn;
    document.getElementById('location-detail-desc-zh').textContent = location.descriptionZh;
    document.getElementById('location-detail-desc-en').textContent = location.descriptionEn;

    const img = document.getElementById('location-detail-image');
    img.src = imageUrl;
    img.alt = location.nameZh;

    const link = document.getElementById('location-detail-link');
    link.href = location.url;
    link.textContent = 'Learn more →';

    updateRouteNav(location);

    detailPanel.classList.remove('is-hidden');
    detailPanel.setAttribute('aria-hidden', 'false');
  }

  function highlightMarkerForLocation(location) {
    clearActiveMarker();
    const marker = markersById[location.id];
    if (!marker) return;

    const el = marker.getElement();
    if (el) {
      activeMarkerEl = el;
      setMarkerHovered(el, true);
    }
  }

  function openLocation(location) {
    activeLocation = location;
    showLocationDetail(location);
    highlightMarkerForLocation(location);
    panToLocation(location);
  }

  function navigateRoute(offset) {
    if (!activeLocation || !activeLocation.routeOrder) return;

    const currentIndex = routeStops.findIndex(function (stop) {
      return stop.id === activeLocation.id;
    });
    const nextIndex = currentIndex + offset;
    if (nextIndex < 0 || nextIndex >= routeStops.length) return;

    openLocation(routeStops[nextIndex]);
  }

  function hideLocationDetail() {
    detailPanel.classList.add('is-hidden');
    detailPanel.setAttribute('aria-hidden', 'true');
    activeLocation = null;
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
      openLocation(location);
      handleCheckpointSelection(location);
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
        zIndexOffset: location.routeOrder ? 100 + location.routeOrder : 0,
      });

      bindMarkerInteractions(marker, location);
      markersById[location.id] = marker;
      layerGroups[category].addLayer(marker);
    });

    activeCategories.forEach(function (category) {
      if (layerGroups[category]) {
        layerGroups[category].addTo(map);
      }
    });
  }

  function createEndpointIcon(label, modifier) {
    return L.divIcon({
      className: '',
      html:
        '<div class="map-endpoint map-endpoint--' + modifier + '">' +
        '<div class="map-endpoint__pin"></div>' +
        '<span class="map-endpoint__label">' + escapeHtml(label) + '</span>' +
        '</div>',
      iconSize: [1, 1],
      iconAnchor: [12, 36],
    });
  }

  function endpointToLocation(point, role) {
    return {
      id: point.id,
      nameZh: point.nameZh,
      nameEn: point.nameEn,
      lat: point.lat,
      lng: point.lng,
      category: role,
      descriptionZh: role === 'start'
        ? '港鐵大學站廣場（校巴及穿梭巴士總站），前往崇基學院禮拜堂的步行路線起點。'
        : '崇基學院禮拜堂，中大校園內最早的獨立禮拜建築之一。',
      descriptionEn: role === 'start'
        ? 'University MTR Station Piazza (campus shuttle bus terminus), start of the walking route to Chung Chi College Chapel.'
        : 'Chung Chi College Chapel, one of the earliest independent sanctuaries for worship on a public university campus in China.',
      url: role === 'start'
        ? 'https://www.mtr.com.hk/en/customer/services/stations_university.html'
        : 'https://www.ccc.cuhk.edu.hk/en/content.php?wid=311',
      image: role === 'start' ? 'images/main-entrance.jpg' : 'images/chung-chi-college.jpg',
    };
  }

  function drawWalkingPath(routeData) {
    if (!routeData.path || routeData.path.length < 2) return;

    mtrChapelLayer = L.layerGroup();
    const color = routeData.color || '#0d9488';

    addWalkPolylines(mtrChapelLayer, routeData.path, color);

    const startLocation = endpointToLocation(routeData.start, 'start');
    const endLocation = endpointToLocation(routeData.end, 'end');

    const startMarker = L.marker([routeData.start.lat, routeData.start.lng], {
      icon: createEndpointIcon('Plaza', 'start'),
      riseOnHover: true,
      zIndexOffset: 200,
    });

    const endMarker = L.marker([routeData.end.lat, routeData.end.lng], {
      icon: createEndpointIcon('Chapel', 'end'),
      riseOnHover: true,
      zIndexOffset: 200,
    });

    bindMarkerInteractions(startMarker, startLocation);
    bindMarkerInteractions(endMarker, endLocation);

    mtrChapelLayer.addLayer(startMarker);
    mtrChapelLayer.addLayer(endMarker);
    mtrChapelLayer.addTo(map);
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

  function initPathPicker() {
    pathPickerEl = document.getElementById('path-picker');
    pathPickerTextEl = document.getElementById('path-picker-text');
    pathPickerClearBtn = document.getElementById('path-picker-clear');

    if (pathPickerClearBtn) {
      pathPickerClearBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        clearCustomWalkRoute();
      });
    }
  }

  function initDetailPanel() {
    detailPanel = document.getElementById('location-detail');
    detailCloseBtn = document.getElementById('location-detail-close');
    detailPrevBtn = document.getElementById('location-detail-prev');
    detailNextBtn = document.getElementById('location-detail-next');

    detailCloseBtn.addEventListener('click', hideLocationDetail);

    if (detailPrevBtn) {
      detailPrevBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        navigateRoute(-1);
      });
    }

    if (detailNextBtn) {
      detailNextBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        navigateRoute(1);
      });
    }

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
    initPathPicker();
    initDetailPanel();

    fetch('data/locations.json')
      .then(function (response) {
        if (!response.ok) throw new Error('Failed to load locations');
        return response.json();
      })
      .then(function (locations) {
        routeStops = locations
          .filter(function (location) {
            return location.routeOrder;
          })
          .sort(function (a, b) {
            return a.routeOrder - b.routeOrder;
          });
        createMarkers(locations);
      })
      .catch(function (err) {
        console.error(err);
        alert('Could not load location data. Please run a local server (see README).');
      });

    fetch('data/mtr-chapel-route.json')
      .then(function (response) {
        if (!response.ok) throw new Error('Failed to load walking route');
        return response.json();
      })
      .then(function (routeData) {
        drawWalkingPath(routeData);
      })
      .catch(function (err) {
        console.error(err);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
