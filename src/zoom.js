import {dispatch} from "d3-dispatch";
import {dragDisable, dragEnable} from "d3-drag";
import {interpolateZoom} from "d3-interpolate";
import {select, pointer} from "d3-selection";
import {interrupt} from "d3-transition";
import constant from "./constant.js";
import ZoomEvent from "./event.js";
import {Transform, identity} from "./transform.js";
import noevent, {nopropagation} from "./noevent.js";
import {Decimal} from 'small-decimal'
// Ignore right-click, since that should open the context menu.
// except for pinch-to-zoom, which is sent as a wheel+ctrlKey event
function defaultFilter(event) {
  return (!event.ctrlKey || event.type === 'wheel') && !event.button;
}

function defaultExtent() {
  var e = this;
  if (e instanceof SVGElement) {
    e = e.ownerSVGElement || e;
    if (e.hasAttribute("viewBox")) {
      e = e.viewBox.baseVal;
      return [[new Decimal(e.x), new Decimal(e.y)], [new Decimal(e.x + e.width), new Decimal(e.y + e.height)]];
    }
    return [[new Decimal(0), new Decimal(0)], [new Decimal(e.width.baseVal.value), new Decimal(e.height.baseVal.value)]];
  }
  return [[new Decimal(0), new Decimal(0)], [new Decimal(e.clientWidth), new Decimal(e.clientHeight)]];
}

function defaultTransform() {
  return this.__zoom || identity;
}

function defaultWheelDelta(event) {
  return -event.deltaY * (event.deltaMode === 1 ? 0.05 : event.deltaMode ? 1 : 0.002) * (event.ctrlKey ? 10 : 1);
}

function defaultTouchable() {
  return navigator.maxTouchPoints || ("ontouchstart" in this);
}

function defaultConstrain(transform, extent, translateExtent) {
  var dx0 = transform.invertX(extent[0][0]).sub(translateExtent[0][0]),
      dx1 = transform.invertX(extent[1][0]).sub(translateExtent[1][0]),
      dy0 = transform.invertY(extent[0][1]).sub(translateExtent[0][1]),
      dy1 = transform.invertY(extent[1][1]).sub(translateExtent[1][1]);
  return transform.translate(
    dx1.greaterThan(dx0) ? dx0.add(dx1).div(new Decimal(2)) : (dx0.lessThan(new Decimal(0)) ? dx0 : Decimal.max(dx1, new Decimal(0))),
    dy1.greaterThan(dy0) ? dy0.add(dy1).div(new Decimal(2)) : (dy0.lessThan(new Decimal(0)) ? dy0 : Decimal.max(new Decimal(0), dy1))
  );
}

