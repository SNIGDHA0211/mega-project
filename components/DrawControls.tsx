import React from 'react';
import { Pencil, Trash2, X, Download } from 'lucide-react';
import { Coordinate } from '../types';
import { geojsonToKML, downloadKML } from '../utils/kmlExporter';

interface DrawControlsProps {
  drawingMode: 'none' | 'draw' | 'edit';
  drawnPlot: { coordinates: Coordinate[]; id: string } | null;
  drawnShapes: GeoJSON.Feature[];
  drawingEnabled: boolean;
  onDrawClick: () => void;
  onDrawToggle: () => void;
  onEditClick: () => void;
  onDeleteClick: () => void;
  onCancelClick: () => void;
  onClearAll: () => void;
}

const DrawControls: React.FC<DrawControlsProps> = ({
  drawingMode,
  drawnPlot,
  drawnShapes,
  drawingEnabled,
  onDrawClick,
  onDrawToggle,
  onEditClick,
  onDeleteClick,
  onCancelClick,
  onClearAll,
}) => {
  const handleExportKML = () => {
    if (drawnShapes.length === 0) {
      alert('No shapes to export');
      return;
    }
    const kmlContent = geojsonToKML(drawnShapes);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    downloadKML(kmlContent, `drawn-shapes-${timestamp}.kml`);
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Drawing Toggle Button */}
      <button
        onClick={onDrawToggle}
        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
          drawingEnabled
            ? 'bg-green-600 text-white hover:bg-green-700'
            : 'bg-black/60 backdrop-blur-sm border border-gray-700 text-gray-300 hover:bg-gray-700'
        }`}
        title={drawingEnabled ? 'Disable drawing tools' : 'Enable drawing tools'}
      >
        <span>{drawingEnabled ? 'Drawing ON' : 'Drawing OFF'}</span>
      </button>


      {/* Export KML Button - Only show when shapes exist */}
      {drawnShapes.length > 0 && (
        <button
          onClick={handleExportKML}
          className="px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 bg-purple-600 text-white hover:bg-purple-700"
          title="Export drawn shapes as KML"
        >
          <Download size={18} />
          <span className="hidden md:inline">Export KML ({drawnShapes.length})</span>
          <span className="md:hidden">Export ({drawnShapes.length})</span>
        </button>
      )}

      {/* Clear All Button - Only show when shapes exist */}
      {drawnShapes.length > 0 && (
        <button
          onClick={onClearAll}
          className="px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 bg-orange-600 text-white hover:bg-orange-700"
          title="Clear all drawn shapes"
        >
          <Trash2 size={18} />
          <span className="hidden md:inline">Clear All</span>
          <span className="md:hidden">Clear</span>
        </button>
      )}

      {/* Edit, Delete, Cancel buttons - Only show when plot is drawn */}
      {drawnPlot && (
        <>
          <button
            onClick={onEditClick}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              drawingMode === 'edit'
                ? 'bg-blue-600 text-white'
                : 'bg-black/60 backdrop-blur-sm border border-gray-700 text-gray-300 hover:bg-gray-700'
            }`}
            title="Edit the drawn plot"
          >
            <Pencil size={18} />
            <span className="hidden md:inline">Edit</span>
          </button>
          <button
            onClick={onDeleteClick}
            className="px-3 py-2 rounded-lg text-sm font-medium transition-colors bg-red-600 text-white hover:bg-red-700 flex items-center gap-2"
            title="Delete the drawn plot"
          >
            <Trash2 size={18} />
            <span className="hidden md:inline">Delete</span>
          </button>
          <button
            onClick={onCancelClick}
            className="px-3 py-2 rounded-lg text-sm font-medium transition-colors bg-gray-600 text-white hover:bg-gray-700 flex items-center gap-2"
            title="Cancel drawing/editing"
          >
            <X size={18} />
            <span className="hidden md:inline">Cancel</span>
          </button>
        </>
      )}
    </div>
  );
};

export default DrawControls;

