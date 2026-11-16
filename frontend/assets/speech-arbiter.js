/*!
 * Digital Bridge — shared speech arbiter
 * --------------------------------------
 * One owner for window.speechSynthesis with two channels:
 *
 *   media : audio description for the lesson video
 *   ui    : spoken navigation / focus announcements
 *
 * Guarantees:
 *   - UI speech never cancels media speech. While audio description is
 *     speaking, UI announcements are written to the polite live region
 *     instead (and can be queued after the cue by the caller).
 *   - Utterances are referenced for their whole lifetime, so the browser
 *     cannot garbage-collect them before onend fires.
 *   - Long text is split into sentence-sized utterances to avoid Chrome's
 *     long-utterance cutoff (~15s) and to allow pause/resume/sync.
 *   - Missing voices are reported visibly through `novoice` instead of
 *     failing silently.
 *
 * Usage:
 *   DBSpeech.speakMedia(text, { rate, onstart, onend })
 *   DBSpeech.speakUI(text, { liveFallback: fn })
 *   DBSpeech.cancel('media' | 'ui' | 'all')
 *   DBSpeech.pause('media') / DBSpeech.resume('media')
 *   DBSpeech.isMediaActive() / DBSpeech.hasVoice()
 *   DBSpeech.setLiveRegion(element)
 */
