/*eslint strict: 0*/
'use strict'

const async = require('async')
const fs = require('fs-extra')
const _ = require('lodash')
const Download = require('download')
const url = require('url')
const path = require('path')

const request = require('request').defaults({
  jar: true,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64; rv:44.0) Gecko/20100101 Firefox/44.0',
    'Cookie': 'birthtime=28801; path=/; domain=store.steampowered.com'
  }
})
const prequest = (opts) => new Promise((resolve, reject) => request(opts, (err, res, body) => {
  if(err) {
    return reject(err)
  }
  if(res.request.uri.path.length < 2) {
    return reject('Invalid game URI!')
  }
  return resolve(body)
}))
const requestDriver = (config = {}) => (ctx) => prequest(Object.assign({}, config, { uri: ctx.url} )).catch(e => console.error(e))
const x = require('x-ray')().driver(requestDriver())


const getLocalName = (uri) => url.parse(uri).pathname.split('/').slice(1).join('-')

const basicInfo = require('../data/step1.json')

async.waterfall(
  [
    (cb) => async.mapLimit(
      basicInfo.map((d, i) => Object.assign({}, d, { index: i + 1 })),
      2,
      (datum, cb2) => {
        if(datum.releaseDate && datum.genres && datum.developer && datum.publisher && datum.popularity && datum.rating) {
          console.log(`Already done: skipping game (${datum.index} / ${basicInfo.length}) "${datum.name}"...`)
          cb2(null, datum)
          return
        }
        if(!datum.uri) {
          console.error(`No game URI for (${datum.index} / ${basicInfo.length}) "${datum.name}"! Skipping.`)
          cb2(null, datum)
          return
        }
        console.log(`Scraping page (${datum.index} / ${basicInfo.length}) "${datum.name}"...`)
        x(datum.uri, {
          details: '.game_details .details_block',
          revs: '.user_reviews_summary_row[itemprop="aggregateRating"]@data-store-tooltip',
          userTags: ['.popular_tags > a.app_tag']
        })((e, scraped) => {
          if(e) {
            console.error(e)
            return
          }

          let details = []
          if(scraped.details && scraped.details.length > 0) {
            details = scraped.details
              .split('\n')
              .map(txt => txt.trim())
              .filter(txt => txt.length > 0)
          }

          let popularity
          let ratings
          if(scraped.revs) {
            const revs = scraped.revs.split(' ')

            popularity = revs[3] && parseInt(revs[3].split(',').join(''), 10)
            if(_.isNaN(popularity)) {
              popularity = undefined
            }

            ratings = revs[0] && parseInt(revs[0], 10)
            if(_.isNaN(ratings)) {
              ratings = undefined
            }
          }

          let tags = []
          if(scraped.userTags) {
            tags = scraped.userTags.map(t => t.trim())
          }

          const genres = getInDataBlock(details, 'Genre') || ''

          cb2(e, Object.assign({}, datum, {
            releaseDate: getInDataBlock(details, 'Release Date'),
            genres: genres.split(',').map(g => g.trim()),
            developer: getInDataBlock(details, 'Developer'),
            publisher: getInDataBlock(details, 'Publisher'),
            popularity: popularity,
            rating: ratings,
            userTags: tags
          }))
        })
      },
      (e, dataWithScrapedInfo) => {
        if(e) {
          console.error(e)
          let validData = dataWithScrapedInfo
          const errorIndex = dataWithScrapedInfo.findIndex(d => _.isNil(d))
          if(errorIndex !== -1) {
            console.log('Error index: ', errorIndex)
            validData = dataWithScrapedInfo.slice(0, errorIndex)
          }
          console.log(`${validData.length} valid entries of ${dataWithScrapedInfo.length}`)
          fs.outputJsonSync('../data/step2-progress.json', validData.concat(basicInfo.slice(validData.length)))
          console.log(`Wrote ${validData.length} progress entries into data/progress.json`)
        }
        console.log('Got ' + dataWithScrapedInfo.length + ' games!')
        cb(e, dataWithScrapedInfo)
      }
    ),
    (data, cb) => fs.outputJson('../data/step2-progress.json', data, e => cb(e, data)),
    (data, cb) => async.parallelLimit(data.map((d, ind) => (cb2) => {
      if(!d.image) {
        console.error(`No image URI for (${ind + 1} / ${data.length}) "${d.name}"! Skipping.`)
        cb2()
        return
      }
      if(fs.existsSync(path.join('../data/images', getLocalName(d.image)))) {
        console.log(`Image "${d.image}" already exists locally! Skipping download.`)
        cb2()
        return
      }
      console.log(`Downloading image (${ind + 1} / ${data.length}) "${d.image}"...`)
      new Download()
        .get(d.image)
        .rename(getLocalName(d.image))
        .dest('../data/images')
        .run(cb2)
    }), 2, e => { console.log('Done downloading!'); cb(e, data) }),
    (games, cb) => cb(null, games.map(g => Object.assign({}, g, { image: (typeof g.image == 'undefined') ? undefined : path.join('../data/images', encodeURI(getLocalName(g.image))) }))),
    (games, cb) => fs.outputFile('../data/step3.js', 'window.games = ' + JSON.stringify(games, null, 2), cb)
  ],
  (err) => { if(err) { console.error('ERROR:'); console.error(err) } else { console.log('Done!') } }
)

function getInDataBlock(datablock, keyword) {
  const datumIndex = datablock.findIndex(d => d.startsWith(keyword))
  if(datumIndex === -1) {
    // throw new Error(`Can't find keyword ${keyword} in data block ${datablock}!`)
    console.error(`Can't find keyword "${keyword}" in data block: [[${datablock}]]!`)
    return undefined
  }
  let datum = datablock[datumIndex].substr(keyword.length + 1).trim()
  if(datum.length === 0) {
    datum = datablock[datumIndex + 1]
  }
  if(typeof datum == 'undefined') {
    // throw new Error(`Can't find keyword ${keyword} in data block ${datablock}!`)
    console.error(`Can't find keyword "${keyword}" in data block [[${datablock}]]!`)
  }
  return datum
}
