import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  StatusBar,

  Animated,
  Dimensions,
  Easing,
} from 'react-native';
import axios from 'axios';

// API Configuration - Automatically detects platform
const API_BASE_URL = 'http://localhost:8080/api';
// const API_BASE_URL = 'http://192.168.1.100:8080/api';
// Replace 192.168.1.100 with YOUR actual IP
const { width } = Dimensions.get('window');

export default function App() {
  const [leaderboard, setLeaderboard] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [totalUsers, setTotalUsers] = useState(0);
  const [page, setPage] = useState(1);
  const [isSearchMode, setIsSearchMode] = useState(false);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-50)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Start animations on mount
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    // Pulse animation for header
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  // Fetch leaderboard data
  const fetchLeaderboard = useCallback(async (pageNum = 1) => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/leaderboard`, {
        params: {
          page: pageNum,
          pageSize: 50,
        },
      });
      
      if (pageNum === 1) {
        setLeaderboard(response.data.users);
      } else {
        setLeaderboard(prev => [...prev, ...response.data.users]);
      }
      
      setTotalUsers(response.data.totalUsers);
      setPage(pageNum);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      alert('⚠️ Failed to connect to backend.\n\nMake sure:\n1. Backend is running on port 8080\n2. You ran: go run main.go');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Search users
  const searchUsers = async (query) => {
    if (!query.trim()) {
      setIsSearchMode(false);
      setSearchResults([]);
      return;
    }

    try {
      setLoading(true);
      setIsSearchMode(true);
      const response = await axios.get(`${API_BASE_URL}/search`, {
        params: { q: query },
      });
      setSearchResults(response.data.results);
    } catch (error) {
      console.error('Error searching users:', error);
      alert('Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Load more data for pagination
  const loadMore = () => {
    if (!loading && !isSearchMode) {
      fetchLeaderboard(page + 1);
    }
  };

  // Refresh data
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    if (isSearchMode && searchQuery) {
      searchUsers(searchQuery);
    } else {
      fetchLeaderboard(1);
    }
  }, [isSearchMode, searchQuery, fetchLeaderboard]);

  // Initial load
  useEffect(() => {
    fetchLeaderboard(1);
  }, [fetchLeaderboard]);

  // Handle search input change with debounce
  const searchTimeout = useRef(null);
  const handleSearchChange = (text) => {
    setSearchQuery(text);
    
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    if (text.trim()) {
      searchTimeout.current = setTimeout(() => {
        searchUsers(text);
      }, 300);
    } else {
      setIsSearchMode(false);
      setSearchResults([]);
    }
  };

  // Get rank badge style with gradient effect
  const getRankBadgeStyle = (rank) => {
    if (rank === 1) return { 
      backgroundColor: '#FFD700', 
      color: '#000',
      shadowColor: '#FFD700',
      emoji: '👑'
    };
    if (rank === 2) return { 
      backgroundColor: '#C0C0C0', 
      color: '#000',
      shadowColor: '#C0C0C0',
      emoji: '🥈'
    };
    if (rank === 3) return { 
      backgroundColor: '#CD7F32', 
      color: '#FFF',
      shadowColor: '#CD7F32',
      emoji: '🥉'
    };
    return { 
      backgroundColor: '#374151', 
      color: '#FFF',
      shadowColor: '#000',
      emoji: ''
    };
  };

  // Animated User Row Component
  const AnimatedUserRow = ({ item, index }) => {
    const scaleAnim = useRef(new Animated.Value(0.9)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 40,
          delay: index * 50,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 400,
          delay: index * 50,
          useNativeDriver: true,
        }),
      ]).start();
    }, []);

    const isTopThree = item.rank <= 3;
    const rankStyle = getRankBadgeStyle(item.rank);

    return (
      <Animated.View 
        style={[
          styles.userRow, 
          isTopThree && styles.topThreeRow,
          {
            opacity: opacityAnim,
            transform: [{ scale: scaleAnim }],
          }
        ]}
      >
        {/* Rank Badge with Glow Effect */}
        <View style={[
          styles.rankBadge, 
          { 
            backgroundColor: rankStyle.backgroundColor,
            shadowColor: rankStyle.shadowColor,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.6,
            shadowRadius: 8,
            elevation: 8,
          }
        ]}>
          <Text style={[styles.rankText, { color: rankStyle.color }]}>
            {item.rank}
          </Text>
        </View>

        {/* User Info */}
        <View style={styles.userInfo}>
          <View style={styles.usernameRow}>
            <Text style={styles.username} numberOfLines={1}>
              {item.username}
            </Text>
            {rankStyle.emoji && (
              <Text style={styles.rankEmoji}>{rankStyle.emoji}</Text>
            )}
          </View>
          {isTopThree && (
            <Text style={styles.topThreeBadge}>
              {item.rank === 1 ? '👑 Champion' : item.rank === 2 ? '🥈 Runner-up' : '🥉 Third Place'}
            </Text>
          )}
        </View>

        {/* Rating Container with Pulse */}
        <View style={styles.ratingContainer}>
          <Text style={[
            styles.rating,
            isTopThree && styles.topThreeRating
          ]}>
            {item.rating}
          </Text>
          <Text style={styles.ratingLabel}>points</Text>
        </View>
      </Animated.View>
    );
  };

  const displayData = isSearchMode ? searchResults : leaderboard;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0E27" />
      
      {/* Animated Header with Gradient */}
      <Animated.View 
        style={[
          styles.header,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          }
        ]}
      >
        <View style={styles.headerContent}>
          <Animated.Text 
            style={[
              styles.headerTitle,
              { transform: [{ scale: pulseAnim }] }
            ]}
          >
            🏆 Global Leaderboard
          </Animated.Text>
          <Text style={styles.headerSubtitle}>
            {totalUsers.toLocaleString()} active players worldwide
          </Text>
        </View>
      </Animated.View>

      {/* Animated Search Bar */}
      <Animated.View 
        style={[
          styles.searchWrapper,
          { opacity: fadeAnim }
        ]}
      >
        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by username..."
            placeholderTextColor="#64748B"
            value={searchQuery}
            onChangeText={handleSearchChange}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={() => {
                setSearchQuery('');
                setIsSearchMode(false);
                setSearchResults([]);
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.clearButtonText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>

      {/* Results Info with Animation */}
      {isSearchMode && (
        <Animated.View 
          style={[
            styles.resultsInfo,
            { opacity: fadeAnim }
          ]}
        >
          <Text style={styles.resultsText}>
            {searchResults.length > 0 
              ? `✨ Found ${searchResults.length} player${searchResults.length !== 1 ? 's' : ''}` 
              : '❌ No players found'}
          </Text>
        </Animated.View>
      )}

      {/* Column Headers */}
      <View style={styles.columnHeaders}>
        <Text style={[styles.columnHeader, styles.rankColumn]}>Rank</Text>
        <Text style={[styles.columnHeader, styles.usernameColumn]}>Player</Text>
        <Text style={[styles.columnHeader, styles.ratingColumn]}>Score</Text>
      </View>

      {/* Leaderboard List */}
      {loading && displayData.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>Loading leaderboard...</Text>
          <Text style={styles.loadingSubtext}>Fetching player rankings</Text>
        </View>
      ) : displayData.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🔍</Text>
          <Text style={styles.emptyText}>
            {isSearchMode ? 'No players found' : 'No data available'}
          </Text>
          <Text style={styles.emptySubtext}>
            {isSearchMode ? 'Try a different search term' : 'Make sure backend is running'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={displayData}
          renderItem={({ item, index }) => (
            <AnimatedUserRow item={item} index={index} />
          )}
          keyExtractor={(item, index) => `${item.username}-${index}`}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#3B82F6"
              colors={['#3B82F6', '#8B5CF6']}
              progressBackgroundColor="#1E293B"
            />
          }
          ListFooterComponent={
            loading && displayData.length > 0 ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color="#3B82F6" />
                <Text style={styles.footerText}>Loading more players...</Text>
              </View>
            ) : null
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0E27',
  },
  header: {
    backgroundColor: '#1E293B',
    paddingTop: 15,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomWidth: 3,
    borderBottomColor: '#3B82F6',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 12,
  },
  headerContent: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  searchWrapper: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderRadius: 20,
    paddingHorizontal: 18,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#334155',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  searchIcon: {
    fontSize: 22,
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    height: 54,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  clearButton: {
    padding: 10,
    borderRadius: 20,
    backgroundColor: '#334155',
  },
  clearButtonText: {
    color: '#94A3B8',
    fontSize: 20,
    fontWeight: 'bold',
  },
  resultsInfo: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  resultsText: {
    color: '#3B82F6',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  columnHeaders: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#1E293B',
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#334155',
  },
  columnHeader: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  rankColumn: {
    width: 70,
  },
  usernameColumn: {
    flex: 1,
  },
  ratingColumn: {
    width: 80,
    textAlign: 'right',
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 18,
    backgroundColor: '#1E293B',
    marginHorizontal: 16,
    marginVertical: 6,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  topThreeRow: {
    borderWidth: 3,
    borderColor: '#3B82F6',
    backgroundColor: '#1E3A5F',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 10,
  },
  rankBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  rankText: {
    fontSize: 20,
    fontWeight: '900',
  },
  userInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  username: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    flex: 1,
    letterSpacing: 0.3,
  },
  rankEmoji: {
    fontSize: 18,
    marginLeft: 8,
  },
  topThreeBadge: {
    color: '#60A5FA',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
    letterSpacing: 0.5,
  },
  ratingContainer: {
    alignItems: 'flex-end',
  },
  rating: {
    color: '#3B82F6',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  topThreeRating: {
    color: '#60A5FA',
  },
  ratingLabel: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 2,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  loadingText: {
    color: '#94A3B8',
    marginTop: 20,
    fontSize: 18,
    fontWeight: '700',
  },
  loadingSubtext: {
    color: '#64748B',
    marginTop: 8,
    fontSize: 14,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyIcon: {
    fontSize: 72,
    marginBottom: 20,
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 10,
  },
  emptySubtext: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '500',
  },
  footerLoader: {
    paddingVertical: 30,
    alignItems: 'center',
  },
  footerText: {
    color: '#64748B',
    marginTop: 12,
    fontSize: 13,
    fontWeight: '600',
  },
});