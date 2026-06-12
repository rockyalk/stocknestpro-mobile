import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
  Vibration,
  StyleSheet,
  Image,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import {
  QrCode,
  MapPin,
  CheckCircle2,
  Package,
  ScanLine,
  Hash,
  Layers,
  ArrowRight,
  XCircle,
  LogOut,
} from 'lucide-react-native';
import { trpc } from '../../App';
import { resolveScanInput } from '../utils/scanResolver';

// ─── Put-Away State Machine ───────────────────────────────────────────────────
//
//  idle           → scan snp://item/{id}  → item_scanned
//  item_scanned   → scan snp://location/{id}  → moving (auto-calls warehouse.moveItem)
//  moving         → success               → idle (ready for next item)
//
//  Any state → press "Finish Session"     → idle (clears everything)
//
// ─────────────────────────────────────────────────────────────────────────────

type PutAwayState = 'idle' | 'item_scanned' | 'moving';

interface ResolvedItem {
  id: number;
  title: string;
  sku: string;
  quantity?: number;
  condition?: string;
  imageUrl?: string | null;
  locationLabel?: string;
}

interface ResolvedLocation {
  id: number;
  name: string;
  fullPath?: string | null;
  fullLocationCode?: string | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ScanScreen() {
  // ── Put-Away State ─────────────────────────────────────────────────────────
  const [putAwayState, setPutAwayState] = useState<PutAwayState>('idle');
  const [activeItem, setActiveItem] = useState<ResolvedItem | null>(null);
  const [lastMoveResult, setLastMoveResult] = useState<{
    item: ResolvedItem;
    location: ResolvedLocation;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ── Camera ─────────────────────────────────────────────────────────────────
  const [permission, requestPermission] = useCameraPermissions();
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [manualCode, setManualCode] = useState('');

  // Debounce guard — prevents duplicate scans from a single camera frame burst
  const scanLockRef = useRef(false);

  // ── tRPC ───────────────────────────────────────────────────────────────────
  const utils = (trpc as any).useUtils();
  const moveMutation = (trpc as any).warehouse.moveItem.useMutation();

  // ── Session helpers ────────────────────────────────────────────────────────

  const finishSession = () => {
    setPutAwayState('idle');
    setActiveItem(null);
    setLastMoveResult(null);
    setErrorMessage(null);
    scanLockRef.current = false;
  };

  // ── Camera helpers ─────────────────────────────────────────────────────────

  const startCamera = async () => {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        Alert.alert(
          'Camera Permission Required',
          'Please enable camera access in your device settings to use the scanner.',
        );
        return;
      }
    }
    scanLockRef.current = false;
    setIsCameraActive(true);
  };

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    setIsCameraActive(false);
    handleCodeScanned(data);
  };

  const handleManualSubmit = () => {
    const code = manualCode.trim();
    if (!code) return;
    setManualCode('');
    handleCodeScanned(code);
  };

  // ── Core scan handler ──────────────────────────────────────────────────────

  const handleCodeScanned = async (code: string) => {
    if (!code || scanLockRef.current) return;
    scanLockRef.current = true;
    setIsLoading(true);
    setErrorMessage(null);

    try {
      try { Vibration.vibrate(80); } catch (_) {}

      // ── Step 1: Resolve internal QR values via the shared scan resolver ─────
      const scanCode = (input: { code: string }) => utils.warehouse.scanCode.fetch(input);
      const scanResult = await resolveScanInput(code, scanCode);
      const resolved = scanResult.kind === 'snp'
        ? scanResult.resolved
        : await scanCode({ code: scanResult.rawCode });

      if (resolved.type === 'item') {
        // ── Item scanned ─────────────────────────────────────────────────────
        const item = resolved.item;
        setActiveItem({
          id: item.id,
          title: item.title,
          sku: item.sku,
          quantity: item.quantity,
          condition: item.condition,
          imageUrl: item.imageUrl,
          locationLabel: item.locationLabel,
        });
        setPutAwayState('item_scanned');
        setLastMoveResult(null);

      } else if (resolved.type === 'bin') {
        // ── Bin scanned ──────────────────────────────────────────────────────
        if (putAwayState !== 'item_scanned' || !activeItem) {
          setErrorMessage('Scan an item first before scanning a bin/location.');
          return;
        }

        const node = resolved.node;
        const location: ResolvedLocation = {
          id: node.id,
          name: node.name,
          fullPath: node.fullPath,
          fullLocationCode: node.fullLocationCode,
        };

        // ── Step 2: Move immediately — no confirmation dialog ─────────────
        setPutAwayState('moving');
        await moveMutation.mutateAsync({ itemId: activeItem.id, locationNodeId: location.id });

        // ── Step 3: Success — show result, reset for next item ────────────
        setLastMoveResult({ item: activeItem, location });
        setActiveItem(null);
        setPutAwayState('idle');
        try { Vibration.vibrate([0, 60, 60, 60]); } catch (_) {}

      } else {
        setErrorMessage('Unrecognised QR code. Expected snp://item/{id} or snp://location/{id}.');
      }
    } catch (err: any) {
      const msg = err?.message || err?.data?.message || 'Failed to process scan.';
      setErrorMessage(msg);
      // If we were mid-move, return to item_scanned so operator can retry the bin
      if (putAwayState === 'moving' && activeItem) {
        setPutAwayState('item_scanned');
      }
    } finally {
      setIsLoading(false);
      setTimeout(() => { scanLockRef.current = false; }, 1200);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const binDisplayLabel = (loc: ResolvedLocation) =>
    loc.fullLocationCode ?? loc.fullPath ?? loc.name;

  return (
    <ScrollView
      className="flex-1 bg-slate-900"
      contentContainerStyle={{ flexGrow: 1 }}
      keyboardShouldPersistTaps="handled"
    >
      <View className="px-5 pt-14 pb-8 flex-1">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <View className="flex-row justify-between items-start mb-6">
          <View className="flex-1 mr-3">
            <Text className="text-2xl font-black text-white tracking-tight">
              Put-Away Scanner
            </Text>
            <Text className="text-slate-400 text-xs mt-0.5">
              {putAwayState === 'idle' && !lastMoveResult
                ? 'Scan an item QR to begin'
                : putAwayState === 'item_scanned'
                ? 'Now scan the destination bin/location'
                : putAwayState === 'moving'
                ? 'Moving item…'
                : 'Ready for next item'}
            </Text>
          </View>
          {/* Finish Session button — always visible when there's anything active */}
          {(putAwayState !== 'idle' || lastMoveResult) && (
            <TouchableOpacity
              className="flex-row items-center px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl"
              onPress={finishSession}
              activeOpacity={0.7}
            >
              <LogOut color="#94a3b8" size={14} />
              <Text className="text-slate-300 font-bold text-xs ml-1.5">Finish Session</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── State indicator pills ───────────────────────────────────────── */}
        <View className="flex-row items-center mb-5 gap-2">
          {/* Step 1 */}
          <View className={`flex-row items-center px-3 py-1.5 rounded-full border ${
            putAwayState === 'idle'
              ? 'bg-sky-500/10 border-sky-500/30'
              : 'bg-sky-500/20 border-sky-500/50'
          }`}>
            <QrCode color={putAwayState === 'idle' ? '#38bdf8' : '#0ea5e9'} size={12} />
            <Text className={`font-bold text-xs ml-1.5 ${
              putAwayState === 'idle' ? 'text-sky-400' : 'text-sky-300'
            }`}>
              {putAwayState === 'idle' ? 'Scan Item' : activeItem?.sku ?? 'Item ✓'}
            </Text>
          </View>

          <ArrowRight color="#475569" size={14} />

          {/* Step 2 */}
          <View className={`flex-row items-center px-3 py-1.5 rounded-full border ${
            putAwayState === 'item_scanned'
              ? 'bg-amber-500/10 border-amber-500/30'
              : putAwayState === 'moving'
              ? 'bg-emerald-500/20 border-emerald-500/50'
              : 'bg-slate-800 border-slate-700'
          }`}>
            <MapPin color={
              putAwayState === 'item_scanned' ? '#fbbf24'
              : putAwayState === 'moving' ? '#34d399'
              : '#475569'
            } size={12} />
            <Text className={`font-bold text-xs ml-1.5 ${
              putAwayState === 'item_scanned' ? 'text-amber-400'
              : putAwayState === 'moving' ? 'text-emerald-400'
              : 'text-slate-500'
            }`}>
              {putAwayState === 'moving' ? 'Moving…' : 'Scan Bin'}
            </Text>
          </View>
        </View>

        {/* ── Camera / Scan View ──────────────────────────────────────────── */}
        <View className="aspect-square rounded-3xl overflow-hidden border border-slate-800 mb-5">
          {isCameraActive ? (
            <View style={StyleSheet.absoluteFillObject}>
              <CameraView
                onBarcodeScanned={handleBarcodeScanned}
                facing="back"
                style={StyleSheet.absoluteFillObject}
              />
              {/* Targeting overlay */}
              <View
                style={StyleSheet.absoluteFillObject}
                className="items-center justify-center"
              >
                <View className="w-56 h-56 relative items-center justify-center">
                  <View className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-sky-400 rounded-tl-lg" />
                  <View className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-sky-400 rounded-tr-lg" />
                  <View className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-sky-400 rounded-bl-lg" />
                  <View className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-sky-400 rounded-br-lg" />
                  <View className="absolute left-0 right-0 h-0.5 bg-sky-500 opacity-80" />
                </View>
                <Text className="text-sky-300 font-semibold text-xs uppercase tracking-wider mt-4 bg-black/50 px-3 py-1 rounded-full">
                  {putAwayState === 'idle' ? 'Scan item QR' : 'Scan bin/location QR'}
                </Text>
              </View>
              <TouchableOpacity
                className="absolute top-4 right-4 bg-black/60 px-4 py-2 rounded-full border border-slate-700"
                onPress={() => setIsCameraActive(false)}
              >
                <Text className="text-white font-bold text-xs">Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : isLoading ? (
            <View className="flex-1 bg-slate-950 items-center justify-center">
              <ActivityIndicator size="large" color="#0284c7" />
              <Text className="text-slate-400 text-xs font-semibold mt-3">
                {putAwayState === 'moving' ? 'Moving item…' : 'Resolving scan…'}
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              className="flex-1 bg-slate-950 items-center justify-center"
              onPress={startCamera}
              activeOpacity={0.75}
            >
              <View className="items-center">
                <View className={`w-20 h-20 rounded-3xl border items-center justify-center mb-4 ${
                  putAwayState === 'item_scanned'
                    ? 'bg-amber-500/10 border-amber-500/30'
                    : 'bg-sky-500/10 border-sky-500/30'
                }`}>
                  <ScanLine
                    color={putAwayState === 'item_scanned' ? '#f59e0b' : '#0284c7'}
                    size={40}
                    strokeWidth={1.5}
                  />
                </View>
                <Text className="text-white font-black text-base mb-1">
                  {putAwayState === 'item_scanned' ? 'Tap to Scan Bin' : 'Tap to Scan Item'}
                </Text>
                <Text className="text-slate-400 text-xs text-center px-8 leading-relaxed">
                  {putAwayState === 'item_scanned'
                    ? 'Scan the destination bin or location QR'
                    : 'Scan the item QR label to begin put-away'}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Active Item Card (shown while waiting for bin scan) ─────────── */}
        {putAwayState === 'item_scanned' && activeItem && (
          <View className="bg-slate-950 border border-sky-500/30 rounded-2xl p-4 mb-4">
            <View className="flex-row justify-between items-center mb-3">
              <Text className="text-sky-400 font-bold text-xs uppercase tracking-wider">
                Item Ready to Move
              </Text>
              <TouchableOpacity
                onPress={() => { setActiveItem(null); setPutAwayState('idle'); setErrorMessage(null); }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <XCircle color="#64748b" size={18} />
              </TouchableOpacity>
            </View>
            <View className="flex-row items-start gap-3">
              {activeItem.imageUrl ? (
                <Image
                  source={{ uri: activeItem.imageUrl }}
                  className="w-16 h-16 rounded-xl bg-slate-800"
                  resizeMode="contain"
                />
              ) : (
                <View className="w-16 h-16 rounded-xl bg-slate-800 items-center justify-center">
                  <Package color="#475569" size={24} />
                </View>
              )}
              <View className="flex-1 min-w-0">
                <Text className="text-white font-bold text-sm leading-snug mb-1" numberOfLines={2}>
                  {activeItem.title}
                </Text>
                <View className="flex-row items-center mb-1">
                  <Hash color="#64748b" size={11} />
                  <Text className="text-slate-400 font-mono text-xs ml-1">{activeItem.sku}</Text>
                </View>
                {activeItem.quantity !== undefined && (
                  <View className="flex-row items-center mb-1">
                    <Layers color="#64748b" size={11} />
                    <Text className="text-slate-400 text-xs ml-1">Qty: {activeItem.quantity}</Text>
                  </View>
                )}
                {activeItem.locationLabel && (
                  <View className="flex-row items-center">
                    <MapPin color="#64748b" size={11} />
                    <Text className="text-slate-500 text-xs ml-1 flex-1" numberOfLines={1}>
                      From: {activeItem.locationLabel}
                    </Text>
                  </View>
                )}
              </View>
            </View>
            {/* Prompt */}
            <View className="mt-3 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2.5 flex-row items-center">
              <MapPin color="#f59e0b" size={14} />
              <Text className="text-amber-300 font-semibold text-xs ml-2">
                Now scan the destination bin/location QR
              </Text>
            </View>
          </View>
        )}

        {/* ── Success Card (last move result) ────────────────────────────── */}
        {putAwayState === 'idle' && lastMoveResult && (
          <View className="bg-slate-950 border border-emerald-500/30 rounded-2xl p-4 mb-4">
            <View className="flex-row items-center mb-3">
              <CheckCircle2 color="#10b981" size={16} />
              <Text className="text-emerald-400 font-bold text-xs uppercase tracking-wider ml-2">
                Item Moved Successfully
              </Text>
            </View>
            <View className="flex-row items-center gap-2 flex-wrap">
              {/* Item */}
              <View className="bg-sky-500/10 border border-sky-500/20 rounded-xl px-3 py-2 flex-1">
                <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-0.5">Item</Text>
                <Text className="text-white font-bold text-xs" numberOfLines={1}>
                  {lastMoveResult.item.title}
                </Text>
                <Text className="text-slate-400 font-mono text-[10px]">{lastMoveResult.item.sku}</Text>
              </View>
              <ArrowRight color="#475569" size={16} />
              {/* Location */}
              <View className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2 flex-1">
                <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-0.5">Location</Text>
                <Text className="text-white font-bold text-xs font-mono" numberOfLines={1}>
                  {binDisplayLabel(lastMoveResult.location)}
                </Text>
              </View>
            </View>
            <Text className="text-slate-500 text-xs mt-3 text-center">
              Scan next item to continue, or tap Finish Session when done.
            </Text>
          </View>
        )}

        {/* ── Error Message ───────────────────────────────────────────────── */}
        {errorMessage && (
          <View className="bg-rose-500/10 border border-rose-500/30 rounded-2xl px-4 py-3 mb-4 flex-row items-start">
            <XCircle color="#f43f5e" size={16} className="mt-0.5" />
            <Text className="text-rose-300 text-xs ml-2 flex-1 leading-relaxed">{errorMessage}</Text>
          </View>
        )}

        {/* ── Manual Code Input ───────────────────────────────────────────── */}
        <View className="flex-row items-center bg-slate-950 border border-slate-800 rounded-2xl px-3 h-14 mb-5">
          <TextInput
            className="flex-1 text-white font-medium ml-2"
            placeholder="Type QR code manually (snp://item/17)…"
            placeholderTextColor="#475569"
            autoCapitalize="none"
            value={manualCode}
            onChangeText={setManualCode}
            onSubmitEditing={handleManualSubmit}
          />
          <TouchableOpacity
            className="bg-sky-500 h-10 px-4 rounded-xl items-center justify-center"
            onPress={handleManualSubmit}
          >
            <Text className="text-white font-bold text-xs">Submit</Text>
          </TouchableOpacity>
        </View>

        {/* ── Finish Session Button (bottom, always accessible) ──────────── */}
        {(putAwayState !== 'idle' || lastMoveResult) && (
          <TouchableOpacity
            className="flex-row items-center justify-center bg-slate-800 border border-slate-700 rounded-2xl py-4 mt-2"
            onPress={finishSession}
            activeOpacity={0.7}
          >
            <LogOut color="#94a3b8" size={16} />
            <Text className="text-slate-300 font-bold text-sm ml-2">Finish Session</Text>
          </TouchableOpacity>
        )}

        {/* ── Dev Simulation Panel ────────────────────────────────────────── */}
        {__DEV__ && (
          <View className="bg-slate-950 border border-dashed border-slate-800 rounded-3xl p-5 mt-6">
            <Text className="text-slate-400 font-bold text-xs uppercase tracking-wider text-center mb-4">
              Scan Simulation (Dev Only)
            </Text>
            <View className="flex-row justify-between flex-wrap gap-2">
              <TouchableOpacity
                className="flex-1 min-w-[45%] bg-sky-500/10 border border-sky-500/20 py-3 rounded-xl items-center"
                onPress={() => handleCodeScanned('snp://item/17')}
              >
                <Text className="text-sky-400 font-bold text-xs">snp://item/17</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 min-w-[45%] bg-sky-500/10 border border-sky-500/20 py-3 rounded-xl items-center"
                onPress={() => handleCodeScanned('snp://item/1')}
              >
                <Text className="text-sky-400 font-bold text-xs">snp://item/1</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 min-w-[45%] bg-amber-500/10 border border-amber-500/20 py-3 rounded-xl items-center"
                onPress={() => handleCodeScanned('snp://location/997')}
              >
                <Text className="text-amber-400 font-bold text-xs">snp://location/997</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 min-w-[45%] bg-amber-500/10 border border-amber-500/20 py-3 rounded-xl items-center"
                onPress={() => handleCodeScanned('snp://location/42')}
              >
                <Text className="text-amber-400 font-bold text-xs">snp://location/42</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

      </View>
    </ScrollView>
  );
}
