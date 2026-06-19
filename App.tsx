import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  Alert,
  PermissionsAndroid,
  Platform,
  SectionList,
  View,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  Animated,
  StatusBar,
  RefreshControl,
} from 'react-native';
import { scanWifi, connectToWifi } from 'react-native-wifi-scanner-nguema';
import { useFavorites } from './src/hooks/useFavorites';
import { useCurrentWifi } from './src/hooks/useCurrentWifi';

// ── Theme ─────────────────────────────────────────────────────────────────────

const C = {
  bg:       '#0A0F1E',
  bg2:      '#111827',
  bg3:      '#1A2235',
  accent:   '#3D8EFF',
  surface:  'rgba(255,255,255,0.05)',
  border:   'rgba(255,255,255,0.08)',
  text:     '#FFFFFF',
  textSub:  'rgba(255,255,255,0.45)',
  textMute: 'rgba(255,255,255,0.25)',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function signalBars(level: number) {
  if (level >= -50) return 4;
  if (level >= -65) return 3;
  if (level >= -75) return 2;
  if (level >= -85) return 1;
  return 0;
}
function signalColor(level: number) {
  if (level >= -50) return '#00E676';
  if (level >= -65) return '#69F0AE';
  if (level >= -75) return '#FFD740';
  if (level >= -85) return '#FF6D00';
  return '#FF1744';
}
function signalLabel(level: number) {
  if (level >= -50) return 'Excellent';
  if (level >= -65) return 'Bon';
  if (level >= -75) return 'Moyen';
  if (level >= -85) return 'Faible';
  return 'Très faible';
}
function bandLabel(freq: number) {
  return freq >= 5000 ? '5 GHz' : '2.4 GHz';
}
function securityColor(sec: string) {
  if (sec === 'Open') return '#FF6D00';
  if (sec === 'WEP')  return '#FFD740';
  return '#00E676';
}

// ── SignalIcon ────────────────────────────────────────────────────────────────

function SignalIcon({ level, size = 22 }: { level: number; size?: number }) {
  const bars = signalBars(level);
  const color = signalColor(level);
  const heights = [size * 0.3, size * 0.5, size * 0.7, size];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>
      {heights.map((h, i) => (
        <View
          key={i}
          style={{
            width: size * 0.18,
            height: h,
            backgroundColor: i < bars ? color : C.border,
            borderRadius: 2,
          }}
        />
      ))}
    </View>
  );
}

// ── WifiCard ──────────────────────────────────────────────────────────────────

interface WifiItem {
  SSID: string;
  BSSID: string;
  level: number;
  frequency: number;
  security: string;
}

interface WifiCardProps {
  item: WifiItem;
  onPress: (item: WifiItem) => void;
  onFavorite: (ssid: string) => void;
  isFavorite: boolean;
  isConnected: boolean;
  index: number;
}

function WifiCard({ item, onPress, onFavorite, isFavorite, isConnected, index }: WifiCardProps) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 280,
      delay: index * 50,
      useNativeDriver: true,
    }).start();
  }, []);

  const color = signalColor(item.level);
  const secColor = securityColor(item.security);

  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0,1], outputRange: [24,0] }) }],
      }}
    >
      <TouchableOpacity
        style={[styles.card, isConnected && styles.cardConnected]}
        onPress={() => onPress(item)}
        activeOpacity={0.75}
      >
        {/* Signal icon */}
        <View style={styles.cardIcon}>
          <SignalIcon level={item.level} size={22} />
        </View>

        {/* Info */}
        <View style={styles.cardInfo}>
          <View style={styles.cardRow}>
            <Text style={styles.cardSSID} numberOfLines={1}>{item.SSID}</Text>
            {isConnected && (
              <View style={styles.connectedBadge}>
                <Text style={styles.connectedText}>✓ Connecté</Text>
              </View>
            )}
          </View>

          <View style={styles.cardMeta}>
            {/* Signal badge */}
            <View style={[styles.pill, { borderColor: color, backgroundColor: color + '18' }]}>
              <View style={[styles.dot, { backgroundColor: color }]} />
              <Text style={[styles.pillText, { color }]}>{signalLabel(item.level)}</Text>
            </View>

            {/* Security badge */}
            <View style={[styles.pill, { borderColor: secColor, backgroundColor: secColor + '18' }]}>
              <Text style={styles.secIcon}>{item.security === 'Open' ? '🔓' : '🔒'}</Text>
              <Text style={[styles.pillText, { color: secColor }]}>{item.security}</Text>
            </View>

            {/* Detail text */}
            <Text style={styles.cardDetail}>{item.level} dBm</Text>
          </View>
        </View>

        {/* Favorite star */}
        <TouchableOpacity
          onPress={() => onFavorite(item.SSID)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.starBtn}
        >
          <Text style={[styles.star, { opacity: isFavorite ? 1 : 0.25 }]}>
            {isFavorite ? '⭐' : '☆'}
          </Text>
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── SectionHeader ─────────────────────────────────────────────────────────────

