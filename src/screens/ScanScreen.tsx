import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
  Vibration,
} from 'react-native';
import {
  QrCode,
  Camera,
  Info,
  MapPin,
  CheckCircle2,
  ChevronRight,
  Barcode,
  Package,
  ArrowRight,
  RefreshCw,
} from 'lucide-react-native';
import { trpc } from '../../App';

export function ScanScreen() {
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const [scannedType, setScannedType] = useState<'item' | 'box' | 'location' | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [lastAction, setLastAction] = useState<string | null>(null);

  // Active session state for moving/mapping
  const [activeItem, setActiveItem] = useState<string | null>(null);
  const [activeBox, setActiveBox] = useState<string | null>(null);

  const scanMutation = (trpc as any).warehouse.scanLocationNode.useMutation();
  const moveMutation = (trpc as any).warehouse.moveItem.useMutation();

  const detectType = (code: string): 'item' | 'box' | 'location' => {
    const upper = code.toUpperCase();
    if (
      upper.startsWith('LOC-') ||
      upper.startsWith('BIN-') ||
      upper.startsWith('ROW-') ||
      upper.startsWith('SHELF-') ||
      upper.startsWith('AISLE-') ||
      upper.startsWith('WH-') ||
      upper.startsWith('SEC-') ||
      upper.startsWith('ZONE-')
    ) {
      return 'location';
    }
    if (upper.startsWith('BOX') || upper.startsWith('BX') || upper.startsWith('CARTON')) {
      return 'box';
    }
    return 'item';
  };

  const handleCodeScanned = async (code: string) => {
    if (!code) return;
    setIsLoading(true);
    setScannedCode(code);
    const type = detectType(code);
    setScannedType(type);

    try {
      // Trigger haptic feedback
      try {
        Vibration.vibrate(100);
      } catch (e) {}

      const response = await scanMutation.mutateAsync({
        code,
        format: 'QR_CODE',
      });

      if (type === 'item') {
        setActiveItem(code);
        setLastAction(`Scanned item: ${code}`);
      } else if (type === 'box') {
        setActiveBox(code);
        setLastAction(`Scanned box: ${code}`);
        if (activeItem) {
          // If we have an active item, map it to the box
          await moveMutation.mutateAsync({
            itemCode: activeItem,
            destinationCode: code,
          });
          setLastAction(`Moved item ${activeItem} into box ${code}`);
        }
      } else if (type === 'location') {
        setLastAction(`Scanned location: ${code}`);
        if (activeBox) {
          // If we have an active box, map it to the location
          await moveMutation.mutateAsync({
            itemCode: activeBox,
            destinationCode: code,
          });
          setLastAction(`Placed box ${activeBox} on location ${code}`);
          setActiveBox(null);
          setActiveItem(null);
        } else if (activeItem) {
          // If we only have an item, map it directly to the location
          await moveMutation.mutateAsync({
            itemCode: activeItem,
            destinationCode: code,
          });
          setLastAction(`Mapped item ${activeItem} directly to location ${code}`);
          setActiveItem(null);
        }
      }
    } catch (err: any) {
      console.error('Scan processing error:', err);
      setLastAction(`Error: ${err?.message || 'Failed to process scan'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualSubmit = () => {
    if (!manualCode.trim()) return;
    handleCodeScanned(manualCode.trim());
    setManualCode('');
  };

  const resetSession = () => {
    setActiveItem(null);
    setActiveBox(null);
    setScannedCode(null);
    setScannedType(null);
    setLastAction(null);
  };

  return (
    <ScrollView className="flex-1 bg-slate-900" contentContainerStyle={{ flexGrow: 1 }}>
      <View className="px-5 pt-14 pb-8 flex-1 justify-between">
        {/* Header */}
        <View className="flex-row justify-between items-center mb-6">
          <View>
            <Text className="text-2xl font-black text-white tracking-tight">
              Warehouse Scanner
            </Text>
            <Text className="text-slate-400 text-xs mt-0.5">
              Scan items, boxes, or location tags
            </Text>
          </View>
          {(activeItem || activeBox) && (
            <TouchableOpacity
              className="px-3 py-1.5 bg-rose-500/20 border border-rose-500/30 rounded-full"
              onPress={resetSession}
            >
              <Text className="text-rose-400 font-bold text-xs">Reset</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Camera / Scan View Simulation */}
        <View className="bg-slate-950 aspect-square rounded-3xl overflow-hidden border border-slate-800 justify-center items-center mb-6 relative">
          <View className="absolute inset-0 opacity-20 bg-[radial-gradient(#0284c7_1px,transparent_1px)] [background-size:16px_16px]" />
          
          {/* Laser guide line animation */}
          <View className="absolute left-10 right-10 h-0.5 bg-sky-500 shadow shadow-sky-500 top-1/2" />

          <QrCode color="#0284c7" size={80} strokeWidth={1.5} />
          <Text className="text-sky-400 font-semibold text-xs uppercase tracking-wider mt-4">
            Camera Scanner Active
          </Text>
          <Text className="text-slate-500 text-[11px] mt-1 px-8 text-center leading-relaxed">
            Position QR code or barcode inside the frame to scan automatically
          </Text>
        </View>

        {/* Session Status Bar */}
        {(activeItem || activeBox) && (
          <View className="bg-slate-800/80 border border-slate-700 rounded-2xl p-4 mb-6">
            <Text className="text-slate-400 font-bold text-xs uppercase tracking-wider mb-3">
              Active Routing Session
            </Text>
            <View className="flex-row items-center flex-wrap">
              {activeItem && (
                <View className="flex-row items-center bg-sky-500/10 border border-sky-500/20 rounded-xl px-3 py-2 mr-2 mb-2">
                  <Barcode color="#0284c7" size={14} />
                  <Text className="text-sky-400 font-bold text-xs ml-2">{activeItem}</Text>
                </View>
              )}
              {activeItem && (activeBox || scannedType === 'location') && (
                <ArrowRight color="#64748b" size={14} className="mr-2 mb-2" />
              )}
              {activeBox && (
                <View className="flex-row items-center bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2 mr-2 mb-2">
                  <Package color="#10b981" size={14} />
                  <Text className="text-emerald-400 font-bold text-xs ml-2">{activeBox}</Text>
                </View>
              )}
            </View>
            <Text className="text-slate-400 text-xs mt-1 leading-relaxed">
              {activeItem && !activeBox && "👉 Scan a Box or Location to map this item."}
              {activeBox && "👉 Scan a Location tag to store this box."}
            </Text>
          </View>
        )}

        {/* Manual Code Input */}
        <View className="flex-row items-center bg-slate-950 border border-slate-800 rounded-2xl px-3 h-14 mb-6">
          <TextInput
            className="flex-1 text-white font-medium ml-2"
            placeholder="Type barcode/tag manually..."
            placeholderTextColor="#475569"
            autoCapitalize="characters"
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

        {/* Scan Results / Actions */}
        {scannedCode && (
          <View className="bg-slate-950 border border-slate-800 rounded-2xl p-4 mb-6">
            <View className="flex-row justify-between items-center mb-2">
              <Text className="text-slate-400 font-bold text-xs uppercase tracking-wider">
                Last Scan Result
              </Text>
              <Text className={`font-bold text-xs uppercase px-2 py-0.5 rounded-full ${
                scannedType === 'location' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                scannedType === 'box' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                'bg-sky-500/10 text-sky-400 border border-sky-500/20'
              }`}>
                {scannedType}
              </Text>
            </View>
            <Text className="text-white font-mono font-bold text-base mb-2">{scannedCode}</Text>
            {lastAction && (
              <View className="flex-row items-start bg-slate-900/80 rounded-xl p-3 border border-slate-800">
                <Info color="#0284c7" size={16} className="mt-0.5" />
                <Text className="text-slate-300 text-xs ml-2 flex-1 leading-relaxed">{lastAction}</Text>
              </View>
            )}
          </View>
        )}

        {/* Scan Simulation Fallback (Testing Panel) */}
        <View className="bg-slate-950 border border-dashed border-slate-800 rounded-3xl p-5 mt-auto">
          <Text className="text-slate-400 font-bold text-xs uppercase tracking-wider text-center mb-4">
            Scan Simulation Fallback (Testing Panel)
          </Text>
          <View className="flex-row justify-between flex-wrap">
            <TouchableOpacity
              className="w-[31%] bg-sky-500/10 border border-sky-500/20 py-3 rounded-xl items-center mb-2"
              onPress={() => handleCodeScanned('SKU-IPHONE15-PRO-256')}
            >
              <Text className="text-sky-400 font-bold text-xs">Scan Item</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="w-[31%] bg-emerald-500/10 border border-emerald-500/20 py-3 rounded-xl items-center mb-2"
              onPress={() => handleCodeScanned('BOX-A382')}
            >
              <Text className="text-emerald-400 font-bold text-xs">Scan Box</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="w-[31%] bg-amber-500/10 border border-amber-500/20 py-3 rounded-xl items-center mb-2"
              onPress={() => handleCodeScanned('LOC-WH1-R04-S2')}
            >
              <Text className="text-amber-400 font-bold text-xs">Scan Location</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
