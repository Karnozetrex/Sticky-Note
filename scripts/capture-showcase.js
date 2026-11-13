const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

app.whenReady().then(async () => {
  try {
    const win = new BrowserWindow({
      width: 1440,
      height: 760,
      show: false,
      frame: false,
      transparent: false,
      backgroundColor: '#18181f',
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });

    const showcaseHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <link rel="stylesheet" href="../src/renderer/styles.css">
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 40px 24px;
      display: flex;
      flex-direction: row;
      gap: 20px;
      justify-content: center;
      align-items: center;
      background: radial-gradient(circle at 50% 20%, #252836 0%, #161822 100%);
      width: 100vw;
      height: 100vh;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .showcase-banner {
      position: absolute;
      top: 14px;
      left: 0;
      right: 0;
      text-align: center;
      color: #cbd5e1;
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0.5px;
      display: flex;
      justify-content: center;
      gap: 24px;
    }
    .showcase-banner span {
      background: rgba(255,255,255,0.08);
      padding: 4px 12px;
      border-radius: 12px;
      border: 1px solid rgba(255,255,255,0.12);
    }
    .note-card-wrap {
      width: 256px;
      height: 380px;
      position: relative;
    }
    /* Static layout simulation using production classes */
    .note-card-wrap .sticky-note {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      display: flex;
      flex-direction: column;
    }
    .more-popover-demo {
      position: absolute;
      top: 36px;
      right: 12px;
      background: #ffffff;
      border: 1px solid rgba(0,0,0,0.12);
      border-radius: 8px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.22);
      padding: 4px 0;
      z-index: 1000;
      min-width: 165px;
      display: flex;
      flex-direction: column;
    }
    .more-popover-demo .menu-row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 7px 12px;
      font-size: 12px;
      font-weight: 500;
      color: #334155;
    }
    .more-popover-demo .menu-row:hover, .more-popover-demo .menu-row.active {
      background: #f1f5f9;
      color: #0f172a;
    }
  </style>
</head>
<body>
  <div class="showcase-banner">
    <span>✅ Pinned [✕] Close Button</span>
    <span>✅ Uncluttered "⋯" More Menu</span>
    <span>✅ Multi-Edge & Corner Resizing</span>
    <span>✅ All 5 Paper Styles & Aqua Teal</span>
  </div>

  <!-- Note 1: Classic Straight (Yellow) -->
  <div class="note-card-wrap style-classic theme-yellow font-sans">
    <div class="sticky-note" style="--note-tilt: -2deg;">
      <header class="note-header">
        <div class="header-left">
          <button class="header-btn" title="New Note">+</button>
          <button class="header-btn" title="Collapse">▲</button>
        </div>
        <div class="header-drag-zone"><span style="font-size:11px;font-weight:700;opacity:0.6;">CLASSIC STRAIGHT</span></div>
        <div class="header-right">
          <button class="header-btn" title="Reminder">🔔</button>
          <button class="header-btn" title="Pin">📌</button>
          <button class="header-btn" title="Lock">🔒</button>
          <button class="header-btn" title="More Options">⋯</button>
          <button class="header-btn btn-delete" title="Close note">✕</button>
        </div>
      </header>
      <main class="note-body">
        <div class="editor-content" style="font-size:14px;line-height:1.4;">
          <strong>Classic Paper</strong><br>
          • Pinned <strong>[✕]</strong> at far right<br>
          • Clean top bar layout<br>
          • Multi-edge resize zones<br>
          • Diagonal grip handle ↘
        </div>
      </main>
      <footer class="note-footer">
        <span>Clean Sans</span>
      </footer>
      <div class="resize-handle-br">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
          <line x1="11" y1="2" x2="2" y2="11"></line>
          <line x1="11" y1="5.5" x2="5.5" y2="11"></line>
          <line x1="11" y1="9" x2="9" y2="11"></line>
        </svg>
      </div>
    </div>
  </div>

  <!-- Note 2: Corner Curl (Aqua Teal) -->
  <div class="note-card-wrap style-corner-curl theme-teal font-sans">
    <div class="sticky-note" style="--note-tilt: 1.5deg;">
      <header class="note-header">
        <div class="header-left">
          <button class="header-btn" title="New Note">+</button>
          <button class="header-btn" title="Collapse">▲</button>
        </div>
        <div class="header-drag-zone"><span style="font-size:11px;font-weight:700;opacity:0.6;">CORNER CURL</span></div>
        <div class="header-right">
          <button class="header-btn" title="Reminder">🔔</button>
          <button class="header-btn" title="Pin">📌</button>
          <button class="header-btn" title="Lock">🔒</button>
          <button class="header-btn" title="More Options">⋯</button>
          <button class="header-btn btn-delete" title="Close note">✕</button>
        </div>
      </header>
      <main class="note-body">
        <div class="editor-content" style="font-size:14px;line-height:1.4;">
          <strong>Aqua Teal Pastel</strong><br>
          • Replaced legacy black<br>
          • 48px corner curl flap<br>
          • <em>Grip moved left (52px)</em><br>
          • Flap has pointer-events:none
        </div>
      </main>
      <footer class="note-footer">
        <span>Soft Turquoise</span>
      </footer>
      <div class="peel-corner"><div class="peel-shadow"></div><div class="peel-fold"></div></div>
      <div class="resize-handle-br" style="right:52px !important; bottom:4px !important;">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
          <line x1="11" y1="2" x2="2" y2="11"></line>
          <line x1="11" y1="5.5" x2="5.5" y2="11"></line>
          <line x1="11" y1="9" x2="9" y2="11"></line>
        </svg>
      </div>
    </div>
  </div>

  <!-- Note 3: Bent Edge (Pink) with "⋯" More Menu Open -->
  <div class="note-card-wrap style-bent-edge theme-pink font-handwriting">
    <div class="sticky-note" style="--note-tilt: -1deg;">
      <div class="bent-shadow"></div>
      <header class="note-header">
        <div class="header-left">
          <button class="header-btn" title="New Note">+</button>
          <button class="header-btn" title="Collapse">▲</button>
        </div>
        <div class="header-drag-zone"><span style="font-size:11px;font-weight:700;opacity:0.6;">BENT EDGE</span></div>
        <div class="header-right">
          <button class="header-btn" title="Reminder">🔔</button>
          <button class="header-btn" title="Pin">📌</button>
          <button class="header-btn" title="Lock">🔒</button>
          <button class="header-btn active" title="More Options" style="background:rgba(0,0,0,0.12);">⋯</button>
          <button class="header-btn btn-delete" title="Close note">✕</button>
        </div>
      </header>
      <main class="note-body">
        <div class="editor-content" style="font-size:15px;line-height:1.4;">
          <strong>"⋯" More Dropdown</strong><br>
          • Clutter moved into menu<br>
          • 1-click open tools<br>
          • Esc or click-outside closes<br>
          • Arched bottom edge
        </div>
      </main>
      <footer class="note-footer">
        <span>Handwriting Font</span>
      </footer>
      <div class="resize-handle-br">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
          <line x1="11" y1="2" x2="2" y2="11"></line>
          <line x1="11" y1="5.5" x2="5.5" y2="11"></line>
          <line x1="11" y1="9" x2="9" y2="11"></line>
        </svg>
      </div>
      <!-- Open More Menu Showcase -->
      <div class="more-popover-demo">
        <div class="menu-row"><span style="font-size:14px;">🎨</span> Note Color</div>
        <div class="menu-row"><span style="font-size:14px;">📄</span> Paper & Font Style</div>
        <div class="menu-row"><span style="font-size:14px;">⏱️</span> Timer / Pomodoro</div>
        <div class="menu-row"><span style="font-size:14px;">⭐</span> Stickers & Doodles</div>
        <div class="menu-row"><span style="font-size:14px;">📋</span> Templates</div>
        <div class="menu-row" style="border-top: 1px solid #f1f5f9;"><span style="font-size:14px;">🔗</span> Share Note</div>
      </div>
    </div>
  </div>

  <!-- Note 4: Wavy Curl (Green) -->
  <div class="note-card-wrap style-wavy-curl theme-green font-sans">
    <div class="sticky-note" style="--note-tilt: 1.8deg;">
      <header class="note-header">
        <div class="header-left">
          <button class="header-btn" title="New Note">+</button>
          <button class="header-btn" title="Collapse">▲</button>
        </div>
        <div class="header-drag-zone"><span style="font-size:11px;font-weight:700;opacity:0.6;">WAVY CURL</span></div>
        <div class="header-right">
          <button class="header-btn" title="Reminder">🔔</button>
          <button class="header-btn" title="Pin">📌</button>
          <button class="header-btn" title="Lock">🔒</button>
          <button class="header-btn" title="More Options">⋯</button>
          <button class="header-btn btn-delete" title="Close note">✕</button>
        </div>
      </header>
      <main class="note-body">
        <div class="editor-content" style="font-size:14px;line-height:1.4;">
          <strong>Wavy Paper 3D</strong><br>
          • Rippling undulating edges<br>
          • Contrast shading<br>
          • Reliable multi-edge resize<br>
          • Min 220x160, Max 800x800
        </div>
      </main>
      <footer class="note-footer">
        <span>Curved Ripple</span>
      </footer>
      <div class="resize-handle-br">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
          <line x1="11" y1="2" x2="2" y2="11"></line>
          <line x1="11" y1="5.5" x2="5.5" y2="11"></line>
          <line x1="11" y1="9" x2="9" y2="11"></line>
        </svg>
      </div>
    </div>
  </div>

  <!-- Note 5: Taped (Purple) -->
  <div class="note-card-wrap style-taped theme-purple font-manga">
    <div class="sticky-note" style="--note-tilt: -2.2deg;">
      <div class="washi-tape"></div>
      <header class="note-header">
        <div class="header-left">
          <button class="header-btn" title="New Note">+</button>
          <button class="header-btn" title="Collapse">▲</button>
        </div>
        <div class="header-drag-zone"><span style="font-size:11px;font-weight:700;opacity:0.6;">TAPED CLASSIC</span></div>
        <div class="header-right">
          <button class="header-btn" title="Reminder">🔔</button>
          <button class="header-btn" title="Pin">📌</button>
          <button class="header-btn" title="Lock">🔒</button>
          <button class="header-btn" title="More Options">⋯</button>
          <button class="header-btn btn-delete" title="Close note">✕</button>
        </div>
      </header>
      <main class="note-body">
        <div class="editor-content" style="font-size:15px;line-height:1.4;">
          <strong>Washi Taped</strong><br>
          • Tape has pointer-events: none<br>
          • Never blocks buttons!<br>
          • Patrick Hand manga font<br>
          • Close [✕] always clickable
        </div>
      </main>
      <footer class="note-footer">
        <span>Manga Font</span>
      </footer>
      <div class="resize-handle-br">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
          <line x1="11" y1="2" x2="2" y2="11"></line>
          <line x1="11" y1="5.5" x2="5.5" y2="11"></line>
          <line x1="11" y1="9" x2="9" y2="11"></line>
        </svg>
      </div>
    </div>
  </div>
</body>
</html>
    `;

    const tmpHtml = path.join(__dirname, 'showcase.html');
    fs.writeFileSync(tmpHtml, showcaseHtml, 'utf8');

    await win.loadFile(tmpHtml);
    await new Promise(r => setTimeout(r, 800));

    const image = await win.webContents.capturePage();
    const localAssetPath = path.join(__dirname, '..', 'assets', 'layout-showcase.png');
    const screenshotsDir = path.join(__dirname, '..', 'screenshots');
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
    const screenshotPath = path.join(screenshotsDir, 'layout-showcase.png');

    fs.writeFileSync(localAssetPath, image.toPNG());
    fs.writeFileSync(screenshotPath, image.toPNG());
    console.log('[SHOWCASE] Layout showcase screenshot saved successfully to:', localAssetPath);

    fs.unlinkSync(tmpHtml);
    win.destroy();
    app.quit();
  } catch (err) {
    console.error('[SHOWCASE FAIL]', err);
    app.exit(1);
  }
});
