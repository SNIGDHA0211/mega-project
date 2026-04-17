import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appPath = path.join(__dirname, "..", "App.tsx");
let s = fs.readFileSync(appPath, "utf8");

const old1 =
  "        const cropData = res[cropKey] as { crop_name?: string; crop_area_ha?: number; color?: string; identified_field_boundaries?: Record<string, { field_id: number; field_area_ha: number }> } | undefined;";
const new1 = "        const cropData = res[cropKey] as PredictAreaCropData | undefined;";

if (!s.includes(old1)) throw new Error("block1 not found");
s = s.replace(old1, new1);

const old2 = `        const rootHa = res.sugarcane_area_ha;
        let sugarHa: number | null = null;
        if (typeof rootHa === 'number' && !Number.isNaN(rootHa)) {
          sugarHa = rootHa;
        } else if (selectedCrop === 'sugarcane' && cropData && typeof cropData.crop_area_ha === 'number' && !Number.isNaN(cropData.crop_area_ha)) {
          sugarHa = cropData.crop_area_ha;
        }
        setPredictSugarcaneAreaHa(selectedCrop === 'sugarcane' ? sugarHa : null);`;

const new2 = `        const rootHa = res.sugarcane_area_ha;
        let sugarHa: number | null = null;
        if (typeof rootHa === 'number' && !Number.isNaN(rootHa)) {
          sugarHa = rootHa;
        } else if (selectedCrop === 'sugarcane' && cropData) {
          const c = cropData as PredictAreaCropData;
          if (typeof c.sugarcane_area_ha === 'number' && !Number.isNaN(c.sugarcane_area_ha)) {
            sugarHa = c.sugarcane_area_ha;
          } else if (typeof c.crop_area_ha === 'number' && !Number.isNaN(c.crop_area_ha)) {
            sugarHa = c.crop_area_ha;
          }
        }
        setPredictSugarcaneAreaHa(selectedCrop === 'sugarcane' ? sugarHa : null);`;

if (!s.includes(old2)) throw new Error("block2 not found");
s = s.replace(old2, new2);

fs.writeFileSync(appPath, s);
console.log("patched App.tsx");
