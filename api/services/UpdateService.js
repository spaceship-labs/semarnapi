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
  //Runs Scraper functions
function install() {
  ScraperService.gacetas()
    .then(ScraperService.downloadGacetas)
    .then(ScraperService.mineGacetas)
    .then(ScraperService.mia)
}

function update() {
  ScraperService.gacetas([2017])
    .then(ScraperService.downloadGacetas)
    .then(ScraperService.mineGacetas)
    .then(ScraperService.mia)
}
