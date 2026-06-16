import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import {
  RefreshCw,
  Package,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  Barcode,
  Truck,
  MapPin,
  ClipboardList,
} from 'lucide-react-native';
import { useAuth } from '../contexts/AuthContext';
import { trpc } from '../../App';

export function OrdersScreen() {
  const route = useRoute();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'pick' | 'pack' | 'shipped'>('pick');
  const [refreshing, setRefreshing] = useState(false);

  const utils = (trpc as any).useUtils();

  // Set active tab from route params if navigated from dashboard
  useEffect(() => {
    if (route.params && (route.params as any).tab) {
      setActiveTab((route.params as any).tab);
    }
  }, [route.params]);

  // Queries
  const pickQueueQuery = (trpc as any).orders.getPickQueue.useQuery(undefined, {
    enabled: !!user,
  });

  const ordersQuery = (trpc as any).orders.list.useQuery(undefined, {
    enabled: !!user,
  });

  // Sync Mutation
  const syncMutation = (trpc as any).orders.syncFromEbay.useMutation({
    onSuccess: () => {
      utils.orders.getPickQueue.invalidate();
      utils.orders.list.invalidate();
      Alert.alert('Success', 'Successfully pulled newest orders from eBay!');
    },
    onError: (err: any) => {
      Alert.alert('Error', err?.message || 'Unable to sync orders.');
    },
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      pickQueueQuery.refetch(),
      ordersQuery.refetch(),
    ]);
    setRefreshing(false);
  };

  const handleSync = async () => {
    try {
      await syncMutation.mutateAsync();
    } catch (e) {}
  };

  const isLoading = pickQueueQuery.isLoading || ordersQuery.isLoading;

  const pickQueue = pickQueueQuery.data || [];
  const allOrders = ordersQuery.data || [];

  const packOrders = allOrders.filter((o: any) => o.status === 'PAID' || o.status === 'READY_TO_PACK');
  const shippedOrders = allOrders.filter((o: any) => o.status === 'SHIPPED');

  return (
    <ScrollView
      className="flex-1 bg-slate-50"
      contentContainerStyle={{ flexGrow: 1 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={['#0284c7']}
        />
      }
    >
      <View className="px-5 pt-14 pb-8 flex-1">
        {/* Header */}
        <View className="flex-row justify-between items-center mb-6">
          <View>
            <Text className="text-2xl font-black text-slate-900 tracking-tight">
              Order Fulfillment
            </Text>
            <Text className="text-slate-500 text-sm font-medium mt-0.5">
              Pick, pack, and verify orders
            </Text>
          </View>
          <TouchableOpacity
            className="flex-row items-center bg-sky-500 px-4 py-2.5 rounded-full shadow-sm active:bg-sky-600"
            onPress={handleSync}
            disabled={syncMutation.isLoading}
          >
            {syncMutation.isLoading ? (
              <ActivityIndicator size="small" color="#ffffff" className="mr-2" />
            ) : (
              <RefreshCw color="#ffffff" size={14} className="mr-2" />
            )}
            <Text className="text-white font-bold text-xs">eBay Sync</Text>
          </TouchableOpacity>
        </View>

        {/* Tab Switcher */}
        <View className="flex-row bg-slate-200/60 p-1 rounded-2xl mb-6 border border-slate-200">
          <TouchableOpacity
            className={`flex-1 py-3 rounded-xl items-center ${
              activeTab === 'pick' ? 'bg-white shadow-sm' : ''
            }`}
            onPress={() => setActiveTab('pick')}
          >
            <Text
              className={`font-bold text-xs ${
                activeTab === 'pick' ? 'text-slate-900' : 'text-slate-500'
              }`}
            >
              Pick Queue ({pickQueue.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            className={`flex-1 py-3 rounded-xl items-center ${
              activeTab === 'pack' ? 'bg-white shadow-sm' : ''
            }`}
            onPress={() => setActiveTab('pack')}
          >
            <Text
              className={`font-bold text-xs ${
                activeTab === 'pack' ? 'text-slate-900' : 'text-slate-500'
              }`}
            >
              Ready to Pack ({packOrders.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            className={`flex-1 py-3 rounded-xl items-center ${
              activeTab === 'shipped' ? 'bg-white shadow-sm' : ''
            }`}
            onPress={() => setActiveTab('shipped')}
          >
            <Text
              className={`font-bold text-xs ${
                activeTab === 'shipped' ? 'text-slate-900' : 'text-slate-500'
              }`}
            >
              Shipped ({shippedOrders.length})
            </Text>
          </TouchableOpacity>
        </View>

        {isLoading && !refreshing ? (
          <View className="flex-1 justify-center items-center py-20">
            <ActivityIndicator size="large" color="#0284c7" />
            <Text className="text-slate-500 mt-4 font-semibold text-sm">
              Loading Orders...
            </Text>
          </View>
        ) : (
          <View className="flex-1">
            {activeTab === 'pick' && (
              <View>
                <Text className="text-xs font-bold text-slate-400 tracking-wider uppercase mb-3 px-1">
                  Active Floor Pick List
                </Text>
                {pickQueue.length === 0 ? (
                  <View className="bg-white rounded-3xl p-8 border border-slate-100 items-center justify-center shadow-sm">
                    <CheckCircle2 color="#10b981" size={48} />
                    <Text className="text-slate-900 font-black text-lg mt-4">
                      No Orders Ready to Pick
                    </Text>
                    <Text className="text-slate-400 text-xs text-center mt-2 leading-relaxed">
                      All active orders have been picked and packed. Tap "eBay Sync" to fetch new paid orders.
                    </Text>
                  </View>
                ) : (
                  pickQueue.map((item: any) => (
                    <View
                      key={item.id ?? item.orderId ?? item.sku ?? Math.random()}
                      className="bg-white p-5 rounded-3xl border border-slate-100 mb-4 shadow-sm"
                    >
                      <View className="flex-row justify-between items-start mb-3">
                        <View className="flex-row items-center">
                          <MapPin color="#0284c7" size={16} />
                          <Text className="text-sky-600 font-extrabold text-sm ml-1">
                            {item.binLocation || 'UNMAPPED'}
                          </Text>
                        </View>
                        <View className="bg-amber-50 border border-amber-100 px-2.5 py-1 rounded-full">
                          <Text className="text-amber-700 font-extrabold text-xs">
                            QTY: {item.quantityToPick || 1}
                          </Text>
                        </View>
                      </View>
                      <Text className="text-slate-900 font-extrabold text-base mb-1">
                        {item.title || 'Product Title'}
                      </Text>
                      <View className="flex-row items-center mt-2">
                        <Barcode color="#64748b" size={14} />
                        <Text className="text-slate-500 font-mono text-xs ml-1.5">
                          SKU: {item.sku || 'N/A'}
                        </Text>
                      </View>
                    </View>
                  ))
                )}
              </View>
            )}

            {activeTab === 'pack' && (
              <View>
                <Text className="text-xs font-bold text-slate-400 tracking-wider uppercase mb-3 px-1">
                  Ready for Pack Verification
                </Text>
                {packOrders.length === 0 ? (
                  <View className="bg-white rounded-3xl p-8 border border-slate-100 items-center justify-center shadow-sm">
                    <ClipboardList color="#64748b" size={48} />
                    <Text className="text-slate-900 font-black text-lg mt-4">
                      No Orders Ready to Pack
                    </Text>
                    <Text className="text-slate-400 text-xs text-center mt-2 leading-relaxed">
                      Complete picking all units in the Pick Queue to move orders here for packing verification.
                    </Text>
                  </View>
                ) : (
                  packOrders.map((order: any) => (
                    <View
                      key={order.id ?? order.orderId ?? Math.random()}
                      className="bg-white p-5 rounded-3xl border border-slate-100 mb-4 shadow-sm"
                    >
                      <View className="flex-row justify-between items-center mb-3">
                        <Text className="text-slate-900 font-black text-sm">
                          Order #{order.orderId || 'N/A'}
                        </Text>
                        <View className="bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-full">
                          <Text className="text-emerald-700 font-extrabold text-xs">
                            {order.status || 'PAID'}
                          </Text>
                        </View>
                      </View>
                      <Text className="text-slate-700 font-semibold text-sm mb-2">
                        Buyer: {order.buyerUsername || 'eBay Buyer'}
                      </Text>
                      <View className="border-t border-slate-100 pt-3 mt-2">
                        {order.items?.map((item: any, itemIdx: number) => (
                          <View key={itemIdx} className="flex-row justify-between items-center mb-1">
                            <Text className="text-slate-600 text-xs flex-1 mr-4" numberOfLines={1}>
                              {item.title || 'Product Title'}
                            </Text>
                            <Text className="text-slate-900 font-bold text-xs">
                              x{item.quantity || 1}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  ))
                )}
              </View>
            )}

            {activeTab === 'shipped' && (
              <View>
                <Text className="text-xs font-bold text-slate-400 tracking-wider uppercase mb-3 px-1">
                  Shipped Orders
                </Text>
                {shippedOrders.length === 0 ? (
                  <View className="bg-white rounded-3xl p-8 border border-slate-100 items-center justify-center shadow-sm">
                    <Truck color="#64748b" size={48} />
                    <Text className="text-slate-900 font-black text-lg mt-4">
                      No Shipped Orders
                    </Text>
                    <Text className="text-slate-400 text-xs text-center mt-2 leading-relaxed">
                      Complete packing verification and purchase shipping labels to move orders here.
                    </Text>
                  </View>
                ) : (
                  shippedOrders.map((order: any) => (
                    <View
                      key={order.id ?? order.orderId ?? Math.random()}
                      className="bg-white p-5 rounded-3xl border border-slate-100 mb-4 shadow-sm"
                    >
                      <View className="flex-row justify-between items-center mb-3">
                        <Text className="text-slate-900 font-black text-sm">
                          Order #{order.orderId || 'N/A'}
                        </Text>
                        <View className="bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-full">
                          <Text className="text-slate-600 font-extrabold text-xs">
                            SHIPPED
                          </Text>
                        </View>
                      </View>
                      <Text className="text-slate-700 font-semibold text-sm mb-2">
                        Buyer: {order.buyerUsername || 'eBay Buyer'}
                      </Text>
                      <Text className="text-slate-400 text-xs">
                        Tracking: {order.trackingNumber || 'N/A'}
                      </Text>
                    </View>
                  ))
                )}
              </View>
            )}
          </View>
        )}
      </View>
    </ScrollView>
  );
}
