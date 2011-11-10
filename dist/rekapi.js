/**
 * Rekapi - Rewritten Kapi. v0.1.8
 *   By Jeremy Kahn - jeremyckahn@gmail.com
 *   https://github.com/jeremyckahn/rekapi
 *
 * Make fun keyframe animations with JavaScript.
 * Dependencies: Underscore.js (https://github.com/documentcloud/underscore), Shifty.js (https://github.com/jeremyckahn/shifty)
 * MIT Lincense.  This code free to use, modify, distribute and enjoy.
 */
;(function rekapiCore (global) {
  
  if (!_) {
    throw 'underscore.js is required for Kapi.';
  }
  
  if (!Tweenable) {
    throw 'shifty.js is required for Kapi.';
  }
  
  var gk
      ,defaultConfig
      ,now
      ,playState;
  
  
  /**
   * Sorts an array numerically, from smallest to largest.
   * @param {Array} array The Array to sort.
   * @returns {Array} The sorted Array.
   */
  function sortNumerically (array) {
    return array.sort(function (a, b) {
      return a - b;
    });
  }
  
  
  /**
   * Determines which iteration of the loop the animation is currently in.
   * @param {Kapi} kapi
   * @param {number} timeSinceStart
   */
  function determineCurrentLoopIteration (kapi, timeSinceStart) {
    var currentIteration;
    
    currentIteration = Math.floor((timeSinceStart) / kapi._animationLength);
    return currentIteration;
  }
  
  
  /**
   * Calculate how many milliseconds since the animation began.
   * @param {Kapi} kapi
   * @returns {number}
   */
  function calculateTimeSinceStart (kapi) {
    var timeSinceStart;

    timeSinceStart = now() - kapi._loopTimestamp;
    return timeSinceStart;
  }
  
  
  /**
   * Determines is the animation is complete or not.
   * @param {Kapi} kapi
   * @param {number} currentLoopIteration
   */
  function isAnimationComplete (kapi, currentLoopIteration) {
    return currentLoopIteration >= kapi._timesToIterate
        && kapi._timesToIterate !== -1;
  }
  
  
  /**
   * Stops the animation if the animation is complete.
   * @param {Kapi} kapi
   * @param {number} currentLoopIteration
   */
  function updatePlayState (kapi, currentLoopIteration) {
    if (isAnimationComplete(kapi, currentLoopIteration)) {
      kapi.stop();
    }
  }
  
  
  /**
   * Calculate how far in the animation loop `kapi` is, in milliseconds, based 
   * on the current time.  Also overflows into a new loop if necessary.
   * @param {Kapi} kapi
   * @returns {number}
   */
  function calculateLoopPosition (kapi, forMillisecond, currentLoopIteration) {
    var currentLoopPosition;
    
    if (isAnimationComplete(kapi, currentLoopIteration)) {
      currentLoopPosition = kapi._animationLength;
    } else {
      currentLoopPosition = forMillisecond % kapi._animationLength;
    }
    
    return currentLoopPosition;
  }
  
  
  /**
   * Calculate the position and state for a given millisecond and render it.
   * Also updates the state internally and accounts for how many loop 
   * iterations the animation runs for.
   * @param {Kapi} kapi
   * @param {number} forMillisecond The millisecond to render
   */
  function renderMillisecond (kapi, forMillisecond) {
    var currentIteration
        ,loopPosition;
    
    currentIteration = determineCurrentLoopIteration(kapi, forMillisecond);
    loopPosition = calculateLoopPosition(kapi, forMillisecond,
        currentIteration);
    updatePlayState(kapi, currentIteration);
    kapi.render(loopPosition);
  }
  
  
  /**
   * Calculate how far in the animation loop `kapi` is, in milliseconds, and
   * render based on that time.
   * @param {Kapi} kapi
   */
  function renderCurrentMillisecond (kapi) {
    renderMillisecond(kapi, calculateTimeSinceStart(kapi));
  }
  
  
  /**
   * This is the heartbeat of an animation.  Renders a frame and then calls
   * itself based on the framerate of the supplied Kapi.
   * @param {Kapi} kapi
   */
  function tick (kapi) {
    kapi._loopId = setTimeout(function () {
      // First, scedule the next update.  renderCurrentMillisecond can cancel
      // the update if necessary.
      tick(kapi);
      renderCurrentMillisecond(kapi);
    }, 1000 / kapi.config.fps);
  }
  
  
  /**
   * Does nothing.  Absolutely nothing at all.
   */
  function noop () {
    // NOOP!
  }
  
  
  defaultConfig = {
    'fps': 30
    ,'height': 150
    ,'width': 300
  };
  
  playState = {
    'STOPPED': 'stopped'
    ,'PAUSED': 'paused'
    ,'PLAYING': 'playing'
  };
  
  now = Tweenable.util.now;
  
  /**
   * @param {HTMLCanvas} canvas
   * @param {Object} config
   * @param {Object} events
   * @returns {Kapi}
   */
  gk = global.Kapi || function Kapi (canvas, config, events) {
    this.canvas = canvas;
    this._context = canvas.getContext('2d');
    
    this.config = {};
    this._actors = {};
    this._drawOrder = [];
    this._playState = playState.STOPPED;

    // How many times to loop the animation before stopping.
    this._timesToIterate = -1;
    
    // Millisecond duration of the animation
    this._animationLength = 0;

    // The setTimeout ID of `tick`
    this._loopId = null;
    
    // The UNIX time at which the animation loop started
    this._loopTimestamp = null;
    
    
    // Used for maintaining position when the animation is paused. 
    this._pausedAtTime = null;
    
    // The last millisecond position that was drawn
    this._lastRenderedMillisecond = 0;
    
    _.extend(this.config, config);
    _.defaults(this.config, defaultConfig);
    
    // Apply the height and width if they were passed in the`config` Object.
    // Also delete them from the internal config - we won't need them anymore.
    _.each(['height', 'width'], function (dimension) {
      if (this.config[dimension]) {
        this['canvas_' + dimension](this.config[dimension]);
        delete this.config[dimension];
      }
    }, this);
    
    return this;
  };
  
  
  /**
   * Returns the length of the animation, in milliseconds.
   * @returns {number}
   */
  gk.prototype.animationLength = function () {
    return this._animationLength;
  };


  /**
   * Returns how many actors are currently in the animation.
   * @returns {number}
   */
  gk.prototype.actorCount = function () {
    return this._drawOrder.length;
  };


  /**
   * Get or sets the framterate.  This is the rate per second at which the
   * animation updates.
   * @param {number} opt_newFramerate The framerate to set
   * @returns {number} The current framerate
   */
  gk.prototype.framerate = function (opt_newFramerate) {
    if (opt_newFramerate) {
      this.config.fps = opt_newFramerate;
    }

    return this.config.fps;
  };
  
  
  /**
   * Render a given millisecond position inside the loop
   * @param {number} millisecond
   * @returns {Kapi}
   */
  gk.prototype.render = function (millisecond) {
    this.calculateActorPositions(millisecond);
    this.draw();
    this._lastRenderedMillisecond = millisecond;
    
    return this;
  };
  
  
  /**
   * Re-draws the millisecond position that was drawn.
   * @returns {Kapi}
   */
  gk.prototype.redraw = function () {
    this.render(this._lastRenderedMillisecond);
    
    return this;
  };
  
  
  /**
   * Updates the position (state) of all the actors.
   * @param {number} millisecond The position in the animation to "go" to.
   * @returns {Kapi}
   */
  gk.prototype.calculateActorPositions = function (millisecond) {
    var i, len;
        
    len = this._drawOrder.length;
    
    for (i = 0; i < len; i++) {
      this._actors[this._drawOrder[i]].calculatePosition(millisecond);
    }
    
    return this;
  };
  
  
  /**
   * Draws all the actors.
   * @returns {Kapi}
   */
  gk.prototype.draw = function () {
    var i, len
        ,currentActor
        ,canvas_context;
    
    this.canvas_clear();
    len = this._drawOrder.length;
    canvas_context = this.canvas_context();
    
    for (i = 0; i < len; i++) {
      currentActor = this._actors[this._drawOrder[i]];
      if (currentActor.isShowing()) {
        currentActor.draw(canvas_context, currentActor.get());
      }
    }
    
    return this;
  };
  
  
  /**
   * Performs a "refresh" of the internal state.
   * @returns {Kapi}
   */
  gk.prototype.updateInternalState = function () {
    var allKeyframeLists;
        
    allKeyframeLists = [0];
        
    _.each(this._drawOrder, function (i) {
      allKeyframeLists = allKeyframeLists.concat(allKeyframeLists,
          this._actors[i].keyframeList());
    }, this);
    
    this._animationLength = Math.max.apply(Math, allKeyframeLists);
    
    return this;
  };
  
  
  /**
   * Add an Actor to the Kapi.
   * @param {Kapi.Actor} actor
   * @param {Object} opt_initialState
   * @returns {Kapi}
   */
  gk.prototype.addActor = function (actor, opt_initialState) {
    // You can't add an actor more than once.
    if (!_.contains(this._actors, actor)) {
      actor.kapi = this;
      actor.fps = this.framerate();
      actor.set(opt_initialState || {});
      this._actors[actor.id] = actor;
      this._drawOrder.push(actor.id);
      actor.setup();
    }
    
    return this;
  };
  
  
  /**
   * Returns an Actor based on a given ID.
   * @param {number} actorId The Actor ID of the actor to fetch
   * @returns {Kapi.Actor}
   */
  gk.prototype.getActor = function (actorId) {
    return this._actors[actorId];
  };
  
  
  /**
   * Removes an Actor from the Kapi.
   * @param {Kapi.Actor} actor A reference to the Actor to remove.
   * @returns {Kapi}
   */
  gk.prototype.removeActor = function (actor) {
    delete this._actors[actor.id];
    delete actor.kapi;
    this._drawOrder = _.without(this._drawOrder, actor.id);
    actor.teardown();
    
    return this;
  };
  
  
  /**
   * Starts or resumes an animation.
   * @param {number} opt_howManyTimes How many times to loop the animation
   *    before stopping.
   * @returns {Kapi}
   */
  gk.prototype.play = function (opt_howManyTimes) {
    clearTimeout(this._loopId);
    
    if (this._playState === playState.PAUSED) {
      this._loopTimestamp += now() - this._pausedAtTime;
    } else {
      this._loopTimestamp = now();
    }
    
    this._timesToIterate = opt_howManyTimes || -1;
    this._playState = playState.PLAYING;
    tick(this);
    
    // also resume any shifty tweens that are paused.
    _.each(this._actors, function (actor) {
      if (actor._state.isPaused ) {
        actor.resume();
      }
    });

    return this;
  };
  
  
  /**
   * Pauses an animation.
   * @returns {Kapi}
   */
  gk.prototype.pause = function () {
    this._playState = playState.PAUSED;
    clearTimeout(this._loopId);
    this._pausedAtTime = now();
    
    // also pause any shifty tweens that are running.
    _.each(this._actors, function (actor) {
      if (actor._state.isTweening) {
        actor.pause();
      }
    });

    return this;
  };
  
  
  /**
   * Stops an animation completely.
   * @param {boolean} alsoClear Whether to also clear the canvas.
   * @returns {Kapi}
   */
  gk.prototype.stop = function (alsoClear) {
    this._playState = playState.STOPPED;
    clearTimeout(this._loopId);
    
    if (alsoClear === true) {
      this.canvas_clear();
    }

    // also kill any shifty tweens that are running.
    _.each(this._actors, function (actor) {
      actor.stop();
    });
    
    return this;
  };


  /**
   * Move an actor from one layer to another.  Higher layers are drawn later
   *    (on top of lower layers).
   * @param {Kapi.Actor} actor The actor to move within the list.
   * @param {number} layer The 0-based layer to move `actor` to.
   * @returns {Kapi.Actor|undefined} If successful, the actor is returned.  If
   *    the operation fails, `undefined` is returned.
   */
  gk.prototype.moveActorToLayer = function (actor, layer) {
    if (layer < this._drawOrder.length) {
      this._drawOrder = _.without(this._drawOrder, actor.id);
      this._drawOrder.splice(layer, 0, actor.id);

      return actor;
    }

    return undefined;
  };
  
  
  /**
   * Returns whether or not the animation is playing (meaning not paused or 
   * stopped).
   * @returns {boolean}
   */
  gk.prototype.isPlaying = function () {
    return this._playState === playState.PLAYING;
  };
  
  
  gk.util = {};
  
  _.extend(gk.util, {
    'noop': noop
    ,'sortNumerically': sortNumerically
  });
  
  // Some hooks for testing.
  if (typeof KAPI_DEBUG !== 'undefined' && KAPI_DEBUG === true) {
    gk._private = {
      'sortNumerically': sortNumerically
      ,'calculateLoopPosition': calculateLoopPosition
      ,'renderCurrentMillisecond': renderCurrentMillisecond
      ,'tick': tick
      ,'determineCurrentLoopIteration': determineCurrentLoopIteration
      ,'calculateTimeSinceStart': calculateTimeSinceStart
      ,'isAnimationComplete': isAnimationComplete
      ,'updatePlayState': updatePlayState
    }
  }
  
  global.Kapi = gk;
  
} (this));
;(function rekapiActor (global) {

  var DEFAULT_EASING = 'linear'
      ,gk
      ,actorCount
      ,ActorMethods;
  
  gk = global.Kapi;
  actorCount = 0;
  
  
  function getUniqueActorId () {
    return actorCount++;
  }
  
  
  /**
   * Finds the index of the keyframe that occurs for `millisecond`.
   * @param {Kapi.Actor} actor The actor to find the keyframe during which
   *    `millisecond` occurs.
   * @param {number} millisecond
   * @returns {number} The keyframe index for `millisecond`, or -1 if it was
   *    not found.
   */
  //TODO:  Oh noes, this is a linear search!  Maybe optimize it?
  function getKeyframeForMillisecond (actor, millisecond) {
    var i, len
        ,list;
    
    list = actor._keyframeList;
    len = list.length;
    
    for (i = 1; i < len; i++) {
      if (list[i] >= millisecond) {
        return (i - 1);
      }
    }
    
    return -1;
  }


  /**
   * Apply new values to an Object.  If the new value for a given property is
   * `null` or `undefined`, the property is deleted from the original Object.
   * @param {Object} targetObject The Object to modify.
   * @param {Object} augmentation The Object containing properties to modify
   *    `targetObject` with.
   */
  function augmentObject (targetObject, augmentation) {
    _.each(augmentation, function (newVal, name) {
      if (newVal === undefined || newVal === null) {
        delete targetObject[name];
      } else {
        targetObject[name] = newVal;
      }
    });
  }
  
  
  /**
   * `Kapi.Actor` constructor.  An Actor is an individual component of an
   * animation.
   * @param {Object} opt_config An Object that may contain the `setup, `draw`
   *    and `teardown` methods for the Actor.
   * @returns {Actor.Kapi}
   */
  gk.Actor = function Actor (opt_config) {
    
    opt_config = opt_config || {};
    
    // Steal the `Tweenable` constructor.
    this.constructor.call(this, {
      'initialState': opt_config.initialState
    });
    
    _.extend(this, {
      '_keyframes': {}
      ,'_keyframeList': []
      ,'_data': {}
      ,'_isShowing': false
      ,'_isPersisting': false
      ,'id': getUniqueActorId()
      ,'setup': opt_config.setup || gk.util.noop
      ,'draw': opt_config.draw || gk.util.noop
      ,'teardown': opt_config.teardown || gk.util.noop
    });
    
    return this;
  };


  // Kind of a fun way to set up an inheritance chain.  `ActorMethods` prevents
  // methods on `Actor.prototype` from polluting `Tweenable`'s prototype with
  // `Actor` specific methods.
  ActorMethods = function () {};
  ActorMethods.prototype = Tweenable.prototype;
  gk.Actor.prototype = new ActorMethods();
  // But the magic doesn't stop here!  `Actor`'s constructor steals the
  // `Tweenable` constructor.
  
  
  /**
   * Calculates and sets the Actor's position at a particular millisecond in the
   * animation.
   * @param {number} forMillisecond
   * @returns {Kapi.Actor}
   */
  gk.Actor.prototype.calculatePosition = function (forMillisecond) {
    //TODO: This function is too long!  It needs to be broken out somehow.
    var keyframeList
        ,keyframes
        ,delta
        ,interpolatedPosition
        ,startMs
        ,endMs
        ,timeRangeIndexStart
        ,rangeFloor
        ,rangeCeil;
        
    keyframeList = this._keyframeList;
    startMs = _.first(keyframeList);
    endMs = _.last(keyframeList);
    this.hide();

    if (startMs <= forMillisecond && forMillisecond <= endMs) {
      this.show();
      keyframes = this._keyframes;
      timeRangeIndexStart = getKeyframeForMillisecond(this, 
          forMillisecond);
      rangeFloor = keyframeList[timeRangeIndexStart];
      rangeCeil = keyframeList[timeRangeIndexStart + 1];
      delta = rangeCeil - rangeFloor;
      interpolatedPosition = (forMillisecond - rangeFloor) / delta;
      
      this
        .set(keyframes[keyframeList[timeRangeIndexStart]].position)
        .interpolate(keyframes[keyframeList[timeRangeIndexStart + 1]].position,
            interpolatedPosition,
            keyframes[keyframeList[timeRangeIndexStart + 1]].easing);
    }

    return this;
  };


  /**
   * Define a keyframe for an Actor.
   * @param {number} when
   * @param {Object} position
   * @param {string|Object} easing If this is a string, the easing is applied
   *    to all parameters of `position`.  You can also mix and match easings
   *    for each parameter. So:
   *  @codestart
   *    actor.keyframe(1000, {
   *      'x': 100
   *      ,'y': 100
   *    }, {
   *      'x': 'easeOutSine'
   *      ,'y': 'easeInSine'
   *    });
   *  @codeend
   * @returns {Kapi.Actor}
   */
  gk.Actor.prototype.keyframe = function keyframe (when, position, easing) {
    var originalEasingString;
    
    // This code will be used.  Other work needs to be done beforehand, though.
    if (!easing) {
      easing = DEFAULT_EASING;
    }
    
    if (typeof easing === 'string') {
      originalEasingString = easing;
      easing = {};
      _.each(position, function (positionVal, positionName) {
        easing[positionName] = originalEasingString;
      });
    }
    
    // If `easing` was passed as an Object, this will fill in any missing
    // easing properties with the default equation.
    _.each(position, function (positionVal, positionName) {
      easing[positionName] = easing[positionName] || DEFAULT_EASING;
    });
    
    this._keyframes[when] = {
      'position': position
      ,'easing': easing
    };
    this._keyframeList.push(when);
    gk.util.sortNumerically(this._keyframeList);
    this.kapi.updateInternalState();
    
    return this;
  };


  /**
   * Copies an existing keyframe into another keyframe.  If the original
   * keyframe is modified by Kapi.Actor.modifyKeyframe, then the copy is
   * modified as well.  If the original keyframe is deleted, the copy remains.
   * If the original keyframe is overwritten with Kapi.Actor.keyframe, then the
   * link between the frames is lost (although the copy remains as an
   * independant keyframe).
   * @param {number} when Where in the animation to make the new keyframe.
   * @param {number} source The "when" of the target keyframe to copy.
   * @returns {Kapi.Actor}
   */
  gk.Actor.prototype.liveCopy = function (when, source) {
    var sourceKeyframeData;

    if (this._keyframes.hasOwnProperty(source)) {
      sourceKeyframeData = this._keyframes[source];
      this.keyframe(when, sourceKeyframeData.position,
          sourceKeyframeData.easing);
    }

    return this;
  };


  /**
   * Augments the properties a preiexisting keyframe.
   * @param {number} when Which keyframe to modify, as identified by it's 
   * millisecond position in the animation.
   * @param {Object} stateModification The properties to augment the keyframe's
   *    state properties with.  If any properties in this Object are `null` or
   *    `undefined`, those state properties are deleted from the keyframe.
   * @param {Object} opt_easingModification The properties to augment the 
   *    individual property easings of the keyframe.  Works the same way as
   *    `stateModification`.
   */
  gk.Actor.prototype.modifyKeyframe = function (when, stateModification,
      opt_easingModification) {

    var targetKeyframe;

    targetKeyframe = this._keyframes[when];
    augmentObject(targetKeyframe.position, stateModification);

    if (opt_easingModification) {
      augmentObject(targetKeyframe.easing, opt_easingModification);
    }

    return this;
  };


  /**
   * Remove a keyframe set on the actor.
   * @param {when} when the millisecond to remove the keyframe from.
   * @returns {Kapi.Actor}
   */
  gk.Actor.prototype.removeKeyframe = function (when) {
    if (this._keyframeList.indexOf(when) !== -1) {
      this._keyframeList = _.without(this._keyframeList, when);
      delete this._keyframes[when];
      this.kapi.updateInternalState();
    }

    return this;
  };


  /**
   * Removes all keyframes set on the actor.
   * @returns {Kapi.Actor}
   */
  gk.Actor.prototype.removeAllKeyframes = function () {
    var keyframeListCopy;

    keyframeListCopy = this._keyframeList.slice(0);

    _.each(keyframeListCopy, function (when) {
      this.removeKeyframe(when);
    }, this);

    return this;
  };
  
  
  /**
   * Move this Actor to another layer in the owner Kapi isntance.
   * @param {number} layer The 0-based layer to move to.
   * @returns {Kapi.Actor|undefined} If successful, the actor is returned.  If
   *    the operation fails, `undefined` is returned.
   */
  gk.Actor.prototype.moveToLayer = function (layer) {
    return this.kapi.moveActorToLayer(this, layer);
  };


  gk.Actor.prototype.show = function (alsoPersist) {
    this._isShowing = true;
    this._isPersisting = !!alsoPersist;
    
    return this;
  };
  
  
  gk.Actor.prototype.hide = function (alsoUnpersist) {
    this._isShowing = false;

    if (alsoUnpersist === true) {
      this._isPersisting = false;
    }
    
    return this;
  };
  
  
  gk.Actor.prototype.isShowing = function () {
    return this._isShowing || this._isPersisting;
  };


  /**
   * Exposes the Actor's ordered list of keyframe times.
   * @returns {Array}
   */
  gk.Actor.prototype.keyframeList = function () {
    return this._keyframeList;
  };


  gk.Actor.prototype.data = function (opt_newData) {
    if (opt_newData) {
      this._data = opt_newData;
    }

    return this._data;
  };


  /**
   * Start Shifty interoperability methods...
   ******/

  _.each(['tween', 'to'], function (shiftyMethodName) {
    gk.Actor.prototype[shiftyMethodName] = function () {
      this.show(true);
      Tweenable.prototype[shiftyMethodName].apply(this, arguments);
    }
  }, this);

  /******
   * ...End Shifty interoperability methods.
   */

} (this));
;(function rekapiCanvas (global) {

  var gk;
  
  gk = global.Kapi;
  
  
  /**
   * Gets (and optionally sets) a style on a canvas.
   * @param {HTMLCanvas} canvas
   * @param {string} dimension The dimension (either "height" or "width") to
   *    get or set.
   * @param {number} opt_new_size The new value to set for `dimension`.
   */
  function canvas_dimension (canvas, dimension, opt_new_size) {
    if (typeof opt_new_size !== 'undefined') {
      canvas[dimension] = opt_new_size;
      canvas.style[dimension] = opt_new_size + 'px';
    }
    
    return canvas[dimension];
  }
  

  /**
   * Get and/or set the height of the canvas.
   * @param {number} opt_height
   * @returns {number} The height of the canvas
   */
  gk.prototype.canvas_height = function (opt_height) {
    return canvas_dimension(this.canvas, 'height', opt_height);
  };
  
  
  /**
   * Get and/or set the width of the canvas.
   * @param {number} opt_width
   * @returns {number} The width of the canvas
   */
  gk.prototype.canvas_width = function (opt_width) {
    return canvas_dimension(this.canvas, 'width', opt_width);
  };
  
  
  /**
   * Get (and optionally set) a style on the Kapi canvas.
   * @param {string} styleName
   * @param {number|string} opt_styleValue The value to set for `styleName`
   * @return {number|string} The current value of `styleName`
   */
  gk.prototype.canvas_style = function (styleName, opt_styleValue) {
    if (typeof opt_styleValue !== 'undefined') {
      this.canvas.style[styleName] = opt_styleValue;
    }
    
    return this.canvas.style[styleName];
  }
  
  
  /**
   * Erases the canvas.
   * @returns {Kapi}
   */
  gk.prototype.canvas_clear = function () {
    this.canvas_context().clearRect(0, 0, this.canvas_width(),
        this.canvas_height());
    
    return this;
  };
  
  
  /**
   * Gets the 2d context of the Kapi's canvas.
   * @returns {CanvasRenderingContext2D}
   */
  gk.prototype.canvas_context = function () {
    return this._context;
  };

} (this));
/*global setTimeout:true, clearTimeout:true */

