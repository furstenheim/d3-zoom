export function Transform(k, x, y) {
  this.k = k;
  this.x = x;
  this.y = y;
}

import {Decimal} from 'decimal.js'
const zero = new Decimal(0)
const one = new Decimal(1)
Transform.prototype = {
  constructor: Transform,
  scale: function(k) {
    return k.equals(one) ? this : new Transform(this.k.mul(k), this.x, this.y);
  },
  translate: function(x, y) {
    return x.equals(zero) && y.equals(zero) ? this : new Transform(this.k, this.x.add(this.k.mul( x)), this.y.add(this.k.mul(y)));
  },
  apply: function(point) {
    return [(point[0].mul(this.k)).add(this.x), (point[1].mul(this.k)).add(this.y)];
  },
  applyX: function(x) {
    return (x.mul(this.k)).add(this.x);
  },
  applyY: function(y) {
    return (y.mul(this.k)).add(this.y);
  },
  invert: function(location) {
    return [location[0].minus(this.x).div(this.k), location[1].minus(this.y).div(this.k)];
  },
  translateAtCoordinateSpace: function (location) {
    return [location[0].minus(this.x), location[1].minus(this.y)];
  },
  invertX: function(x) {
    return (x.minus(this.x)).div(this.k);
  },

  invertY: function(y) {
    return (y.minus(this.y)).div(this.k);
  },
  rescaleX: function(x) {
    return x.copy().domain(x.range().map(this.invertX, this).map(x.invert, x));
  },
  rescaleY: function(y) {
    return y.copy().domain(y.range().map(this.invertY, this).map(y.invert, y));
  },
  toString: function() {
    return "translate(" + this.x.toString() + "," + this.y.toString() + ") scale(" + this.k.toString() + ")";
  }
};

export var identity = new Transform(new Decimal(1), new Decimal(0), new Decimal(0));

transform.prototype = Transform.prototype;

export default function transform(node) {
  while (!node.__zoom) if (!(node = node.parentNode)) return identity;
  return node.__zoom;
}
