const fs = require('fs');
const path = require('path');

const templatePath = path.resolve(
  __dirname,
  '../../drawio app/src/main/webapp/templates/templateLegend.drawio',
);

function loadTemplate() {
  return fs.readFileSync(templatePath, 'utf8');
}

describe('templateLegend.drawio', () => {
  it('parses as valid XML', () => {
    const template = loadTemplate();
    const document = new DOMParser().parseFromString(template, 'application/xml');

    expect(document.getElementsByTagName('parsererror')).toHaveLength(0);
    expect(document.documentElement.nodeName).toBe('mxfile');
  });

  it('contains the expected legend labels', () => {
    const template = loadTemplate();

    expect(template).toContain('directly identifiable');
    expect(template).toContain('anonymous');
    expect(template).toContain('strictly pseudonymous (does not contain indirect identifiers)');
    expect(template).toContain('soft pseudonymous (may contain indirect identifiers)');
  });
});