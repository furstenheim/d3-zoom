const { Decimal }  = require('small-decimal')

var tape = require("tape"),
    d3 = require("../"),
    identity = d3.zoomIdentity;

tape("d3.zoomIdentity transform contains k = 1, x = y = 0", function(test) {
  test.deepEqual(toObject(identity), {k: new Decimal(1), x: new Decimal(0), y: new Decimal(0)});
  test.end();
});

tape("transform.scale(k) returns a new transform scaled with k", function(test) {
  var transform = identity.scale(new Decimal(2.5));
  test.deepEqual(toObject(transform.scale(new Decimal(2))), {k: new Decimal(5), x: new Decimal(0), y: new Decimal(0)});
  test.end();
});

tape("transform.translate(x, y) returns a new transform translated with x and y", function(test) {
  var transform = identity.translate(new Decimal(2), new Decimal(3));
  test.deepEqual(toObject(transform.translate(new Decimal(-4), new Decimal(4))), {k: new Decimal(1), x: new Decimal(-2), y: new Decimal(7)});
  test.deepEqual(toObject(transform.scale(new Decimal(2)).translate(new Decimal(-4), new Decimal(4))), {k: new Decimal(2), x: new Decimal(-6), y: new Decimal(11)});
  test.end();
});

tape("transform.apply([x, y]) returns the transformation of the specified point", function(test) {
  test.deepEqual(identity.translate(new Decimal(2), new Decimal(3)).scale(new Decimal(2)).apply([new Decimal(4), new Decimal(5)]), [new Decimal(10), new Decimal(13)]);
  test.end();
});

tape("transform.applyX(x) returns the transformation of the specified x-coordinate", function(test) {
  test.deepEqual(identity.translate(new Decimal(2), new Decimal(0)).scale(new Decimal(2)).applyX(new Decimal(4)), new Decimal(10));
  test.end();
});

tape("transform.applyY(y) returns the transformation of the specified y-coordinate", function(test) {
  test.deepEqual(identity.translate(new Decimal(0), new Decimal(3)).scale(new Decimal(2)).applyY(new Decimal(5)), new Decimal(13));
  test.end();
});

tape("transform.invert([x, y]) returns the inverse transformation of the specified point", function(test) {
  test.deepEqual(identity.translate(new Decimal(2), new Decimal(3)).scale(new Decimal(2)).invert([new Decimal(4), new Decimal(5)]), [new Decimal(1), new Decimal(1)]);
  test.end();
});

tape("transform.invertX(x) returns the inverse transformation of the specified x-coordinate", function(test) {
  test.deepEqual(identity.translate(new Decimal(2), new Decimal(0)).scale(new Decimal(2)).invertX(new Decimal(4)), new Decimal(1));
  test.end();
});

tape("transform.invertY(y) returns the inverse transformation of the specified y-coordinate", function(test) {
  test.deepEqual(identity.translate(new Decimal(0), new Decimal(3)).scale(new Decimal(2)).invertY(new Decimal(5)), new Decimal(1));
  test.end();
});

// transform.rescaleX(x)

// transform.rescaleY(y)

tape("transform.toString() returns a string representing the SVG transform", function(test) {
  test.equal(d3.zoomIdentity.toString(), "translate(0,0) scale(1)");
  test.end();
});

function toObject(transform) {
  return {k: transform.k, x: transform.x, y: transform.y};
}
