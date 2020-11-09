const tape = require("tape"),
    jsdom = require("./jsdom"),
    d3 = Object.assign(require("../"), require("d3-selection"), require("d3-transition"));
const { Decimal } = require('small-decimal')
// d3-zoom expects global navigator and SVGElement to exist
global.navigator = {};
global.SVGElement = function(){};

 const document = jsdom("<body>"),
  div = d3.select(document.body).append("div").datum("hello"),
  zoom = d3.zoom(),
  identity = d3.zoomIdentity;

div.call(zoom);

tape("d3.zoom initiates a zooming behavior", function(test) {
  div.call(zoom.transform, identity);
  test.deepEqual(div.node().__zoom, { k: new Decimal(1), x: new Decimal(0), y: new Decimal(0) });
  div.call(zoom.transform, d3.zoomIdentity.scale(new Decimal(2)).translate(new Decimal(1),new Decimal(-3)));
  test.deepEqual(div.node().__zoom, { k: new Decimal(2), x: new Decimal(2), y: new Decimal(-6) });
  test.end();
});

tape("zoomTransform returns the node’s current transform", function(test) {
  div.call(zoom.transform, identity);
  test.deepEqual(d3.zoomTransform(div.node()), { k: new Decimal(1), x: new Decimal(0), y: new Decimal(0) });
  div.call(zoom.translateBy, new Decimal(10), new Decimal(10));
  test.deepEqual(d3.zoomTransform(div.node()), { k: new Decimal(1), x: new Decimal(10), y: new Decimal(10) });

  // or an ancestor's…
  test.deepEqual(d3.zoomTransform(div.append("span").node()), { k: new Decimal(1), x: new Decimal(10), y: new Decimal(10) });

  // or zoomIdentity
  test.deepEqual(d3.zoomTransform(document.body), d3.zoomIdentity);

  div.html("");
  test.end();
});

tape("zoom.scaleBy zooms", function(test) {
  div.call(zoom.transform, identity);
  div.call(zoom.scaleBy, new Decimal(2), [new Decimal(0), new Decimal(0)]);
  test.deepEqual(div.node().__zoom, { k: new Decimal(2), x: new Decimal(0), y: new Decimal(0) });
  div.call(zoom.scaleBy, new Decimal(2), [new Decimal(2), new Decimal(-2)]);
  test.deepEqual(div.node().__zoom, { k: new Decimal(4), x: new Decimal(-2), y:new Decimal( 2) });
  div.call(zoom.scaleBy, new Decimal(1/4), [new Decimal(2), new Decimal(-2)]);
  test.deepEqual(div.node().__zoom, { k: new Decimal(1), x: new Decimal(1), y: new Decimal(-1) });
  test.end();
});

tape("zoom.scaleTo zooms", function(test) {
  div.call(zoom.transform, identity);
  div.call(zoom.scaleTo, new Decimal(2));
  test.deepEqual(div.node().__zoom, { k: new Decimal(2), x: new Decimal(0), y: new Decimal(0) });
  div.call(zoom.scaleTo, new Decimal(2));
  test.deepEqual(div.node().__zoom, { k: new Decimal(2), x: new Decimal(0), y: new Decimal(0) });
  div.call(zoom.scaleTo, new Decimal(1));
  test.deepEqual(div.node().__zoom, { k: new Decimal(1), x: new Decimal(0), y: new Decimal(0) });
  test.end();
});

tape("zoom.translateBy translates", function(test) {
  div.call(zoom.transform, identity);
  div.call(zoom.translateBy, new Decimal(10), new Decimal(10));
  test.deepEqual(div.node().__zoom, { k: new Decimal(1), x: new Decimal(10), y: new Decimal(10) });
  div.call(zoom.scaleBy, new Decimal(2));
  div.call(zoom.translateBy, new Decimal(-10), new Decimal(-10));
  test.deepEqual(div.node().__zoom, { k: new Decimal(2), x: new Decimal(0), y: new Decimal(0) });
  test.end();
});

tape("zoom.scaleBy arguments can be functions passed (datum, index)", function(test) {
  div.call(zoom.transform, identity);
  let a, b, c, d;
  div.call(zoom.scaleBy,
    function() { a = arguments; b = this; return new Decimal(2); },
    function() { c = arguments; d = this; return [new Decimal(0), new Decimal(0)]; }
  );
  test.deepEqual(div.node().__zoom, { k: new Decimal(2), x: new Decimal(0), y: new Decimal(0) });
  test.deepEqual(a[0], "hello");
  // TODO each returns a number not decimal
  test.deepEqual(new Decimal(a[1]), new Decimal(0));
  test.deepEqual(b, div.node());
  test.deepEqual(c[0], "hello");
  test.deepEqual(new Decimal(c[1]), new Decimal(0));
  test.deepEqual(d, div.node());
  test.end();
});

tape("zoom.scaleTo arguments can be functions passed (datum, index)", function(test) {
  div.call(zoom.transform, identity);
  let a, b, c, d;
  div.call(zoom.scaleTo,
    function() { a = arguments; b = this; return new Decimal(2); },
    function() { c = arguments; d = this; return [new Decimal(0), new Decimal(0)]; }
  );
  test.deepEqual(div.node().__zoom, { k: new Decimal(2), x: new Decimal(0), y: new Decimal(0) });
  test.deepEqual(a[0], "hello");
  test.deepEqual(new Decimal(a[1]), new Decimal(0));
  test.deepEqual(b, div.node());
  test.deepEqual(c[0], "hello");
  test.deepEqual(new Decimal(c[1]), new Decimal(0));
  test.deepEqual(d, div.node());
  test.end();
});

tape("zoom.translateBy arguments can be functions passed (datum, index)", function(test) {
  div.call(zoom.transform, identity);
  let a, b, c, d;
  div.call(zoom.translateBy,
    function() { a = arguments; b = this; return new Decimal(2); },
    function() { c = arguments; d = this; return new Decimal(3); }
  );
  test.deepEqual(div.node().__zoom, { k: new Decimal(1), x: new Decimal(2), y: new Decimal(3) });
  test.deepEqual(a[0], "hello");
  test.deepEqual(a[1], 0);
  test.deepEqual(b, div.node());
  test.deepEqual(c[0], "hello");
  test.deepEqual(c[1], 0);
  test.deepEqual(d, div.node());
  test.end();
});


tape("zoom.constrain receives (transform, extent, translateExtent)", function(test) {
  div.call(zoom.transform, identity);
  const constrain = zoom.constrain();
  let a, b;
  zoom.constrain(function() {
    a = arguments;
    return b = constrain.apply(this, arguments);
  });
  div.call(zoom.translateBy, new Decimal(10), new Decimal(10));
  test.deepEqual(a[0], b);
  test.deepEqual(a[0], { k: new Decimal(1), x: new Decimal(10), y: new Decimal(10) });
  test.deepEqual(a[1], [ [ new Decimal(0), new Decimal(0) ], [ new Decimal(0), new Decimal(0) ] ]);
  test.equal(a[2][0][0], -Infinity);
  zoom.constrain(constrain);
  test.end();
});
