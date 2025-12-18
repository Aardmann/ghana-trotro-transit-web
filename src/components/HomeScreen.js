import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { 
  ArrowUpDown, Copy, Info, Lock, MapPin, Navigation, 
  Search, Share2, User, X, Plus, History, Key, 
  Mail, Phone, Globe, Clock, Map,
  ChevronLeft, ChevronRight, ArrowLeft, ArrowRight, 
  Bus, CheckCircle, Calendar, Thermometer, Hash,
  Tv, Building, Package, AlertCircle, CalendarDays,
  Wind, Type, RefreshCw, Radio
} from 'lucide-react';
import { supabase } from '../config/supabase';
import { COLORS, MAP_CONFIG, SAMPLE_STOPS } from '../utils/constants';
import MapComponent from './MapComponent';
import '../styles/HomeScreen.css';

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
    try {
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

  // Fetch stop suggestions
  const fetchSuggestions = useCallback(async (query, type) => {
    if (query.length < 2) {
      setSuggestions([]);
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
      
      // Stop realtime subscriptions on sign out
      stopRealtimeSubscriptions();
      
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

        // Format routes
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

  // Update the findRoutes function
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
        alert('No routes found in database');
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
        alert(`No direct routes found from ${startPoint} to ${destination}. Try different stops.`);
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
  }, [user, startPoint, destination, saveSearchHistory, fetchRouteInfo]);

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
    setTouchStart(clientX);
    setIsSwipeActive(true);
    setSwipeTranslate(0);
  };

  const handleTouchMove = (e) => {
    if (touchStart === null) return;
    
    const clientX = e.touches && e.touches[0] ? e.touches[0].clientX : e.clientX;
    const distance = clientX - touchStart;
    
    // Only allow swipe when showing route content
    if (bottomSheetContent === 'route') {
      // Limit the drag to -100% to 100%
      const clampedDistance = Math.max(-window.innerWidth, Math.min(window.innerWidth, distance));
      setSwipeTranslate(clampedDistance);
    }
  };

  const handleTouchEnd = () => {
    if (touchStart === null) return;
    
    const swipeThreshold = window.innerWidth * 0.2; // 20% of screen width
    
    // Only respond to swipes when bottom sheet is showing route content
    if (bottomSheetContent === 'route') {
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

  // Check if any modal or bottom sheet is open
  const isAnyModalOpen = showBottomSheet || showProfileModal || showInfoModal || showSearchHistoryModal;

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
        setSearchHistory([]);
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
              <X size={20} color={COLORS.text} />
            </button>
          </div>
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
                    ensureConnected();
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
                  ensureConnected();
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
                    ensureConnected();
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
                  ensureConnected();
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
            className={`search-button ${!user ? 'search-button-disabled' : ''} ${isFindingRoutes ? 'search-button-loading' : ''}`} 
            onClick={findRoutes}
            disabled={!user || isFindingRoutes}
          >
            {!user ? (
              <>
                <Lock size={20} color="#FFFFFF" />
                <span className="search-button-text">Sign In to Search</span>
              </>
            ) : (
              <>
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
  ), [user, startPoint, destination, suggestions, activeInput, showWelcomeBanner, userProfile, isRealtimeConnected, lastUpdateTime, fetchSuggestions, swapLocations, findRoutes, closeBottomSheet, ensureConnected]);

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
            {selectedRoute?.stops[0]?.name} → {selectedRoute?.stops[selectedRoute.stops.length - 1]?.name}
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
  ), [selectedRoute, routes, resetSearch, closeBottomSheet, showSwipeIndicator, isRealtimeConnected, lastUpdateTime]);

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
            <X size={20} color={COLORS.text} />
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

      {/* Bottom Sheet - Slides up from bottom */}
      {showBottomSheet && (
        <div 
          className="bottom-sheet-overlay"
          onClick={handleBottomSheetOverlayClick}
        >
          <div
            className="bottom-sheet"
            ref={bottomSheetRef}
          >
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
                <h3 className="info-section-title">Note</h3>
                <div className="contact-list">
                  <div className="contact-item">
                    <Info size={20} color={COLORS.primary} />
                    <span className="contact-text">Prices may vary from time to time, please make sure to carry on you extra change to avoid complications. Happy Trotro-ing!.</span>
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
    </div>
  );
};

export default GhanaTrotroTransit;