/**
 * Convert GeoJSON FeatureCollection to KML format
 */
export function geojsonToKML(features: GeoJSON.Feature[]): string {
  const kmlHeader = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Drawn Shapes</name>
    <description>Exported shapes from map</description>`;

  const kmlFooter = `  </Document>
</kml>`;

  const placemarks = features.map((feature, index) => {
    const name = feature.properties?.name || `Shape ${index + 1}`;
    const description = feature.properties?.description || '';
    const coordinates = getCoordinates(feature.geometry);

    if (!coordinates) return '';

    let geometryKML = '';
    
    switch (feature.geometry.type) {
      case 'Polygon':
        geometryKML = `<Polygon>
          <outerBoundaryIs>
            <LinearRing>
              <coordinates>${formatCoordinates(coordinates as number[][][])}</coordinates>
            </LinearRing>
          </outerBoundaryIs>
        </Polygon>`;
        break;
      
      case 'LineString':
        geometryKML = `<LineString>
          <coordinates>${formatLineCoordinates(coordinates as number[][])}</coordinates>
        </LineString>`;
        break;
      
      case 'Point':
        const pointCoords = coordinates as number[];
        geometryKML = `<Point>
          <coordinates>${pointCoords[0]},${pointCoords[1]},0</coordinates>
        </Point>`;
        break;
      
      default:
        return '';
    }

    return `    <Placemark>
      <name>${escapeXML(name)}</name>
      ${description ? `<description>${escapeXML(description)}</description>` : ''}
      ${geometryKML}
    </Placemark>`;
  }).filter(p => p !== '').join('\n');

  return `${kmlHeader}\n${placemarks}\n${kmlFooter}`;
}

/**
 * Get coordinates from GeoJSON geometry
 */
function getCoordinates(geometry: GeoJSON.Geometry): number[] | number[][] | number[][][] | null {
  switch (geometry.type) {
    case 'Polygon':
      return (geometry as GeoJSON.Polygon).coordinates;
    case 'LineString':
      return (geometry as GeoJSON.LineString).coordinates;
    case 'Point':
      return (geometry as GeoJSON.Point).coordinates;
    default:
      return null;
  }
}

/**
 * Format polygon coordinates for KML
 */
function formatCoordinates(coords: number[][][]): string {
  // Polygon coordinates are [outerRing, ...innerRings]
  const outerRing = coords[0];
  return outerRing.map(coord => `${coord[0]},${coord[1]},0`).join(' ');
}

/**
 * Format line string coordinates for KML
 */
function formatLineCoordinates(coords: number[][]): string {
  return coords.map(coord => `${coord[0]},${coord[1]},0`).join(' ');
}

/**
 * Escape XML special characters
 */
function escapeXML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Download KML file
 */
export function downloadKML(kmlContent: string, filename: string = 'drawn-shapes.kml'): void {
  const blob = new Blob([kmlContent], { type: 'application/vnd.google-earth.kml+xml' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

