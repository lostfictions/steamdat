// Run in browser console from https://steamcommunity.com/id/YOUR_NAME/games/?tab=all
// The result will be in your clipboard
/*global copy:false*/

const items = Array.from(document.querySelectorAll('.gameListRow'))
  .map(i => ({
    name: i.querySelector('.gameListRowItemName').textContent,
    image: i.querySelector('.gameListRowLogo img').getAttribute('src'),
    uri: 'http://store.steampowered.com/app/' + i
      .querySelector('.gameListRowLogo a')
      .getAttribute('href')
      .split('/')
      .pop()
  }))

copy(items)

// If copy() doesn't work for some reason, uncomment the below snippet to append the
// result to the bottom of the page, where you can copy-paste manually

// const container = document.createElement('pre')
// container.textContent = JSON.stringify(items, undefined, 2)
// document.body.appendChild(container)
