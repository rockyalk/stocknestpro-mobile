import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
} from 'react-native';
import {
  RefreshCw,
  ShoppingBag,
  Tag,
  AlertTriangle,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react-native';
import { useAuth } from '../contexts/AuthContext';
import { trpc } from '../../App';

export function HomeScreen({ navigation }: any) {
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const dashboardQuery = (trpc as any).analytics.getMobileDashboard.useQuery(undefined, {
    enabled: !!user,
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await dashboardQuery.refetch();
    setRefreshing(false);
  };

  const data = dashboardQuery.data || {
    pendingOrders: 0,
    ordersReadyToPick: 0,
    ordersReadyToPack: 0,
    ordersWaitingForLabel: 0,
    activeListings: 0,
    draftListings: 0,
    lowStockAlerts: 0,
    salesToday: 0,
    salesLast30Days: 0,
    lastEbaySync: undefined,
    printAgentStatus: undefined,
  };

  const isLoading = dashboardQuery.isLoading;

  const getPrintAgentStatus = () => {
    const status = data.printAgentStatus || 'online';
    if (status === 'online') {
      return { text: 'Online', color: 'text-emerald-600', dot: 'bg-emerald-500' };
    } else if (status === 'offline') {
      return { text: 'Offline', color: 'text-rose-600', dot: 'bg-rose-500' };
    } else {
      return { text: 'Idle', color: 'text-slate-500', dot: 'bg-slate-400' };
    }
  };

  const printAgent = getPrintAgentStatus();

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
      <View className="px-5 pt-14 pb-8">
        {/* Header */}
        <View className="flex-row justify-between items-center mb-6">
          <View>
            <Text className="text-2xl font-extrabold text-slate-900 tracking-tight">
              StockNestPro
            </Text>
            <Text className="text-slate-500 text-sm font-medium mt-0.5">
              Welcome, {user?.name || 'Operator'}
            </Text>
          </View>
          <TouchableOpacity
            className="p-2.5 bg-white rounded-full border border-slate-200 active:bg-slate-50"
            onPress={onRefresh}
          >
            <RefreshCw color="#64748b" size={18} />
          </TouchableOpacity>
        </View>

        {isLoading && !refreshing ? (
          <View className="flex-1 justify-center items-center py-20">
            <ActivityIndicator size="large" color="#0284c7" />
            <Text className="text-slate-500 mt-4 font-semibold text-sm">
              Loading Dashboard...
            </Text>
          </View>
        ) : (
          <>
            {/* Daily Work Hub */}
            <Text className="text-xs font-bold text-slate-400 tracking-wider uppercase mb-3 px-1">
              Daily Work Hub
            </Text>
            <View className="flex-row flex-wrap justify-between mb-6">
              {/* Scan Card */}
              <TouchableOpacity
                className="w-[48%] bg-white p-5 rounded-3xl border border-slate-100 mb-4 shadow-sm active:bg-slate-50"
                onPress={() => navigation.navigate('Scan')}
              >
                <View className="bg-sky-100 p-3 rounded-2xl w-12 h-12 items-center justify-center mb-4">
                  <RefreshCw color="#0284c7" size={24} />
                </View>
                <Text className="text-slate-900 font-bold text-base">Scan</Text>
                <Text className="text-slate-400 text-xs mt-1">
                  Item, box, or location
                </Text>
              </TouchableOpacity>

              {/* Orders Card */}
              <TouchableOpacity
                className="w-[48%] bg-white p-5 rounded-3xl border border-slate-100 mb-4 shadow-sm active:bg-slate-50"
                onPress={() => navigation.navigate('Orders')}
              >
                <View className="bg-emerald-100 p-3 rounded-2xl w-12 h-12 items-center justify-center mb-4">
                  <ShoppingBag color="#10b981" size={24} />
                </View>
                <Text className="text-slate-900 font-bold text-base">Orders</Text>
                <Text className="text-slate-400 text-xs mt-1">
                  Pick, pack, and ship
                </Text>
              </TouchableOpacity>

              {/* Listings Card */}
              <TouchableOpacity
                className="w-[48%] bg-white p-5 rounded-3xl border border-slate-100 mb-4 shadow-sm active:bg-slate-50"
                onPress={() => navigation.navigate('Listings')}
              >
                <View className="bg-indigo-100 p-3 rounded-2xl w-12 h-12 items-center justify-center mb-4">
                  <Tag color="#6366f1" size={24} />
                </View>
                <Text className="text-slate-900 font-bold text-base">
                  Listings
                </Text>
                <Text className="text-slate-400 text-xs mt-1">
                  Active, drafts, mapping
                </Text>
              </TouchableOpacity>

              {/* Print Queue Card */}
              <TouchableOpacity
                className="w-[48%] bg-white p-5 rounded-3xl border border-slate-100 mb-4 shadow-sm active:bg-slate-50"
              onPress={() => navigation.navigate('Listings', { tab: 'active' })}
            >
              <View className="bg-amber-100 p-3 rounded-2xl w-12 h-12 items-center justify-center mb-4">
                <AlertTriangle color="#d97706" size={24} />
              </View>
              <Text className="text-slate-900 font-bold text-base">
                Print Queue
              </Text>
              <Text className="text-slate-400 text-xs mt-1">
                Thermal & label jobs
              </Text>
              </TouchableOpacity>
            </View>

            {/* Operational Indicators */}
            <Text className="text-xs font-bold text-slate-400 tracking-wider uppercase mb-3 px-1">
              Operational Indicators
            </Text>
            <View className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden mb-6">
              {/* Pending Orders */}
              <TouchableOpacity
                className="flex-row items-center justify-between p-4 border-b border-slate-100 active:bg-slate-50"
                onPress={() => navigation.navigate('Orders', { tab: 'pick' })}
              >
                <Text className="text-slate-700 font-semibold">
                  Pending Orders
                </Text>
                <View className="flex-row items-center">
                  <View className="bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100 mr-2">
                    <Text className="text-emerald-700 font-extrabold text-sm">
                      {data.ordersReadyToPick || 0}
                    </Text>
                  </View>
                  <ChevronRight color="#94a3b8" size={16} />
                </View>
              </TouchableOpacity>

              {/* Waiting Shipment */}
              <TouchableOpacity
                className="flex-row items-center justify-between p-4 border-b border-slate-100 active:bg-slate-50"
                onPress={() => navigation.navigate('Orders', { tab: 'pack' })}
              >
                <Text className="text-slate-700 font-semibold">
                  Waiting Shipment
                </Text>
                <View className="flex-row items-center">
                  <View className="bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100 mr-2">
                    <Text className="text-emerald-700 font-extrabold text-sm">
                      {data.ordersWaitingForLabel || 0}
                    </Text>
                  </View>
                  <ChevronRight color="#94a3b8" size={16} />
                </View>
              </TouchableOpacity>

              {/* Low Stock */}
              <View className="flex-row items-center justify-between p-4 border-b border-slate-100">
                <Text className="text-slate-700 font-semibold">Low Stock</Text>
                <View className="bg-amber-50 px-3 py-1 rounded-full border border-amber-100">
                  <Text className="text-amber-700 font-extrabold text-sm">
                    {data.lowStockAlerts || 0}
                  </Text>
                </View>
              </View>

              {/* eBay Sync Status */}
              <View className="flex-row items-center justify-between p-4 border-b border-slate-100">
                <Text className="text-slate-700 font-semibold">
                  eBay Sync Status
                </Text>
                <View className="flex-row items-center">
                  <View className={`w-2 h-2 rounded-full mr-2 ${
                    data.lastEbaySync === 'OK' || data.lastEbaySync === 'Synced'
                      ? 'bg-emerald-500'
                      : data.lastEbaySync === 'Error' || data.lastEbaySync === 'Failed'
                        ? 'bg-rose-500'
                        : 'bg-amber-400'
                  }`} />
                  <Text className={`font-bold text-sm ${
                    data.lastEbaySync === 'OK' || data.lastEbaySync === 'Synced'
                      ? 'text-emerald-600'
                      : data.lastEbaySync === 'Error' || data.lastEbaySync === 'Failed'
                        ? 'text-rose-600'
                        : 'text-amber-600'
                  }`}>
                    {data.lastEbaySync || 'Unknown'}
                  </Text>
                </View>
              </View>

              {/* Print Agent Status */}
              <View className="flex-row items-center justify-between p-4">
                <Text className="text-slate-700 font-semibold">
                  Print Agent Status
                </Text>
                <View className="flex-row items-center">
                  <View className={`w-2 h-2 rounded-full ${printAgent.dot} mr-2`} />
                  <Text className={`font-bold text-sm ${printAgent.color}`}>
                    {printAgent.text}
                  </Text>
                </View>
              </View>
            </View>
          </>
        )}
      </View>
    </ScrollView>
  );
}
