import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { 
  ArrowUpDown, Copy, Info, Lock, MapPin, Navigation, 
  Search, Share2, User, X, Plus, History, Key, 
  DollarSign, Mail, Phone, Globe, Clock, Map
} from 'lucide-react';
import { supabase } from '../config/supabase';
import { COLORS, MAP_CONFIG, SAMPLE_STOPS } from '../utils/constants';
import MapComponent from './MapComponent';
import '../styles/HomeScreen.css';

// Rate limiting configuration
const RATE_LIMIT_CONFIG = {
  // Route searches per minute
  ROUTE_SEARCHES: {
    MAX_REQUESTS: 10,
    TIME_WINDOW: 60 * 1000, // 1 minute in milliseconds
  },
  // User info fetches per minute
  USER_INFO: {
    MAX_REQUESTS: 20,
    TIME_WINDOW: 60 * 1000, // 1 minute in milliseconds
  },
  // Suggestions per minute
  SUGGESTIONS: {
    MAX_REQUESTS: 30,
    TIME_WINDOW: 60 * 1000, // 1 minute in milliseconds
  }
};

// Rate limit store
const rateLimitStore = new Map();

const checkRateLimit = (userId, endpoint) => {
  const now = Date.now();
  const key = `${userId}_${endpoint}`;
  
  if (!rateLimitStore.has(key)) {
    rateLimitStore.set(key, {
      count: 1,
      firstRequest: now,
      lastRequest: now
    });
    return { allowed: true, remaining: RATE_LIMIT_CONFIG[endpoint].MAX_REQUESTS - 1 };
  }

  const userLimit = rateLimitStore.get(key);
  const timeWindow = RATE_LIMIT_CONFIG[endpoint].TIME_WINDOW;

  // Reset counter if time window has passed
  if (now - userLimit.firstRequest > timeWindow) {
    userLimit.count = 1;
    userLimit.firstRequest = now;
    userLimit.lastRequest = now;
    rateLimitStore.set(key, userLimit);
    return { allowed: true, remaining: RATE_LIMIT_CONFIG[endpoint].MAX_REQUESTS - 1 };
  }

  // Check if within rate limit
  if (userLimit.count < RATE_LIMIT_CONFIG[endpoint].MAX_REQUESTS) {
    userLimit.count++;
    userLimit.lastRequest = now;
    rateLimitStore.set(key, userLimit);
    return { 
      allowed: true, 
      remaining: RATE_LIMIT_CONFIG[endpoint].MAX_REQUESTS - userLimit.count 
    };
  } else {
    const timeLeft = timeWindow - (now - userLimit.firstRequest);
    return { 
      allowed: false, 
      remaining: 0,
      retryAfter: Math.ceil(timeLeft / 1000) // seconds
    };
  }
};

const getUserIdForRateLimit = (user) => {
  return user?.id || 'anonymous';
};

const AuthForm = ({ onSignIn, onSignUp, onForgotPassword, authLoading }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email || !password) {
      alert('Error: Please enter both email and password');
      return;
    }

    if (isSignUp && (!firstName || !lastName)) {
      alert('Error: Please enter your first and last name');
      return;
    }

    if (isSignUp) {
      await onSignUp(email, password, firstName, lastName);
    } else {
      await onSignIn(email, password);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      alert('Please enter your email address to reset password');
      return;
    }

    setForgotPasswordLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://ghanatrotrotransit.netlify.app/reset-password',
    });

    if (error) throw error;
    
    alert(
      `Password Reset Email Sent', Check your email (${email}) for the password reset link. The link will expire in 24 hours.`
    );
    } catch (error) {
      alert(`Error sending reset email. Please try again.,${error.message}`);
    } finally {
      setForgotPasswordLoading(false);
    }
  };

  return (
    <div className="auth-form">
      <h2 className="auth-title">
        {isSignUp ? 'Create Account' : 'Sign In'}
      </h2>
      
      {isSignUp && (
        <>
          <div className="auth-input-container">
            <User size={20} color={COLORS.primary} />
            <input
              className="auth-input-field"
              placeholder="First Name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              style={{ color: COLORS.textLight }}
            />
          </div>
          <div className="auth-input-container">
            <User size={20} color={COLORS.primary} />
            <input
              className="auth-input-field"
              placeholder="Last Name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              style={{ color: COLORS.textLight }}
            />
          </div>
        </>
      )}
      
      <div className="auth-input-container">
        <Mail size={20} color={COLORS.primary} />
        <input
          className="auth-input-field"
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ color: COLORS.textLight }}
        />
      </div>
      
      <div className="auth-input-container">
        <Lock size={20} color={COLORS.primary} />
        <input
          className="auth-input-field"
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ color: COLORS.textLight }}
        />
      </div>
      
      <button 
        className={`auth-button ${authLoading ? 'auth-button-disabled' : ''}`}
        onClick={handleSubmit}
        disabled={authLoading}
      >
        {authLoading ? 'Loading...' : (isSignUp ? 'Sign Up' : 'Sign In')}
      </button>

      {!isSignUp && (
        <button 
          className="auth-forgot-password"
          onClick={handleForgotPassword}
          disabled={forgotPasswordLoading}
        >
          {forgotPasswordLoading ? 'Sending...' : 'Forgot Password?'}
        </button>
      )}
      
      <button 
        className="auth-switch"
        onClick={() => setIsSignUp(!isSignUp)}
      >
        {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
      </button>
    </div>
  );
};

