import { test, expect } from '@playwright/test';

test.describe('Terra Geospatial Application', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for the app container to mount
    await expect(page.locator('.app-container')).toBeVisible();
  });

  test('initializes application header, branding, and WebGL canvas', async ({ page }) => {
    // Brand title & release badge
    await expect(page.locator('.brand-title')).toHaveText('TERRA');
    await expect(page.locator('.brand-tag')).toContainText('Release');

    // WebGL Canvas initialized in viewport
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(300);
    expect(box!.height).toBeGreaterThan(300);

    // Initial synthetic terrain metadata in header
    await expect(page.locator('.header-meta')).toContainText('75 × 75 px');
  });

  test('switches between synthetic terrain models', async ({ page }) => {
    // Select Valley
    await page.getByRole('button', { name: 'Valley' }).click();
    await expect(page.locator('.header-meta-value').first()).toContainText('Synthetic Valley');

    // Select Pyramid
    await page.getByRole('button', { name: 'Pyramid' }).click();
    await expect(page.locator('.header-meta-value').first()).toContainText('Synthetic Pyramid');

    // Select Depression
    await page.getByRole('button', { name: 'Depression' }).click();
    await expect(page.locator('.header-meta-value').first()).toContainText('Synthetic Depression');
  });

  test('loads open sample DEM datasets (Mount St. Helens & Eagle Creek Basin)', async ({ page }) => {
    // Click Mount St. Helens sample button
    const mshButton = page.locator('[data-testid="sample-mount-st-helens"]');
    await expect(mshButton).toBeVisible();
    await mshButton.click();

    // Verify dataset name and dimensions update in Header
    await expect(page.locator('.header-meta')).toContainText('Mount St. Helens', { timeout: 10000 });
    await expect(page.locator('.header-meta')).toContainText('128 × 128 px');

    // Click Eagle Creek Basin sample button
    const basinButton = page.locator('[data-testid="sample-drainage-basin"]');
    await expect(basinButton).toBeVisible();
    await basinButton.click();

    await expect(page.locator('.header-meta')).toContainText('Eagle Creek Basin', { timeout: 10000 });
    await expect(page.locator('.header-meta')).toContainText('128 × 128 px');
  });

  test('switches analysis layers and updates active visualization', async ({ page }) => {
    // Load Mount St. Helens for analysis testing
    await page.locator('[data-testid="sample-mount-st-helens"]').click();
    await expect(page.locator('.header-meta')).toContainText('Mount St. Helens', { timeout: 10000 });

    // Switch to Slope layer
    const slopeTab = page.locator('.layer-tab', { hasText: 'Slope' });
    await slopeTab.click();
    await expect(slopeTab).toHaveClass(/active/);
    await expect(page.locator('.legend-bar')).toBeVisible();

    // Switch to Aspect layer
    const aspectTab = page.locator('.layer-tab', { hasText: 'Aspect' });
    await aspectTab.click();
    await expect(aspectTab).toHaveClass(/active/);

    // Switch to Hillshade layer
    const hillshadeTab = page.locator('.layer-tab', { hasText: 'Hillshade' });
    await hillshadeTab.click();
    await expect(hillshadeTab).toHaveClass(/active/);

    // Switch to D8 Flow layer
    const d8Tab = page.locator('.layer-tab', { hasText: 'D8 Flow' });
    await d8Tab.click();
    await expect(d8Tab).toHaveClass(/active/);

    // Switch to Flow Accumulation layer
    const accumTab = page.locator('.layer-tab', { hasText: 'Accum' });
    await accumTab.click();
    await expect(accumTab).toHaveClass(/active/);
  });

  test('applies camera presets and resets orientation', async ({ page }) => {
    const sidebar = page.locator('.app-sidebar');

    // Camera presets section in sidebar
    const topDownBtn = sidebar.getByRole('button', { name: /Top-Down/i });
    await expect(topDownBtn).toBeVisible();
    await topDownBtn.click();

    const isometricBtn = sidebar.getByRole('button', { name: /Isometric/i });
    await expect(isometricBtn).toBeVisible();
    await isometricBtn.click();

    const obliqueBtn = sidebar.getByRole('button', { name: /Oblique/i });
    await expect(obliqueBtn).toBeVisible();
    await obliqueBtn.click();

    const resetBtn = sidebar.getByRole('button', { name: /Reset Camera View/i });
    await expect(resetBtn).toBeVisible();
    await resetBtn.click();
  });

  test('activates and cancels elevation profile transect tool', async ({ page }) => {
    const drawTransectBtn = page.getByRole('button', { name: /Draw 2D Profile Transect/i });
    await expect(drawTransectBtn).toBeVisible();
    await drawTransectBtn.click();

    // Verify transect mode alert is shown
    await expect(page.locator('.app-sidebar')).toContainText('start transect');

    // Cancel transect
    const cancelBtn = page.getByRole('button', { name: 'Cancel Transect' });
    await expect(cancelBtn).toBeVisible();
    await cancelBtn.click();

    await expect(drawTransectBtn).toBeVisible();
  });

  test('verifies export panel controls and options', async ({ page }) => {
    // Export section should be present in sidebar
    await expect(page.getByRole('heading', { name: 'Geospatial Data Export' })).toBeVisible();

    // Export buttons
    await expect(page.getByRole('button', { name: /Export Active Layer \(GeoTIFF\)/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Capture Viewport \(PNG\)/i })).toBeVisible();
  });

  test('verifies social metadata, HiDPI viewport quality toggle, and drag-and-drop dropzone', async ({ page }) => {
    // Social metadata verification in DOM head
    const ogTitle = page.locator('meta[property="og:title"]');
    await expect(ogTitle).toHaveAttribute('content', /Terra — 3D Terrain & Geospatial Analysis/);

    const twitterCard = page.locator('meta[name="twitter:card"]');
    await expect(twitterCard).toHaveAttribute('content', 'summary_large_image');

    const favicon = page.locator('link[type="image/svg+xml"]');
    await expect(favicon).toHaveAttribute('href', /favicon\.svg/);

    // HiDPI quality toggle in viewport HUD
    const hidpiBtn = page.getByRole('button', { name: /HiDPI|1×/i });
    await expect(hidpiBtn).toBeVisible();
    await expect(hidpiBtn).toContainText('HiDPI');

    // Click to switch to 1x performance mode
    await hidpiBtn.click();
    await expect(hidpiBtn).toContainText('1×');

    // Click again to switch back to HiDPI mode
    await hidpiBtn.click();
    await expect(hidpiBtn).toContainText('HiDPI');

    // Drag-and-drop file overlay trigger
    await page.evaluate(() => {
      const event = new DragEvent('dragenter', {
        bubbles: true,
        cancelable: true,
        dataTransfer: new DataTransfer(),
      });
      event.dataTransfer?.items.add(new File(['test'], 'elevation.tif', { type: 'image/tiff' }));
      window.dispatchEvent(event);
    });

    const overlay = page.getByRole('region', { name: 'File dropzone' });
    await expect(overlay).toBeVisible();
    await expect(overlay).toContainText('Drop GeoTIFF Elevation Model Here');

    // Leave window drag
    await page.evaluate(() => {
      const event = new DragEvent('dragleave', {
        bubbles: true,
        cancelable: true,
        dataTransfer: new DataTransfer(),
      });
      event.dataTransfer?.items.add(new File(['test'], 'elevation.tif', { type: 'image/tiff' }));
      window.dispatchEvent(event);
    });

    await expect(overlay).not.toBeVisible();
  });
});
