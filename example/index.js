const d3Zoom = require('../dist/d3-zoom')
/*
const d3Zoom = d3
*/
console.log(d3Zoom)
var canvas = d3.select("canvas").call(d3Zoom.zoom().scaleExtent([1, 8]).on("zoom", zoom)),
  context = canvas.node().getContext("2d"),
  width = canvas.property("width"),
  height = canvas.property("height");

var randomX = d3.randomNormal(width / 2, 80),
  randomY = d3.randomNormal(height / 2, 80),
  data = d3.range(2000).map(function() { return [randomX(), randomY()]; });

draw();

function zoom(event) {
  var transform = event.transform;
  context.save();
  context.clearRect(0, 0, width, height);
  context.translate(transform.x, transform.y);
  context.scale(transform.k, transform.k);
  draw();
  context.restore();
}

function draw() {
  var i = -1, n = data.length, d;
  context.beginPath();
  while (++i < n) {
    d = data[i];
    context.moveTo(d[0], d[1]);
    context.arc(d[0], d[1], 2.5, 0, 2 * Math.PI);
  }
  context.fill();
}
