# Pixel Tuner

**Offline image adjustments in a single HTML file.**

[简体中文](README.zh-CN.md)

Pixel Tuner is a small, local image adjustment tool with live brightness, contrast, and sharpness controls. Open the HTML file in your browser, choose an image, and adjust it without uploading anything.

No installation. No backend. No tracking. No external runtime dependencies.

> Switch between English and Chinese with the segmented buttons in the top-right corner. Your selection is saved locally when browser storage is available. The interface defaults to English on first use, regardless of browser language.

## Quick start

1. Download [index.html](index.html). On GitHub, use **Download raw file** to save the actual HTML file.
2. Double-click the downloaded file to open it in a recent desktop browser.
3. Choose an image or drop it into the preview area. All three controls start at **0%**, and the original image is displayed.
4. Move a slider or choose a preset to update the preview automatically.
5. Wait for the full-resolution result, then click **Download PNG**.

Click **Reset** to return every control to zero and immediately show the original image.

After downloading the HTML file, you can disconnect from the internet. No local server or build step is required.

## Features

- **Bilingual interface** — switch between English and Chinese without reloading or changing your image.
- **Live adjustments** — brightness, contrast, and sharpness, with 1% precision.
- **One preview area** — shows the original at neutral settings and the adjusted image while editing.
- **Built-in presets** — apply a parameter combination, then fine-tune it with the sliders.
- **Zoom and pan** — click the image to open a larger preview; use the mouse wheel to zoom and drag to inspect details.
- **Full-resolution PNG export** — exported images retain the decoded source dimensions.
- **Responsive processing** — pixel calculations run in an embedded Web Worker.
- **Local workspace recovery** — attempts to save the original image, latest result, and parameters in IndexedDB.
- **Self-contained file** — HTML, CSS, processing code, and worker code are bundled together.

## Controls

| Control | Range | Default | Effect |
| --- | --- | --- | --- |
| Brightness | −100% to +100% | 0% | Adds or subtracts a tonal offset. |
| Contrast | −100% to +100% | 0% | Expands or compresses values around the midpoint after the brightness offset. |
| Sharpness | 0% to 100% | 0% | Enhances local detail with an unsharp-mask approximation. |

Each update starts from the original image, so adjustments do not accumulate across slider movements.

## Presets

| Preset | UI label | Brightness | Contrast | Sharpness |
| --- | --- | --- | --- | --- |
| Original | Original | 0% | 0% | 0% |
| Taobao preset | Remove Taobao watermark | −10% | 20% | 20% |
| Scan-style preset | Scan-style | 0% | 100% | 100% |

The menu contains three selectable options and defaults to **Original**. Choosing Original or clicking Reset sets all controls to zero and immediately shows the original image. You can fine-tune a preset with the sliders; when the values no longer match a recipe, the menu retains the last applied preset as the starting point.

These are general image adjustment recipes. The Taobao preset does not detect or selectively remove watermarks, and removal is not guaranteed. The scan-style preset does not perform OCR, page detection, or perspective correction.

## Image support

| Item | Support |
| --- | --- |
| Input formats | PNG, JPEG, WebP, BMP, static GIF |
| Output format | PNG |
| Maximum input file size | 10 MiB (10 × 1024 × 1024 bytes) |
| Maximum decoded image size | 30 million pixels |
| Unsupported input | HEIC/HEIF, TIFF, SVG, APNG, animated WebP, animated GIF |

The application checks file contents before decoding and rejects detected animations and unsupported formats. Final decoding depends on the browser.

## How live processing works

While editing, Pixel Tuner generates a preview with a maximum long edge of **1280 pixels**. Preview jobs are coalesced so rapid slider input does not create a growing queue of outdated jobs.

After **250 milliseconds** without a new adjustment, full-resolution processing starts. A new adjustment cancels an outdated full-resolution worker. Download becomes available only when the full-resolution result matches the current parameters. Large images can take longer depending on your device.

At neutral settings, the preview uses the original image directly. Download still exports a PNG through Canvas; it is not a byte-for-byte copy of the input file.

## Privacy and offline use

- Images are processed locally in your browser. The application does not upload images or send analytics.
- No CDN scripts, external fonts, or remote processing services are used.
- An embedded Content Security Policy disables network connections initiated by the application.
- Images and settings may remain on your device in **IndexedDB**. Remove the relevant browser storage if you want to delete these cached copies.
- Local-file storage behavior varies by browser. Moving the HTML file, switching browsers, using private browsing, or clearing browser data may prevent workspace recovery.

Keep your source images and download important results before closing the page.

## Processing notes

- High contrast can remove tonal detail and substantially change colors.
- At **100% contrast**, each RGB channel is thresholded to either 0 or 255. This can produce up to eight RGB colors; it is not a grayscale-only conversion.
- Sharpening is a JavaScript approximation and is not guaranteed to match Pillow or Microsoft Word pixel for pixel.
- Browser decoding, Canvas color conversion, and rounding can affect pixels and transparency. Original EXIF and other metadata are not preserved by the PNG export.
- Large images may exceed memory limits on some devices. Try a smaller image if processing fails.

## Development

The offline application is maintained in [index.html](index.html). Edit it directly and reopen or refresh the file in your browser. There is no build step.

Run the logic tests with Node.js:

```bash
node tests/test.cjs
```

Tests cover preset menu markup and parameter application, translation coverage, language selection, zero defaults, reset behavior, update coalescing, outdated-job cancellation, full-resolution export scheduling, and stale-result rejection. They do not replace browser compatibility testing.

## Contributing

Bug reports and focused pull requests are welcome. For rendering or processing issues, include your browser and operating system, image format and dimensions, selected parameters, and steps to reproduce. Share only images you are comfortable making public.

When changing processing or scheduling behavior, update the relevant tests and check that the downloaded HTML still works without network access.
