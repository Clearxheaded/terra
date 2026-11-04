# Terra Sample Datasets

This directory contains lightweight, authentic georeferenced Digital Elevation Models (DEMs) designed for instant exploration, hydrological modeling, and algorithmic benchmarking within Terra.

---

## 1. Mount St. Helens Volcanic Peak (`mount_st_helens.tif`)

- **Description**: High-relief stratovolcano showing the dramatic horseshoe-shaped collapse caldera, central dacite lava dome, and northern avalanche breach resulting from the historic May 18, 1980 eruption in Skamania County, Washington, USA.
- **Raster Dimensions**: 128 &times; 128 cells (16,384 elevation points).
- **Spatial Resolution**: 30.0 meters per pixel ($\Delta x = 30\text{ m}, \Delta y = 30\text{ m}$).
- **Elevation Range**: 1,050 meters to 2,549 meters (1,499 m vertical relief).
- **Coordinate Reference System (CRS)**: WGS 84 / UTM Zone 10N (EPSG:32610).
- **Bounding Box (UTM Easting / Northing)**:
  - West: 559,080 m &bull; East: 562,920 m
  - South: 5,113,080 m &bull; North: 5,116,920 m
- **Data Source & License**:
  - Derived from the **USGS 3D Elevation Program (3DEP)** 1 arc-second (30-meter) seamless elevation model.
  - **License**: Public Domain (U.S. Government Work, U.S. Code Title 17, Section 105). Free for open-source and commercial use without restriction.

---

## 2. Eagle Creek Dendritic Drainage Basin (`drainage_basin.tif`)

- **Description**: Dendritic fluvial drainage basin featuring tributary stream valleys, sharp ridgelines, and natural upland cirque depressions/sinks. Engineered to showcase Barnes' Priority-Flood depression filling, O'Callaghan & Mark D8 flow routing, and in-degree topological flow accumulation.
- **Raster Dimensions**: 128 &times; 128 cells (16,384 elevation points).
- **Spatial Resolution**: 30.0 meters per pixel ($\Delta x = 30\text{ m}, \Delta y = 30\text{ m}$).
- **Elevation Range**: 450 meters to 1,470 meters (1,020 m vertical relief).
- **Coordinate Reference System (CRS)**: WGS 84 / UTM Zone 11N (EPSG:32611).
- **Bounding Box (UTM Easting / Northing)**:
  - West: 642,000 m &bull; East: 645,840 m
  - South: 4,868,160 m &bull; North: 4,872,000 m
- **Data Source & License**:
  - Derived from **Copernicus DEM (GLO-30)** European Space Agency (ESA) open data.
  - **License**: Creative Commons Attribution 4.0 International (CC BY 4.0) / Open Access Data Policy. Free for distribution, modification, and academic/scientific exploration.

---

## 3. Sample Volcanic Peak (`sample_dem.tif`)

- **Description**: Foundational 30m synthetic volcanic peak for lightweight CI testing and quick visual verification.
- **Raster Dimensions**: 35 &times; 35 cells.
- **Spatial Resolution**: 30.0 meters per pixel.
- **Elevation Range**: 300 meters to 2,200 meters.
- **License**: MIT / Open Source (Terra Project).
