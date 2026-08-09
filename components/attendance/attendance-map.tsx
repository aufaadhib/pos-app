"use client";

import { useEffect, useMemo } from "react";
import { Circle, MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import { divIcon, latLngBounds, type LeafletEvent } from "leaflet";

type MapValue = { latitude: number; longitude: number; radiusMeters: number };

/** Edits outlet center and radius with draggable, touch-sized handles. */
export default function AttendanceMap({ value, onChange }: { value: MapValue; onChange: (value: MapValue) => void }) {
  const center: [number, number] = [value.latitude, value.longitude];
  const handle: [number, number] = [value.latitude, radiusLongitude(value.latitude, value.longitude, value.radiusMeters)];
  const centerIcon = useMemo(() => divIcon({ className: "attendance-map-center", html: "", iconSize: [44, 44], iconAnchor: [22, 22] }), []);
  const radiusIcon = useMemo(() => divIcon({ className: "attendance-map-radius", html: "", iconSize: [44, 44], iconAnchor: [22, 22] }), []);

  function moveCenter(event: LeafletEvent) {
    const point = event.target.getLatLng();
    onChange({ ...value, latitude: point.lat, longitude: point.lng });
  }

  function moveRadius(event: LeafletEvent) {
    const point = event.target.getLatLng();
    const longitudeDistance = Math.abs(point.lng - value.longitude) * 111_320 * Math.max(0.1, Math.cos(value.latitude * Math.PI / 180));
    onChange({ ...value, radiusMeters: Math.min(500, Math.max(50, Math.round(longitudeDistance))) });
  }

  return <MapContainer attributionControl className="attendance-map h-[22rem] w-full rounded-xl bg-muted sm:h-[26rem]" center={center} scrollWheelZoom zoom={17}>
    <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
    <Circle center={center} pathOptions={{ color: "#257354", fillColor: "#5bd39a", fillOpacity: 0.16, weight: 3 }} radius={value.radiusMeters} />
    <Marker draggable eventHandlers={{ dragend: moveCenter }} icon={centerIcon} position={center} title="Geser titik pusat outlet" />
    <Marker draggable eventHandlers={{ dragend: moveRadius }} icon={radiusIcon} position={handle} title="Geser untuk mengubah radius" />
    <MapViewport center={center} radiusMeters={value.radiusMeters} />
  </MapContainer>;
}

/** Keeps the entire geofence visible when form values change outside the map. */
function MapViewport({ center, radiusMeters }: { center: [number, number]; radiusMeters: number }) {
  const map = useMap();
  useEffect(() => {
    const latitudeDelta = radiusMeters / 111_320;
    const longitudeDelta = latitudeDelta / Math.max(0.1, Math.cos(center[0] * Math.PI / 180));
    map.fitBounds(latLngBounds([center[0] - latitudeDelta, center[1] - longitudeDelta], [center[0] + latitudeDelta, center[1] + longitudeDelta]), { padding: [32, 32], maxZoom: 18 });
  }, [center, map, radiusMeters]);
  return null;
}

function radiusLongitude(latitude: number, longitude: number, radiusMeters: number) {
  return longitude + radiusMeters / (111_320 * Math.max(0.1, Math.cos(latitude * Math.PI / 180)));
}