export default function() {
  var filter = defaultFilter,
      extent = defaultExtent,
      constrain = defaultConstrain,
      wheelDelta = defaultWheelDelta,
      touchable = defaultTouchable,
      scaleExtent = [0, Infinity],
      translateExtent = [[-Infinity, -Infinity], [Infinity, Infinity]],
      duration = 250,
      interpolate = interpolateZoom,
      listeners = dispatch("start", "zoom", "zoom-suggest", "end"),
      touchstarting,
      touchfirst,
      touchending,
      touchDelay = 500,
      wheelDelay = 150,
      clickDistance2 = 0,
      tapDistance = 10;

  function zoom(selection) {
    selection
        .property("__zoom", defaultTransform)
        .on("wheel.zoom", wheeled)
        .on("mousedown.zoom", mousedowned)
        .on("dblclick.zoom", dblclicked)
      .filter(touchable)
        .on("touchstart.zoom", touchstarted)
        .on("touchmove.zoom", touchmoved)
        .on("touchend.zoom touchcancel.zoom", touchended)
        .style("-webkit-tap-highlight-color", "rgba(0,0,0,0)");
  }

  zoom.transform = function(collection, transform, point, event) {
    var selection = collection.selection ? collection.selection() : collection;
    selection.property("__zoom", defaultTransform);
    if (collection !== selection) {
      schedule(collection, transform, point, event);
    } else {
      selection.interrupt().each(function() {
        gesture(this, arguments)
          .event(event)
          .start()
          .zoom(null, typeof transform === "function" ? transform.apply(this, arguments) : transform)
          .end();
      });
    }
  };

  zoom.scaleBy = function(selection, k, p, event) {
    zoom.scaleTo(selection, function() {
      var k0 = this.__zoom.k,
          k1 = typeof k === "function" ? k.apply(this, arguments) : k;
      return k0.mul(k1);
    }, p, event);
  };

  zoom.scaleTo = function(selection, k, p, event) {
    zoom.transform(selection, function() {
      var e = extent.apply(this, arguments),
          t0 = this.__zoom,
          p0 = p == null ? centroid(e) : typeof p === "function" ? p.apply(this, arguments) : p,
          p1 = t0.invert(p0),
          k1 = typeof k === "function" ? k.apply(this, arguments) : k;
      return constrain(translate(lowerScale(t0, k1), p0, p1), e, translateExtent);
    }, p, event);
  };

  zoom.translateBy = function(selection, x, y, event) {
    zoom.transform(selection, function() {
      return constrain(this.__zoom.translate(
        typeof x === "function" ? x.apply(this, arguments) : x,
        typeof y === "function" ? y.apply(this, arguments) : y
      ), extent.apply(this, arguments), translateExtent);
    }, null, event);
  };

  zoom.translateTo = function(selection, x, y, p, event) {
    zoom.transform(selection, function() {
      var e = extent.apply(this, arguments),
          t = this.__zoom,
          p0 = p == null ? centroid(e) : typeof p === "function" ? p.apply(this, arguments) : p;
      return constrain(identity.translate(p0[0], p0[1]).scale(t.k).translate(
        typeof x === "function" ? x.apply(this, arguments).neg() : x.neg(),
        typeof y === "function" ? y.apply(this, arguments).neg() : y.neg()
      ), e, translateExtent);
    }, p, event);
  };

  function scale(transform, k) {
    k = Decimal.max(new Decimal(scaleExtent[0]), Decimal.min(new Decimal(scaleExtent[1]), k));
    return k.equals(transform.k) ? transform : new Transform(k, transform.x, transform.y);
  }

  function lowerScale(transform, k) {
    k = Decimal.max(new Decimal(scaleExtent[0]), k);
    return k.equals(transform.k) ? transform : new Transform(k, transform.x, transform.y);
  }

  function translate(transform, p0, p1) {
    var x = p0[0].sub(p1[0].mul(transform.k)), y = p0[1].sub(p1[1].mul(transform.k));
    return x.equals(transform.x) && y.equals(transform.y) ? transform : new Transform(transform.k, x, y);
  }

  function translateCoordinateSpace(transform, p0, p1, p2, scaleFactor) {
    var x = p0[0].sub(p2[0].mul(scaleFactor)), y = p0[1].sub(p2[1].mul(scaleFactor));
    return x.equals(transform.x) && y.equals(transform.y) ? transform : new Transform(transform.k, x, y);
  }

  function centroid(extent) {
    return [extent[0][0].add(extent[1][0]).div(new Decimal(2)), extent[0][1].add(extent[1][1]).div(new Decimal(2))];
  }

  function schedule(transition, transform, point, event) {
    transition
        .on("start.zoom", function() { gesture(this, arguments).event(event).start(); })
        .on("interrupt.zoom end.zoom", function() { gesture(this, arguments).event(event).end(); })
        .tween("zoom", function() {
          var that = this,
              args = arguments,
              g = gesture(that, args).event(event),
              e = extent.apply(that, args),
              p = point == null ? centroid(e) : typeof point === "function" ? point.apply(that, args) : point,
              w = Math.max(e[1][0] - e[0][0], e[1][1] - e[0][1]),
              a = that.__zoom,
              b = typeof transform === "function" ? transform.apply(that, args) : transform,
              i = interpolate(a.invert(p).concat(w / a.k), b.invert(p).concat(w / b.k));
          return function(t) {
            if (t === 1) t = b; // Avoid rounding error on end.
            else { var l = i(t), k = w / l[2]; t = new Transform(k, p[0] - l[0] * k, p[1] - l[1] * k); }
            g.zoom(null, t);
          };
        });
  }

  function gesture(that, args, clean) {
    return (!clean && that.__zooming) || new Gesture(that, args);
  }

  function Gesture(that, args) {
    this.that = that;
    this.args = args;
    this.active = 0;
    this.sourceEvent = null;
    this.extent = extent.apply(that, args);
    this.taps = 0;
  }

  Gesture.prototype = {
    event: function(event) {
      if (event) this.sourceEvent = event;
      return this;
    },
    start: function() {
      if (++this.active === 1) {
        this.that.__zooming = this;
        this.emit("start");
      }
      return this;
    },
    zoom: function(key, transform) {
      if (this.mouse && key !== "mouse") {this.mouse[1] = transform.invert(this.mouse[0]); this.mouse[2] = transform.translateAtCoordinateSpace(this.mouse[0])}
      // if (this.touch0 && key !== "touch") this.touch0[1] = transform.invert(this.touch0[0]);
      // if (this.touch1 && key !== "touch") this.touch1[1] = transform.invert(this.touch1[0]);

      this.that.__zoom = transform;

      if (key === "touch") {
        this.emit("zoom-suggest")
        return this
      }

      // console.log('emitting')
      this.emit("zoom");
      return this;
    },
    end: function() {
      if (--this.active === 0) {
        delete this.that.__zooming;
        this.emit("end");
      }
      return this;
    },
    emit: function(type) {
      var d = select(this.that).datum();
      listeners.call(
        type,
        this.that,
        new ZoomEvent(type, {
          sourceEvent: this.sourceEvent,
          target: zoom,
          type,
          transform: this.that.__zoom,
          dispatch: listeners
        }),
        d
      );
    }
  };

  function wheeled(event, ...args) {
    if (!filter.apply(this, arguments)) return;
    var g = gesture(this, args).event(event),
        t = this.__zoom,
        scaleFactorCandidate = new Decimal(2 ** (wheelDelta.apply(this, arguments))),
        k = Decimal.max(new Decimal(scaleExtent[0]), t.k.mul(scaleFactorCandidate)),
        pRaw = pointer(event),
        p = [new Decimal(pRaw[0]), new Decimal(pRaw[1])];

    // If the mouse is in the same location as before, reuse it.
    // If there were recent wheel events, reset the wheel idle timeout.
    if (g.wheel) {
/*
      if (g.mouse[0][0] !== pRaw[0] || g.mouse[0][1] !== pRaw[1]) {
      }
*/
      g.mouse[1] = t.invert(g.mouse[0] = p);
      g.mouse[2] = t.translateAtCoordinateSpace(g.mouse[0]);
      clearTimeout(g.wheel);
    }

    // If this wheel event won’t trigger a transform change, ignore it.
    else if (t.k === k) return;

    // Otherwise, capture the mouse point and location at the start.
    else {
      g.mouse = [p, t.invert(p), t.translateAtCoordinateSpace(p)];
      interrupt(this);
      g.start();
    }

    noevent(event);
    g.wheel = setTimeout(wheelidled, wheelDelay);
    const previousK = t.k
    const scaled = lowerScale(t, k)
    let scaleFactor
    if (scaled.k.lessThan(new Decimal(5))) {
      scaleFactor = scaled.k.div(previousK)
    } else {
      scaleFactor = scaleFactorCandidate
    }
    g.zoom("mouse", constrain(translateCoordinateSpace(scaled, g.mouse[0], g.mouse[1], g.mouse[2], scaleFactor), g.extent, translateExtent));

    function wheelidled() {
      g.wheel = null;
      g.end();
    }
  }

  function mousedowned(event, ...args) {
    // if (touchending || !filter.apply(this, arguments)) return;
    var g = gesture(this, args, true).event(event),
        v = select(event.view).on("mousemove.zoom", mousemoved, true).on("mouseup.zoom", mouseupped, true),
        pRaw = pointer(event, currentTarget),
        p = [new Decimal(pRaw[0]), new Decimal(pRaw[1])],
        currentTarget = event.currentTarget,
        x0 = new Decimal(event.clientX),
        y0 = new Decimal(event.clientY);

    dragDisable(event.view);
    nopropagation(event);
    g.mouse = [p, null, this.__zoom.translateAtCoordinateSpace(p)];
    interrupt(this);
    g.start();

    function mousemoved(event) {
      noevent(event);
      if (!g.moved) {
        var dx = new Decimal(event.clientX).sub(x0), dy = new Decimal(event.clientY).sub(y0);
        g.moved = dx.mul(dx).add(dy.mul(dy)).greaterThan(clickDistance2);
      }
      var endRaw = pointer(event, currentTarget)
      var endDec = [new Decimal(endRaw[0]), new Decimal(endRaw[1])]
      g.event(event)
       .zoom("mouse", constrain(translateCoordinateSpace(g.that.__zoom, g.mouse[0] = endDec, null, g.mouse[2], new Decimal(1)), g.extent, translateExtent));
    }

    function mouseupped(event) {
      v.on("mousemove.zoom mouseup.zoom", null);
      dragEnable(event.view, g.moved);
      noevent(event);
      g.event(event).end();
    }
  }

  function dblclicked(event, ...args) {
    if (!filter.apply(this, arguments)) return;
    var t0 = this.__zoom,
        p0Raw = pointer(event.changedTouches ? event.changedTouches[0] : event, this),
        p0 = [new Decimal(p0Raw[0]), new Decimal(p0Raw[1])],
        p1 = t0.invert(p0),
        k1 = t0.k.mul(event.shiftKey ? new Decimal(0.5) : new Decimal(2)),
        t1 = constrain(translate(scale(t0, k1), p0, p1), extent.apply(this, args), translateExtent);

    noevent(event);
    if (duration > 0) select(this).transition().duration(duration).call(schedule, t1, p0, event);
    else select(this).call(zoom.transform, t1, p0, event);
  }

  function touchstarted(event, ...args) {
    if (!filter.apply(this, arguments)) return;
    var touches = event.touches,
        n = touches.length,
        g = gesture(this, args, event.changedTouches.length === n).event(event),
        started, i, t, p;

    nopropagation(event);
    // console.log('touchstart assigning')
    for (i = 0; i < n; ++i) {
      t = touches[i], p = pointer(t, this);
      p = [p, p, t.identifier, this.__zoom];
      if (!g.touch0) g.touch0 = p, started = true, g.taps = 1 + !!touchstarting;
      else if (!g.touch1 && g.touch0[2] !== p[2]) {
        g.touch1 = p, g.taps = 0;
        // console.log('assiging second finger')
      }
    }

    if (touchstarting) touchstarting = clearTimeout(touchstarting);

    if (started) {
      if (g.taps < 2) touchfirst = p[0], touchstarting = setTimeout(function() { touchstarting = null; }, touchDelay);
      interrupt(this);
      g.start();
    }
  }

  function touchmoved(event, ...args) {
    if (!this.__zooming) return;
    var g = gesture(this, args).event(event),
        touches = event.changedTouches,
        n = touches.length, i, t, p, l;

    // console.log('touchmoved', touches, g.touch0, g.touch1)
    noevent(event);
    for (i = 0; i < n; ++i) {
      t = touches[i], p = pointer(t, this);

      if (g.touch0 && g.touch0[2] === t.identifier) {
        // console.log('reassigning first touch')

        g.touch0[0] = p;
      } else if (g.touch1 && g.touch1[2] === t.identifier) {
        // console.log('reassigning second touch')
        g.touch1[0] = p;
      }
    }
    t = g.that.__zoom;
    var scaleFactor
    if (g.touch1) {
      var p0 = g.touch0[0], l0 = g.touch0[1],
          p1 = g.touch1[0], l1 = g.touch1[1],
          dp = (dp = p1[0] - p0[0]) * dp + (dp = p1[1] - p0[1]) * dp,
          dl = (dl = l1[0] - l0[0]) * dl + (dl = l1[1] - l0[1]) * dl;
      // console.log('scale factor candidate', Math.sqrt(dp / dl))
      var scaleFactorCandidate = new Decimal(Math.sqrt(dp / dl))
      var originalK = g.touch0[3].k
      t = lowerScale(t, originalK.mul(scaleFactorCandidate));
      if (t.k.lessThan(new Decimal(5))) {
        scaleFactor = t.k.div(originalK)
      } else {
        scaleFactor = scaleFactorCandidate
      }

      p = [new Decimal((p0[0] + p1[0]) / 2), new Decimal((p0[1] + p1[1]) / 2)];
      l = [new Decimal((l0[0] + l1[0]) / 2).sub(g.touch0[3].x), new Decimal((l0[1] + l1[1]) / 2).sub(g.touch0[3].y)];
    }
    else if (g.touch0) p = [new Decimal(g.touch0[0][0]), new Decimal(g.touch0[0][1])], l = [new Decimal(g.touch0[1][0]).sub(g.touch0[3].x), new Decimal(g.touch0[1][1]).sub(g.touch0[3].y)], scaleFactor = new Decimal(1);
    else return;

    // console.log('scale factor', scaleFactor.toNumber())
    // console.log('settingtouchmoved', !!g.touch1)
    this.__touchmoved = constrain(translateCoordinateSpace(t, p, null, l, scaleFactor), g.extent, translateExtent)
    g.zoom("touch", this.__touchmoved)
  }

  function touchended(event, ...args) {
    if (!this.__zooming) return;


    var g = gesture(this, args).event(event),
        touches = event.changedTouches,
        n = touches.length, i, t;
    // console.log('touchend')
    g.zoom("touchend", this.__touchmoved)
    nopropagation(event);
    delete g.touch0
    delete g.touch1
    return

  }

  zoom.wheelDelta = function(_) {
    return arguments.length ? (wheelDelta = typeof _ === "function" ? _ : constant(+_), zoom) : wheelDelta;
  };

  zoom.filter = function(_) {
    return arguments.length ? (filter = typeof _ === "function" ? _ : constant(!!_), zoom) : filter;
  };

  zoom.touchable = function(_) {
    return arguments.length ? (touchable = typeof _ === "function" ? _ : constant(!!_), zoom) : touchable;
  };

  zoom.extent = function(_) {
    return arguments.length ? (extent = typeof _ === "function" ? _ : constant([[+_[0][0], +_[0][1]], [+_[1][0], +_[1][1]]]), zoom) : extent;
  };

  zoom.scaleExtent = function(_) {
    return arguments.length ? (scaleExtent[0] = +_[0], scaleExtent[1] = +_[1], zoom) : [scaleExtent[0], scaleExtent[1]];
  };

  zoom.translateExtent = function(_) {
    return arguments.length ? (translateExtent[0][0] = +_[0][0], translateExtent[1][0] = +_[1][0], translateExtent[0][1] = +_[0][1], translateExtent[1][1] = +_[1][1], zoom) : [[translateExtent[0][0], translateExtent[0][1]], [translateExtent[1][0], translateExtent[1][1]]];
  };

  zoom.constrain = function(_) {
    return arguments.length ? (constrain = _, zoom) : constrain;
  };

  zoom.duration = function(_) {
    return arguments.length ? (duration = +_, zoom) : duration;
  };

  zoom.interpolate = function(_) {
    return arguments.length ? (interpolate = _, zoom) : interpolate;
  };

  zoom.on = function() {
    var value = listeners.on.apply(listeners, arguments);
    return value === listeners ? zoom : value;
  };

  zoom.clickDistance = function(_) {
    return arguments.length ? (clickDistance2 = (_ = +_) * _, zoom) : Math.sqrt(clickDistance2);
  };

  zoom.tapDistance = function(_) {
    return arguments.length ? (tapDistance = +_, zoom) : tapDistance;
  };

  return zoom;
}
