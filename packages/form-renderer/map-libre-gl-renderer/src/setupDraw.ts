import maplibregl from "maplibre-gl";
import {
  TerraDraw,
  TerraDrawCircleMode,
  TerraDrawFreehandMode,
  TerraDrawLineStringMode,
  TerraDrawPointMode,
  TerraDrawPolygonMode,
  TerraDrawRectangleMode,
  TerraDrawSelectMode,
  ValidateNotSelfIntersecting,
} from "terra-draw";
import { TerraDrawMapLibreGLAdapter } from "terra-draw-maplibre-gl-adapter";

export function setupDraw(map: maplibregl.Map) {
  return new TerraDraw({
    tracked: true,
    adapter: new TerraDrawMapLibreGLAdapter({
      map,
      coordinatePrecision: 9,
    }),
    modes: [
      new TerraDrawSelectMode({
        flags: {
          polygon: {
            feature: {
              scaleable: true,
              rotateable: true,
              draggable: true,
              coordinates: {
                midpoints: true,
                draggable: true,
                deletable: true,
              },
            },
          },
          linestring: {
            feature: {
              draggable: true,
              coordinates: {
                midpoints: true,
                draggable: true,
                deletable: true,
              },
            },
          },
          circle: {
            feature: {
              draggable: true,
            },
          },
          point: {
            feature: {
              draggable: true,
            },
          },
          rectangle: {
            feature: {
              draggable: true,
              coordinates: {
                resizable: "opposite",
              },
            },
          },
          freehand: {
            feature: {
              draggable: true,
            },
          },
        },
      }),
      new TerraDrawPointMode(),
      new TerraDrawLineStringMode({
        validation: (feature, { updateType }) => {
          if (updateType === "finish" || updateType === "commit") {
            return ValidateNotSelfIntersecting(feature);
          }
          return {
            valid: true,
          };
        },
      }),
      new TerraDrawRectangleMode(),
      new TerraDrawPolygonMode({
        pointerDistance: 30,
        validation: (feature, { updateType }) => {
          if (updateType === "finish" || updateType === "commit") {
            return ValidateNotSelfIntersecting(feature);
          }
          return {
            valid: true,
          };
        },
      }),
      new TerraDrawCircleMode(),
      new TerraDrawFreehandMode({
        pointerDistance: 5,
        validation: (feature) => {
          return ValidateNotSelfIntersecting(feature);
        },
      }),
    ],
  });
}
