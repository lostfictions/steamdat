/*eslint strict: 0*/
/*global games:false*/
'use strict'

const qs = document.querySelector.bind(document)
const i = qs('.wrapper img')
const link = qs('.wrapper a')
const cap = qs('.wrapper .caption')

let game = {}
const hist = []

const n = qs('#new')
n.onclick = function(e) { e.preventDefault(); newGame() }

const u = qs('#undo')
u.onclick = function(e) { e.preventDefault(); undo() }

newGame()

function newGame() {
  hist.push(game)
  game = randomInArray(games)
  i.setAttribute('src', game.img)
  link.setAttribute('href', game.gameUri)
  cap.textContent = game.name
}

function undo() {
  if(hist.length <= 1) {
    return
  }

  const h = hist.pop()
  i.setAttribute('src', h.img)
  link.setAttribute('href', h.gameUri)
  cap.textContent = h.name
}

function randomInArray(arr) { return arr[Math.floor(Math.random() * arr.length)] }