;(function rekapiInterpolate (global) {
  
  var gk;
  
  gk = global.Kapi;
  
  function getInterpolatedValues (from, current, to, position, easing) {
    
    var R_COLOR_COMPONENT = /^(__r__|__g__|__b__)/
        ,interpolatedValues;
    
    interpolatedValues = {};
    
    _.each(from, function (val, name) {
      
      var easingFunc;
      
      if (name.match(R_COLOR_COMPONENT)) {
        // The call to `.slice` removes the __color__ prefix that was
        // put there by Shifty.  This causes non-modified color property's
        // easing to be used.
        easingFunc = Tweenable.prototype.formula[easing[name.slice(5)]];
      } else {
        easingFunc = Tweenable.prototype.formula[easing[name]];
      }
      
      if (typeof to[name] !== 'undefined') {
        interpolatedValues[name] = global.Tweenable.util.tweenProp(
            from[name]
            ,to[name]
            ,easingFunc
            ,position);
      }

    });
    
    return interpolatedValues;
  }

  
  function interpolate (from, to, position, easing) {
    var current,
      interpolatedValues;
    
    current = global.Tweenable.util.simpleCopy({}, from);
    
    // Call any data type filters
    global.Tweenable.util.applyFilter('tweenCreated', current, 
        [current, from, to]);
    global.Tweenable.util.applyFilter('beforeTween', current, 
        [current, from, to]);
    interpolatedValues = getInterpolatedValues(
        from, current, to, position, easing);
    global.Tweenable.util.applyFilter('afterTween', interpolatedValues, 
        [interpolatedValues, from, to]);
    
    return interpolatedValues;
  }
  
  
  gk.Actor.prototype.interpolate = function (to, position, easing) {
    var interpolatedValues;
    
    interpolatedValues = interpolate(this.get(), to, position, easing);
    this.set(interpolatedValues);
    
    return interpolatedValues;
  };
  
}(this));
