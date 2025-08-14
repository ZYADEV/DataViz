import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix default icon paths in many bundlers
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface Props {
  data: Record<string, any>[];
  latKey: string;
  lonKey: string;
  labelKeys?: string[];
}

const MapCard: React.FC<Props> = ({ data, latKey, lonKey, labelKeys = [] }) => {
  const points = data
    .map((r) => ({ lat: Number(r[latKey] || r['lat']), lon: Number(r[lonKey] || r['lon']), raw: r }))
    .filter((p) => !isNaN(p.lat) && !isNaN(p.lon));

  const center = points.length
    ? [points.reduce((a, b) => a + b.lat, 0) / points.length, points.reduce((a, b) => a + b.lon, 0) / points.length]
    : [0, 0];

  return (
    <div className="glass p-4 rounded-xl h-[28rem]">
      <div className="h-full rounded overflow-hidden">
        <MapContainer center={center as any} zoom={6} style={{ height: '100%', width: '100%' }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
          {points.map((p, i) => (
            <Marker key={i} position={[p.lat, p.lon] as any}>
              <Popup>
                {labelKeys.length
                  ? labelKeys.map((k) => (
                      <div key={k}>
                        <strong>{k}:</strong> {String(p.raw[k])}
                      </div>
                    ))
                  : 'Point'}
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
};

export default MapCard;


