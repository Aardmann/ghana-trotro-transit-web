import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { 
  ArrowUpDown, Copy, Info, Lock, MapPin, Navigation, 
  Search, Share2, User, X, Plus, History, Key, 
  Mail, Phone, Globe, Clock, Map,
  ChevronLeft, ChevronRight, ChevronUp, ChevronDown,
  ArrowLeft, ArrowRight, Trash2,
  Bus, CheckCircle, Calendar, Thermometer, Hash,
  Tv, Building, Package, AlertCircle, CalendarDays,
  Wind, Type, RefreshCw, Radio, Flag, Check, Coins,
  Eye, EyeOff, Heart, Users, ImagePlus, Camera, LogIn
} from 'lucide-react';
import { supabase } from '../config/supabase';
import {
  getSearchHistoryFromCookie,
  addSearchToCookie,
  deleteSearchFromCookie,
  clearSearchHistoryCookie,
  hasAcceptedCookies,
  acceptCookieConsent,
  hasGrantedLocationBefore,
  markLocationGranted,
  getCachedUserLocation,
  setCachedUserLocation,
  getCachedNearbyStops,
  setCachedNearbyStops,
  getCachedStopSearch,
  setCachedStopSearch,
  getCachedUserSearchHistory,
  setCachedUserSearchHistory,
  haversineKm,
  NEARBY_RADIUS_KM,
  NEARBY_CACHE_MOVE_THRESHOLD_KM,
} from '../config/cookies';
import { COLORS, MAP_CONFIG, SAMPLE_STOPS } from '../utils/constants';
import MapComponent from './MapComponent';
import '../styles/HomeScreen.css';

