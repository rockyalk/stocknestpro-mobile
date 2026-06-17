import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  User,
  Settings,
  RefreshCw,
  LogOut,
  CheckCircle2,
  AlertTriangle,
  Info,
} from 'lucide-react-native';
import { useAuth } from '../contexts/AuthContext';
import { trpc } from '../../App';

export function MoreScreen() {
  const { user, logout } = useAuth();

  // Query to fetch current statuses
  const dashboardQuery = (trpc as any).analytics.getMobileDashboard.useQuery(undefined, {
    enabled: !!user,
  });

  // Mobile must sync through the StockNestPro backend, not directly with eBay.
  // Reuse the same backend contract as the web app: list the tenant's eBay connections,
  // choose the active connection, then call ebay.triggerSync({ connectionId }).
  const connectionsQuery = (trpc as any).ebay.listConnections.useQuery(undefined, {
    enabled: !!user,
  });

  const utils = (trpc as any).useUtils();

  // Mutation to trigger eBay sync through the existing backend procedure.
  const syncMutation = (trpc as any).ebay.triggerSync.useMutation({
    onSuccess: (res: any) => {
      utils.analytics.getMobileDashboard.invalidate();
      utils.ebay.listConnections.invalidate();
      utils.ebay.listListings.invalidate();
      Alert.alert('Sync Complete', res?.message || 'Successfully synced listings from eBay!');
    },
    onError: (err: any) => {
      Alert.alert('Error', err?.message || 'Unable to sync with eBay.');
    },
  });

  const handleManualSync = async () => {
    const connections = Array.isArray(connectionsQuery.data) ? connectionsQuery.data : [];
    const activeConnection = connections.find((connection: any) => connection?.isActive) || connections[0];

    if (!activeConnection?.id) {
      Alert.alert('eBay Not Connected', 'Please connect an eBay account from the web app before syncing from mobile.');
      return;
    }

    try {
      await syncMutation.mutateAsync({ connectionId: activeConnection.id });
    } catch (e) {}
  };

  const data = dashboardQuery.data || {
    lastEbaySync: undefined,
    printAgentStatus: undefined,
    shippoStatus: undefined,
  };

  const isSyncing = syncMutation.isLoading || connectionsQuery.isLoading;

  const getPrintAgentStatus = () => {
    const status = data.printAgentStatus || 'online';
    if (status === 'online') {
      return { text: 'Online', color: 'text-emerald-600', dot: 'bg-emerald-500' };
    } else if (status === 'offline') {
      return { text: 'Offline', color: 'text-rose-600', dot: 'bg-rose-500' };
    } else {
      return { text: 'Unconfigured', color: 'text-slate-500', dot: 'bg-slate-400' };
    }
  };

  const printAgent = getPrintAgentStatus();

  return (
    <ScrollView className="flex-1 bg-slate-50" contentContainerStyle={{ flexGrow: 1 }}>
      <View className="px-6 py-8">
        {/* User Card */}
        <View className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm items-center mb-6">
          <View className="bg-sky-100 p-4 rounded-full mb-4">
            <User color="#0284c7" size={40} />
          </View>
          <Text className="text-xl font-bold text-slate-900">
            {user?.name || 'Operator'}
          </Text>
          <Text className="text-slate-500 font-medium mt-1">
            {user?.email || 'operator@stocknestpro.com'}
          </Text>
          <View className="bg-sky-50 px-3 py-1 rounded-full mt-3 border border-sky-100">
            <Text className="text-sky-700 text-xs font-bold uppercase tracking-wider">
              {user?.role || 'Warehouse Operator'}
            </Text>
          </View>
        </View>

        {/* System Status Card */}
        <Text className="text-xs font-bold text-slate-400 tracking-wider uppercase mb-3 px-1">
          Operational Statuses
        </Text>
        <View className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden mb-6">
          {/* eBay Connection */}
          <View className="flex-row items-center justify-between p-4 border-b border-slate-100">
            <View className="flex-row items-center">
              <Settings color="#64748b" size={20} />
              <Text className="text-slate-700 font-semibold ml-3">
                eBay Sync Status
              </Text>
            </View>
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

          {/* Shippo Connection */}
          <View className="flex-row items-center justify-between p-4 border-b border-slate-100">
            <View className="flex-row items-center">
              <Settings color="#64748b" size={20} />
              <Text className="text-slate-700 font-semibold ml-3">
                Shippo Connection
              </Text>
            </View>
            <View className="flex-row items-center">
              <View className={`w-2 h-2 rounded-full mr-2 ${
                data.shippoStatus === 'active' ? 'bg-emerald-500'
                : data.shippoStatus === 'error' ? 'bg-rose-500'
                : 'bg-amber-400'
              }`} />
              <Text className={`font-bold text-sm capitalize ${
                data.shippoStatus === 'active' ? 'text-emerald-600'
                : data.shippoStatus === 'error' ? 'text-rose-600'
                : 'text-slate-500'
              }`}>
                {data.shippoStatus ? data.shippoStatus.charAt(0).toUpperCase() + data.shippoStatus.slice(1) : 'Unknown'}
              </Text>
            </View>
          </View>

          {/* Print Agent Connection */}
          <View className="flex-row items-center justify-between p-4 border-b border-slate-100">
            <View className="flex-row items-center">
              <Settings color="#64748b" size={20} />
              <Text className="text-slate-700 font-semibold ml-3">
                Print Agent Status
              </Text>
            </View>
            <View className="flex-row items-center">
              <View className={`w-2 h-2 rounded-full ${printAgent.dot} mr-2`} />
              <Text className={`font-bold text-sm capitalize ${printAgent.color}`}>
                {printAgent.text}
              </Text>
            </View>
          </View>

          {/* Last Sync Time */}
          <View className="flex-row items-center justify-between p-4">
            <View className="flex-row items-center">
              <RefreshCw color="#64748b" size={20} />
              <Text className="text-slate-700 font-semibold ml-3">
                Last Sync Time
              </Text>
            </View>
            <Text className="text-slate-500 font-semibold text-sm">
              {data.lastEbaySync || 'Just now'}
            </Text>
          </View>
        </View>

        {/* Manual Sync Button */}
        <TouchableOpacity
          className="bg-sky-50 border border-sky-100 h-14 rounded-2xl flex-row items-center justify-center active:bg-sky-100 mb-4"
          onPress={handleManualSync}
          disabled={isSyncing || !user}
        >
          {isSyncing ? (
            <ActivityIndicator size="small" color="#0284c7" className="mr-2" />
          ) : (
            <RefreshCw color="#0284c7" size={20} className="mr-2" />
          )}
          <Text className="text-sky-700 font-bold text-base ml-2">
            {isSyncing ? 'Syncing...' : 'Manual eBay Sync'}
          </Text>
        </TouchableOpacity>

        {/* Sign Out Button */}
        <TouchableOpacity
          className="bg-red-50 border border-red-100 h-14 rounded-2xl flex-row items-center justify-center active:bg-red-100"
          onPress={logout}
        >
          <LogOut color="#ef4444" size={20} className="mr-2" />
          <Text className="text-red-600 font-bold text-base ml-2">Sign Out</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
