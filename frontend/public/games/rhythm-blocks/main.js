// Main Bootstrapper

window.onload = function() {
    console.log("[Rhythm Blocks] Booting...");

    const engine = new window.Engine();
    engine.init();

    // Calibration UI
    const offsetInput = document.getElementById('offset-input');
    offsetInput.value = localStorage.getItem('rhythm-blocks-offset') || '0';
    offsetInput.addEventListener('change', (e) => {
        const val = parseInt(e.target.value, 10) || 0;
        localStorage.setItem('rhythm-blocks-offset', val);
        engine.offset = val;
    });

    // Prevent default touch behaviors
    document.addEventListener('touchmove', function(e) { e.preventDefault(); }, { passive: false });
    document.addEventListener('gesturestart', function(e) { e.preventDefault(); });
};
