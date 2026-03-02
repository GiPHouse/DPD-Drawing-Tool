/**
 * Copyright (c) 2006-2024, JGraph Holdings Ltd
 * Copyright (c) 2006-2024, draw.io AG
 */
/* 

+--------------------------------------------------------+
| This file contains modified code by SE team,           |
| refer to keywords: 'NOLAI'                             |
|                                                        |
+--------------------------------------------------------+

*/

// Overrides of global vars need to be pre-loaded
window.DRAWIO_PUBLIC_BUILD = true;
window.EXPORT_URL = 'REPLACE_WITH_YOUR_IMAGE_SERVER';
window.PLANT_URL = 'REPLACE_WITH_YOUR_PLANTUML_SERVER';
window.DRAWIO_BASE_URL = null; // Replace with path to base of deployment, e.g. https://www.example.com/folder
window.DRAWIO_VIEWER_URL = null; // Replace your path to the viewer js, e.g. https://www.example.com/js/viewer.min.js
window.DRAWIO_LIGHTBOX_URL = null; // Replace with your lightbox URL, eg. https://www.example.com
window.DRAW_MATH_URL = 'math4/es5';
window.DRAWIO_CONFIG = null; // Replace with your custom draw.io configurations. For more details, https://www.drawio.com/doc/faq/configure-diagram-editor
urlParams['sync'] = 'manual';


// ======   NOLAI - Frontend - /Sprint 1/ Task #89=====
try {
    var req = new XMLHttpRequest();
    req.open('GET', 'configuration/nolai_configuration.json', false);
    req.send(null);

    if (req.status >= 200 && req.status < 300) {
        var contentType = req.getResponseHeader("Content-Type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
            window.DRAWIO_CONFIG = JSON.parse(req.responseText);
        } else {
            console.error("NOLAI: Expected JSON, got " + contentType);
        }
    }
} catch (e) {
    console.error("NOLAI: Failed to parse config, preventing fatal crash.", e);
}

urlParams['p']= 'dpd'; // This is fine here, plugins load later in the lifecycle