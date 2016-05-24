/*eslint strict: 0*/
/*global games:false, d3:false, moment:false*/
'use strict'

const validGames = games
  .filter(g => g.releaseDate && g.popularity && g.gameUri)
  .map(g => Object.assign({}, g, { releaseDate: moment(g.releaseDate, 'DD MMM, YYYY').toDate() }))
  .filter(g => g.releaseDate > new Date(2007, 1, 1))

const margin = {top: 20, right: 20, bottom: 30, left: 40}
const width = 960 - margin.left - margin.right
const height = 500 - margin.top - margin.bottom

const x = d3.scaleTime()
  .range([0, width])
  .domain(d3.extent(validGames, g => g.releaseDate))
  .nice()

const y = d3.scaleLog()
  .range([height, 0])
  .domain(d3.extent(validGames, g => g.popularity))
  .nice()

// const radius = d3.scaleSqrt()
//   .range([3.5, 10])
//   .domain(d3.extent(validGames, g => g.rating))

const color = d3.scaleInferno()
  .domain(d3.extent(validGames, g => g.rating))

const xAxis = d3.axisBottom(x)
const yAxis = d3.axisLeft(y)

const svg = d3.select("body").append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
  .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")")

const div = d3.select("body").append("div")
  .attr("class", "tooltip")
  .style("opacity", 0)



svg.append("g")
    .attr("class", "x axis")
    .attr("transform", "translate(0," + height + ")")
    .call(xAxis)
  .append("text")
    .attr("class", "label")
    .attr("x", width)
    .attr("y", -6)
    .style("text-anchor", "end")
    .text("Release Date")

svg.append("g")
    .attr("class", "y axis")
    .call(yAxis)
  .append("text")
    .attr("class", "label")
    .attr("transform", "rotate(-90)")
    .attr("y", 6)
    .attr("dy", ".71em")
    .style("text-anchor", "end")
    .text("Popularity")

svg.selectAll('.dot')
    .data(validGames)
  .enter().append('circle')
    .attr('class', 'dot')
    .attr('r', 3.5)
    // .attr('r', g => radius(g.rating))
    .attr('cx', g => x(g.releaseDate))
    .attr('cy', g => y(g.popularity))
    .style('fill', g => color(g.rating))
    .on('mouseover', g => {
      div.transition()
        .duration(200)
        .style('opacity', 0.9)

      div.html(`
        <img src=${g.img}>
        <b>${g.name}</b><br/>
        Released ${moment(g.releaseDate).fromNow()}<br/>
        Rating: ${g.rating}<br/>
        Popularity: ${g.popularity}
      `)
        .style("left", (d3.event.pageX + 10) + "px")
        .style("top", (d3.event.pageY - 28) + "px")
    })
    .on('mouseout', () => {
      div.transition()
        .duration(500)
        .style('opacity', 0)
    })
    .on('click', g => window.open(g.gameUri, '_blank'))

/*
var legend = svg.selectAll(".legend")
    .data(color.domain())
  .enter().append("g")
    .attr("class", "legend")
    .attr("transform", function(d, i) { return "translate(0," + i * 20 + ")"; });

legend.append("rect")
    .attr("x", width - 18)
    .attr("width", 18)
    .attr("height", 18)
    .style("fill", color);

legend.append("text")
    .attr("x", width - 24)
    .attr("y", 9)
    .attr("dy", ".35em")
    .style("text-anchor", "end")
    .text(function(d) { return d; });
*/




/*
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
*/
