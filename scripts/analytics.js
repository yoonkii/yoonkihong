/* ============================================================================
   Analytics bootstrap — PostHog (product analytics) + Sentry (error monitoring).
   Loaded with <script defer> by BOTH index.html and classic.html.

   - Only activates on the production domain (yoonkihong.com) so local dev,
     preview servers, and github.io mirrors never pollute the stats.
   - Exposes window.ywTrack(event, props): a safe no-op wrapper the game code
     calls without caring whether analytics is loaded/enabled.
   - Both keys below are PUBLIC client-side identifiers (safe to commit).
   ========================================================================== */
(function () {
  'use strict';

  var PROD = /(^|\.)yoonkihong\.com$/.test(location.hostname);

  // Safe tracker: buffers nothing, just forwards when PostHog is live.
  window.ywTrack = function (event, props) {
    if (PROD && window.posthog && window.posthog.capture) {
      window.posthog.capture(event, props || {});
    }
  };

  if (!PROD) return; // local/preview: leave ywTrack as a no-op

  /* ---- Sentry (error monitoring) — official Loader Script -------------- */
  var s = document.createElement('script');
  s.src = 'https://js.sentry-cdn.com/1809033d6fa90a7dcb676b140bb3e3bb.min.js';
  s.crossOrigin = 'anonymous';
  document.head.appendChild(s);

  /* ---- PostHog — official JS snippet (loads array.js async) ------------ */
  !function (t, e) { var o, n, p, r; e.__SV || (window.posthog = e, e._i = [], e.init = function (i, s, a) { function g(t, e) { var o = e.split("."); 2 == o.length && (t = t[o[0]], e = o[1]), t[e] = function () { t.push([e].concat(Array.prototype.slice.call(arguments, 0))) } } (p = t.createElement("script")).type = "text/javascript", p.crossOrigin = "anonymous", p.async = !0, p.src = s.api_host.replace(".i.posthog.com", "-assets.i.posthog.com") + "/static/array.js", (r = t.getElementsByTagName("script")[0]).parentNode.insertBefore(p, r); var u = e; for (void 0 !== a ? u = e[a] = [] : a = "posthog", u.people = u.people || [], u.toString = function (t) { var e = "posthog"; return "posthog" !== a && (e += "." + a), t || (e += " (stub)"), e }, u.people.toString = function () { return u.toString(1) + ".people (stub)" }, o = "init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug getPageViewId captureTraceFeedback captureTraceMetric".split(" "), n = 0; n < o.length; n++) g(u, o[n]); e._i.push([i, s, a]) }, e.__SV = 1) }(document, window.posthog || []);
  window.posthog.init('phc_tAbFy7ZhwxxEq6XbaWtTQaXLKZBHJ9XmXxPz89uzLt4z', {
    api_host: 'https://us.i.posthog.com',
    defaults: '2025-05-24',
    person_profiles: 'identified_only'
  });
})();
