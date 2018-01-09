require('materialize-css/dist/css/materialize.css');
require('materialize-css/dist/js/materialize.js');
require('materialize-css/js/init.js');
require('font-awesome/css/font-awesome.css');
require('./menus.css');

const scene = document.getElementsByTagName('a-scene')[0];
const apainter_ui = document.getElementById('apainter-ui');
apainter_ui.innerHTML += require('./menus.html');
