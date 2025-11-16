/**
 * Interval Timer helper extracted from the open-source `interval-timer`
 * package (MIT License, https://www.npmjs.com/package/interval-timer).
 * The original source has been adapted for the browser (EventTarget only)
 * and exported through the global `window.IntervalTimerLib`.
 */
(function () {
  function createEventHub() {
    if (typeof document !== 'undefined' && document.createElement) {
      return document.createElement('span');
    }
    return null;
  }

  function pad(padString, string, padLeft) {
    if (typeof string === 'undefined') return padString;
    if (padLeft) {
      return (padString + string).slice(-padString.length);
    }
    return (string + padString).substring(0, padString.length);
  }

  class Timer {
    constructor(options = {}) {
      this.startTime = 0;
      this.endTime = null;
      this.updateFrequency = 100;
      this.selfAdjust = true;
      this.countdown = false;
      this.animationFrame = false;
      this._timer = null;
      this._startTime = 0;
      this._timeAtStart = 0;
      this._currentTime = 0;
      this._expected = 0;
      this._drift = 0;
      this._isRunning = false;
      this._isPaused = false;
      this._eventEmitter = createEventHub();
      this.on = this.addEventListener;
      this.off = this.removeEventListener;

      Object.assign(this, options);
    }

    _instance() {
      this._isRunning = true;
      this._currentTime = this.countdown
        ? this._timeAtStart - new Date() + this._startTime
        : new Date() - this._timeAtStart + this._startTime;

      if (this.selfAdjust && !this.animationFrame) {
        this._drift = this.countdown
          ? this._expected - this._currentTime
          : this._currentTime - this._expected;
      }

      const reachedEnd = this.countdown
        ? (this.endTime !== null && this._currentTime <= this.endTime) ||
          this._currentTime <= 0
        : this.endTime !== null && this._currentTime >= this.endTime;

      if (reachedEnd) {
        this._currentTime = this.endTime;
        this._isRunning = false;
        this.dispatchEvent('update', this);
        this.dispatchEvent('end', this);
        return;
      }

      this.dispatchEvent('update', this);

      this.countdown
        ? (this._expected -= this.updateFrequency)
        : (this._expected += this.updateFrequency);

      this._timer = this.animationFrame
        ? requestAnimationFrame(() => this._instance())
        : setTimeout(
            () => this._instance(),
            this.selfAdjust
              ? Math.max(0, this.updateFrequency - this._drift)
              : this.updateFrequency
          );
    }

    start(options = {}) {
      if (this._isRunning) return;

      if (this._isPaused) {
        this._isPaused = false;
        this._timeAtStart = new Date().getTime();
        this._startTime = this._currentTime;
        this._expected = this._startTime;
        this.dispatchEvent('start', this);
        this._instance();
        return;
      }

      Object.assign(this, options);
      this._timeAtStart = new Date().getTime();
      this._startTime = this.startTime;
      this._currentTime = this.startTime;
      this._expected = this.startTime;
      this.dispatchEvent('start', this);
      this._instance();
    }

    stop() {
      if (!this._isRunning || this._isPaused) return;
      this._isRunning = false;
      this._isPaused = false;
      this.animationFrame
        ? cancelAnimationFrame(this._timer)
        : clearTimeout(this._timer);
      this.dispatchEvent('stop', this);
    }

    pause() {
      if (!this._isRunning || this._isPaused) return;
      this._isRunning = false;
      this._isPaused = true;
      this.animationFrame
        ? cancelAnimationFrame(this._timer)
        : clearTimeout(this._timer);
      this.dispatchEvent('pause', this);
    }

    reset(options = {}) {
      this.stop();
      this._isRunning = false;
      this._isPaused = false;
      Object.assign(this, options);
      this._currentTime = this.startTime;
      this._expected = this.startTime;
      this.dispatchEvent('update', this);
      this.dispatchEvent('reset', this);
    }

    adjustTime(val) {
      if (!this._isRunning || this._isPaused) return;
      this._expected = this._expected + val;
      this._startTime = this._startTime + val;
    }

    get getTime() {
      return {
        milliseconds: Math.floor(this._currentTime % 1000),
        millisecondsTotal: Math.floor(this._currentTime),
        hundredths: Math.floor(((this._currentTime % 1000) / 10).toFixed(0)),
        hundredthsTotal: Math.floor((this._currentTime / 10).toFixed(0)),
        tenths: Math.floor(((this._currentTime % 1000) / 100).toFixed(0)),
        tenthsTotal: Math.floor((this._currentTime % 1000).toFixed(0)),
        seconds: Math.floor((this._currentTime / 1000) % 60),
        secondsTotal: Math.floor(this._currentTime / 1000),
        minutes: Math.floor((this._currentTime / 1000 / 60) % 60),
        minutesTotal: Math.floor(this._currentTime / 1000 / 60),
        hours: Math.floor((this._currentTime / 1000 / 60 / 60) % 24),
        hoursTotal: Math.floor(this._currentTime / 1000 / 60 / 60),
        days: Math.floor(this._currentTime / 1000 / 60 / 60 / 24),
        daysTotal: Math.floor(this._currentTime / 1000 / 60 / 60 / 24)
      };
    }

    get isRunning() {
      return this._isRunning;
    }

    get isPaused() {
      return this._isPaused;
    }

    addEventListener(event, listener) {
      if (this._eventEmitter) {
        this._eventEmitter.addEventListener(event, listener);
      }
    }

    removeEventListener(event, listener) {
      if (this._eventEmitter) {
        this._eventEmitter.removeEventListener(event, listener);
      }
    }

    dispatchEvent(event, data) {
      if (this._eventEmitter) {
        this._eventEmitter.dispatchEvent(
          new CustomEvent(event, { detail: data })
        );
      }
    }
  }

  window.IntervalTimerLib = {
    pad,
    Timer
  };
})();