const AuthForm = ({ onSignIn, onSignUp, authLoading, onForgotPasswordOpen }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Forgot password panel state
  const [showForgotPanel, setShowForgotPanel] = useState(false);
  const [fpEmail, setFpEmail] = useState('');
  const [fpLoading, setFpLoading] = useState(false);
  const [fpSent, setFpSent] = useState(false);

  const handleSubmit = async () => {
    if (!email || !password) {
      alert('Error: Please enter both email and password');
      return;
    }

    if (isSignUp && (!firstName || !lastName)) {
      alert('Error: Please enter your first and last name');
      return;
    }

    if (isSignUp && password !== confirmPassword) {
      alert('Error: Passwords do not match');
      return;
    }

    if (isSignUp) {
      await onSignUp(email, password, firstName, lastName);
    } else {
      await onSignIn(email, password);
    }
  };

  const handleForgotPasswordSend = async () => {
    if (!fpEmail) {
      alert('Please enter your email address');
      return;
    }
    setFpLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(fpEmail, {
        redirectTo: 'https://user-gtt.nxnx.tech/reset-password',
      });
      if (error) throw error;
      setFpSent(true);
      alert('If email is correct, you should recieve a reset email in your email account.')
    } catch (error) {
      alert('Error sending reset email: ' + error.message);
    } finally {
      setFpLoading(false);
    }
  };

  const closeForgotPanel = () => {
    setShowForgotPanel(false);
    setFpEmail('');
    setFpSent(false);
  };

  return (
    <div className="ios-auth-form">
      <div className="ios-auth-header">
        <div className="ios-auth-icon">
          <User size={26} color="#FFFFFF" />
        </div>
        <h2 className="ios-auth-title">
          {isSignUp ? 'Create Account' : 'Welcome Back'}
        </h2>
        <p className="ios-auth-subtitle">
          {isSignUp ? 'Sign up to save routes and sync your history' : 'Sign in to continue'}
        </p>
      </div>

      <div className="ios-auth-tabs">
        <button
          className={`ios-auth-tab ${!isSignUp ? 'ios-auth-tab--active' : ''}`}
          onClick={() => { setIsSignUp(false); closeForgotPanel(); }}
        >
          Sign In
        </button>
        <button
          className={`ios-auth-tab ${isSignUp ? 'ios-auth-tab--active' : ''}`}
          onClick={() => { setIsSignUp(true); closeForgotPanel(); }}
        >
          Sign Up
        </button>
      </div>

      {isSignUp && (
        <div className="ios-list-group ios-form-group">
          <div className="ios-auth-input-row">
            <User size={17} color="#8E8E93" />
            <input
              className="ios-auth-input"
              placeholder="First Name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
            {firstName ? (
              <button className="input-clear-btn" onClick={() => setFirstName('')} tabIndex={-1}>
                <X size={14} />
              </button>
            ) : null}
          </div>
          <div className="ios-list-divider" style={{ marginLeft: '41px' }}></div>
          <div className="ios-auth-input-row">
            <User size={17} color="#8E8E93" />
            <input
              className="ios-auth-input"
              placeholder="Last Name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
            {lastName ? (
              <button className="input-clear-btn" onClick={() => setLastName('')} tabIndex={-1}>
                <X size={14} />
              </button>
            ) : null}
          </div>
        </div>
      )}

      <div className="ios-list-group ios-form-group">
        <div className="ios-auth-input-row">
          <Mail size={17} color="#8E8E93" />
          <input
            className="ios-auth-input"
            placeholder="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {email ? (
            <button className="input-clear-btn" onClick={() => setEmail('')} tabIndex={-1}>
              <X size={14} />
            </button>
          ) : null}
        </div>

        <div className="ios-list-divider" style={{ marginLeft: '41px' }}></div>

        <div className="ios-auth-input-row">
          <Lock size={17} color="#8E8E93" />
          <input
            className="ios-auth-input"
            placeholder="Password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="button"
            className="password-reveal-btn"
            onClick={() => setShowPassword(prev => !prev)}
            tabIndex={-1}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
          {password ? (
            <button className="input-clear-btn" onClick={() => setPassword('')} tabIndex={-1}>
              <X size={14} />
            </button>
          ) : null}
        </div>

        {isSignUp && (
          <>
            <div className="ios-list-divider" style={{ marginLeft: '41px' }}></div>
            <div className="ios-auth-input-row">
              <Lock size={17} color="#8E8E93" />
              <input
                className="ios-auth-input"
                placeholder="Confirm Password"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              <button
                type="button"
                className="password-reveal-btn"
                onClick={() => setShowConfirmPassword(prev => !prev)}
                tabIndex={-1}
              >
                {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
              {confirmPassword ? (
                <button className="input-clear-btn" onClick={() => setConfirmPassword('')} tabIndex={-1}>
                  <X size={14} />
                </button>
              ) : null}
            </div>
          </>
        )}
      </div>

      <button 
        className={`ios-auth-submit ${authLoading ? 'ios-auth-submit--disabled' : ''}`}
        onClick={handleSubmit}
        disabled={authLoading}
      >
        {authLoading ? 'Loading...' : (isSignUp ? 'Create Account' : 'Sign In')}
      </button>

      {isSignUp && (
        <p className="ios-auth-legal-text">
          By signing up, you agree to our{' '}
          <a
            href="https://gtt.nxnx.tech/privacy"
            target="_blank"
            rel="noopener noreferrer"
          >
            Privacy Policy
          </a>{' '}
          and{' '}
          <a
            href="https://gtt.nxnx.tech/terms"
            target="_blank"
            rel="noopener noreferrer"
          >
            Terms &amp; Conditions
          </a>
          .
        </p>
      )}

      {!isSignUp && (
        <>
          <button
            className="ios-auth-forgot"
            onClick={() => {
              setShowForgotPanel(prev => {
                const next = !prev;
                if (next) onForgotPasswordOpen?.();
                return next;
              });
              setFpSent(false);
              setFpEmail('');
            }}
          >
            Forgot Password?
          </button>

          {showForgotPanel && (
            <div className="ios-list-group ios-forgot-panel">
              {fpSent ? (
                <div className="ios-forgot-success">
                  <div className="ios-forgot-success-icon">
                    <CheckCircle size={28} color="#10B981" />
                  </div>
                  <p className="ios-forgot-success-text">
                    Reset link sent! Check <strong>{fpEmail}</strong> for the password reset link. It expires in 24 hours.
                  </p>
                  <button className="ios-forgot-done-btn" onClick={closeForgotPanel}>
                    Done
                  </button>
                </div>
              ) : (
                <div className="ios-forgot-body">
                  <p className="ios-forgot-label">Enter your email to receive a reset link</p>
                  <div className="ios-auth-input-row ios-forgot-input-row">
                    <Mail size={17} color="#8E8E93" />
                    <input
                      className="ios-auth-input"
                      placeholder="Your email address"
                      type="email"
                      value={fpEmail}
                      onChange={(e) => setFpEmail(e.target.value)}
                    />
                    {fpEmail ? (
                      <button className="input-clear-btn" onClick={() => setFpEmail('')} tabIndex={-1}>
                        <X size={14} />
                      </button>
                    ) : null}
                  </div>
                  <button
                    className={`ios-forgot-send-btn${fpLoading ? ' ios-forgot-send-btn--disabled' : ''}`}
                    onClick={handleForgotPasswordSend}
                    disabled={fpLoading}
                  >
                    {fpLoading ? 'Sending...' : 'Send Reset Email'}
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ── Composite route helper ─────────────────────────────────────────────────────
// For a composite route, each sub-route in route_compositions becomes ONE row
// in the UI stops list, labelled with the sub-route name and its own total_fare.
// The map receives all real stop coordinates from all sub-routes so road routing
// draws continuously through every junction point without showing walk arcs.
//
// Schema facts used here:
//   route_compositions.composite_route_id  → FK to the parent/composite route
//   route_compositions.sub_route_id        → FK to each constituent sub-route
//   route_compositions.composition_order   → display order
//   No fare_override column — fare always comes from sub_route.total_fare
const fetchCompositeSegments = async (routeId) => {
  const { data: compositions, error } = await supabase
    .from('route_compositions')
    .select(`
      composition_order,
      sub_route:sub_route_id (
        id,
        name,
        total_fare,
        total_distance,
        route_stops (
          stop_order,
          fare_to_next,
          distance_to_next,
          stops (*)
        )
      )
    `)
    .eq('composite_route_id', routeId)
    .order('composition_order');

  if (error || !compositions || compositions.length === 0) return null;

  // Each composition entry → one segment shown in the stops list
  const segments = compositions.map((comp) => {
    const subRoute = comp.sub_route;
    if (!subRoute || !subRoute.route_stops) return null;

    const sorted = [...subRoute.route_stops].sort((a, b) => a.stop_order - b.stop_order);
    const firstStop = sorted[0]?.stops;
    const lastStop  = sorted[sorted.length - 1]?.stops;

    return {
      subRouteId:   subRoute.id,
      subRouteName: subRoute.name,
      fare:         subRoute.total_fare,       // fare from the sub-route itself
      distance:     subRoute.total_distance,
      fromName:     firstStop?.name ?? '',
      toName:       lastStop?.name  ?? '',
      // All coordinates for this sub-route (used to build the map path)
      allCoords: sorted.map(rs => ({
        id:   rs.stops.id,
        name: rs.stops.name,
        lat:  parseFloat(rs.stops.latitude),
        lng:  parseFloat(rs.stops.longitude),
      })),
    };
  }).filter(Boolean);

  if (segments.length === 0) return null;

  // Flatten all sub-route coords into one list for the map, deduplicating the
  // shared boundary stop between consecutive legs (last of leg N = first of leg N+1).
  //
  // fare_to_next on stop[i] controls the segment from stop[i] → stop[i+1]:
  //   • 0   → draw a walk arc (dashed) instead of road-routing
  //   • null → road-route as normal
  //
  // The segment's character is determined by the sub-route that OWNS stop[i+1]:
  //   - Both stops inside the same sub-route       → own sub-route's fare
  //   - stop[i] is the last of sub-route k,
  //     stop[i+1] is the first of sub-route k+1    → k+1's fare (the destination)
  //
  // This ensures arcs start exactly where the walk sub-route begins and stop
  // exactly where it ends, with no bleed into adjacent road-routed segments.
  const mapStops = [];
  segments.forEach((seg, i) => {
    const isWalkSeg  = Number(seg.fare) === 0;
    const prevIsWalk = i > 0 && Number(segments[i - 1].fare) === 0;
    const nextSeg    = segments[i + 1] ?? null;
    const coords     = i === 0 ? seg.allCoords : seg.allCoords.slice(1);

    coords.forEach((c, j) => {
      const isJunction    = i > 0 && j === 0;
      const isLastInSeg   = j === coords.length - 1;

      // For the last stop in this sub-route the next stop belongs to nextSeg.
      // Use nextSeg's fare to decide whether that crossing segment is a walk.
      const fare_to_next = isLastInSeg
        ? (nextSeg && Number(nextSeg.fare) === 0 ? 0 : null)
        : (isWalkSeg ? 0 : null);

      mapStops.push({
        id:          c.id,
        name:        c.name,
        lat:         c.lat,
        lng:         c.lng,
        fare_to_next,
        // Transfer marker only at boundaries between two non-walk sub-routes
        isTransfer:  isJunction && !isWalkSeg && !prevIsWalk,
      });
    });
  });

  return { segments, mapStops };
};

// Format a single route row from Supabase into the app's route shape.
const formatRoute = async (route) => {
  if (route.is_composite) {
    const composite = await fetchCompositeSegments(route.id);
    if (composite) {
      return {
        id:             route.id,
        name:           route.name,
        total_distance: route.total_distance,
        total_fare:     route.total_fare,
        is_composite:   true,
        // segments drives the stops-list UI for composite routes
        compositionSegments: composite.segments,
        // mapStops / stops are used by the map (all real coordinates)
        stops: composite.mapStops,
      };
    }
  }

  // Normal (non-composite) route
  const sortedStops = [...route.route_stops].sort((a, b) => a.stop_order - b.stop_order);
  return {
    id:             route.id,
    name:           route.name,
    total_distance: route.total_distance,
    total_fare:     route.total_fare,
    is_composite:   false,
    compositionSegments: [],
    stops: sortedStops.map(rs => ({
      id:               rs.stops.id,
      name:             rs.stops.name,
      lat:              parseFloat(rs.stops.latitude),
      lng:              parseFloat(rs.stops.longitude),
      fare_to_next:     rs.fare_to_next,
      distance_to_next: rs.distance_to_next,
    })),
  };
};

const GhanaTrotroTransit = () => {
  // ── Cookie consent states ──────────────────────────────────────────
  const [cookiesAccepted, setCookiesAccepted] = useState(() => hasAcceptedCookies());
  const [cookiesDeclined, setCookiesDeclined] = useState(false);
  const [showCookieInfoModal, setShowCookieInfoModal] = useState(false);

  const handleAcceptCookies = useCallback(() => {
    acceptCookieConsent();
    setCookiesAccepted(true);
    setCookiesDeclined(false);
    setShowCookieInfoModal(false);
  }, []);

  const handleDeclineCookies = useCallback(() => {
    // Decline is intentionally never persisted - reloading gives the
    // user another chance to accept.
    setCookiesDeclined(true);
    setShowCookieInfoModal(false);
  }, []);

  // Navigation and UI states
  const [startPoint, setStartPoint] = useState('');
  const [destination, setDestination] = useState('');
  const [routes, setRoutes] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [activeInput, setActiveInput] = useState('start');
  
  // User states
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);

  // ── User location (requires cookie/location consent) ────────────────
  const [userLocation, setUserLocation] = useState(null);
  const locationRequestedRef = useRef(false);

  // ── Nearby stops (faint reference dots around the user) ─────────────
  // Fetched once per location (device-cached — see fetchNearbyStops below)
  // rather than every time the app is opened or refreshed.
  const [nearbyStops, setNearbyStops] = useState([]);

  // Merges a freshly-fetched (or cached) batch into whatever nearby stops
  // are already known, deduping by id, so the visible dot set only ever
  // grows as the user pans — it never gets replaced/reset on each fetch.
  const mergeNearbyStops = useCallback((batch) => {
    setNearbyStops((prev) => {
      const seen = new Set(prev.map((s) => s.id));
      const additions = batch.filter((s) => !seen.has(s.id));
      return additions.length ? [...prev, ...additions] : prev;
    });
  }, []);

  const fetchNearbyStops = useCallback(async (coords) => {
    if (!coords) return;

    // Serve straight from the device cache when it's still fresh and the
    // user hasn't moved far enough away to make it stale.
    const cached = getCachedNearbyStops(coords.lat, coords.lng);
    if (cached) {
      mergeNearbyStops(cached);
      return;
    }

    try {
      // Rough bounding box first (cheap on the DB), then an exact
      // haversine check below to trim it down to a true 2km circle.
      const latDelta = NEARBY_RADIUS_KM / 111;
      const lngDelta = NEARBY_RADIUS_KM / (111 * Math.cos((coords.lat * Math.PI) / 180));

      const { data, error } = await supabase
        .from('stops')
        .select('id, name, latitude, longitude')
        .eq('approved', true)
        .gte('latitude', coords.lat - latDelta)
        .lte('latitude', coords.lat + latDelta)
        .gte('longitude', coords.lng - lngDelta)
        .lte('longitude', coords.lng + lngDelta);

      if (error) throw error;

      const nearby = (data || [])
        .map((s) => ({
          id: s.id,
          name: s.name,
          lat: parseFloat(s.latitude),
          lng: parseFloat(s.longitude),
        }))
        .filter((s) => haversineKm(coords.lat, coords.lng, s.lat, s.lng) <= NEARBY_RADIUS_KM);

      mergeNearbyStops(nearby);
      setCachedNearbyStops(coords.lat, coords.lng, nearby);
    } catch (error) {
      console.error('Error fetching nearby stops:', error);
    }
  }, [mergeNearbyStops]);

  // Runs once userLocation becomes available (see requestUserLocation
  // below) — cache-first, so a refresh won't hit the DB again unless the
  // cache expired or the user moved. This only ever fires if the user has
  // granted location access; otherwise userLocation stays null and no
  // location-based lookup happens at all.
  useEffect(() => {
    if (userLocation) {
      fetchNearbyStops(userLocation);
    }
  }, [userLocation, fetchNearbyStops]);

  // ── Stops for whatever area the user has panned the map to ──────────
  // Unlike the location-based fetch above, this doesn't require location
  // permission at all — it's just based on where the user is looking on
  // the map. Reuses the same cache-first fetchNearbyStops + device cache,
  // so revisiting an area already seen (this session or a past one)
  // doesn't re-hit the DB. A simple distance check keeps small map
  // jitters from triggering redundant fetches.
  const lastViewportFetchRef = useRef(null);

  const handleMapViewportMoved = useCallback((lat, lng) => {
    const last = lastViewportFetchRef.current;
    if (last && haversineKm(lat, lng, last.lat, last.lng) < NEARBY_CACHE_MOVE_THRESHOLD_KM) {
      return;
    }
    lastViewportFetchRef.current = { lat, lng };
    fetchNearbyStops({ lat, lng });
  }, [fetchNearbyStops]);

  const requestUserLocation = useCallback(() => {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setUserLocation(coords);
        // Permission was granted - remember that so we never call
        // getCurrentPosition again until cookie consent is given fresh,
        // and cache the coords so even a silent re-fetch isn't needed
        // again for another 30 days.
        markLocationGranted();
        setCachedUserLocation(coords);

        // Persist location for signed-in users only (location_history and
        // users.last_location both key off a real user id). Guests still
        // see the marker on their own map, it's just not stored server-side.
        if (user?.id) {
          try {
            await supabase
              .from('users')
              .update({ last_location: coords, last_seen_at: new Date().toISOString() })
              .eq('id', user.id);

            await supabase.from('location_history').insert({
              user_id: user.id,
              latitude: coords.lat,
              longitude: coords.lng,
              accuracy: position.coords.accuracy ?? null,
            });
          } catch (error) {
            console.error('Error storing user location:', error);
          }
        }
      },
      (error) => {
        console.warn('Geolocation unavailable or denied:', error.message);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, [user]);

  // Once the user has accepted cookies/location consent, get their
  // location - but only ever calls the actual geolocation API (which is
  // what can prompt the user) once. After that first grant, a cached
  // location is used instead; the API is only called again silently (no
  // prompt, since permission is already granted) if that cache has gone
  // stale, and never re-prompts from scratch until cookie consent itself
  // has to be given again.
  useEffect(() => {
    if (!cookiesAccepted || locationRequestedRef.current) return;
    locationRequestedRef.current = true;

    const cachedLocation = getCachedUserLocation();
    if (cachedLocation) {
      setUserLocation(cachedLocation);
    }

    if (!hasGrantedLocationBefore()) {
      // Never granted before under the current consent - this is the one
      // real "ask".
      requestUserLocation();
    } else if (!cachedLocation) {
      // Already granted previously, cache just expired - refresh silently;
      // the browser won't show a permission prompt for an already-granted
      // permission.
      requestUserLocation();
    }
  }, [cookiesAccepted, requestUserLocation]);
  const [showWelcomeBanner, setShowWelcomeBanner] = useState(false);
  
  // Modal states
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showBottomSheet, setShowBottomSheet] = useState(false);
  const [bottomSheetContent, setBottomSheetContent] = useState('search'); // 'search' or 'route'
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showSearchHistoryModal, setShowSearchHistoryModal] = useState(false);
  const [showRouteNotFoundModal, setShowRouteNotFoundModal] = useState(false);
  const [showSignOutConfirmModal, setShowSignOutConfirmModal] = useState(false);
  const [signOutLoading, setSignOutLoading] = useState(false);
  const [showSignOutSuccessModal, setShowSignOutSuccessModal] = useState(false);

  // Profile modal — Account sub-view state
  const [profileView, setProfileView] = useState('menu'); // 'menu' | 'account'
  // Guests see the normal profile menu first — this only flips to true once
  // they tap Account, Search History, or the header Sign In button.
  const [showGuestSignIn, setShowGuestSignIn] = useState(false);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [nameUpdateLoading, setNameUpdateLoading] = useState(false);
  const [nameUpdateSuccess, setNameUpdateSuccess] = useState(false);
  const [showDeleteAccountConfirm, setShowDeleteAccountConfirm] = useState(false);
  const [deleteAccountLoading, setDeleteAccountLoading] = useState(false);

  // ── Volunteer mode: tap the map to add a new stop ────────────────────
  const [volunteerMode, setVolunteerMode] = useState(false);
  const [pendingStopCoords, setPendingStopCoords] = useState(null); // { lat, lng }
  const [showAddStopModal, setShowAddStopModal] = useState(false);
  const [newStopName, setNewStopName] = useState('');
  const [newStopImages, setNewStopImages] = useState([]); // File[]
  const [addStopSubmitting, setAddStopSubmitting] = useState(false);
  const [addStopSuccess, setAddStopSuccess] = useState(false);

  // ── Donate (Paystack) ─────────────────────────────────────────────────
  const [showDonateModal, setShowDonateModal] = useState(false);
  const [donateAmount, setDonateAmount] = useState('20');
  const [donateEmail, setDonateEmail] = useState('');
  const [donateLoading, setDonateLoading] = useState(false);
  
  // History states
  const [createdRoutesHistory, setCreatedRoutesHistory] = useState([]);
  const [searchHistory, setSearchHistory] = useState(() => getSearchHistoryFromCookie());

  // Download app modal state
  const [showDownloadAppModal, setShowDownloadAppModal] = useState(false);

  // Forgot password panel state (inside profile modal, for logged-in users)
  const [showForgotPasswordPanel, setShowForgotPasswordPanel] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);
  const [forgotPasswordSent, setForgotPasswordSent] = useState(false);

  // ── Report Issue state ─────────────────────────────────────────────────────
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportNote, setReportNote] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);
  // true = general report (from profile, no route attached); false = route report
  const [isGeneralReport, setIsGeneralReport] = useState(false);

  // Map layer mode: 'normal' | 'satellite'
  const [mapMode, setMapMode] = useState('normal');

  // Recent searches panel – persisted to localStorage
  const [showRecentSearches, setShowRecentSearches] = useState(() => {
    try {
      const saved = localStorage.getItem('gtt_showRecentSearches');
      return saved === null ? true : saved === 'true';
    } catch {
      return true;
    }
  });

  const toggleRecentSearches = useCallback(() => {
    setShowRecentSearches(prev => {
      const next = !prev;
      try { localStorage.setItem('gtt_showRecentSearches', String(next)); } catch {}
      return next;
    });
  }, []);

  // Realtime states
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [isFindingRoutes, setIsFindingRoutes] = useState(false);

  // Refs
  const startInputRef = useRef(null);
  const destinationInputRef = useRef(null);
  const bottomSheetRef = useRef(null);
  const modalRef = useRef(null);
  // Scrollable content area inside the profile modal (guest sign-in state) -
  // scrolled to the bottom when "Forgot Password?" is clicked so the panel
  // that expands below isn't cut off out of view.
  const profileModalContentRef = useRef(null);
  const realtimeSubscriptionRef = useRef(null);
  const routesCacheRef = useRef(null);
  const isMountedRef = useRef(true);

  const [bottomSheetState, setBottomSheetState] = useState('route-details'); 
  const [showSwipeIndicator, setShowSwipeIndicator] = useState(true);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const [routeInfoData, setRouteInfoData] = useState(null);
  const [prevBottomSheetState, setPrevBottomSheetState] = useState('route-details');
  const [swipeTranslate, setSwipeTranslate] = useState(0);
  const [isSwipeActive, setIsSwipeActive] = useState(false);
  const bottomSheetContentRef = useRef(null);
  const touchStartYRef = useRef(null);
  const swipeAxisLockRef = useRef(null); // 'x' | 'y' | null — decided once per gesture

  // ── Vertical drag / snap state ──────────────────────────────────────────────
  const SNAP_HEIGHTS = [32, 58, 88]; // vh: peek, half, full
  const [sheetSnapIndex, setSheetSnapIndex] = useState(1);
  const [sheetDragHeight, setSheetDragHeight] = useState(SNAP_HEIGHTS[1]);
  const [sheetIsDragging, setSheetIsDragging] = useState(false);
  const sheetDragRef = useRef({ active: false, startY: 0, startH: SNAP_HEIGHTS[1], currentH: SNAP_HEIGHTS[1] });

  // ── Dynamic sheet height based on stop count ──────────────────────────────
  // Each stop row ~72px, header ~160px, summary cards ~80px, padding ~40px.
  // The computed height becomes the maximum snap point for this route.
  useEffect(() => {
    if (!selectedRoute) return;
    const stopCount = selectedRoute.is_composite
      ? (selectedRoute.compositionSegments?.length ?? 0) + 1
      : (selectedRoute.stops?.length ?? 0);
    const viewportH = window.innerHeight;
    const estimatedPx = 160 + 80 + stopCount * 72 + 40;
    const estimatedVh = Math.round((estimatedPx / viewportH) * 100);
    // Clamp: min 42 vh, max 88 vh — this is the new "full" snap
    const fullSnap = Math.min(Math.max(estimatedVh, 42), 88);
    // Rebuild snap points with the computed full height
    const newSnaps = [32, Math.round((32 + fullSnap) / 2), fullSnap];
    // Start at the mid snap
    const midIdx = 1;
    setSheetDragHeight(newSnaps[midIdx]);
    setSheetSnapIndex(midIdx);
    sheetDragRef.current.currentH = newSnaps[midIdx];
    sheetDragRef.current.startH   = newSnaps[midIdx];
    // Store dynamic snaps for drag handler
    sheetDragRef.current.snapHeights = newSnaps;
  }, [selectedRoute]); // eslint-disable-line react-hooks/exhaustive-deps

  // Memoized map data to prevent unnecessary re-renders
  const memoizedRouteCoordinates = useMemo(() => {
    return selectedRoute ? selectedRoute.stops.map(stop => [stop.lat, stop.lng]) : [];
  }, [selectedRoute]);

  const memoizedStops = useMemo(() => {
    return selectedRoute?.stops || [];
  }, [selectedRoute]);

  const memoizedMapCenter = useMemo(() => {
    if (memoizedRouteCoordinates.length > 0) {
      return memoizedRouteCoordinates[0];
    }
    // No route selected yet — prefer centering on the user's real position
    // (once location permission has been granted) over the static default.
    if (userLocation) {
      return [userLocation.lat, userLocation.lng];
    }
    return MAP_CONFIG.center;
  }, [memoizedRouteCoordinates, userLocation]);

  // Close modals when clicking outside
  const handleOverlayClick = useCallback((e, closeFunction) => {
    if (e.target === e.currentTarget) {
      closeFunction();
    }
  }, []);

  // Close bottom sheet when clicking on overlay
  const handleBottomSheetOverlayClick = useCallback((e) => {
    handleOverlayClick(e, closeBottomSheet);
  }, [handleOverlayClick]);

  // Close profile modal when clicking on overlay
  const handleProfileModalOverlayClick = useCallback((e) => {
    handleOverlayClick(e, () => {
      setShowProfileModal(false);
      setShowForgotPasswordPanel(false);
      setForgotPasswordSent(false);
      setForgotPasswordEmail('');
    });
  }, [handleOverlayClick]);

  // Close info modal when clicking on overlay
  const handleInfoModalOverlayClick = useCallback((e) => {
    handleOverlayClick(e, () => setShowInfoModal(false));
  }, [handleOverlayClick]);

  // Close search history modal when clicking on overlay
  const handleSearchHistoryModalOverlayClick = useCallback((e) => {
    handleOverlayClick(e, () => setShowSearchHistoryModal(false));
  }, [handleOverlayClick]);

  // Close route-not-found modal when clicking on overlay
  const handleRouteNotFoundModalOverlayClick = useCallback((e) => {
    handleOverlayClick(e, () => setShowRouteNotFoundModal(false));
  }, [handleOverlayClick]);

  // Check user on component mount
  const checkUser = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      
      if (session?.user) {
        await fetchUserProfile(session.user.id);
        await fetchUserHistory(session.user.id);
      }
    } catch (error) {
      console.error('Error checking user:', error);
    }
  }, []);

  // Fetch user profile
  const fetchUserProfile = useCallback(async (userId) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (!error && data) {
        setUserProfile(data);
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  }, []);

  // Fetch user history
  const fetchUserHistory = useCallback(async (userId) => {
    // Show the device-cached search history immediately (no DB wait), then
    // quietly refresh from Supabase below and update the cache to match —
    // keeps things instant on reopen while still staying in sync.
    const cachedSearch = getCachedUserSearchHistory(userId);
    if (cachedSearch) setSearchHistory(cachedSearch);

    try {
      const [createdRoutes, searchHistoryData] = await Promise.all([
        supabase.from('user_created_routes').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('search_history').select('*').eq('user_id', userId).order('searched_at', { ascending: false })
      ]);

      if (!createdRoutes.error) setCreatedRoutesHistory(createdRoutes.data || []);
      if (!searchHistoryData.error) {
        setSearchHistory(searchHistoryData.data || []);
        setCachedUserSearchHistory(userId, searchHistoryData.data || []);
      }
    } catch (error) {
      console.error('Error fetching user history:', error);
    }
  }, []);

  // Save search history — Supabase for signed-in users, an on-device
  // cookie for guests so they still get a "recent searches" list.
  const saveSearchHistory = useCallback(async (start, dest) => {
    if (!user) {
      const updated = addSearchToCookie(start, dest);
      setSearchHistory(updated);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('search_history')
        .insert({
          user_id: user.id,
          start_point: start,
          destination: dest
        })
        .select()
        .single();

      if (error) {
        console.error('Error saving search history:', error);
        return;
      }

      // Mirror the new entry into the device cache so it's there instantly
      // on next app open without waiting on a fresh DB fetch.
      setSearchHistory((prev) => {
        const updated = data ? [data, ...prev] : prev;
        setCachedUserSearchHistory(user.id, updated);
        return updated;
      });
    } catch (error) {
      console.error('Error saving search history:', error);
    }
  }, [user]);

  // Clear all search history for the current user (or guest cookie)
  const clearSearchHistory = useCallback(async () => {
    if (!user) {
      setSearchHistory(clearSearchHistoryCookie());
      return;
    }

    try {
      const { error } = await supabase
        .from('search_history')
        .delete()
        .eq('user_id', user.id);

      if (error) {
        console.error('Error clearing search history:', error);
        return;
      }

      setSearchHistory([]);
      setCachedUserSearchHistory(user.id, []);
    } catch (error) {
      console.error('Error clearing search history:', error);
    }
  }, [user]);

  // Delete a single search history item (Supabase row or cookie entry)
  const deleteSearchHistoryItem = useCallback(async (itemId) => {
    if (!user) {
      setSearchHistory(deleteSearchFromCookie(itemId));
      return;
    }

    try {
      const { error } = await supabase
        .from('search_history')
        .delete()
        .eq('id', itemId)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error deleting search history item:', error);
        return;
      }

      setSearchHistory(prev => {
        const updated = prev.filter(item => item.id !== itemId);
        setCachedUserSearchHistory(user.id, updated);
        return updated;
      });
    } catch (error) {
      console.error('Error deleting search history item:', error);
    }
  }, [user]);

  // Fetch stop suggestions
  const fetchSuggestions = useCallback(async (query, type) => {
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }

    // Device cache first — repeat lookups (retyping, or the same query on a
    // later app open) are served without hitting the `stops` table again.
    const cached = getCachedStopSearch(query);
    if (cached) {
      setSuggestions(cached);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('stops')
        .select('*')
        .ilike('name', `%${query}%`)
        .limit(5);

      if (!error && data) {
        setSuggestions(data);
        setCachedStopSearch(query, data);
      } else {
        const filtered = SAMPLE_STOPS.filter(stop => 
          stop.name.toLowerCase().includes(query.toLowerCase())
        );
        setSuggestions(filtered);
      }
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      const filtered = SAMPLE_STOPS.filter(stop => 
        stop.name.toLowerCase().includes(query.toLowerCase())
      );
      setSuggestions(filtered);
    }
  }, []);

  // Authentication functions
  const handleSignIn = useCallback(async (email, password) => {
    setAuthLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
      });

      if (error) throw error;

      setUser(data.user);
      await fetchUserProfile(data.user.id);
      setShowProfileModal(false);
      setShowWelcomeBanner(true);
      setTimeout(() => setShowWelcomeBanner(false), 5000);
      
      // Start realtime subscriptions after sign in
      setupRealtimeSubscriptions();
      
      return true;
    } catch (error) {
      alert('Sign In Error: ' + error.message);
      return false;
    } finally {
      setAuthLoading(false);
    }
  }, [fetchUserProfile]);

  const handleSignUp = useCallback(async (email, password, firstName, lastName) => {
    setAuthLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email,
        password: password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName
          }
        }
      });

      if (error) throw error;

      alert('Success: Account created successfully! Please check your email for verification.');
      return true;
    } catch (error) {
      alert('Sign Up Error: ' + error.message);
      return false;
    } finally {
      setAuthLoading(false);
    }
  }, []);

  // Opens the confirmation modal instead of signing out immediately
  const handleSignOut = useCallback(() => {
    setShowSignOutConfirmModal(true);
  }, []);

  // Called when the user confirms sign out in the modal
  const confirmSignOut = useCallback(async () => {
    setShowSignOutConfirmModal(false);
    setSignOutLoading(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      setUser(null);
      setUserProfile(null);
      setShowProfileModal(false);
      setShowWelcomeBanner(false);
      setRoutes([]);
      setSelectedRoute(null);
      setSuggestions([]);
      setShowBottomSheet(false);

      // Stop realtime subscriptions on sign out
      stopRealtimeSubscriptions();

      setSignOutLoading(false);
      setShowSignOutSuccessModal(true);
    } catch (error) {
      setSignOutLoading(false);
      alert('Error: ' + error.message);
    }
  }, []);

  // Auto-dismiss the sign-out success modal after a couple of seconds
  useEffect(() => {
    if (showSignOutSuccessModal) {
      const timer = setTimeout(() => setShowSignOutSuccessModal(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [showSignOutSuccessModal]);

  // Reset the Account sub-view whenever the profile modal is closed
  useEffect(() => {
    if (!showProfileModal) {
      setProfileView('menu');
      setNameUpdateSuccess(false);
      setShowGuestSignIn(false);
    }
  }, [showProfileModal]);

  const handleOpenAccountView = useCallback(() => {
    setEditFirstName(userProfile?.first_name || '');
    setEditLastName(userProfile?.last_name || '');
    setNameUpdateSuccess(false);
    setProfileView('account');
  }, [userProfile]);

  const handleUpdateName = useCallback(async () => {
    if (!user) return;
    if (!editFirstName.trim() || !editLastName.trim()) {
      alert('Error: Please enter both first and last name');
      return;
    }
    setNameUpdateLoading(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ first_name: editFirstName.trim(), last_name: editLastName.trim() })
        .eq('id', user.id);
      if (error) throw error;

      setUserProfile((prev) => prev
        ? { ...prev, first_name: editFirstName.trim(), last_name: editLastName.trim() }
        : prev);
      setNameUpdateSuccess(true);
      setTimeout(() => setNameUpdateSuccess(false), 2000);
    } catch (error) {
      alert('Error: ' + error.message);
    } finally {
      setNameUpdateLoading(false);
    }
  }, [user, editFirstName, editLastName]);

  const confirmDeleteAccount = useCallback(async () => {
    setShowDeleteAccountConfirm(false);
    setDeleteAccountLoading(true);
    try {
      const { error } = await supabase.functions.invoke('delete-user');
      if (error) throw error;

      setUser(null);
      setUserProfile(null);
      setShowProfileModal(false);
      setShowWelcomeBanner(false);
      setRoutes([]);
      setSelectedRoute(null);
      setSuggestions([]);
      setShowBottomSheet(false);

      stopRealtimeSubscriptions();

      setDeleteAccountLoading(false);
    } catch (error) {
      setDeleteAccountLoading(false);
      alert('Error deleting account: ' + error.message);
    }
  }, []);

  const handlePasswordChange = useCallback(async () => {
    if (!user) return;
    
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email,{
        redirectTo: "https://user-gtt.nxnx.tech/reset-password/"
      });
      if (error) throw error;
      
      alert('Password Reset: Check your email for the password reset link');
    } catch (error) {
      alert('Error: ' + error.message);
    }
  }, [user]);

  // ── Volunteer mode ──────────────────────────────────────────────────────
  const handleStartVolunteering = useCallback(() => {
    setShowProfileModal(false);
    setVolunteerMode(true);
  }, []);

  const handleStopVolunteering = useCallback(() => {
    setVolunteerMode(false);
    setShowAddStopModal(false);
    setPendingStopCoords(null);
  }, []);

  // Called by MapComponent when the map is tapped while volunteerMode is on
  const handleMapTap = useCallback((lat, lng) => {
    if (!volunteerMode) return;
    setPendingStopCoords({ lat, lng });
    setNewStopName('');
    setNewStopImages([]);
    setAddStopSuccess(false);
    setShowAddStopModal(true);
  }, [volunteerMode]);

  // Called by MapComponent when a nearby-stop dot is double-tapped —
  // pre-fills the "start" field with that stop's name and opens the
  // search sheet so the user can pick a destination.
  const handleNearbyStopSelect = useCallback((name) => {
    if (!name) return;
    setStartPoint(name);
    setActiveInput('start');
    setSuggestions([]);
    setBottomSheetContent('search');
    setShowBottomSheet(true);
  }, []);

  const closeAddStopModal = useCallback(() => {
    setShowAddStopModal(false);
    setPendingStopCoords(null);
    setNewStopName('');
    setNewStopImages([]);
  }, []);

  const handleAddStopImagesSelected = useCallback((e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setNewStopImages((prev) => [...prev, ...files]);
    e.target.value = '';
  }, []);

  const removeNewStopImage = useCallback((index) => {
    setNewStopImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Submits a volunteer-added stop (and any photos) — unapproved until a
  // moderator reviews it, exactly like the earner-submitted stops flow.
  const handleSubmitNewStop = useCallback(async () => {
    if (!pendingStopCoords || !newStopName.trim()) return;
    setAddStopSubmitting(true);
    try {
      // Generate the id client-side so we can attach photos to it without
      // needing to select the (still-unapproved) row back under RLS.
      const newStopId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

      const { error: stopError } = await supabase.from('stops').insert({
        id: newStopId,
        name: newStopName.trim(),
        latitude: pendingStopCoords.lat,
        longitude: pendingStopCoords.lng,
        approved: false,
      });
      if (stopError) throw stopError;

      for (const file of newStopImages) {
        try {
          const ext = (file.name?.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
          const leaf = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
          const path = `${newStopId}/${leaf}.${ext}`;

          const { error: uploadError } = await supabase.storage
            .from('stop-images')
            .upload(path, file, { contentType: file.type || 'image/jpeg' });
          if (uploadError) throw uploadError;

          const { data: publicData } = supabase.storage.from('stop-images').getPublicUrl(path);
          await supabase.from('stop_images').insert({
            stop_id: newStopId,
            url: publicData?.publicUrl,
            uploaded_by: user?.id ?? null,
            approved: false,
          });
        } catch (imgErr) {
          // One photo failing shouldn't block the stop submission itself
          console.error('Error uploading a stop photo:', imgErr);
        }
      }

      setAddStopSuccess(true);
      setTimeout(() => {
        setShowAddStopModal(false);
        setPendingStopCoords(null);
        setNewStopName('');
        setNewStopImages([]);
        setAddStopSuccess(false);
      }, 1200);
    } catch (error) {
      console.error('Error adding volunteer stop:', error);
      alert('Error: ' + (error.message || 'Could not add this stop. Please try again.'));
    } finally {
      setAddStopSubmitting(false);
    }
  }, [pendingStopCoords, newStopName, newStopImages, user]);

  // ── Donate (Paystack Inline)
  const PAYSTACK_PUBLIC_KEY = "pk_live_be7ac128a98aa85c216b52f64f1ad5523bd3193e";

  const loadPaystackScript = useCallback(() => {
    if (window.PaystackPop) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const existing = document.getElementById('paystack-inline-script');
      if (existing) {
        existing.addEventListener('load', resolve);
        existing.addEventListener('error', reject);
        return;
      }
      const script = document.createElement('script');
      script.id = 'paystack-inline-script';
      script.src = 'https://js.paystack.co/v1/inline.js';
      script.onload = resolve;
      script.onerror = reject;
      document.body.appendChild(script);
    });
  }, []);

  console.log('Paystack key:', PAYSTACK_PUBLIC_KEY);

  const handleDonate = useCallback(async () => {
    const amountGHS = parseFloat(donateAmount);
    if (!amountGHS || amountGHS <= 0) {
      alert('Please enter a valid donation amount.');
      return;
    }
    const email = (donateEmail || user?.email || '').trim();
    if (!email) {
      alert('Please enter an email address for your receipt.');
      return;
    }

    setDonateLoading(true);
    try {
      if (!PAYSTACK_PUBLIC_KEY || !PAYSTACK_PUBLIC_KEY.startsWith('pk_')) {
        console.error(
          'Paystack public key is missing or invalid:',
          PAYSTACK_PUBLIC_KEY,
          '— check your REACT_APP_PAYSTACK_PUBLIC_KEY (or VITE_ equivalent) env var, ' +
          'that the dev server was restarted after setting it, and that it is set in your ' +
          'deployment environment for production builds.'
        );
        alert('Donations are temporarily unavailable (missing payment configuration). Please try again later.');
        setDonateLoading(false);
        return;
      }
      await loadPaystackScript();
      const handler = window.PaystackPop.setup({
        key: PAYSTACK_PUBLIC_KEY,
        email,
        amount: Math.round(amountGHS * 100), // Paystack expects the smallest unit (pesewas)
        currency: 'GHS',
        metadata: { donation: true, user_id: user?.id ?? null },
        callback: function (response) {
          setDonateLoading(false);
          setShowDonateModal(false);
          alert('Thank you for your donation! Reference: ' + response.reference);
          // For production, verify response.reference server-side (e.g. a
          // Supabase Edge Function calling Paystack's verify endpoint)
          // before treating the donation as confirmed.
        },
        onClose: function () {
          setDonateLoading(false);
        },
      });
      handler.openIframe();
    } catch (error) {
      console.error('Error starting donation checkout:', error);
      setDonateLoading(false);
      alert('Could not start checkout. Please check your connection and try again.');
    }
  }, [donateAmount, donateEmail, user, loadPaystackScript]);

  const handleForgotPasswordFromProfile = useCallback(async () => {
    if (!forgotPasswordEmail) {
      alert('Please enter your email address');
      return;
    }
    setForgotPasswordLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotPasswordEmail, {
        redirectTo: 'https://user-gtt.nxnx.tech/reset-password',
      });
      if (error) throw error;
      setForgotPasswordSent(true);
    } catch (error) {
      alert('Error sending reset email: ' + error.message);
    } finally {
      setForgotPasswordLoading(false);
    }
  }, [forgotPasswordEmail]);

  const handleSubmitReport = useCallback(async () => {
    if (!reportReason) return;
    setReportSubmitting(true);
    try {
      const { error } = await supabase
        .from('reports')
        .insert({
          // For general reports (from profile), no route is attached
          route_id:   isGeneralReport ? null : (selectedRoute?.id ?? null),
          route_name: isGeneralReport ? null : (selectedRoute?.name ?? null),
          user_id:    user?.id ?? null,
          reason:     reportReason,
          message:    reportNote.trim() || null,
        });
      if (error) throw error;
      setReportSuccess(true);
    } catch (err) {
      alert('Failed to submit report. Please try again.');
    } finally {
      setReportSubmitting(false);
    }
  }, [reportReason, reportNote, selectedRoute, user, isGeneralReport]);

  const closeReportModal = useCallback(() => {
    setShowReportModal(false);
    setReportReason('');
    setReportNote('');
    setReportSuccess(false);
    setIsGeneralReport(false);
  }, []);

  const fetchRouteInfo = useCallback(async (routeId) => {
    if (!routeId) {
      setRouteInfoData(null);
      return;
    }

    try {
      // Try different table names for route info
      let routeInfo = null;
      
      // Try 'route_info' table first
      const { data: infoData, error: infoError } = await supabase
        .from('route_info')
        .select('*')
        .eq('route_id', routeId)
        .maybeSingle();
      
      if (!infoError && infoData) {
        routeInfo = infoData;
      } else {
        // Try 'route_infos' table (plural)
        const { data: infosData, error: infosError } = await supabase
          .from('route_infos')
          .select('*')
          .eq('route_id', routeId)
          .maybeSingle();
        
        if (!infosError && infosData) {
          routeInfo = infosData;
        } else {
          // Try 'routes' table for embedded info
          const { data: routeData, error: routeError } = await supabase
            .from('routes')
            .select('description, travel_time_minutes, peak_hours, frequency, vehicle_type, notes, amenities, operating_hours')
            .eq('id', routeId)
            .maybeSingle();
          
          if (!routeError && routeData) {
            // Check if any info exists in the route itself
            const hasInfo = Object.values(routeData).some(value => 
              value !== null && value !== '' && 
              (!Array.isArray(value) || value.length > 0) &&
              (typeof value !== 'object' || Object.keys(value).length > 0)
            );
            
            if (hasInfo) {
              routeInfo = routeData;
            }
          }
        }
      }
      
      if (routeInfo) {
        setRouteInfoData({
          description: routeInfo.description || '',
          travel_time_minutes: routeInfo.travel_time_minutes || routeInfo.travelTimeMinutes || '',
          peak_hours: routeInfo.peak_hours || routeInfo.peakHours || '',
          frequency: routeInfo.frequency || '',
          vehicle_type: routeInfo.vehicle_type || routeInfo.vehicleType || '',
          notes: routeInfo.notes || '',
          amenities: routeInfo.amenities || [],
          operating_hours: routeInfo.operating_hours || routeInfo.operatingHours || {
            start: '',
            end: '',
            days: []
          }
        });
      } else {
        setRouteInfoData(null);
      }
      
    } catch (error) {
      console.error('Error fetching route info:', error);
      setRouteInfoData(null);
    }
  }, []);

  // Setup realtime subscriptions
  const setupRealtimeSubscriptions = useCallback(() => {
    if (realtimeSubscriptionRef.current) {
      supabase.removeChannel(realtimeSubscriptionRef.current);
    }

    console.log('Setting up realtime subscriptions...');

    // Subscribe to routes changes
    const routesChannel = supabase
      .channel('routes-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'routes'
        },
        async (payload) => {
          console.log('Route change detected:', payload);
          setLastUpdateTime(new Date());
          
          // If we have an active search, refresh the routes
          if (routes.length > 0 && startPoint && destination) {
            await refreshCurrentRoutes();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'route_stops'
        },
        async (payload) => {
          console.log('Route stop change detected:', payload);
          setLastUpdateTime(new Date());
          
          // If we have an active search, refresh the routes
          if (routes.length > 0 && startPoint && destination) {
            await refreshCurrentRoutes();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'stops'
        },
        async (payload) => {
          console.log('Stop change detected:', payload);
          setLastUpdateTime(new Date());
          
          // If we have an active search, refresh the routes
          if (routes.length > 0 && startPoint && destination) {
            await refreshCurrentRoutes();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'route_info'
        },
        (payload) => {
          console.log('Route info change detected:', payload);
          setLastUpdateTime(new Date());
          
          // If current route info changed, refresh it
          if (selectedRoute?.id === payload.new?.route_id || selectedRoute?.id === payload.old?.route_id) {
            fetchRouteInfo(selectedRoute.id);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'route_infos'
        },
        (payload) => {
          console.log('Route infos change detected:', payload);
          setLastUpdateTime(new Date());
          
          // If current route info changed, refresh it
          if (selectedRoute?.id === payload.new?.route_id || selectedRoute?.id === payload.old?.route_id) {
            fetchRouteInfo(selectedRoute.id);
          }
        }
      )
      .subscribe((status) => {
        console.log('Realtime subscription status:', status);
        setIsRealtimeConnected(status === 'SUBSCRIBED');
        setConnectionStatus(status);
        
        if (status === 'SUBSCRIBED') {
          setLastUpdateTime(new Date());
          console.log('✅ Realtime connection established');
        }
      });

    realtimeSubscriptionRef.current = routesChannel;
  }, [routes, startPoint, destination, selectedRoute, fetchRouteInfo]);

  // Ensure session and realtime subscriptions are active when user interacts
  const ensureConnected = useCallback(async () => {
    try {
      // Re-check session and user state
      await checkUser();

      // If subscriptions are not active, try to re-subscribe
      if (!realtimeSubscriptionRef.current || connectionStatus !== 'SUBSCRIBED') {
        setupRealtimeSubscriptions();
      }
    } catch (error) {
      console.error('Error ensuring connection:', error);
    }
  }, [checkUser, setupRealtimeSubscriptions, connectionStatus]);

  // Stop realtime subscriptions
  const stopRealtimeSubscriptions = useCallback(() => {
    if (realtimeSubscriptionRef.current) {
      console.log('Stopping realtime subscriptions...');
      supabase.removeChannel(realtimeSubscriptionRef.current);
      realtimeSubscriptionRef.current = null;
      setIsRealtimeConnected(false);
      setConnectionStatus('disconnected');
    }
  }, []);

  // Refresh current routes without UI flicker
  const refreshCurrentRoutes = useCallback(async () => {
    try {
      const { data: routesData, error } = await supabase
        .from('routes')
        .select(`
          *,
          route_stops(
            stop_order,
            fare_to_next,
            distance_to_next,
            stops(*)
          )
        `)
        .order('total_fare');

      if (error) throw error;

      if (routesData && routesData.length > 0) {
        // Filter routes that match current search criteria
        const matchingRoutes = routesData.filter(route => {
          if (!route.route_stops || route.route_stops.length === 0) return false;
          
          const sortedStops = route.route_stops.sort((a, b) => a.stop_order - b.stop_order);
          const firstStop = sortedStops[0];
          const lastStop = sortedStops[sortedStops.length - 1];
          
          const firstStopName = firstStop.stops.name.toLowerCase();
          const lastStopName = lastStop.stops.name.toLowerCase();
          const userStart = startPoint.toLowerCase();
          const userDest = destination.toLowerCase();
          
          const startMatches = firstStopName.includes(userStart) || userStart.includes(firstStopName);
          const destMatches = lastStopName.includes(userDest) || userDest.includes(lastStopName);
          
          return startMatches && destMatches;
        });

        // Format routes (handles composite routes)
        const formattedRoutes = await Promise.all(matchingRoutes.map(route => formatRoute(route)));

        // Cache routes for comparison
        const cachedRoutes = routesCacheRef.current;
        routesCacheRef.current = formattedRoutes;

        // Only update if routes actually changed
        if (!cachedRoutes || JSON.stringify(cachedRoutes) !== JSON.stringify(formattedRoutes)) {
          setRoutes(formattedRoutes);
          console.log('Routes updated:', formattedRoutes.length, 'routes found');
        }

        // Update selected route if it still exists
        if (selectedRoute && formattedRoutes.length > 0) {
          const currentSelectedRoute = formattedRoutes.find(r => r.id === selectedRoute.id);
          if (currentSelectedRoute) {
            // Only update if selected route changed
            if (JSON.stringify(selectedRoute) !== JSON.stringify(currentSelectedRoute)) {
              setSelectedRoute(currentSelectedRoute);
              console.log('Selected route updated');
            }
          } else {
            // If current selected route no longer exists, select the first one
            setSelectedRoute(formattedRoutes[0]);
            console.log('Selected route changed to first available');
          }
        }
      }
    } catch (error) {
      console.error('Error refreshing routes:', error);
    }
  }, [startPoint, destination, selectedRoute]);

  // Log a search that returned no matching routes, so we can see demand
  // for routes that don't exist in the database yet. Best-effort — a
  // failure here should never block the "route not found" UX.
  const logUnmatchedSearch = useCallback(async (start, dest) => {
    try {
      await supabase.from('unmatched_searches').insert({
        start_point: start,
        destination: dest,
        user_id: user?.id ?? null,
      });
    } catch (error) {
      console.error('Error logging unmatched search:', error);
    }
  }, [user]);

  // Update the findRoutes function
  const findRoutes = useCallback(async () => {
    if (!startPoint || !destination) {
      alert('Error: Please enter both start and destination points');
      return;
    }

    // Indicate that route search is in progress
    setIsFindingRoutes(true);

    // Save to search history
    await saveSearchHistory(startPoint, destination);

    try {
      console.log('Searching for routes from:', startPoint, 'to:', destination);
      
      // Fetch routes with stops
      const { data: routesData, error } = await supabase
        .from('routes')
        .select(`
          *,
          route_stops(
            stop_order,
            fare_to_next,
            distance_to_next,
            stops(*)
          )
        `)
        .order('total_fare');

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      console.log('Fetched routes from database:', routesData);

      if (!routesData || routesData.length === 0) {
        await logUnmatchedSearch(startPoint, destination);
        setShowRouteNotFoundModal(true);
        return;
      }

      // Filter routes that match the search criteria
      const matchingRoutes = routesData.filter(route => {
        if (!route.route_stops || route.route_stops.length === 0) return false;
        
        const sortedStops = route.route_stops.sort((a, b) => a.stop_order - b.stop_order);
        const firstStop = sortedStops[0];
        const lastStop = sortedStops[sortedStops.length - 1];
        
        const firstStopName = firstStop.stops.name.toLowerCase();
        const lastStopName = lastStop.stops.name.toLowerCase();
        const userStart = startPoint.toLowerCase();
        const userDest = destination.toLowerCase();
        
        const startMatches = firstStopName.includes(userStart) || userStart.includes(firstStopName);
        const destMatches = lastStopName.includes(userDest) || userDest.includes(lastStopName);
        
        return startMatches && destMatches;
      });

      console.log('Matching routes found:', matchingRoutes.length);

      if (matchingRoutes.length === 0) {
        await logUnmatchedSearch(startPoint, destination);
        setShowRouteNotFoundModal(true);
        return;
      }

      // Format the routes for the app (handles composite routes)
      const formattedRoutes = await Promise.all(matchingRoutes.map(route => formatRoute(route)));

      // Cache routes
      routesCacheRef.current = formattedRoutes;
      setRoutes(formattedRoutes);
      
      // Auto-select the first route
      const firstRoute = formattedRoutes[0];
      setSelectedRoute(firstRoute);
      
      // Fetch route info for the selected route
      await fetchRouteInfo(firstRoute.id);
      
      setBottomSheetContent('route');
      setShowBottomSheet(true);
      setLastUpdateTime(new Date());
      
    } catch (error) {
      console.error('Error finding routes:', error);
      alert('Error searching for routes. Please try again.');
    } finally {
      setIsFindingRoutes(false);
    }
  }, [user, startPoint, destination, saveSearchHistory, fetchRouteInfo, logUnmatchedSearch]);

  const swapLocations = useCallback(() => {
    const temp = startPoint;
    setStartPoint(destination);
    setDestination(temp);
  }, [startPoint, destination]);

  const resetSearch = useCallback(() => {
    setStartPoint('');
    setDestination('');
    setRoutes([]);
    setSelectedRoute(null);
    setSuggestions([]);
    setShowBottomSheet(true);
    setBottomSheetContent('search');
    routesCacheRef.current = null;
  }, []);

  const closeBottomSheet = useCallback(() => {
    setShowBottomSheet(false);
    setBottomSheetState('route-details');
    setShowSwipeIndicator(true);
  }, []);

  const showRouteDetails = useCallback(() => {
    if (selectedRoute) {
      setBottomSheetState('route-details');
      setShowBottomSheet(true);
      setShowSwipeIndicator(true);
    } else {
      setBottomSheetContent('search');
      setShowBottomSheet(true);
    }
  }, [selectedRoute]);

  const handleTouchStart = (e) => {
    const clientX = e.touches && e.touches[0] ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches && e.touches[0] ? e.touches[0].clientY : e.clientY;
    setTouchStart(clientX);
    touchStartYRef.current = clientY;
    swipeAxisLockRef.current = null;
    setIsSwipeActive(false);
    setSwipeTranslate(0);
  };

  const handleTouchMove = (e) => {
    if (touchStart === null) return;
    if (bottomSheetContent !== 'route') return;

    const clientX = e.touches && e.touches[0] ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches && e.touches[0] ? e.touches[0].clientY : e.clientY;
    const distance = clientX - touchStart;
    const distanceY = touchStartYRef.current !== null ? clientY - touchStartYRef.current : 0;

    // Decide the gesture's axis once, early on, and stick with it — this is
    // what stops a vertical scroll from ever nudging the sheet sideways.
    if (swipeAxisLockRef.current === null) {
      if (Math.abs(distance) < 8 && Math.abs(distanceY) < 8) return; // not enough movement yet
      swipeAxisLockRef.current = Math.abs(distance) > Math.abs(distanceY) ? 'x' : 'y';
      if (swipeAxisLockRef.current === 'x') setIsSwipeActive(true);
    }

    if (swipeAxisLockRef.current !== 'x') return; // vertical gesture — leave the sheet alone

    // Limit the drag to -100% to 100%
    const clampedDistance = Math.max(-window.innerWidth, Math.min(window.innerWidth, distance));
    setSwipeTranslate(clampedDistance);
  };

  const handleTouchEnd = () => {
    if (touchStart === null) return;

    const swipeThreshold = window.innerWidth * 0.2; // 20% of screen width

    // Only resolve into a page change if this gesture was locked to the x-axis
    if (bottomSheetContent === 'route' && swipeAxisLockRef.current === 'x') {
      if (swipeTranslate < -swipeThreshold && bottomSheetState === 'route-details') {
        // Swiped left - go to route-info
        setPrevBottomSheetState('route-details');
        setBottomSheetState('route-info');
        setSwipeTranslate(0);
      } else if (swipeTranslate > swipeThreshold && bottomSheetState === 'route-info') {
        // Swiped right - go to route-details
        setPrevBottomSheetState('route-info');
        setBottomSheetState('route-details');
        setSwipeTranslate(0);
      } else {
        // Snap back to current position
        setSwipeTranslate(0);
      }
    }

    setShowSwipeIndicator(false);
    setIsSwipeActive(false);
    setTouchStart(null);
    touchStartYRef.current = null;
    swipeAxisLockRef.current = null;
  };

  // Pointer event fallbacks for desktop / trackpad
  const handlePointerDown = (e) => {
    setTouchStart(e.clientX);
  };

  const handlePointerMove = (e) => {
    setTouchEnd(e.clientX);
  };

  const handlePointerUp = () => {
    handleTouchEnd();
  };

  const toggleBottomSheetContent = () => {
    setPrevBottomSheetState(bottomSheetState);
    setBottomSheetState(prev => 
      prev === 'route-details' ? 'route-info' : 'route-details'
    );
    setShowSwipeIndicator(false);
  };

  const handleIndicatorClick = () => {
    toggleBottomSheetContent();
    setShowSwipeIndicator(false);
  };

  // ── Sheet vertical drag handlers ─────────────────────────────────────────
  const handleSheetHandlePointerDown = useCallback((e) => {
    e.stopPropagation();
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    sheetDragRef.current = {
      ...sheetDragRef.current,
      active: true,
      startY: clientY,
      startH: sheetDragHeight,
      currentH: sheetDragHeight,
    };
    setSheetIsDragging(true);
  }, [sheetDragHeight]);

  useEffect(() => {
    if (!sheetIsDragging) return;

    const onMove = (e) => {
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const d = sheetDragRef.current;
      const deltaVh = ((d.startY - clientY) / window.innerHeight) * 100;
      // Let the sheet be dragged all the way down so the user can feel it
      // collapsing toward the dismiss threshold, rather than hard-stopping at 20vh.
      const newH = Math.min(92, Math.max(4, d.startH + deltaVh));
      d.currentH = newH;
      setSheetDragHeight(newH);
    };

    const onUp = () => {
      const h = sheetDragRef.current.currentH;

      if (h <= 20) {
        // Dragged down to (or past) the dismiss threshold — close the sheet
        closeBottomSheet();
        setSheetIsDragging(false);
        return;
      }

      // Otherwise: free snap — the sheet just stays wherever the user left it
      setSheetDragHeight(h);
      setSheetIsDragging(false);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchend', onUp);
    };
  }, [sheetIsDragging, closeBottomSheet]);

  // Reset sheet to mid snap when bottom sheet opens
  useEffect(() => {
    if (showBottomSheet) {
      setSheetSnapIndex(1);
      setSheetDragHeight(SNAP_HEIGHTS[1]);
    }
  }, [showBottomSheet]);

  // Auto-hide swipe indicator after 5 seconds
  useEffect(() => {
    if (!showSwipeIndicator) return;
    const timer = setTimeout(() => setShowSwipeIndicator(false), 5000);
    return () => clearTimeout(timer);
  }, [showSwipeIndicator]);

  // Check if any modal or bottom sheet is open
  const isAnyModalOpen = showBottomSheet || showProfileModal || showInfoModal || showSearchHistoryModal || showRouteNotFoundModal;

  // Effects
  useEffect(() => {
    isMountedRef.current = true;
    checkUser();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const newUser = session?.user ?? null;
      setUser(newUser);
      
      if (newUser) {
        await fetchUserProfile(newUser.id);
        await fetchUserHistory(newUser.id);
        
        if (event === 'SIGNED_IN') {
          setShowWelcomeBanner(true);
          setTimeout(() => setShowWelcomeBanner(false), 5000);
          // Setup realtime subscriptions after sign in
          setupRealtimeSubscriptions();
        }
      } else {
        setUserProfile(null);
        setCreatedRoutesHistory([]);
        setSearchHistory(getSearchHistoryFromCookie());
        // Stop realtime subscriptions on sign out
        stopRealtimeSubscriptions();
      }
    });

    // Setup realtime subscriptions on mount
    setupRealtimeSubscriptions();

    // Set initial update time
    setLastUpdateTime(new Date());

    return () => {
      isMountedRef.current = false;
      subscription?.unsubscribe();
      stopRealtimeSubscriptions();
    };
  }, [checkUser, fetchUserProfile, fetchUserHistory, setupRealtimeSubscriptions, stopRealtimeSubscriptions]);

  // When app regains focus or becomes visible again, ensure we reconnect
  // and refresh current data without resetting user input or UI state.
  useEffect(() => {
    let isActive = true;
    const lastFocusRef = { current: 0 };

    const handleFocus = async () => {
      try {
        // avoid rapid repeated calls
        const now = Date.now();
        if (now - lastFocusRef.current < 800) return;
        lastFocusRef.current = now;

        await ensureConnected();

        // Refresh user data quietly
        if (user) {
          try {
            await fetchUserProfile(user.id);
            await fetchUserHistory(user.id);
          } catch (err) {
            console.warn('Could not refresh user profile/history on focus:', err);
          }
        }

        // If there was an active search or routes present, refresh them
        if (startPoint && destination) {
          try {
            await refreshCurrentRoutes();
          } catch (err) {
            console.warn('Error refreshing routes on focus:', err);
          }
        } else if (routes.length > 0) {
          try {
            await refreshCurrentRoutes();
          } catch (err) {
            console.warn('Error refreshing routes on focus:', err);
          }
        }

        // Refresh selected route info if visible
        if (selectedRoute) {
          try {
            await fetchRouteInfo(selectedRoute.id);
          } catch (err) {
            console.warn('Error fetching route info on focus:', err);
          }
        }
      } catch (error) {
        console.error('Error handling app focus/visibility:', error);
      }
    };

    const visibilityHandler = () => {
      if (document.visibilityState === 'visible') {
        handleFocus();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', visibilityHandler);

    return () => {
      isActive = false;
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', visibilityHandler);
    };
  }, [ensureConnected, user, startPoint, destination, routes, selectedRoute, fetchUserProfile, fetchUserHistory, refreshCurrentRoutes, fetchRouteInfo]);

  useEffect(() => {
    if (selectedRoute) {
      fetchRouteInfo(selectedRoute.id);
    }
  }, [selectedRoute, fetchRouteInfo]);

  // Render search form with realtime indicator
  const renderSearchForm = useCallback(() => (
    <div className="search-section">
      <div className="scroll-view">
        <div className="sheet-header">
          <div className="header-content">
            <h1 className="app-title">Ghana Trotro Transit</h1>
            <p className="app-subtitle">Find your perfect trotro route</p>
          </div>
          <div className="header-actions">
            <button 
              className="close-button"
              onClick={closeBottomSheet}
            >
              <X size={18} strokeWidth={2.5} />
            </button>
          </div>
        </div>
        
        {user && showWelcomeBanner && (
          <div className="welcome-banner">
            <span className="welcome-text">
              Welcome back, {userProfile?.first_name || user.email?.split('@')[0]}! 👋
            </span>
          </div>
        )}

      
        <div className="search-card">
          <div className="input-row">
            <div className="input-container input-container-start">
              <div className="input-icon">
                <MapPin size={20} color={COLORS.primary} />
              </div>
              <input
                ref={startInputRef}
                className="input"
                placeholder="Where are you starting from?"
                value={startPoint}
                onChange={(e) => {
                  setStartPoint(e.target.value);
                  setActiveInput('start');
                  ensureConnected();
                  fetchSuggestions(e.target.value, 'start');
                }}
                onFocus={() => {
                  setActiveInput('start');
                  ensureConnected();
                }}
              />
              {startPoint ? (
                <button className="input-clear-btn" onClick={() => { setStartPoint(''); setSuggestions([]); }} tabIndex={-1}>
                  <X size={14} />
                </button>
              ) : null}
            </div>

            <button 
              className="swap-button"
              onClick={swapLocations}
              title="Swap locations"
            >
              <ArrowUpDown size={18} color={COLORS.primary} />
            </button>

            <div className="input-container">
              <div className="input-icon">
                <Navigation size={20} color={COLORS.primary} />
              </div>
              <input
                ref={destinationInputRef}
                className="input"
                placeholder="Where are you going?"
                value={destination}
                onChange={(e) => {
                  setDestination(e.target.value);
                  setActiveInput('destination');
                  ensureConnected();
                  fetchSuggestions(e.target.value, 'destination');
                }}
                onFocus={() => {
                  setActiveInput('destination');
                  ensureConnected();
                }}
              />
              {destination ? (
                <button className="input-clear-btn" onClick={() => { setDestination(''); setSuggestions([]); }} tabIndex={-1}>
                  <X size={14} />
                </button>
              ) : null}
            </div>
          </div>

          {suggestions.length > 0 && (
            <div className="suggestions-container">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion.id}
                  className="suggestion-item"
                  onClick={() => {
                    if (activeInput === 'start') {
                      setStartPoint(suggestion.name);
                    } else {
                      setDestination(suggestion.name);
                    }
                    setSuggestions([]);
                  }}
                >
                  <MapPin size={16} color={COLORS.primary} />
                  <span className="suggestion-text">{suggestion.name}</span>
                </button>
              ))}
            </div>
          )}

          <button 
            className={`search-button ${isFindingRoutes ? 'search-button-loading' : ''}`} 
            onClick={findRoutes}
            disabled={isFindingRoutes}
          >
            {isFindingRoutes ? (
              <>
                <RefreshCw size={20} color="#FFFFFF" />
                <span className="search-button-text">Finding routes...</span>
              </>
            ) : (
              <>
                <Search size={20} color="#FFFFFF" />
                <span className="search-button-text">Find Routes</span>
              </>
            )}
          </button>
        </div>

        {searchHistory.length > 0 && (
          <div className="recent-searches">
            <button
              className="recent-searches-header"
              onClick={toggleRecentSearches}
            >
              <div className="recent-searches-header-left">
                <History size={16} color={COLORS.primary} />
                <span className="recent-searches-title">Recent Searches</span>
              </div>
              {showRecentSearches
                ? <ChevronUp size={18} color={COLORS.textLight} />
                : <ChevronDown size={18} color={COLORS.textLight} />
              }
            </button>

            {showRecentSearches && (
              <div className="recent-searches-list">
                {searchHistory.slice(0, 5).map((search) => (
                  <button
                    key={search.id}
                    className="recent-search-item"
                    onClick={() => {
                      setStartPoint(search.start_point);
                      setDestination(search.destination);
                      setSuggestions([]);
                    }}
                  >
                    <div className="recent-search-icon">
                      <MapPin size={14} color={COLORS.primary} />
                    </div>
                    <div className="recent-search-body">
                      <span className="recent-search-text">
                        {search.start_point}
                        <span className="recent-search-arrow"> → </span>
                        {search.destination}
                      </span>
                      <span className="recent-search-date">
                        {new Date(search.searched_at).toLocaleDateString()}
                      </span>
                    </div>
                    <ChevronRight size={16} color={COLORS.textLight} className="recent-search-chevron" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        
        {!user && (
          <div className="quick-auth-section">
            <span className="quick-auth-text">Don't have an account?</span>
            <button 
              className="quick-auth-button"
              onClick={() => setShowProfileModal(true)}
            >
              Sign Up Free
            </button>
            <button
              className="quick-auth-info-button"
              onClick={() => setShowInfoModal(true)}
              title="Why create an account?"
              aria-label="Why create an account?"
            >
              <Info size={16} color={COLORS.primary} />
            </button>
          </div>
        )}
      </div>
    </div>
  ), [user, startPoint, destination, suggestions, activeInput, showWelcomeBanner, userProfile, isRealtimeConnected, lastUpdateTime, fetchSuggestions, swapLocations, findRoutes, closeBottomSheet, ensureConnected, searchHistory, showRecentSearches, toggleRecentSearches]);

  // Render route details with realtime indicator
  const renderRouteDetails = useCallback(() => (
    <div className="route-details" 
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}>
      <div className="sheet-header">
        <div className="header-content">
          <h2 className="route-name">{selectedRoute?.name || 'Route Details'}</h2>

          <p className="route-subtitle">
            Ghana Trotro Transit Route
          </p>
        </div>
        <div className="header-buttons">
          <div className="realtime-status">
            <div className={`status-indicator ${isRealtimeConnected ? 'connected' : 'disconnected'}`} />
          </div>
          <button className="new-search-button" onClick={resetSearch} title="New Search">
            <Search size={18} color="#FFFFFF" />
          </button>
          <button 
            className="info-toggle-button"
            onClick={toggleBottomSheetContent}
            title="Show Route Information"
          >
            <ChevronLeft size={20} color={COLORS.primary} />
          </button>
          <button 
            className="close-button"
            onClick={closeBottomSheet}
            title="Close"
          >
            <X size={18} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {selectedRoute && (
        <div className="route-details-body">
          <div className="route-summary-cards">
            <div className="summary-card">
              <div className="summary-icon">
                <Map size={20} color={COLORS.primary} />
              </div>
              <div className="summary-content">
                <span className="summary-label">Total Distance</span>
                <span className="summary-value">{selectedRoute.total_distance} km</span>
              </div>
            </div>
            <div className="summary-card">
              <div className="summary-icon">
                  <span className="cedi-icon" style={{color: COLORS.primary, fontWeight: 600, fontSize: 20,}}>₵</span>
                </div>
              <div className="summary-content">
                <span className="summary-label">Total Fare</span>
                <span className="summary-value">GH₵ {selectedRoute.total_fare}</span>
              </div>
            </div>
            <div className="summary-card">
              <div className="summary-icon">
                <Clock size={20} color={COLORS.primary} />
              </div>
              <div className="summary-content">
                <span className="summary-label">Stops</span>
                <span className="summary-value">{selectedRoute.stops.length - 2} in between</span>
              </div>
            </div>
          </div>

          {routes.length > 1 && (
            <div className="route-options-container">
              <h3 className="route-options-title">Available Routes ({routes.length})</h3>
              <div className="route-options">
                {routes.map((route, index) => (
                  <button
                    key={route.id}
                    className={`route-option ${selectedRoute?.id === route.id ? 'route-option-selected' : ''}`}
                    onClick={() => {
                      setSelectedRoute(route);
                      // Route info will be fetched via useEffect
                    }}
                  >
                    <span className={`route-option-text ${selectedRoute?.id === route.id ? 'route-option-text-selected' : ''}`}>
                      Route {index + 1}
                    </span>
                    <span className="route-option-subtext">
                      GH₵ {route.total_fare} • {route.total_distance}km
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="stops-list">
            <div className="stops-title">
              <span className="stops-title-text">
                Route Stops
              </span>
              <div className="stops-title-actions">
                <span className="stops-count-badge">
                  {selectedRoute.is_composite
                    ? `${selectedRoute.compositionSegments.length + 1} stops`
                    : `${selectedRoute.stops.length} stops`}
                </span>
                <button
                  className="report-inline-button"
                  onClick={() => { setIsGeneralReport(false); setShowReportModal(true); }}
                  title="Report an issue"
                >
                  <Flag size={13} color="#000000" />
                  <span>Report</span>
                </button>
              </div>
            </div>

            <div className="stops-timeline">
              {selectedRoute.is_composite
                /* ── Composite route: one row per stop-point (A→B→C→D chain) ── */
                ? (() => {
                    const segs = selectedRoute.compositionSegments;
                    const displayNodes = [
                      { name: segs[0].fromName, nextSeg: segs[0] },
                      ...segs.slice(0, -1).map((seg, i) => ({
                        name:    seg.toName,         // = segs[i+1].fromName
                        nextSeg: segs[i + 1],
                      })),
                      { name: segs[segs.length - 1].toName, nextSeg: null },
                    ];

                    return displayNodes.map((node, index) => {
                      const isFirst      = index === 0;
                      const isLast       = index === displayNodes.length - 1;
                      const seg          = node.nextSeg;   
                      const isWalkToNext = !isLast && seg && Number(seg.fare) === 0;

                      return (
                        <div key={index} className={`stop-item-v2 ${isLast ? 'stop-item-v2--last' : ''}`}>
                          <div className="stop-connector">
                            <div className={`stop-node ${isFirst ? 'stop-node--start' : isLast ? 'stop-node--end' : 'stop-node--mid'}`}>
                              {isFirst ? <MapPin     size={13} color="#fff" /> :
                               isLast  ? <Navigation size={13} color="#fff" /> :
                                  <span style={{ fontSize: 9, color: '#fff', fontWeight: 700, lineHeight: 1 }}>{index}</span>}
                            </div>
                            {!isLast && (
                              <div className={`stop-connector-line${isWalkToNext ? ' stop-connector-line--walk' : ''}`} />
                            )}
                          </div>

                          <div className={`stop-card ${isFirst ? 'stop-card--start' : isLast ? 'stop-card--end' : ''}`}>
                            <div className="stop-card-top">
                              <div className="stop-card-label">
                                <span className={`stop-tag ${isFirst ? 'stop-tag--start' : isLast ? 'stop-tag--end' : 'stop-tag--mid'}`}>
                                  {isFirst ? 'Start' : isLast ? 'Destination' : `Stop ${index}`}
                                </span>
                              </div>
                              {/* Fare / Walk pill for the leg leaving this stop */}
                              {!isLast && seg && (
                                Number(seg.fare) === 0
                                  ? <span className="stop-walk-pill">Walk</span>
                                  : seg.fare != null && (
                                      <span className="stop-fare-pill">
                                        <span className="stop-fare-cedi">₵</span>
                                        {seg.fare}
                                      </span>
                                    )
                              )}
                            </div>

                            {/* Stop / junction name */}
                            <span className="stop-card-name">{node.name}</span>

                            {/* Sub-route label for the outgoing leg */}
                            {/* {!isLast && seg && (
                              <div className="stop-card-meta">
                                <span className="stop-meta-dot" />
                                <span className="stop-card-distance">via {seg.subRouteName}</span>
                              </div>
                            )} */}

                            {!isLast && seg?.distance && (
                              <div className="stop-card-meta">
                                <span className="stop-meta-dot" />
                                <span className="stop-card-distance">{seg.distance} km</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    });
                  })()

                /* ── Normal route: one row per stop ──────────────────────── */
                : selectedRoute.stops.map((stop, index) => {
                  const isFirst  = index === 0;
                  const isLast   = index === selectedRoute.stops.length - 1;
                  const stopClass = isFirst ? 'stop-node--start' : isLast ? 'stop-node--end' : 'stop-node--mid';
                  const isWalkToNext = !isLast && Number(stop.fare_to_next) === 0;

                  return (
                    <div key={index} className={`stop-item-v2 ${isLast ? 'stop-item-v2--last' : ''}`}>
                      <div className="stop-connector">
                        <div className={`stop-node ${stopClass}`}>
                          {isFirst  ? <MapPin    size={13} color="#fff" /> :
                            isLast ? <Navigation size={13} color="#fff" className='destination-icon'/> :
                          <span className="stop-node-num">{index}</span>}
                        </div>
                        {!isLast && (
                          <div className={`stop-connector-line${isWalkToNext ? ' stop-connector-line--walk' : ''}`} />
                        )}
                      </div>
                
                      <div className={`stop-card ${isFirst ? 'stop-card--start' : isLast ? 'stop-card--end' : ''}`}>
                        <div className="stop-card-top">
                          <div className="stop-card-label">
                            <span className={`stop-tag ${isFirst ? 'stop-tag--start' : isLast ? 'stop-tag--end' : 'stop-tag--mid'}`}>
                              {isFirst ? 'Start' : isLast ? 'Destination' : `Stop ${index}`}
                            </span>
                          </div>
                          {isWalkToNext ? (
                            <span className="stop-walk-pill">Walk</span>
                          ) : (
                            stop.fare_to_next ? (
                              <span className="stop-fare-pill">
                                <span className="stop-fare-cedi">₵</span>
                                {stop.fare_to_next}
                              </span>
                            ) : null
                          )}
                        </div>
                        <span className="stop-card-name">{stop.name}</span>
                        {stop.distance_to_next && (
                          <div className="stop-card-meta">
                            <span className="stop-meta-dot" />
                            <span className="stop-card-distance">{stop.distance_to_next} km to next stop</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

        </div>
      )}

      {showSwipeIndicator && (
        <div className="swipe-indicator">
          <button 
            className="swipe-indicator-button"
            onClick={handleIndicatorClick}
          >
            <ArrowLeft size={16} />
            <span>Tap or swipe left for route information</span>
          </button>
        </div>
      )}
    </div>
  ), [selectedRoute, routes, resetSearch, closeBottomSheet, showSwipeIndicator, isRealtimeConnected, lastUpdateTime, setShowReportModal, setIsGeneralReport]);

  // Render route info with realtime indicator
  const renderRouteInfo = useCallback(() => (
    <div 
      className="route-info"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="sheet-header">
        <div className="header-content">
          <h2 className="route-name">Route Information</h2>
          <p className="route-subtitle">
            {selectedRoute?.name || 'Route Details'}
          </p>
        </div>
        <div className="header-buttons">
          <div className="realtime-status">
            <div className={`status-indicator ${isRealtimeConnected ? 'connected' : 'disconnected'}`} />
          </div>
          <button 
            className="info-toggle-button"
            onClick={toggleBottomSheetContent}
            title="Show Route Details"
          >
            <ChevronRight size={20} color={COLORS.primary} />
          </button>
          <button 
            className="close-button"
            onClick={closeBottomSheet}
            title="Close"
          >
            <X size={18} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      <div className="scroll-view">
        <div className="route-info-content">
          {routeInfoData ? (
            <>
              {routeInfoData.description && (
                <div className="info-section">
                  <h3 className="info-section-title">
                    <Info size={18} />
                    Description
                  </h3>
                  <p className="info-text">{routeInfoData.description}</p>
                </div>
              )}

              <div className="info-grid">
                {/* Left Column */}
                <div className="info-column">
                  {routeInfoData.travel_time_minutes && (
                    <div className="info-section">
                      <h3 className="info-section-title">
                        <Clock size={18} />
                        Travel Time
                      </h3>
                      <div className="info-item">
                        <span className="info-value">
                          {routeInfoData.travel_time_minutes} minutes
                        </span>
                      </div>
                    </div>
                  )}

                  {routeInfoData.frequency && (
                    <div className="info-section">
                      <h3 className="info-section-title">
                        <CalendarDays size={18} />
                        Frequency
                      </h3>
                      <div className="info-item">
                        <span className="info-value">{routeInfoData.frequency}</span>
                      </div>
                    </div>
                  )}

                  {routeInfoData.peak_hours && (
                    <div className="info-section">
                      <h3 className="info-section-title">
                        <AlertCircle size={18} />
                        Peak Hours
                      </h3>
                      <div className="info-item">
                        <span className="info-value">{routeInfoData.peak_hours}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Column */}
                <div className="info-column">
                  {routeInfoData.vehicle_type && (
                    <div className="info-section">
                      <h3 className="info-section-title">
                        <Bus size={18} />
                        Vehicle Type
                      </h3>
                      <div className="info-item">
                        <span className="info-value">{routeInfoData.vehicle_type}</span>
                      </div>
                    </div>
                  )}

                  {(routeInfoData.operating_hours?.start || routeInfoData.operating_hours?.end) && (
                    <div className="info-section">
                      <h3 className="info-section-title">
                        <Clock size={18} />
                        Operating Hours
                      </h3>
                      <div className="info-grid-small">
                        {(routeInfoData.operating_hours.start || routeInfoData.operating_hours.end) && (
                          <div className="info-item">
                            <span className="info-label">Hours:</span>
                            <span className="info-value">
                              {routeInfoData.operating_hours.start} - {routeInfoData.operating_hours.end}
                            </span>
                          </div>
                        )}
                        {routeInfoData.operating_hours.days?.length > 0 && (
                          <div className="info-item">
                            <span className="info-label">Days:</span>
                            <span className="info-value">
                              {routeInfoData.operating_hours.days.join(', ')}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {routeInfoData.amenities?.length > 0 && (
                    <div className="info-section">
                      <h3 className="info-section-title">
                        <Wind size={18} />
                        Amenities
                      </h3>
                      <div className="amenities-list">
                        {routeInfoData.amenities.map((amenity, index) => {
                          const amenityLabels = {
                            'air_conditioning': 'Air Conditioning',
                            'charging_ports': 'Charging Ports',
                            'tv': 'TV',
                            'restroom': 'Restroom',
                            'luggage_space': 'Luggage Space',
                            'first_aid': 'First Aid Kit'
                          };
                          
                          return (
                            <span key={index} className="amenity-tag">
                              {amenityLabels[amenity] || amenity.replace('_', ' ')}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {routeInfoData.notes && (
                <div className="info-section">
                  <h3 className="info-section-title">
                    <Info size={18} />
                    Additional Notes
                  </h3>
                  <p className="info-text">{routeInfoData.notes}</p>
                </div>
              )}
            </>
          ) : (
            // Show message when no route info is available
            <div className="no-route-info">
              <div className="no-info-icon">
                <Info size={48} color="#9ca3af" />
              </div>
              <h3 className="no-info-title">No Information Available</h3>
              <p className="no-info-text">
                Sorry, no additional information is available for this route.
              </p>
              <p className="no-info-subtext">
                Route information may be added by administrators in the future.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Swipe Indicator for route info */}
      <div className="swipe-indicator">
        <button 
          className="swipe-indicator-button"
          onClick={toggleBottomSheetContent}
        >
          <ArrowRight size={16} />
          <span>Swipe right for route details</span>
        </button>
      </div>
    </div>
  ), [selectedRoute, routeInfoData, closeBottomSheet, isRealtimeConnected, lastUpdateTime]);

  const renderBottomSheetContent = useCallback(() => {
    if (bottomSheetContent === 'search') {
      return renderSearchForm();
    }
    
    // Show either route details or route info based on state
    // with proper page-like animations and live swipe feedback
    const contentStyle = isSwipeActive ? {
      transform: `translateX(${swipeTranslate}px)`,
      transition: 'none'
    } : {
      transform: 'translateX(0)',
      transition: 'transform 0.3s ease-out'
    };

    return (
      <div
        ref={bottomSheetContentRef}
        className="route-swipe-wrapper"
        style={contentStyle}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {bottomSheetState === 'route-details' 
          ? renderRouteDetails() 
          : renderRouteInfo()}
      </div>
    );
  }, [bottomSheetContent, bottomSheetState, renderSearchForm, renderRouteDetails, renderRouteInfo, swipeTranslate, isSwipeActive]);

  // ── Cookie consent required screen ──────────────────────────────────
  // Cookies cannot be declined - if the user chooses not to accept,
  // the app goes blank (white background, logo, reload button) so
  // they can restart and accept to continue.
  if (cookiesDeclined) {
    return (
      <div className="cookie-blocked-screen">
        <div className="cookie-blocked-logo">
          <img
            src={`${process.env.PUBLIC_URL}/GTT-glass-icon.png`}
            alt="Ghana Trotro Transit"
            className="cookie-blocked-logo-img"
          />
          <span className="cookie-blocked-logo-text">Ghana Trotro Transit</span>
        </div>
        <button
          className="cookie-blocked-reload-button"
          onClick={() => window.location.reload()}
        >
          <RefreshCw size={18} color="#FFFFFF" />
          <span>Reload App</span>
        </button>
      </div>
    );
  }

  return (
    <div className="container">
      {/* Map Component - Memoized to prevent unnecessary re-renders */}
      <MapComponent 
        center={memoizedMapCenter}
        routeCoordinates={memoizedRouteCoordinates}
        stops={memoizedStops}
        nearbyStops={nearbyStops}
        onNearbyStopSelect={handleNearbyStopSelect}
        onMapMoved={handleMapViewportMoved}
        mapMode={mapMode}
        isComposite={selectedRoute?.is_composite ?? false}
        onLayerChange={setMapMode}
        userLocation={userLocation}
        primaryColor={COLORS.primary}
        currentUserId={user?.id ?? null}
        volunteerMode={volunteerMode}
        onMapTap={handleMapTap}
      />

      {/* App Title in Top Left */}
      <div className="app-title-top-left">
        <h4>Ghana Trotro Transit</h4>
      </div>

      {/* Top Right Buttons */}
      <button
        className="profile-button"
        onClick={() => setShowProfileModal(true)}
      >
        <User size={24} color="#FFFFFF" />
      </button>

      <button
        className="plus-button"
        onClick={() => setShowDownloadAppModal(true)}
      >
        <Plus size={20} color="#FFFFFF" />
      </button>

      {/*
       {user && (
          <div className="realtime-status-corner-indicator">
            <Radio size={14} className={isRealtimeConnected ? 'realtime-active' : ''} />
            <span className="status-text">
              {isRealtimeConnected ? '' :  'connecting...'}
            </span>
          </div>
        )}
        */}


      {/* Realtime Status Indicator 
      <div className="realtime-status-corner">
        <div className={`status-indicator ${isRealtimeConnected ? 'connected' : 'disconnected'}`} />
        <span className="status-text">
          {isRealtimeConnected ? 'Online' : 'Offline'}
        </span>
      </div>
      */}

      {/* Info Button with conditional opacity */}
      <button className={`info-button ${isAnyModalOpen ? 'info-button-dimmed' : ''}`} onClick={() => setShowInfoModal(true)}>
        <Info size={20} color="#FFFFFF" />
      </button>

      {/* Bottom Sheet - Slides up from bottom, draggable */}
      {showBottomSheet && (
        <div 
          className="bottom-sheet-overlay"
          onClick={handleBottomSheetOverlayClick}
        >
          <div
            className={`bottom-sheet${sheetIsDragging ? ' is-dragging' : ''}`}
            ref={bottomSheetRef}
            style={{
              height: `${sheetDragHeight}vh`,
              transition: sheetIsDragging ? 'none' : 'height 0.38s cubic-bezier(0.4,0,0.2,1)',
            }}
          >
            {/* ── Drag Handle ── */}
            <div
              className="sheet-drag-handle"
              onMouseDown={handleSheetHandlePointerDown}
              onTouchStart={handleSheetHandlePointerDown}
            >
              <div className="drag-pill" />
            </div>

            <div className="bottom-sheet-content">
              {renderBottomSheetContent()}
            </div>
          </div>
        </div>
      )}

      {/* Floating Search Button - Only show when bottom sheet is closed */}
      {!showBottomSheet && (
        <div className="floating-button">
          <button
            className="search-button-inner"
            onClick={showRouteDetails}
          >
            <Search size={24} color="#FFFFFF" />
          </button>
        </div>
      )}

      {/* Profile Modal - Non-blocking */}
      {showProfileModal && (
        <div 
          className="modal-overlay non-blocking"
          onClick={handleProfileModalOverlayClick}
        >
          <div className="modal ios-profile-modal" ref={modalRef}>
            <div className="ios-modal-grabber"></div>
            <div className="modal-header ios-profile-header">
              <h2 className="modal-title">Profile</h2>
              <div className="ios-profile-header-actions">
                {!user && !showGuestSignIn && (
                  <button
                    className="ios-header-signin-button"
                    onClick={() => setShowGuestSignIn(true)}
                  >
                    <span>SignUp</span>
                  </button>
                )}
                <button 
                  className="close-button"
                  onClick={() => setShowProfileModal(false)}
                >
                  <X size={18} strokeWidth={2.5} />
                </button>
              </div>
            </div>

            {!user && showGuestSignIn ? (
              <div className="modal-content ios-profile-content" ref={profileModalContentRef}>
                <AuthForm
                  onSignIn={handleSignIn}
                  onSignUp={handleSignUp}
                  authLoading={authLoading}
                  onForgotPasswordOpen={() => {
                    // Wait a tick for the panel to actually expand so
                    // scrollHeight reflects the new, taller content.
                    requestAnimationFrame(() => {
                      const el = profileModalContentRef.current;
                      if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
                    });
                  }}
                />
              </div>
            ) : (
              <div className="modal-content ios-profile-content">
                {user && (
                  <div className="ios-user-info">
                    <div className="ios-avatar">
                      <span className="ios-avatar-text">
                        {userProfile?.first_name?.[0]}{userProfile?.last_name?.[0] || user.email?.[0]?.toUpperCase()}
                      </span>
                    </div>
                    <span className="ios-user-name">
                      {userProfile?.first_name} {userProfile?.last_name}
                    </span>
                    <span className="ios-user-email">{user.email}</span>
                  </div>
                )}

                {profileView === 'menu' ? (
                  <>
                    <div className="ios-list-group">
                      <button
                        className="ios-list-row"
                        onClick={user ? handleOpenAccountView : () => setShowGuestSignIn(true)}
                      >
                        <span className="ios-row-icon ios-row-icon--purple">
                          <User size={16} color="#FFFFFF" />
                        </span>
                        <span className="ios-row-text">Account</span>
                        <ChevronRight size={18} color="#C7C7CC" className="ios-row-chevron" />
                      </button>

                      <div className="ios-list-divider"></div>

                      <button 
                        className="ios-list-row"
                        onClick={() => {
                          if (!user) {
                            setShowGuestSignIn(true);
                            return;
                          }
                          setShowSearchHistoryModal(true);
                          setShowProfileModal(false);
                        }}
                      >
                        <span className="ios-row-icon ios-row-icon--blue">
                          <History size={16} color="#FFFFFF" />
                        </span>
                        <span className="ios-row-text">Search History</span>
                        <ChevronRight size={18} color="#C7C7CC" className="ios-row-chevron" />
                      </button>
                    </div>

                    <div className="ios-list-group">
                      <button
                        className="ios-list-row"
                        onClick={() => {
                          setShowProfileModal(false);
                          setIsGeneralReport(true);
                          setTimeout(() => setShowReportModal(true), 200);
                        }}
                      >
                        <span className="ios-row-icon ios-row-icon--gray">
                          <Flag size={16} color="#FFFFFF" />
                        </span>
                        <span className="ios-row-text">Report an Issue</span>
                        <ChevronRight size={18} color="#C7C7CC" className="ios-row-chevron" />
                      </button>

                      <div className="ios-list-divider"></div>

                      <button
                        className="ios-list-row"
                        onClick={() => {
                          window.open('https://gtt.nxnx.tech/earn', '_blank', 'noopener,noreferrer');
                        }}
                      >
                        <span className="ios-row-icon ios-row-icon--green">
                          <Coins size={16} color="#FFFFFF" />
                        </span>
                        <span className="ios-row-text">Become an Earner</span>
                        <ChevronRight size={18} color="#C7C7CC" className="ios-row-chevron" />
                      </button>
                    </div>

                    <div className="ios-list-group">
                      <button
                        className="ios-list-row"
                        onClick={handleStartVolunteering}
                      >
                        <span className="ios-row-icon ios-row-icon--teal">
                          <Users size={16} color="#FFFFFF" />
                        </span>
                        <span className="ios-row-text">Add a Stop</span>
                        <ChevronRight size={18} color="#C7C7CC" className="ios-row-chevron" />
                      </button>

                      <div className="ios-list-divider"></div>

                      <button
                        className="ios-list-row"
                        onClick={() => {
                          setShowProfileModal(false);
                          setDonateEmail(user?.email || '');
                          setShowDonateModal(true);
                        }}
                      >
                        <span className="ios-row-icon ios-row-icon--red">
                          <Heart size={16} color="#FFFFFF" />
                        </span>
                        <span className="ios-row-text">Buy Me Waakye</span>
                        <ChevronRight size={18} color="#C7C7CC" className="ios-row-chevron" />
                      </button>
                    </div>

                    {user && (
                      <div className="ios-list-group">
                        <button 
                          className="ios-list-row ios-list-row--destructive"
                          onClick={handleSignOut}
                        >
                          <span className="ios-row-text ios-row-text--destructive">Sign Out</span>
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="ios-account-view">
                    <button className="ios-back-row" onClick={() => setProfileView('menu')}>
                      <ChevronLeft size={18} color={COLORS.primary} />
                      <span>Back</span>
                    </button>

                    <p className="ios-section-label">Name</p>
                    <div className="ios-list-group ios-form-group">
                      <div className="ios-form-row">
                        <label className="ios-form-label">First Name</label>
                        <input
                          className="ios-form-input"
                          placeholder="First Name"
                          value={editFirstName}
                          onChange={(e) => setEditFirstName(e.target.value)}
                        />
                      </div>
                      <div className="ios-list-divider"></div>
                      <div className="ios-form-row">
                        <label className="ios-form-label">Last Name</label>
                        <input
                          className="ios-form-input"
                          placeholder="Last Name"
                          value={editLastName}
                          onChange={(e) => setEditLastName(e.target.value)}
                        />
                      </div>
                    </div>
                    <button
                      className={`ios-save-button ${nameUpdateSuccess ? 'ios-save-button--success' : ''}`}
                      onClick={handleUpdateName}
                      disabled={nameUpdateLoading}
                    >
                      {nameUpdateLoading ? 'Saving...' : nameUpdateSuccess ? 'Saved ✓' : 'Save Changes'}
                    </button>

                    <p className="ios-section-label">Security</p>
                    <div className="ios-list-group">
                      <button className="ios-list-row" onClick={handlePasswordChange}>
                        <span className="ios-row-icon ios-row-icon--purple">
                          <Key size={16} color="#FFFFFF" />
                        </span>
                        <span className="ios-row-text">Change Password</span>
                        <ChevronRight size={18} color="#C7C7CC" className="ios-row-chevron" />
                      </button>
                    </div>

                    <p className="ios-section-label">Danger Zone</p>
                    <div className="ios-list-group">
                      <button
                        className="ios-list-row ios-list-row--destructive"
                        onClick={() => setShowDeleteAccountConfirm(true)}
                      >
                        <span className="ios-row-text ios-row-text--destructive">Delete Account</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
                    <p className="ios-version-text">Version: aaya!</p>

          </div>
        </div>
      )}

      {/* ── Delete Account Confirmation Modal ── */}
      {showDeleteAccountConfirm && (
        <div
          className="modal-overlay non-blocking"
          onClick={(e) => { if (e.target === e.currentTarget) setShowDeleteAccountConfirm(false); }}
        >
          <div className="modal sign-out-confirm-modal">
            <div className="modal-header">
              <button
                className="close-button"
                onClick={() => setShowDeleteAccountConfirm(false)}
              >
                <X size={18} strokeWidth={2.5} />
              </button>
            </div>
            <div className="sign-out-confirm-content">
              <div className="delete-account-warning-icon">
                <AlertCircle size={32} color="#FF3B30" />
              </div>
              <h3 className="sign-out-confirm-title">Delete Account?</h3>
              <p className="sign-out-confirm-msg">
                This will permanently delete your account and all associated data,
                including your search history and saved routes. This action cannot be undone.
              </p>
              <button
                className="delete-account-confirm-button"
                onClick={confirmDeleteAccount}
              >
                Delete My Account
              </button>
              <button
                className="sign-out-cancel-button"
                onClick={() => setShowDeleteAccountConfirm(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Account Loading Overlay ── */}
      {deleteAccountLoading && (
        <div className="loading-overlay sign-out-loading-overlay">
          <div className="sign-out-loading-content">
            <div className="loading-spinner"></div>
            <p className="sign-out-loading-text">Deleting account...</p>
          </div>
        </div>
      )}

      {/* ── Volunteer mode banner ── */}
      {volunteerMode && !showAddStopModal && (
        <div className="volunteer-mode-banner">
          <div className="volunteer-mode-banner-text">
            <MapPin size={16} color="#FFFFFF" />
            <span>Tap anywhere on the map to add a stop</span>
          </div>
          <button className="volunteer-mode-done-button" onClick={handleStopVolunteering}>
            Done
          </button>
        </div>
      )}

      {/* ── Add Stop Modal (volunteer mode) ── */}
      {showAddStopModal && (
        <div
          className="modal-overlay non-blocking"
          onClick={(e) => { if (e.target === e.currentTarget && !addStopSubmitting) closeAddStopModal(); }}
        >
          <div className="modal add-stop-modal">
            {addStopSuccess ? (
              <div className="report-success">
                <div className="report-success-icon">
                  <Check size={32} color="#10B981" />
                </div>
                <h3 className="report-success-title">Stop Submitted!</h3>
                <p className="report-success-msg">
                  Thanks for helping map Ghana&apos;s trotro network. This stop will appear on the map once it&apos;s verified.
                </p>
              </div>
            ) : (
              <>
                <div className="modal-header">
                  <h2 className="modal-title">Add a Stop</h2>
                  <button className="close-button" onClick={closeAddStopModal} disabled={addStopSubmitting}>
                    <X size={18} strokeWidth={2.5} />
                  </button>
                </div>

                <div className="modal-content">
                  {pendingStopCoords && (
                    <p className="add-stop-coords">
                      {pendingStopCoords.lat.toFixed(5)}, {pendingStopCoords.lng.toFixed(5)}
                    </p>
                  )}

                  <p className="report-section-label">Stop name *</p>
                  <input
                    className="ios-form-input add-stop-name-input"
                    placeholder="e.g. Achimota Market"
                    value={newStopName}
                    onChange={(e) => setNewStopName(e.target.value)}
                    maxLength={100}
                  />

                  <p className="report-section-label">Photos (optional)</p>
                  <div className="add-stop-photos-grid">
                    {newStopImages.map((file, i) => (
                      <div className="add-stop-photo-thumb" key={i}>
                        <img src={URL.createObjectURL(file)} alt={`Stop photo ${i + 1}`} />
                        <button
                          type="button"
                          className="add-stop-photo-remove"
                          onClick={() => removeNewStopImage(i)}
                        >
                          <X size={12} strokeWidth={3} />
                        </button>
                      </div>
                    ))}
                    <label className="add-stop-photo-add">
                      <ImagePlus size={20} color={COLORS.primary} />
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        style={{ display: 'none' }}
                        onChange={handleAddStopImagesSelected}
                      />
                    </label>
                  </div>
                  <p className="add-stop-photos-hint">
                    Photos help other users recognize the stop. They&apos;ll be visible once approved.
                  </p>

                  <button
                    className={`report-submit-button${(!newStopName.trim() || addStopSubmitting) ? ' report-submit-disabled' : ''}`}
                    onClick={handleSubmitNewStop}
                    disabled={!newStopName.trim() || addStopSubmitting}
                  >
                    {addStopSubmitting ? 'Submitting...' : 'Submit Stop'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Donate Modal (Paystack) ── */}
      {showDonateModal && (
        <div
          className="modal-overlay non-blocking"
          onClick={(e) => { if (e.target === e.currentTarget && !donateLoading) setShowDonateModal(false); }}
        >
          <div className="modal donate-modal">
            <div className="modal-header">
              <h2 className="modal-title">Support Ghana Trotro Transit</h2>
              <button className="close-button" onClick={() => setShowDonateModal(false)} disabled={donateLoading}>
                <X size={18} strokeWidth={2.5} />
              </button>
            </div>

            <div className="modal-content">
              <p className="donate-intro">
                Donations help keep the app free, fund new stop verification, and support the volunteers mapping Ghana&apos;s trotro routes.
              </p>

              <p className="report-section-label">Amount (GH&#8373;)</p>
              <div className="donate-amount-chips">
                {['5', '20', '50', '100'].map((amt) => (
                  <button
                    key={amt}
                    className={`donate-amount-chip${donateAmount === amt ? ' donate-amount-chip-selected' : ''}`}
                    onClick={() => setDonateAmount(amt)}
                  >
                    GH&#8373;{amt}
                  </button>
                ))}
              </div>
              <input
                className="ios-form-input donate-amount-input"
                type="number"
                min="1"
                placeholder="Custom amount"
                value={donateAmount}
                onChange={(e) => setDonateAmount(e.target.value)}
              />

              <p className="report-section-label">Email (for your receipt)</p>
              <input
                className="ios-form-input"
                type="email"
                placeholder="you@example.com"
                value={donateEmail}
                onChange={(e) => setDonateEmail(e.target.value)}
              />

              <button
                className={`report-submit-button${donateLoading ? ' report-submit-disabled' : ''}`}
                onClick={handleDonate}
                disabled={donateLoading}
              >
                {donateLoading ? 'Processing...' : 'Buy the waakye with Paystack'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Info Modal - Non-blocking */}
      {showInfoModal && (
        <div 
          className="modal-overlay non-blocking"
          onClick={handleInfoModalOverlayClick}
        >
          <div className="modal info-modal" ref={modalRef}>
            <div className="modal-header">
              <h2 className="modal-title">About Ghana Trotro Transit</h2>
              <button 
                className="close-button"
                onClick={() => setShowInfoModal(false)}
              >
                <X size={18} strokeWidth={2.5} />
              </button>
            </div>

            <div className="modal-content">
              <div className="info-section">
                <h3 className="info-section-title">How It Works</h3>
                <p className="info-text">
                  Ghana Trotro Transit helps you navigate Accra's public transportation system by finding the best trotro routes between locations.
                  Don't know your routes? <a href='https://gtt.nxnx.tech/routes-you-can-find.html' target='_blank' rel='noreferrer'>click here</a>
                </p>
                
              </div>

              {!user && (
                <div className="info-section account-perks-section">
                  <h3 className="info-section-title">Why Create an Account?</h3>
                  <p className="info-text">
                    You can already search for routes, but signing up unlocks a lot more:
                  </p>
                  <div className="feature-list">
                    <div className="feature-item">
                      <div className="feature-icon">
                        <History size={16} color={COLORS.primary} />
                      </div>
                      <span className="feature-text">Search history synced across all your devices</span>
                    </div>
                    <div className="feature-item">
                      <div className="feature-icon">
                        <Plus size={16} color={COLORS.primary} />
                      </div>
                      <span className="feature-text">Create and save your own custom routes</span>
                    </div>
                    <div className="feature-item">
                      <div className="feature-icon">
                        <Share2 size={16} color={COLORS.primary} />
                      </div>
                      <span className="feature-text">Share your custom routes with others</span>
                    </div>
                    <div className="feature-item">
                      <div className="feature-icon">
                        <Radio size={16} color={COLORS.primary} />
                      </div>
                      <span className="feature-text">Real-time route updates and notifications</span>
                    </div>
                    <div className="feature-item">
                      <div className="feature-icon">
                        <Flag size={16} color={COLORS.primary} />
                      </div>
                      <span className="feature-text">Report route issues and track their status</span>
                    </div>
                  </div>
                  <button
                    className="account-perks-cta-button"
                    onClick={() => {
                      setShowInfoModal(false);
                      setShowProfileModal(true);
                    }}
                  >
                    Create Free Account
                  </button>
                </div>
              )}

              <div className="info-section">
                <h3 className="info-section-title">Features</h3>
                <div className="feature-list">
                  <div className="feature-item">
                    <div className="feature-icon">
                      <Search size={16} color={COLORS.primary} />
                    </div>
                    <span className="feature-text">Find optimal trotro routes</span>
                  </div>
                  <div className="feature-item">
                    <div className="feature-icon">
                      <Plus size={16} color={COLORS.primary} />
                    </div>
                    <span className="feature-text">Create custom routes</span>
                  </div>
                  <div className="feature-item">
                    <div className="feature-icon">
                      <Share2 size={16} color={COLORS.primary} />
                    </div>
                    <span className="feature-text">Share routes with others</span>
                  </div>
                  <div className="feature-item">
                    <div className="feature-icon">
                      <History size={16} color={COLORS.primary} />
                    </div>
                    <span className="feature-text">Track your search history</span>
                  </div>
                  <div className="feature-item">
                    <div className="feature-icon">
                      <Radio size={16} color={COLORS.primary} />
                    </div>
                    <span className="feature-text">Real-time route updates</span>
                  </div>
                </div>
              </div>

              <div className="info-section">
                <h3 className="info-section-title">Contact & Support</h3>
                <div className="contact-list">
                  <div className="contact-item">
                    <Phone size={16} color={COLORS.primary} />
                    <span className="contact-text">
                      <a className='contact-text-help' href='tel:233209156811'>+233 209 156 811</a>
                    </span>
                  </div>
                  <div className="contact-item">
                    <Mail size={16} color={COLORS.primary} />
                    <span className="contact-text">
                      <a className='contact-text-help' href='mailto:nxnxtech@gmail.com'>nxnxtech@gmail.com</a>
                    </span>
                  </div>
                  <div className="contact-item">
                    <Globe size={16} color={COLORS.primary} />
                    <span className="contact-text">
                      <a className="contact-text-help" href='https://gtt.nxnx.tech' target='_blank' rel="noreferrer">https://gtt.nxnx.tech</a>
                    </span>
                  </div>
                </div>
              </div>

              <div className="info-section">
                <h3 className="info-section-title">Legal</h3>
                <div className="contact-list">
                  <div className="contact-item">
                    <Lock size={16} color={COLORS.primary} />
                    <span className="contact-text">
                      <a
                        className="contact-text-help"
                        href="https://gtt.nxnx.tech/privacy"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Privacy Policy
                      </a>
                    </span>
                  </div>
                  <div className="contact-item">
                    <Info size={16} color={COLORS.primary} />
                    <span className="contact-text">
                      <a
                        className="contact-text-help"
                        href="https://gtt.nxnx.tech/terms"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Terms &amp; Conditions
                      </a>
                    </span>
                  </div>
                </div>
              </div>

              <div className="info-section">
                <h3 className="info-section-title">Note</h3>
                <div className="contact-list">
                  <div className="contact-item">
                    <Info size={20} color={COLORS.primary} />
                    <span className="contact-text">Prices may vary from time to time, please make sure to carry on you extra change to avoid complications. Happy Trotro-ing!</span>
                  </div>
                </div>
              </div>
            </div>
                <h6 class="info-text">Version: aaya!</h6>

          </div>
        </div>
      )}

      {/* Download App Modal */}
      {showDownloadAppModal && (
        <div
          className="modal-overlay non-blocking"
          onClick={(e) => { if (e.target === e.currentTarget) setShowDownloadAppModal(false); }}
        >
          <div className="modal download-app-modal">
            <div className="modal-header">
              <h2 className="modal-title">Download the App</h2>
              <button className="close-button" onClick={() => setShowDownloadAppModal(false)}>
                <X size={18} strokeWidth={2.5} />
              </button>
            </div>
            <div className="modal-content download-app-content">
              <div className="download-app-icon">
                <Plus size={40} color={COLORS.background} />
              </div>
              <h3 className="download-app-heading">Create Route</h3>
              <p className="download-app-text">
                The <strong>Create Route</strong> feature is available exclusively on our mobile app.
                Download Ghana Trotro Transit to create and share custom trotro routes on the go.
              </p>
              <div className="download-app-buttons">
                <a
                  href="https://gtt.nxnx.tech/#download"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="store-button store-button-ios"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                  </svg>
                  <span>App Store</span>
                </a>
                <a
                  href="https://gtt.nxnx.tech/#download"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="store-button store-button-android"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M3.18 23.76c.35.2.74.24 1.12.12l11.4-6.59-2.38-2.38-10.14 8.85zm-1.8-20.2C1.15 3.9 1 4.27 1 4.7v14.6c0 .43.15.8.38 1.1l.07.06 8.19-8.2v-.18L1.45 3.5l-.07.06zM20.1 10.5l-2.34-1.36-2.66 2.66 2.66 2.65 2.36-1.37c.67-.39.67-1.2-.02-1.58zM4.3.12L15.7 6.71l-2.38 2.38L3.18.24C3.54.06 3.95.08 4.3.12z"/>
                  </svg>
                  <span>Google Play</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search History Modal - Non-blocking */}
      {showSearchHistoryModal && (
        <div 
          className="modal-overlay non-blocking"
          onClick={handleSearchHistoryModalOverlayClick}
        >
          <div className="modal ios-history-modal" ref={modalRef}>
            <div className="ios-modal-grabber"></div>
            <div className="modal-header ios-history-header">
              <button
                className="ios-modal-back-button"
                onClick={() => {
                  setShowSearchHistoryModal(false);
                  setShowProfileModal(true);
                }}
              >
                <ChevronLeft size={20} strokeWidth={2.5} />
              </button>
              <h2 className="modal-title">Search History</h2>
              <button 
                className="close-button"
                onClick={() => setShowSearchHistoryModal(false)}
              >
                <X size={18} strokeWidth={2.5} />
              </button>
            </div>

            <div className="modal-content ios-history-content">
              {searchHistory.length === 0 ? (
                <div className="ios-empty-state">
                  <div className="ios-empty-state-icon">
                    <History size={26} color="#8E8E93" />
                  </div>
                  <h3 className="ios-empty-state-title">No Search History</h3>
                  <p className="ios-empty-state-text">
                    Your search history will appear here once you start searching for routes.
                  </p>
                </div>
              ) : (
                <>
                  {searchHistory.length > 0 && (
                    <button
                      className="ios-clear-history-button"
                      onClick={clearSearchHistory}
                    >
                      <Trash2 size={14} />
                      Clear All
                    </button>
                  )}
                  <div className="ios-list-group">
                    {searchHistory.map((search, idx) => (
                      <React.Fragment key={search.id}>
                        <div className="ios-history-row">
                          <button
                            className="ios-history-row-main"
                            onClick={() => {
                              setStartPoint(search.start_point);
                              setDestination(search.destination);
                              setShowSearchHistoryModal(false);
                              setBottomSheetContent('search');
                              setShowBottomSheet(true);
                            }}
                          >
                            <span className="ios-row-icon ios-row-icon--blue">
                              <Navigation size={15} color="#FFFFFF" />
                            </span>
                            <span className="ios-history-text">
                              <span className="ios-history-route">
                                {search.start_point} → {search.destination}
                              </span>
                              <span className="ios-history-date">
                                {new Date(search.searched_at).toLocaleDateString()}
                              </span>
                            </span>
                          </button>
                          <button
                            className="ios-history-delete"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteSearchHistoryItem(search.id);
                            }}
                            title="Delete this entry"
                          >
                            <X size={14} color="#8E8E93" />
                          </button>
                        </div>
                        {idx < searchHistory.length - 1 && (
                          <div className="ios-list-divider" style={{ marginLeft: '50px' }}></div>
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Route Not Found Modal ── */}
      {showRouteNotFoundModal && (
        <div
          className="modal-overlay non-blocking"
          onClick={handleRouteNotFoundModalOverlayClick}
        >
          <div className="modal route-not-found-modal">
            <div className="modal-header">
              <button
                className="close-button"
                onClick={() => setShowRouteNotFoundModal(false)}
              >
                <X size={18} strokeWidth={2.5} />
              </button>
            </div>

            <div className="route-not-found-content">
              <div className="route-not-found-icon">
                <AlertCircle size={32} color="#F59E0B" />
              </div>
              <h3 className="route-not-found-title">Route Not Available Yet</h3>
              <p className="route-not-found-msg">
                We couldn&apos;t find a route from <strong>{startPoint}</strong> to <strong>{destination}</strong>.
                This route may not be available in our database yet.
              </p>
              <p className="route-not-found-msg">
                Visit the link below to see all the routes we currently support.
              </p>
              <a
                href="https://gtt.nxnx.tech/routes-you-can-find.html"
                target="_blank"
                rel="noopener noreferrer"
                className="route-not-found-link-button"
              >
                <Globe size={18} color="#FFFFFF" />
                <span>See Available Routes</span>
              </a>
              <button
                className="route-not-found-close-button"
                onClick={() => setShowRouteNotFoundModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Sign Out Confirmation Modal ── */}
      {showSignOutConfirmModal && (
        <div
          className="modal-overlay non-blocking"
          onClick={(e) => { if (e.target === e.currentTarget) setShowSignOutConfirmModal(false); }}
        >
          <div className="modal sign-out-confirm-modal">
            <div className="modal-header">
              <button
                className="close-button"
                onClick={() => setShowSignOutConfirmModal(false)}
              >
                <X size={18} strokeWidth={2.5} />
              </button>
            </div>
            <div className="sign-out-confirm-content">
              <h3 className="sign-out-confirm-title">Sign Out?</h3>
              <p className="sign-out-confirm-msg">
                Are you sure you want to sign out of your account?
              </p>
              <button
                className="sign-out-confirm-button"
                onClick={confirmSignOut}
              >
                Sign Out
              </button>
              <button
                className="sign-out-cancel-button"
                onClick={() => setShowSignOutConfirmModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Sign Out Loading Overlay ── */}
      {signOutLoading && (
        <div className="loading-overlay sign-out-loading-overlay">
          <div className="sign-out-loading-content">
            <div className="loading-spinner"></div>
            <p className="sign-out-loading-text">Signing out...</p>
          </div>
        </div>
      )}

      {/* ── Sign Out Success Modal ── */}
      {showSignOutSuccessModal && (
        <div
          className="modal-overlay non-blocking"
          onClick={(e) => { if (e.target === e.currentTarget) setShowSignOutSuccessModal(false); }}
        >
          <div className="modal sign-out-success-modal">
            <div className="sign-out-success-content">
              <div className="sign-out-success-icon">
                <CheckCircle size={40} color="#10B981" />
              </div>
              <h3 className="sign-out-success-title">Signed out successfully</h3>
              <button
                className="sign-out-success-button"
                onClick={() => setShowSignOutSuccessModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Report Issue Modal ── */}
      {showReportModal && (
        <div
          className="modal-overlay non-blocking"
          onClick={(e) => { if (e.target === e.currentTarget) closeReportModal(); }}
        >
          <div className="modal report-modal">
            {reportSuccess ? (
              /* Success state */
              <div className="report-success">
                <div className="report-success-icon">
                  <Check size={32} color="#10B981" />
                </div>
                <h3 className="report-success-title">Report Sent!</h3>
                <p className="report-success-msg">
                  Thanks for letting us know. We&apos;ll look into this shortly.
                </p>
                <button className="report-done-button" onClick={closeReportModal}>
                  Done
                </button>
              </div>
            ) : (
              /* Report form */
              <>
                <div className="modal-header">
                  <div className="report-modal-title-row">
                    <Flag size={18} color="#000000" />
                    <h2 className="modal-title">
                      {isGeneralReport ? 'General Report' : 'Report Route Issue'}
                    </h2>
                  </div>
                  <button className="close-button" onClick={closeReportModal}>
                    <X size={18} strokeWidth={2.5} />
                  </button>
                </div>

                {!isGeneralReport && selectedRoute?.name && (
                  <p className="report-route-name">{selectedRoute.name}</p>
                )}

                <div className="modal-content">
                  <p className="report-section-label">Select a reason *</p>
                  <div className="report-reasons-grid">
                    {(isGeneralReport
                      ? [
                          'App Bug',
                          'Wrong information',
                          'Suggestion',
                          'Accessibility issue',
                          'Account issue',
                          'Other',
                        ]
                      : [
                          'Incorrect fare',
                          'Wrong route stops',
                          'Route no longer exists',
                          'Duplicate route',
                          'Inaccurate distance',
                          'App Bug',
                          'Suggestion',
                          'Other',
                        ]
                    ).map((reason) => (
                      <button
                        key={reason}
                        className={`report-chip ${reportReason === reason ? 'report-chip-selected' : ''}`}
                        onClick={() => setReportReason(reason)}
                      >
                        {reason}
                      </button>
                    ))}
                  </div>

                  <p className="report-section-label">Additional details (optional)</p>
                  <textarea
                    className="report-textarea"
                    placeholder="Describe the issue in more detail..."
                    value={reportNote}
                    onChange={(e) => setReportNote(e.target.value)}
                    maxLength={500}
                    rows={4}
                  />
                  <span className="report-char-count">{reportNote.length}/500</span>

                  <button
                    className={`report-submit-button${(!reportReason || reportSubmitting) ? ' report-submit-disabled' : ''}`}
                    onClick={handleSubmitReport}
                    disabled={!reportReason || reportSubmitting}
                  >
                    {reportSubmitting ? 'Sending...' : 'Send Report'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Cookie Consent Banner ── */}
      {!cookiesAccepted && !cookiesDeclined && (
        <div className="cookie-consent-overlay">
          <div className="cookie-consent-banner">
            <p className="cookie-consent-text">
              We use cookies and your device location to keep Ghana Trotro Transit working smoothly — including saving your search history, showing your position on the map, and improving route suggestions near you. You need to agree to continue using the app.
            </p>
            <div className="cookie-consent-actions">
              <button
                className="cookie-consent-info-button"
                onClick={() => setShowCookieInfoModal(true)}
              >
                What cookies are used for
              </button>
              <div className="cookie-consent-main-actions">
                <button
                  className="cookie-consent-decline-button"
                  onClick={handleDeclineCookies}
                >
                  Decline
                </button>
                <button
                  className="cookie-consent-accept-button"
                  onClick={handleAcceptCookies}
                >
                  Accept & Continue
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Cookie Info Modal ── */}
      {showCookieInfoModal && (
        <div
          className="modal-overlay cookie-info-modal-overlay"
          onClick={(e) => { if (e.target === e.currentTarget) setShowCookieInfoModal(false); }}
        >
          <div className="modal cookie-info-modal">
            <div className="modal-header">
              <h2 className="modal-title">How We Use Cookies</h2>
              <button
                className="close-button"
                onClick={() => setShowCookieInfoModal(false)}
              >
                <X size={18} strokeWidth={2.5} />
              </button>
            </div>

            <div className="modal-content">
              <div className="info-section">
                <div className="feature-list">
                  <div className="feature-item">
                    <div className="feature-icon">
                      <History size={16} color={COLORS.primary} />
                    </div>
                    <span className="feature-text">Remembering your recent route searches so you can quickly find them again</span>
                  </div>
                  <div className="feature-item">
                    <div className="feature-icon">
                      <User size={16} color={COLORS.primary} />
                    </div>
                    <span className="feature-text">Keeping you signed in to your account between visits</span>
                  </div>
                  <div className="feature-item">
                    <div className="feature-icon">
                      <Check size={16} color={COLORS.primary} />
                    </div>
                    <span className="feature-text">Remembering that you've accepted our use of cookies</span>
                  </div>
                  <div className="feature-item">
                    <div className="feature-icon">
                      <Map size={16} color={COLORS.primary} />
                    </div>
                    <span className="feature-text">Storing basic preferences, like your last selected map layer</span>
                  </div>
                  <div className="feature-item">
                    <div className="feature-icon">
                      <Navigation size={16} color={COLORS.primary} />
                    </div>
                    <span className="feature-text">Showing your current location on the map, and saving it to your account (if signed in) to improve nearby route suggestions</span>
                  </div>
                </div>
                <p className="info-text">
                  These cookies are essential to how the app functions on this device. For more detail, see our{' '}
                  <a href="https://gtt.nxnx.tech/privacy" target="_blank" rel="noreferrer">Privacy Policy</a>.
                </p>
              </div>

              <button
                className="cookie-info-accept-button"
                onClick={handleAcceptCookies}
              >
                Accept & Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GhanaTrotroTransit;