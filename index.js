/*eslint semi: ["error", "never"], strict: 0*/
'use strict'

const x = require('x-ray')()
const async = require('async')
const fs = require('fs-extra')
// const _ = require('lodash')
const Download = require('download')
const url = require('url')
const path = require('path')

const getLocalName = (uri) => url.parse(uri).pathname.split('/').slice(1).join('-')


const gams = fs.readFileSync('gams.txt').toString().split('\n')

const searchUris = gams
  // .slice(0, 13)
  .map(g => 'http://store.steampowered.com/search/?snr=1_4_4__12&term=' + encodeURI(g))

async.waterfall(
  [
    (cb) => async.mapLimit(
      searchUris.map((v, i) => ({val: v, ind: i})),
      2,
      (searchUri, cb2) => {
        console.log(`Searching game (${searchUri.ind + 1} / ${searchUris.length}) "${searchUri.val}"...`)
        x(searchUri.val, '.search_result_row@href')((e, href) => cb2(e, href))
      },
      (e, uris) => { console.log('Got ' + uris.length + ' uris!'); cb(e, uris) }
    ),
    (uris, cb) => async.mapLimit(
      uris.map((v, i) => ({val: v, ind: i})),
      2,
      (uri, cb2) => {
        console.log(`Scraping page (${uri.ind + 1} / ${uris.length}) "${uri.val}"...`)
        x(uri.val, {
          details: '.details_block',
          img: 'img.game_header_image_full@src',
          revs: '.user_reviews_summary_row[itemprop="aggregateRating"]@data-store-tooltip'
        })((e, data) => {
          const details = data.details
            .split('\n')
            .map(txt => txt.trim())
            .filter(txt => txt.length > 0)
          
          const revs = data.revs.split(' ')
          
          cb2(e, {
            name: getInDataBlock(details, 'Title'),
            releaseDate: getInDataBlock(details, 'Release Date'),
            genres: getInDataBlock(details, 'Genre').split(',').map(g => g.trim()),
            developer: getInDataBlock(details, 'Developer'),
            publisher: getInDataBlock(details, 'Publisher'),
            url: uri.val,
            img: data.img,
            popularity: parseInt(revs[3].split(',').join(''), 10),
            rating: parseInt(revs[0], 10)
          })
        })
      },
      (e, data) => { console.log('Got ' + data.length + ' games!'); cb(e, data) }
    ),
    (data, cb) => async.parallelLimit(data.map((d, ind) => (cb2) => {
      console.log(`Downloading image (${ind + 1} / ${data.length}) "${d.img}"...`)
      new Download()
        .get(d.img)
        .rename(getLocalName(d.img))
        .dest('data/images')
        .run(cb2)
    }), 2, (e) => { console.log('Done downloading!'); cb(e, data) }),
    (games, cb) => cb(null, games.map(g => Object.assign({}, g, { img: path.join('data/images', encodeURI(getLocalName(g.img))) }))),
    (games, cb) => fs.outputFile('data/games.js', 'window.games = ' + JSON.stringify(games, null, 2), cb)
  ],
  (err) => { if(err) { console.error('ERROR:'); console.error(err) } else { console.log('Done!') } }
)

function getInDataBlock(datablock, keyword) {
  const datumIndex = datablock.findIndex(d => d.startsWith(keyword))
  if(datumIndex === -1) {
    throw new Error(`Can't find keyword ${keyword} in data block ${datablock}!`)
  }
  let datum = datablock[datumIndex].substr(keyword.length + 1).trim()
  if(datum.length === 0) {
    datum = datablock[datumIndex + 1]
  }
  if(typeof datum == 'undefined') {
    throw new Error(`Can't find keyword ${keyword} in data block ${datablock}!`)    
  }
  return datum
}