function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionPill}>
        <Text style={styles.sectionCount}>{count}</Text>
      </View>
    </View>
  );
}

// ── Scan Button ───────────────────────────────────────────────────────────────

function ScanButton({ onPress, loading }: { onPress: () => void; loading: boolean }) {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (loading) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.12, duration: 600, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    } else {
      pulse.setValue(1);
    }
  }, [loading]);
  return (
    <TouchableOpacity onPress={onPress} disabled={loading} activeOpacity={0.8}>
      <Animated.View style={[styles.scanBtn, { transform: [{ scale: pulse }] }]}>
        {loading
          ? <ActivityIndicator color="#fff" size="small" />
          : <Text style={styles.scanBtnText}>⟳  Scanner</Text>
        }
      </Animated.View>
    </TouchableOpacity>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────

export default function App() {
  const [networks, setNetworks] = useState<WifiItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<'all' | 'favorites'>('all');
  const [lastScan, setLastScan] = useState<Date | null>(null);

  // Connect modal state
  const [selectedNetwork, setSelectedNetwork] = useState<WifiItem | null>(null);
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const modalAnim = useRef(new Animated.Value(0)).current;

  const { favorites, toggle: toggleFavorite } = useFavorites();
  const { currentSSID } = useCurrentWifi();

  // ── Permissions ──
  const requestPermissions = async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return true;
    try {
      const v = Number(Platform.Version);
      if (v >= 33) {
        const res = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          PermissionsAndroid.PERMISSIONS.NEARBY_WIFI_DEVICES,
        ]);
        return (
          res[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] === 'granted' &&
          res[PermissionsAndroid.PERMISSIONS.NEARBY_WIFI_DEVICES] === 'granted'
        );
      }
      const r = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        { title: "Localisation", message: "Requis pour scanner le Wi-Fi.", buttonPositive: "Autoriser", buttonNegative: "Refuser", buttonNeutral: "Plus tard" }
      );
      return r === 'granted';
    } catch { return false; }
  };

  // ── Scan ──
  const scan = async () => {
    setLoading(true);
    const ok = await requestPermissions();
    if (!ok) {
      Alert.alert("Permission refusée", "L'accès à la localisation est requis.");
      setLoading(false);
      return;
    }
    try {
      const raw = await scanWifi();
      const sorted = (raw || [])
        .map((n: any) => ({
          SSID: n.SSID || 'Réseau inconnu',
          BSSID: n.BSSID || '',
          level: n.level ?? -100,
          frequency: n.frequency ?? 2400,
          security: n.security || 'Open',
        }))
        .sort((a: WifiItem, b: WifiItem) => b.level - a.level);
      setNetworks(sorted);
      setLastScan(new Date());
    } catch (e: any) {
      Alert.alert("Erreur", e?.message || "Scan impossible.");
    } finally {
      setLoading(false);
    }
  };

  // ── Sections ──
  const sections = useMemo(() => {
    const pool = tab === 'favorites'
      ? networks.filter(n => favorites.has(n.SSID))
      : networks;

    const filtered = query
      ? pool.filter(n => n.SSID.toLowerCase().includes(query.toLowerCase()))
      : pool;

    const ghz5  = filtered.filter(n => n.frequency >= 5000);
    const ghz24 = filtered.filter(n => n.frequency < 5000);

    const result = [];
    if (ghz5.length)  result.push({ title: '⚡ 5 GHz',   data: ghz5 });
    if (ghz24.length) result.push({ title: '📡 2.4 GHz', data: ghz24 });
    return result;
  }, [networks, query, tab, favorites]);

  const totalFiltered = sections.reduce((s, sec) => s + sec.data.length, 0);

  // ── Modal ──
  const openModal = (item: WifiItem) => {
    setSelectedNetwork(item);
    setPassword('');
    setShowPwd(false);
    setModalVisible(true);
    Animated.spring(modalAnim, { toValue: 1, tension: 65, friction: 10, useNativeDriver: true }).start();
  };
  const closeModal = () => {
    Animated.timing(modalAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setModalVisible(false));
  };

  const handleConnect = async () => {
    if (!selectedNetwork) return;
    setConnecting(true);
    try {
      const success = await connectToWifi(selectedNetwork.SSID, password);
      if (success) {
        Alert.alert("✅ Connecté", `Vous êtes connecté à « ${selectedNetwork.SSID} ».`);
        closeModal();
      } else {
        Alert.alert("❌ Échec", "Impossible de se connecter. Vérifiez le mot de passe.");
      }
    } catch (e: any) {
      Alert.alert("Erreur", e?.message);
    } finally {
      setConnecting(false);
    }
  };

  const modalY = modalAnim.interpolate({ inputRange: [0, 1], outputRange: [500, 0] });

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {/* ── Header ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.appTitle}>Wi-Fi Scanner</Text>
          <Text style={styles.appSub}>
            {lastScan
              ? `Mise à jour ${lastScan.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
              : 'Détectez les réseaux à proximité'}
          </Text>
        </View>
        <ScanButton onPress={scan} loading={loading} />
      </View>

      {/* ── Search bar ── */}
      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher un réseau..."
          placeholderTextColor={C.textMute}
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')}>
            <Text style={styles.clearIcon}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Tabs ── */}
      <View style={styles.tabs}>
        {(['all', 'favorites'] as const).map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'all' ? `Tous (${networks.length})` : `⭐ Favoris (${favorites.size})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Connected banner ── */}
      {currentSSID && (
        <View style={styles.connBanner}>
          <Text style={styles.connBannerIcon}>📶</Text>
          <Text style={styles.connBannerText}>
            Connecté à <Text style={styles.connBannerSSID}>{currentSSID}</Text>
          </Text>
        </View>
      )}

      {/* ── List ── */}
      <SectionList
        sections={sections}
        keyExtractor={(item, i) => `${item.SSID}-${i}`}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={scan}
            tintColor={C.accent}
            colors={[C.accent]}
          />
        }
        renderSectionHeader={({ section }) => (
          <SectionHeader title={section.title} count={section.data.length} />
        )}
        renderItem={({ item, index }) => (
          <WifiCard
            item={item}
            onPress={openModal}
            onFavorite={toggleFavorite}
            isFavorite={favorites.has(item.SSID)}
            isConnected={item.SSID === currentSSID}
            index={index}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📡</Text>
            <Text style={styles.emptyTitle}>
              {tab === 'favorites' && favorites.size === 0
                ? 'Aucun favori enregistré'
                : query
                ? `Aucun résultat pour "${query}"`
                : 'Aucun réseau détecté'}
            </Text>
            <Text style={styles.emptyHint}>
              {tab === 'favorites' && favorites.size === 0
                ? 'Appuyez sur ☆ pour sauvegarder vos réseaux préférés'
                : 'Lancez un scan ou tirez vers le bas pour actualiser'}
            </Text>
          </View>
        }
      />

      {/* ── Connect Modal ── */}
      <Modal transparent visible={modalVisible} animationType="none" onRequestClose={closeModal}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={closeModal} />
        <Animated.View style={[styles.sheet, { transform: [{ translateY: modalY }] }]}>
          <View style={styles.sheetHandle} />

          {/* Network info row */}
          <View style={styles.sheetHeader}>
            <SignalIcon level={selectedNetwork?.level ?? -100} size={26} />
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetSSID} numberOfLines={1}>{selectedNetwork?.SSID}</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                <Text style={[styles.sheetMeta, { color: signalColor(selectedNetwork?.level ?? -100) }]}>
                  {signalLabel(selectedNetwork?.level ?? -100)} · {selectedNetwork?.level} dBm
                </Text>
                <Text style={[styles.sheetMeta, { color: securityColor(selectedNetwork?.security ?? 'Open') }]}>
                  {selectedNetwork?.security === 'Open' ? '🔓 Ouvert' : `🔒 ${selectedNetwork?.security}`}
                </Text>
              </View>
            </View>
          </View>

          {selectedNetwork?.security === 'Open' ? (
            <View style={styles.openNotice}>
              <Text style={styles.openNoticeText}>
                ⚠️ Ce réseau est ouvert — aucun mot de passe requis mais la connexion n'est pas chiffrée.
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.inputLabel}>Mot de passe Wi-Fi</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.input}
                  placeholder="Entrez le mot de passe"
                  placeholderTextColor={C.textMute}
                  secureTextEntry={!showPwd}
                  value={password}
                  onChangeText={setPassword}
                  autoFocus
                />
                <TouchableOpacity onPress={() => setShowPwd(v => !v)} style={styles.eyeBtn}>
                  <Text style={styles.eyeIcon}>{showPwd ? '🙈' : '👁'}</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          <View style={styles.sheetBtns}>
            <TouchableOpacity style={styles.cancelBtn} onPress={closeModal}>
              <Text style={styles.cancelBtnText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.connectBtn, connecting && { opacity: 0.5 }]}
              onPress={handleConnect}
              disabled={connecting}
            >
              {connecting
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.connectBtnText}>Se connecter</Text>
              }
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Modal>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
    paddingTop: Platform.OS === 'android' ? 28 : 0,
  },
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  appTitle: { fontSize: 24, fontWeight: '800', color: C.text, letterSpacing: 0.3 },
  appSub:   { fontSize: 12, color: C.textSub, marginTop: 3 },
  scanBtn: {
    backgroundColor: C.accent,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 30,
    elevation: 6,
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    minWidth: 110,
    alignItems: 'center',
  },
  scanBtnText: { color: '#fff', fontSize: 14, fontWeight: '700', letterSpacing: 0.3 },
  // Search
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 14,
    marginBottom: 8,
    backgroundColor: C.bg3,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 14,
    paddingVertical: 2,
  },
  searchIcon:  { fontSize: 16, marginRight: 10 },
  searchInput: { flex: 1, fontSize: 15, color: C.text, paddingVertical: 11 },
  clearIcon:   { color: C.textMute, fontSize: 14, paddingLeft: 8 },
  // Tabs
  tabs: {
    flexDirection: 'row',
    marginHorizontal: 14,
    marginBottom: 6,
    backgroundColor: C.bg3,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: C.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabActive:     { backgroundColor: C.accent },
  tabText:       { color: C.textSub, fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: '#fff' },
  // Connected banner
  connBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 14,
    marginBottom: 6,
    padding: 10,
    backgroundColor: '#00E67615',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#00E67630',
  },
  connBannerIcon: { fontSize: 16 },
  connBannerText: { color: C.textSub, fontSize: 13 },
  connBannerSSID: { color: '#00E676', fontWeight: '700' },
  // List
  list: { paddingHorizontal: 14, paddingBottom: 40 },
  // Section header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  sectionTitle: { color: C.textSub, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  sectionPill: {
    backgroundColor: C.surface,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: C.border,
  },
  sectionCount: { color: C.textMute, fontSize: 11, fontWeight: '600' },
  // Card
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.bg3,
    borderRadius: 16,
    marginBottom: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  cardConnected: {
    borderColor: '#00E67640',
    backgroundColor: '#00E67608',
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: C.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  cardInfo:  { flex: 1, gap: 5 },
  cardRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardSSID:  { flex: 1, fontSize: 15, fontWeight: '700', color: C.text },
  connectedBadge: {
    backgroundColor: '#00E67618',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#00E67640',
  },
  connectedText: { color: '#00E676', fontSize: 10, fontWeight: '700' },
  cardMeta:  { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 20,
    borderWidth: 1,
  },
  dot:       { width: 5, height: 5, borderRadius: 3 },
  secIcon:   { fontSize: 10 },
  pillText:  { fontSize: 10, fontWeight: '600' },
  cardDetail: { fontSize: 10, color: C.textMute },
  starBtn:   { paddingLeft: 8 },
  star:      { fontSize: 18 },
  // Empty
  empty:      { alignItems: 'center', paddingTop: 70, gap: 10 },
  emptyIcon:  { fontSize: 52 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: 'rgba(255,255,255,0.5)' },
  emptyHint:  { fontSize: 13, color: C.textMute, textAlign: 'center', lineHeight: 20 },
  // Modal / Sheet
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: C.bg2,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: Platform.OS === 'android' ? 30 : 44,
    borderTopWidth: 1,
    borderColor: C.border,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    backgroundColor: C.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 22,
  },
  sheetSSID:  { fontSize: 17, fontWeight: '800', color: C.text },
  sheetMeta:  { fontSize: 12, fontWeight: '500' },
  openNotice: {
    padding: 14,
    backgroundColor: '#FF6D0015',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FF6D0040',
    marginBottom: 20,
  },
  openNoticeText: { color: '#FF6D00', fontSize: 13, lineHeight: 20 },
  inputLabel: {
    color: C.textSub,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.bg3,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 22,
    paddingRight: 12,
  },
  input:   { flex: 1, padding: 14, fontSize: 16, color: C.text },
  eyeBtn:  { padding: 6 },
  eyeIcon: { fontSize: 17 },
  sheetBtns: { flexDirection: 'row', gap: 12 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
  },
  cancelBtnText: { color: C.textSub, fontWeight: '600', fontSize: 15 },
  connectBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: C.accent,
    elevation: 4,
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  connectBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});