const GhanaTrotroTransit = () => {
  // Navigation and UI states
  const [startPoint, setStartPoint] = useState('');
  const [destination, setDestination] = useState('');
  const [routes, setRoutes] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [activeInput, setActiveInput] = useState('start');
  const [isLoading, setIsLoading] = useState(false);
  
  // User states
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [showWelcomeBanner, setShowWelcomeBanner] = useState(false);
  
  // Modal states
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showBottomSheet, setShowBottomSheet] = useState(false);
  const [bottomSheetContent, setBottomSheetContent] = useState('search'); // 'search' or 'route'
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showSearchHistoryModal, setShowSearchHistoryModal] = useState(false);
  
  // History states
  const [createdRoutesHistory, setCreatedRoutesHistory] = useState([]);
  const [searchHistory, setSearchHistory] = useState([]);

  // Rate limit states
  const [rateLimitInfo, setRateLimitInfo] = useState({
    routeSearches: { remaining: RATE_LIMIT_CONFIG.ROUTE_SEARCHES.MAX_REQUESTS },
    suggestions: { remaining: RATE_LIMIT_CONFIG.SUGGESTIONS.MAX_REQUESTS }
  });

  // Refs
  const startInputRef = useRef(null);
  const destinationInputRef = useRef(null);
  const bottomSheetRef = useRef(null);
  const modalRef = useRef(null);

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
    return MAP_CONFIG.center;
  }, [memoizedRouteCoordinates]);

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
    handleOverlayClick(e, () => setShowProfileModal(false));
  }, [handleOverlayClick]);

  // Close info modal when clicking on overlay
  const handleInfoModalOverlayClick = useCallback((e) => {
    handleOverlayClick(e, () => setShowInfoModal(false));
  }, [handleOverlayClick]);

  // Close search history modal when clicking on overlay
  const handleSearchHistoryModalOverlayClick = useCallback((e) => {
    handleOverlayClick(e, () => setShowSearchHistoryModal(false));
  }, [handleOverlayClick]);

  // Check user on component mount
  const checkUser = useCallback(async () => {
    try {
      const userId = getUserIdForRateLimit(user);
      const rateLimit = checkRateLimit(userId, 'USER_INFO');
      
      if (!rateLimit.allowed) {
        console.warn('Rate limit exceeded for user info fetch');
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      
      if (session?.user) {
        await fetchUserProfile(session.user.id);
        await fetchUserHistory(session.user.id);
      }
    } catch (error) {
      console.error('Error checking user:', error);
    }
  }, [user]);

  // Fetch user profile with rate limiting
  const fetchUserProfile = useCallback(async (userId) => {
    try {
      const rateLimit = checkRateLimit(userId, 'USER_INFO');
      
      if (!rateLimit.allowed) {
        console.warn('Rate limit exceeded for user profile fetch');
        return;
      }

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

  // Fetch user history with rate limiting
  const fetchUserHistory = useCallback(async (userId) => {
    try {
      const rateLimit = checkRateLimit(userId, 'USER_INFO');
      
      if (!rateLimit.allowed) {
        console.warn('Rate limit exceeded for user history fetch');
        return;
      }

      const [createdRoutes, searchHistoryData] = await Promise.all([
        supabase.from('user_created_routes').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('search_history').select('*').eq('user_id', userId).order('searched_at', { ascending: false })
      ]);

      if (!createdRoutes.error) setCreatedRoutesHistory(createdRoutes.data || []);
      if (!searchHistoryData.error) setSearchHistory(searchHistoryData.data || []);
    } catch (error) {
      console.error('Error fetching user history:', error);
    }
  }, []);

  // Save search history
  const saveSearchHistory = useCallback(async (start, dest) => {
    if (!user) return;
    
    try {
      const { error } = await supabase
        .from('search_history')
        .insert({
          user_id: user.id,
          start_point: start,
          destination: dest
        });
      
      if (error) console.error('Error saving search history:', error);
    } catch (error) {
      console.error('Error saving search history:', error);
    }
  }, [user]);

  // Fetch stop suggestions with rate limiting
  const fetchSuggestions = useCallback(async (query, type) => {
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }

    const userId = getUserIdForRateLimit(user);
    const rateLimit = checkRateLimit(userId, 'SUGGESTIONS');
    
    if (!rateLimit.allowed) {
      console.warn('Rate limit exceeded for suggestions');
      setSuggestions([]);
      return;
    }

    // Update rate limit info
    setRateLimitInfo(prev => ({
      ...prev,
      suggestions: { remaining: rateLimit.remaining }
    }));

    try {
      const { data, error } = await supabase
        .from('stops')
        .select('*')
        .ilike('name', `%${query}%`)
        .limit(5);

      if (!error && data) {
        setSuggestions(data);
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
  }, [user]);

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

  const handleSignOut = useCallback(async () => {
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
      alert('Success: Signed out successfully!');
    } catch (error) {
      alert('Error: ' + error.message);
    }
  }, []);

  const handlePasswordChange = useCallback(async () => {
    if (!user) return;
    
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email,{
        redirectTo: "https://ghanatrotrotransit.netlify.app/reset-password/"
      });
      if (error) throw error;
      
      alert('Password Reset: Check your email for the password reset link');
    } catch (error) {
      alert('Error: ' + error.message);
    }
  }, [user]);

  // Route finding function with rate limiting
  const findRoutes = useCallback(async () => {
    if (!user) {
      alert('Authentication Required: Please sign in to search for routes');
      setShowProfileModal(true);
      return;
    }

    if (!startPoint || !destination) {
      alert('Error: Please enter both start and destination points');
      return;
    }

    // Check rate limit for route searches
    const userId = getUserIdForRateLimit(user);
    const rateLimit = checkRateLimit(userId, 'ROUTE_SEARCHES');
    
    if (!rateLimit.allowed) {
      alert(`Rate limit exceeded: Please wait ${rateLimit.retryAfter} seconds before searching for routes again.`);
      return;
    }

    // Update rate limit info
    setRateLimitInfo(prev => ({
      ...prev,
      routeSearches: { remaining: rateLimit.remaining }
    }));

    setIsLoading(true);
    
    // Save to search history
    await saveSearchHistory(startPoint, destination);
    
    try {
      console.log('Searching for routes from:', startPoint, 'to:', destination);
      
      // Fetch routes from Supabase with related stops
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
        alert('No routes found in database');
        setIsLoading(false);
        return;
      }

      // Filter routes that match the search criteria
      const matchingRoutes = routesData.filter(route => {
        if (!route.route_stops || route.route_stops.length === 0) return false;
        
        // Sort stops by stop_order
        const sortedStops = route.route_stops.sort((a, b) => a.stop_order - b.stop_order);
        
        // Check if first stop matches user's start point
        const firstStop = sortedStops[0];
        const lastStop = sortedStops[sortedStops.length - 1];
        
        const firstStopName = firstStop.stops.name.toLowerCase();
        const lastStopName = lastStop.stops.name.toLowerCase();
        const userStart = startPoint.toLowerCase();
        const userDest = destination.toLowerCase();
        
        // Check for partial matches
        const startMatches = firstStopName.includes(userStart) || userStart.includes(firstStopName);
        const destMatches = lastStopName.includes(userDest) || userDest.includes(lastStopName);
        
        return startMatches && destMatches;
      });

      console.log('Matching routes found:', matchingRoutes.length);

      if (matchingRoutes.length === 0) {
        alert(`No direct routes found from ${startPoint} to ${destination}. Try different stops.`);
        setIsLoading(false);
        return;
      }

      // Format the routes for the app
      const formattedRoutes = matchingRoutes.map(route => {
        const sortedStops = route.route_stops.sort((a, b) => a.stop_order - b.stop_order);
        
        return {
          id: route.id,
          name: route.name,
          total_distance: route.total_distance,
          total_fare: route.total_fare,
          stops: sortedStops.map(rs => ({
            name: rs.stops.name,
            lat: parseFloat(rs.stops.latitude),
            lng: parseFloat(rs.stops.longitude),
            fare_to_next: rs.fare_to_next,
            distance_to_next: rs.distance_to_next,
          }))
        };
      });

      setRoutes(formattedRoutes);
      
      // Auto-select the first route
      const firstRoute = formattedRoutes[0];
      setSelectedRoute(firstRoute);
      
      setBottomSheetContent('route');
      setShowBottomSheet(true);
      
    } catch (error) {
      console.error('Error finding routes:', error);
      alert('Error searching for routes. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [user, startPoint, destination, saveSearchHistory]);

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
  }, []);

  const closeBottomSheet = useCallback(() => {
    setShowBottomSheet(false);
  }, []);

  const showRouteDetails = useCallback(() => {
    if (selectedRoute) {
      setBottomSheetContent('route');
      setShowBottomSheet(true);
    } else {
      setBottomSheetContent('search');
      setShowBottomSheet(true);
    }
  }, [selectedRoute]);

  // Effects
  useEffect(() => {
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
        }
      } else {
        setUserProfile(null);
        setCreatedRoutesHistory([]);
        setSearchHistory([]);
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, [checkUser, fetchUserProfile, fetchUserHistory]);

  // Check if any modal or bottom sheet is open
  const isAnyModalOpen = showBottomSheet || showProfileModal || showInfoModal || showSearchHistoryModal;

  // Render search form with rate limit info
  const renderSearchForm = useCallback(() => (
    <div className="search-section">
      <div className="scroll-view">
        <div className="sheet-header">
          <div className="header-content">
            <h1 className="app-title">Ghana Trotro Transit</h1>
            <p className="app-subtitle">Find your perfect trotro route</p>
          </div>
          <button 
            className="close-button"
            onClick={closeBottomSheet}
          >
            <X size={20} color={COLORS.text} />
          </button>
        </div>
        
        {!user && (
          <div className="auth-banner">
            <div className="auth-banner-content">
              <Lock size={16} color="#FFFFFF" />
              <span className="auth-banner-text">
                Sign in to search for routes
              </span>
            </div>
            <button 
              className="auth-banner-button"
              onClick={() => setShowProfileModal(true)}
            >
              Sign In
            </button>
          </div>
        )}

        {user && showWelcomeBanner && (
          <div className="welcome-banner">
            <span className="welcome-text">
              Welcome back, {userProfile?.first_name || user.email?.split('@')[0]}! 👋
            </span>
          </div>
        )}

        {/* Rate Limit Info Banner */}
        {user && (
          <div className="rate-limit-info">
            <div className="rate-limit-item">
              <span className="rate-limit-label">Route searches left:</span>
              <span className={`rate-limit-value ${rateLimitInfo.routeSearches.remaining < 3 ? 'rate-limit-warning' : ''}`}>
                {rateLimitInfo.routeSearches.remaining}/{RATE_LIMIT_CONFIG.ROUTE_SEARCHES.MAX_REQUESTS}
              </span>
            </div>
            <div className="rate-limit-item">
              <span className="rate-limit-label">Suggestions left:</span>
              <span className={`rate-limit-value ${rateLimitInfo.suggestions.remaining < 5 ? 'rate-limit-warning' : ''}`}>
                {rateLimitInfo.suggestions.remaining}/{RATE_LIMIT_CONFIG.SUGGESTIONS.MAX_REQUESTS}
              </span>
            </div>
          </div>
        )}

        <div className="search-card">
          <div className="input-row">
            <div className="input-container">
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
                  if (user) {
                    fetchSuggestions(e.target.value, 'start');
                  }
                }}
                onFocus={() => {
                  if (!user) {
                    alert('Authentication Required: Please sign in to search for routes');
                    setShowProfileModal(true);
                    return;
                  }
                  setActiveInput('start');
                }}
              />
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
                  if (user) {
                    fetchSuggestions(e.target.value, 'destination');
                  }
                }}
                onFocus={() => {
                  if (!user) {
                    alert('Authentication Required: Please sign in to search for routes');
                    setShowProfileModal(true);
                    return;
                  }
                  setActiveInput('destination');
                }}
              />
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
            className={`search-button ${(!user || isLoading) ? 'search-button-disabled' : ''}`} 
            onClick={findRoutes}
            disabled={!user || isLoading}
          >
            {!user ? (
              <>
                <Lock size={20} color="#FFFFFF" />
                <span className="search-button-text">Sign In to Search</span>
              </>
            ) : (
              <>
                <Search size={20} color="#FFFFFF" />
                <span className="search-button-text">
                  {isLoading ? 'Finding Routes...' : 'Find Routes'}
                </span>
              </>
            )}
          </button>
        </div>

        {!user && (
          <div className="quick-auth-section">
            <span className="quick-auth-text">Don't have an account?</span>
            <button 
              className="quick-auth-button"
              onClick={() => setShowProfileModal(true)}
            >
              Sign Up Free
            </button>
          </div>
        )}
      </div>
    </div>
  ), [user, startPoint, destination, suggestions, activeInput, isLoading, showWelcomeBanner, userProfile, rateLimitInfo, fetchSuggestions, swapLocations, findRoutes, closeBottomSheet]);

  // Render route details
  const renderRouteDetails = useCallback(() => (
    <div className="route-details">
      <div className="sheet-header">
        <div className="header-content">
          <h2 className="route-name">{selectedRoute?.name || 'Route Details'}</h2>
          <p className="route-subtitle">
            {selectedRoute?.stops[0]?.name} → {selectedRoute?.stops[selectedRoute.stops.length - 1]?.name}
          </p>
        </div>
        <div className="header-buttons">
          <button className="new-search-button" onClick={resetSearch} title="New Search">
            <Search size={18} color="#FFFFFF" />
          </button>
          <button 
            className="close-button"
            onClick={closeBottomSheet}
            title="Close"
          >
            <X size={20} color={COLORS.text} />
          </button>
        </div>
      </div>

      {selectedRoute && (
        <>
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
                <DollarSign size={20} color={COLORS.primary} />
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
            <h3 className="stops-title">Route Stops</h3>
            <div className="stops-timeline">
              {selectedRoute.stops.map((stop, index) => (
                <div key={index} className="stop-item">
                  <div className="stop-marker">
                    <div className={`stop-dot ${index === 0 ? 'start-dot' : index === selectedRoute.stops.length - 1 ? 'end-dot' : ''}`}>
                      {index === 0 ? <MapPin size={12} color="#FFFFFF" /> : 
                       index === selectedRoute.stops.length - 1 ? <Navigation size={12} color="#FFFFFF" /> :
                       <span className="stop-number">{index + 1}</span>}
                    </div>
                    {index < selectedRoute.stops.length - 1 && <div className="stop-line" />}
                  </div>
                  <div className="stop-info">
                    <div className="stop-header">
                      <span className="stop-name">{stop.name}</span>
                      {stop.fare_to_next && (
                        <span className="stop-fare">GH₵ {stop.fare_to_next}</span>
                      )}
                    </div>
                    {stop.distance_to_next && (
                      <span className="stop-distance">{stop.distance_to_next} km to next</span>
                    )}
                    <div className="stop-type">
                      {index === 0 ? 'Start Point' : 
                       index === selectedRoute.stops.length - 1 ? 'Destination' : 
                       `Stop ${index}`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  ), [selectedRoute, routes, resetSearch, closeBottomSheet]);

  return (
    <div className="container">
      {/* Map Component - Memoized to prevent unnecessary re-renders */}
      <MapComponent 
        center={memoizedMapCenter}
        routeCoordinates={memoizedRouteCoordinates}
        stops={memoizedStops}
      />

      {/* Top Right Buttons */}
      <button
        className="profile-button"
        onClick={() => setShowProfileModal(true)}
      >
        <User size={24} color="#FFFFFF" />
      </button>

      <button
        className="plus-button"
        onClick={() => alert('Create route feature coming soon!')}
      >
        <Plus size={20} color="#FFFFFF" />
      </button>

      {/* Info Button with conditional opacity */}
        <button className={`info-button ${isAnyModalOpen ? 'info-button-dimmed' : ''}`} onClick={() => setShowInfoModal(true)}>
          <Info size={20} color="#FFFFFF" />
        </button>

      {/* Bottom Sheet - Slides up from bottom */}
      {showBottomSheet && (
        <div 
          className="bottom-sheet-overlay"
          onClick={handleBottomSheetOverlayClick}
        >
          <div className="bottom-sheet" ref={bottomSheetRef}>
            <div className="bottom-sheet-content">
              {bottomSheetContent === 'search' ? renderSearchForm() : renderRouteDetails()}
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
          <div className="modal" ref={modalRef}>
            <div className="modal-header">
              <h2 className="modal-title">Profile</h2>
              <button 
                className="close-button"
                onClick={() => setShowProfileModal(false)}
              >
                <X size={24} color={COLORS.text} />
              </button>
            </div>

            {user ? (
              <div className="modal-content">
                <div className="user-info">
                  <div className="avatar">
                    <span className="avatar-text">
                      {userProfile?.first_name?.[0]}{userProfile?.last_name?.[0] || user.email?.[0]?.toUpperCase()}
                    </span>
                  </div>
                  <span className="user-name">
                    {userProfile?.first_name} {userProfile?.last_name}
                  </span>
                  <span className="user-email">{user.email}</span>
                </div>

                <div className="profile-options">
                  <button 
                    className="profile-option"
                    onClick={handlePasswordChange}
                  >
                    <Key size={20} color={COLORS.primary} />
                    <span className="profile-option-text">Change Password</span>
                  </button>

                  <button 
                    className="profile-option"
                    onClick={() => {
                      setShowSearchHistoryModal(true);
                      setShowProfileModal(false);
                    }}
                  >
                    <History size={20} color={COLORS.primary} />
                    <span className="profile-option-text">Search History</span>
                  </button>

                  <button 
                    className="profile-option sign-out-option"
                    onClick={handleSignOut}
                  >
                    <span className="sign-out-text">Sign Out</span>
                  </button>
                </div>
              </div>
            ) : (
              <AuthForm onSignIn={handleSignIn} onSignUp={handleSignUp} authLoading={authLoading} />
            )}
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
                <X size={24} color={COLORS.text} />
              </button>
            </div>

            <div className="modal-content">
              <div className="info-section">
                <h3 className="info-section-title">How It Works</h3>
                <p className="info-text">
                  Ghana Trotro Transit helps you navigate Accra's public transportation system by finding the best trotro routes between locations.
                </p>
              </div>

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
                </div>
              </div>

              <div className="info-section">
                <h3 className="info-section-title">Contact & Support</h3>
                <div className="contact-list">
                  <div className="contact-item">
                    <Phone size={16} color={COLORS.primary} />
                    <span className="contact-text">+233 209 156 811</span>
                  </div>
                  <div className="contact-item">
                    <Mail size={16} color={COLORS.primary} />
                    <span className="contact-text">nananketia07@gmail.com</span>
                  </div>
                  <div className="contact-item">
                    <Globe size={16} color={COLORS.primary} />
                    <span className="contact-text">www.ghanatrotrotransit.com/help</span>
                  </div>
                </div>
              </div>

              <div className="info-section">
                <h3 className="info-section-title">Contact & Support</h3>
                <div className="contact-list">
                  <div className="contact-item">
                    <Info size={20} color={COLORS.primary} />
                    <span className="contact-text">Please prices may vary, carry extra change on you as you commute. Happy trotro-ing!</span>
                  </div>
                </div>
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
          <div className="modal" ref={modalRef}>
            <div className="modal-header">
              <h2 className="modal-title">Search History</h2>
              <button 
                className="close-button"
                onClick={() => setShowSearchHistoryModal(false)}
              >
                <X size={24} color={COLORS.text} />
              </button>
            </div>

            <div className="modal-content">
              {searchHistory.length === 0 ? (
                <div className="empty-state">
                  <History size={48} color={COLORS.textLight} />
                  <h3 className="empty-state-title">No Search History</h3>
                  <p className="empty-state-text">
                    Your search history will appear here once you start searching for routes.
                  </p>
                </div>
              ) : (
                <div className="history-list">
                  {searchHistory.map((search) => (
                    <button
                      key={search.id}
                      className="history-item"
                      onClick={() => {
                        setStartPoint(search.start_point);
                        setDestination(search.destination);
                        setShowSearchHistoryModal(false);
                        setBottomSheetContent('search');
                        setShowBottomSheet(true);
                      }}
                    >
                      <span className="history-route-name">
                        {search.start_point} → {search.destination}
                      </span>
                      <span className="history-date">
                        {new Date(search.searched_at).toLocaleDateString()}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {isLoading && (
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
        </div>
      )}
    </div>
  );
};

export default GhanaTrotroTransit;