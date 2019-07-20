/**
 * UpdateService.js
 *
 * @description ::
 * @docs        :: http://sailsjs.org/#!documentation/controllers
 */
module.exports = {
    install: install,
    update: update,
  }
  
function install() {
  ScraperService.gacetas()
    .then(ScraperService.downloadGacetas)
    .then(ScraperService.mineGacetas)
    .then(ScraperService.mia)
}

function update() {
  ScraperService.gacetas([2019])
    .then(ScraperService.downloadGacetas)
    .then(ScraperService.mineGacetas)
    .then(ScraperService.mia)
}

