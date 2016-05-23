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
const prequest = (opts) => new Promise((resolve, reject) => request(opts, (err, res, body) => _.isNil(err) ? resolve(body) : reject(err)))
const requestDriver = (config = {}) => (ctx) => prequest(Object.assign({}, config, { uri: ctx.url} ))
const x = require('x-ray')().driver(requestDriver())


const getLocalName = (uri) => url.parse(uri).pathname.split('/').slice(1).join('-')

const gams = fs.readFileSync('gams.txt').toString().split('\n')

let gameData

try {
  gameData = fs.readJsonSync('data/progress.json')
  let errorIndex
  do {
    errorIndex = gameData.findIndex(d => _.isNil(d))
    if(errorIndex !== -1) {
      console.log('Error index: ', errorIndex)
      gameData[errorIndex] = {
        name: gams[errorIndex],
        index: errorIndex,
        searchUri: 'http://store.steampowered.com/search/?snr=1_4_4__12&term=' + encodeURI(gams[errorIndex])
      }
    }
  } while(errorIndex !== -1)
}
catch(e) {
  gameData = gams
    // .slice(0, 13)
    .map((gameName, index) => ({
      name: gameName,
      index: index,
      searchUri: 'http://store.steampowered.com/search/?snr=1_4_4__12&term=' + encodeURI(gameName)
    }))
}

async.waterfall(
  [
    (cb) => async.mapLimit(
      gameData,
      2,
      (gameDatum, cb2) => {
        if(gameDatum.gameUri) {
          console.log(`SKIPPING game (${gameDatum.index + 1} / ${gameData.length}) "${gameDatum.name}"...`)
          cb2(null, gameDatum)
          return
        }
        console.log(`Searching game (${gameDatum.index + 1} / ${gameData.length}) "${gameDatum.name}"...`)
        x(gameDatum.searchUri, '.search_result_row@href')((e, href) => {
          if(e) {
            console.error(e)
          }
          cb2(e, Object.assign({}, gameDatum, { gameUri: href }))
        })
      },
      (e, newData) => {
        if(e) {
          console.error(e)
          let validData = newData
          const errorIndex = newData.findIndex(d => _.isNil(d))
          if(errorIndex !== -1) {
            console.log('Error index: ', errorIndex)
            validData = newData.slice(0, errorIndex)
          }
          console.log(`${validData.length} valid entries of ${newData.length}`)
          fs.outputJsonSync('data/progress.json', validData.concat(gameData.slice(validData.length)))
          console.log(`Wrote ${validData.length} progress entries into data/progress.json`)
        }
        console.log('Got ' + newData.length + ' uris!'); cb(e, newData)
      }
    ),
    (dataWithGameUris, cb) => fs.outputJson('data/progress.json', dataWithGameUris, e => cb(e, dataWithGameUris)),
    (dataWithGameUris, cb) => async.mapLimit(
      dataWithGameUris,
      2,
      (datum, cb2) => {
        if(datum.releaseDate && datum.genres && datum.developer && datum.publisher && datum.img && datum.popularity && datum.rating) {
          console.log(`SKIPPING game (${datum.index + 1} / ${dataWithGameUris.length}) "${datum.name}"...`)
          cb2(null, datum)
          return
        }
        if(!datum.gameUri) {
          console.error(`No game URI for (${datum.index + 1} / ${dataWithGameUris.length}) "${datum.name}"! Skipping.`)
          cb2(null, datum)
          return
        }
        console.log(`Scraping page (${datum.index + 1} / ${dataWithGameUris.length}) "${datum.name}"...`)
        x(datum.gameUri, {
          details: '.game_details .details_block',
          img: 'img.game_header_image_full@src',
          revs: '.user_reviews_summary_row[itemprop="aggregateRating"]@data-store-tooltip',
          userTags: ['.popular_tags > a.app_tag']
        })((e, scraped) => {
          if(e) {
            console.error(e)
          }

          const details = scraped.details
            .split('\n')
            .map(txt => txt.trim())
            .filter(txt => txt.length > 0)

          const revs = scraped.revs.split(' ')

          let popularity = revs[3] && parseInt(revs[3].split(',').join(''), 10)
          if(_.isNaN(popularity)) {
            popularity = undefined
          }

          let ratings = revs[0] && parseInt(revs[0], 10)
          if(_.isNaN(ratings)) {
            ratings = undefined
          }

          const tags = scraped.userTags.map(t => t.trim())
          const genres = getInDataBlock(details, 'Genre') || ''

          cb2(e, Object.assign({}, datum, {
            releaseDate: getInDataBlock(details, 'Release Date'),
            genres: genres.split(',').map(g => g.trim()),
            developer: getInDataBlock(details, 'Developer'),
            publisher: getInDataBlock(details, 'Publisher'),
            img: scraped.img,
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
          fs.outputJsonSync('data/progress.json', validData.concat(dataWithGameUris.slice(validData.length)))
          console.log(`Wrote ${validData.length} progress entries into data/progress.json`)
        }
        console.log('Got ' + dataWithScrapedInfo.length + ' games!')
        cb(e, dataWithScrapedInfo)
      }
    ),
    (data, cb) => fs.outputJson('data/progress.json', data, e => cb(e, data)),
    (data, cb) => async.parallelLimit(data.map((d, ind) => (cb2) => {
      if(!d.img) {
        console.error(`No image URI for (${ind + 1} / ${data.length}) "${d.name}"! Skipping.`)
        cb2()
        return
      }
      if(fs.existsSync(path.join('data/images', getLocalName(d.img)))) {
        console.log(`Image "${d.img}" already exists locally! Skipping download.`)
        cb2()
        return
      }
      console.log(`Downloading image (${ind + 1} / ${data.length}) "${d.img}"...`)
      new Download()
        .get(d.img)
        .rename(getLocalName(d.img))
        .dest('data/images')
        .run(cb2)
    }), 2, e => { console.log('Done downloading!'); cb(e, data) }),
    (games, cb) => cb(null, games.map(g => Object.assign({}, g, { img: (typeof g.img == 'undefined') ? undefined : path.join('data/images', encodeURI(getLocalName(g.img))) }))),
    (games, cb) => fs.outputFile('data/games.js', 'window.games = ' + JSON.stringify(games, null, 2), cb)
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
