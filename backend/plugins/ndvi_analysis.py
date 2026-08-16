# plugins/ndvi_analysis.py
from __future__ import annotations
import numpy as np
import rasterio
from geochat_sdk import capability, auto_collect, RasterIn, RasterOut

@capability(
    name="ndvi_processor",
    keywords=["ndvi", "vegetation index", "vegetation"],
    required_inputs=["red_band", "nir_band"],
    output_kind="raster",
    description="Generate an NDVI map for a commercial geospatial platform"
)
async def process_ndvi(red_band: RasterIn, nir_band: RasterIn) -> RasterOut:
    red = red_band.read_numpy().astype(np.float32)
    nir = nir_band.read_numpy().astype(np.float32)
    
    if red.shape != nir.shape:
        raise ValueError("Input image dimensions do not match.")
        
    denom = nir + red
    ndvi = np.zeros_like(red)
    mask = denom != 0
    ndvi[mask] = (nir[mask] - red[mask]) / denom[mask]
    
    # Generate output.
    out_path = "output_ndvi.tif"
    profile = red_band.get_profile()
    profile.update(dtype="float32", count=1)
    
    with rasterio.open(out_path, "w", **profile) as dst:
        dst.write(ndvi, 1)
        
    return RasterOut(
        path=out_path,
        metadata={"mean_ndvi": float(np.mean(ndvi[mask]))}
    )


# The capability registry resolves runtime callables by capability name.
# Keep the original function name for compatibility, and expose the registered
# capability name as a module-level callable.
ndvi_processor = process_ndvi


PLUGIN = auto_collect(
    id="ndvi_enterprise_plugin",
    version="1.0.0",
    name="NDVI Enterprise",
    description="Official enterprise vegetation-analysis plugin"
)