(function () {
  'use strict';

  if (window.DBSpeech) return;

  var synth = ('speechSynthesis' in window) ? window.speechSynthesis : null;
  var UtteranceCtor = window.SpeechSynthesisUtterance || null;
  var supported = !!(synth && UtteranceCtor);

  var MAX_SEGMENT_CHARS = 170;
  var STATE = { owner: null, mediaActive: false, noVoice: false };
  var listeners = {};
  var utteranceRefs = [];
  var liveRegion = null;

  function emit(name, detail) {
    var fns = listeners[name];
    if (!fns) return;
    for (var i = 0; i < fns.length; i++) {
      try { fns[i](detail); } catch (err) { /* listener must not break speech */ }
    }
  }

  function on(name, fn) {
    if (!listeners[name]) listeners[name] = [];
    listeners[name].push(fn);
    return function off() {
      var list = listeners[name] || [];
      var at = list.indexOf(fn);
      if (at !== -1) list.splice(at, 1);
    };
  }

  function writeLive(text) {
    if (!liveRegion || !text) return;
    liveRegion.textContent = '';
    window.setTimeout(function () { liveRegion.textContent = text; }, 30);
  }

  function getVoices() {
    if (!synth || typeof synth.getVoices !== 'function') return [];
    try { return synth.getVoices() || []; } catch (err) { return []; }
  }

  function pickVoice(preferredLang) {
    var voices = getVoices();
    if (!voices.length) return null;
    var base = String(preferredLang || document.documentElement.getAttribute('lang') || 'en')
      .toLowerCase().split('-')[0];
    var matching = [];
    var i;
    for (i = 0; i < voices.length; i++) {
      if (String(voices[i].lang || '').toLowerCase().indexOf(base) === 0) matching.push(voices[i]);
    }
    for (i = 0; i < matching.length; i++) {
      if (matching[i].localService) return matching[i];
    }
    return matching[0] || voices[0] || null;
  }

  /** Split text into sentence-sized pieces, never mid-word. */
  function splitSegments(text) {
    var clean = String(text == null ? '' : text)
      .replace(/\u00A0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!clean) return [];

    var sentences = clean.match(/[^.!?;:]+[.!?;:]+["')\]]?|\S[^.!?;:]*$/g) || [clean];
    var out = [];
    var i, j;

    for (i = 0; i < sentences.length; i++) {
      var sentence = sentences[i].trim();
      if (!sentence) continue;
      if (sentence.length <= MAX_SEGMENT_CHARS) {
        out.push(sentence);
        continue;
      }
      // Too long: split on commas, then on spaces.
      var chunks = sentence.replace(/,\s*/g, ', ').split(', ').map(function (part, idx, all) {
        return idx < all.length - 1 ? part + ',' : part;
      });
      var buffer = '';
      for (j = 0; j < chunks.length; j++) {
        var candidate = buffer ? buffer + ' ' + chunks[j] : chunks[j];
        if (candidate.length > MAX_SEGMENT_CHARS && buffer) {
          out.push(buffer);
          buffer = chunks[j];
        } else if (candidate.length > MAX_SEGMENT_CHARS) {
          // A single huge chunk with no commas.
          var words = chunks[j].split(' ');
          var line = '';
          for (var w = 0; w < words.length; w++) {
            var next = line ? line + ' ' + words[w] : words[w];
            if (next.length > MAX_SEGMENT_CHARS && line) {
              out.push(line);
              line = words[w];
            } else {
              line = next;
            }
          }
          buffer = line;
        } else {
          buffer = candidate;
        }
      }
      if (buffer) out.push(buffer);
    }
    return out;
  }

  function Channel(name) {
    this.name = name;
    this.segments = [];
    this.index = 0;
    this.options = {};
    this.active = false;
    this.paused = false;
    this.current = null;
  }

  Channel.prototype.speak = function (text, options) {
    this.cancel();
    var segments = splitSegments(text);
    if (!segments.length) return false;
    this.segments = segments;
    this.index = 0;
    this.options = options || {};
    this.active = true;
    this.paused = false;
    STATE.owner = this.name;
    if (this.name === 'media') {
      STATE.mediaActive = true;
      emit('mediachange', { active: true });
    }
    this._next();
    return true;
  };

  Channel.prototype._next = function () {
    if (!this.active || this.paused) return;
    if (this.index >= this.segments.length) return this._finish();

    var text = this.segments[this.index++];
    var utterance = new UtteranceCtor(text);
    var voice = pickVoice(this.options.lang);
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    }
    utterance.rate = this.options.rate || 1;
    utterance.pitch = 1;
    utterance.volume = 1;

    this.current = utterance;
    utteranceRefs.push(utterance);
    if (utteranceRefs.length > 40) utteranceRefs.shift();

    var self = this;
    var started = false;
    utterance.onstart = function () {
      started = true;
      STATE.noVoice = false;
      if (self.name === 'media' && self.options.onstart) self.options.onstart(utterance);
    };
    utterance.onend = function () {
      self.current = null;
      if (self.active && !self.paused) self._next();
      else if (!self.active) self._finish();
    };
    utterance.onerror = function (event) {
      self.current = null;
      if (!started && (event.error === 'synthesis-failed' || event.error === 'voice-unavailable' ||
          event.error === 'language-unavailable')) {
        STATE.noVoice = true;
        emit('novoice', { channel: self.name });
      }
      if (self.active && !self.paused) self._next();
    };

    try {
      synth.speak(utterance);
    } catch (err) {
      STATE.noVoice = true;
      emit('novoice', { channel: this.name });
      this._finish();
      return;
    }

    // Detect "no voice installed" — nothing starts and nothing is pending.
    window.setTimeout(function () {
      if (!started && !synth.speaking && !synth.pending) {
        STATE.noVoice = true;
        if (self.name === 'media' && self.options.onfailure) self.options.onfailure();
        emit('novoice', { channel: self.name });
        if (self.active) self._finish();
      }
    }, 900);
  };

  Channel.prototype._finish = function () {
    var wasMedia = this.name === 'media';
    this.active = false;
    this.paused = false;
    this.segments = [];
    this.index = 0;
    this.current = null;
    var done = this.options && this.options.onend;
    this.options = {};
    if (STATE.owner === this.name) STATE.owner = null;
    if (wasMedia) {
      STATE.mediaActive = false;
      emit('mediachange', { active: false });
    }
    if (done) {
      try { done(); } catch (err) { /* ignore */ }
    }
    emit('idle', { channel: this.name });
  };

  Channel.prototype.cancel = function () {
    var wasActive = this.active;
    this.active = false;
    this.paused = false;
    this.segments = [];
    this.index = 0;
    this.current = null;
    if (wasActive && STATE.owner === this.name) {
      try { synth.cancel(); } catch (err) { /* ignore */ }
      STATE.owner = null;
    }
    if (this.name === 'media' && STATE.mediaActive) {
      STATE.mediaActive = false;
      emit('mediachange', { active: false });
    }
  };

  var media = new Channel('media');
  var ui = new Channel('ui');

  var api = {
    supported: supported,
    /** Speak an audio-description cue. Cancels previous media speech only. */
    speakMedia: function (text, options) {
      if (!supported) { if (options && options.onfailure) options.onfailure(); return false; }
      return media.speak(text, options);
    },
    /** Speak a navigation announcement. Never cancels media speech. */
    speakUI: function (text, options) {
      var opts = options || {};
      if (!supported) {
        writeLive(text);
        if (opts.liveFallback) opts.liveFallback(text);
        return false;
      }
      if (STATE.mediaActive || STATE.owner === 'media') {
        // Audio description owns the synthesiser: announce politely instead.
        writeLive(text);
        if (opts.liveFallback) opts.liveFallback(text);
        return false;
      }
      return ui.speak(text, opts);
    },
    cancel: function (channel) {
      if (channel === 'media') media.cancel();
      else if (channel === 'ui') ui.cancel();
      else if (channel === 'all') {
        media.cancel();
        ui.cancel();
        try { synth.cancel(); } catch (err) { /* ignore */ }
        STATE.owner = null;
      } else if (channel === 'ui-if-idle') {
        if (!STATE.mediaActive) ui.cancel();
      }
    },
    pause: function (channel) {
      var target = channel === 'media' ? media : ui;
      if (!target.active) return;
      target.paused = true;
      try { synth.pause(); } catch (err) { /* ignore */ }
    },
    resume: function (channel) {
      var target = channel === 'media' ? media : ui;
      if (!target.active) return;
      target.paused = false;
      try { synth.resume(); } catch (err) { /* ignore */ }
      // Some engines ignore resume(); restart the current segment instead.
      window.setTimeout(function () {
        if (target.active && !target.paused && !synth.speaking) {
          if (target.index > 0) target.index -= 1;
          target._next();
        }
      }, 500);
    },
    isMediaActive: function () { return STATE.mediaActive; },
    isSpeaking: function (channel) {
      var target = channel === 'media' ? media : ui;
      return !!(target && target.active);
    },
    hasVoice: function () { return supported && getVoices().length > 0; },
    noVoice: function () { return STATE.noVoice; },
    setLiveRegion: function (el) { liveRegion = el; },
    writeLive: writeLive,
    on: on,
    splitSegments: splitSegments,
    _channels: { media: media, ui: ui }
  };

  // Voices load asynchronously in Chrome.
  if (synth && typeof synth.addEventListener === 'function') {
    synth.addEventListener('voiceschanged', function () {
      emit('voices', { count: getVoices().length });
    });
  }

  window.DBSpeech = api;
})();
