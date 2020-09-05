require('../dist/d3-zoom')
var canvas = d3.select("canvas").call(d3.zoom().scaleExtent([1, 8]).on("zoom", zoom)),
  context = canvas.node().getContext("2d"),
  width = canvas.property("width"),
  height = canvas.property("height");

var randomX = d3.randomNormal(width / 2, 80),
  randomY = d3.randomNormal(height / 2, 80),
  data = d3.range(2000).map(function() { return [randomX(), randomY()]; });

draw(d3.zoomIdentity);

function zoom() {
  context.clearRect(0, 0, width, height);
  draw(d3.event.transform);
}

function draw(transform) {
  var i = -1, n = data.length, d;
  context.beginPath();
  while (++i < n) {
    d = transform.apply(data[i]);
    context.moveTo(d[0], d[1]);
    context.arc(d[0], d[1], 2.5, 0, 2 * Math.PI);
  }
  context.fill();
}