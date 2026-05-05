const fs = require('fs');
const { DOMParser, XMLSerializer } = require('@xmldom/xmldom');

const svgTemplate = fs.readFileSync('./public/Mockup-1-Light-Mode.svg', 'utf8');
const parser = new DOMParser();
const doc = parser.parseFromString(svgTemplate, 'image/svg+xml');

const placeholder = doc.getElementById('Placeholder-Image') || doc.querySelector && doc.querySelector('#Placeholder-Image');
console.log("Placeholder found:", !!placeholder);
if (placeholder) {
    console.log("Placeholder tag:", placeholder.tagName);
    console.log("Placeholder parent:", placeholder.parentNode.tagName);
}
