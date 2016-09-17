/**
 * UpdateService.js
 *
 * @description ::
 * @docs        :: http://sailsjs.org/#!documentation/controllers
 */
module.exports = {
    install : install,
  }
//Runs Scraper functions
function install() {
  ScraperService.gacetas()
    .then(ScraperService.downloadGacetas)
    .then(ScraperService.mineGacetas)
    .then(ScraperService.mia)
}
