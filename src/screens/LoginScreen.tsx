import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from 'react-native';
import { ShieldCheck, Mail, Lock, AlertTriangle } from 'lucide-react-native';
import { useAuth } from '../contexts/AuthContext';
import { trpc } from '../../App';

export function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const loginMutation = (trpc as any).auth.login.useMutation();

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      const response = await loginMutation.mutateAsync({
        email: email.trim(),
        password: password,
      });

      // Support all possible backend response shapes for the token
      const token =
        response?.token ||
        response?.accessToken ||
        response?.jwt ||
        response?.data?.token ||
        response?.data?.accessToken;

      // Support all possible backend response shapes for the user
      const user = response?.user || response?.data?.user || response?.data;

      if (user) {
        const userObj = {
          id: user.id,
          name: user.name || 'Warehouse Operator',
          email: user.email || email,
          role: user.role || 'user',
          companyId: user.companyId || user.company?.id || null,
        };
        await login(token || 'cookie-session', userObj);
      } else if (token && !user) {
        // Token exists but user shape is unexpected — log in with minimal info.
        await login(token, {
          id: 0,
          name: 'Warehouse Operator',
          email: email,
          role: 'user',
          companyId: null,
        });
      } else {
        setError('Login succeeded but no user session was returned. Please contact your administrator.');
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err?.message || 'Invalid email or password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-slate-50"
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-1 justify-center px-6 py-12">
          {/* Header */}
          <View className="items-center mb-10">
            <View className="bg-sky-500 p-4 rounded-3xl shadow-lg mb-4">
              <ShieldCheck color="#ffffff" size={48} />
            </View>
            <Text className="text-3xl font-black text-slate-900 tracking-tight">
              StockNestPro
            </Text>
            <Text className="text-slate-500 mt-2 text-center font-medium">
              Mobile Warehouse Suite
            </Text>
          </View>

          {/* Error Message */}
          {!!error && (
            <View className="bg-rose-50 border border-rose-200 rounded-xl p-4 mb-6 flex-row items-center">
              <AlertTriangle color="#ef4444" size={20} />
              <Text className="text-rose-600 ml-3 font-semibold text-sm flex-1">
                {error}
              </Text>
            </View>
          )}

          {/* Form */}
          <Text className="text-slate-700 font-semibold mb-2 text-sm">
            Email Address
          </Text>
          <View className="flex-row items-center bg-slate-50 border border-slate-200 rounded-xl px-3 mb-4 focus:border-sky-500">
            <Mail color="#64748b" size={20} />
            <TextInput
              className="flex-1 h-12 ml-3 text-slate-900 font-medium"
              placeholder="you@example.com"
              placeholderTextColor="#94a3b8"
              keyboardType="email-address"
              autoCapitalize="none"
              returnKeyType="next"
              blurOnSubmit={false}
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <Text className="text-slate-700 font-semibold mb-2 text-sm">
            Password
          </Text>
          <View className="flex-row items-center bg-slate-50 border border-slate-200 rounded-xl px-3 mb-6 focus:border-sky-500">
            <Lock color="#64748b" size={20} />
            <TextInput
              className="flex-1 h-12 ml-3 text-slate-900 font-medium"
              placeholder="••••••••"
              placeholderTextColor="#94a3b8"
              secureTextEntry
              autoCapitalize="none"
              returnKeyType="done"
              onSubmitEditing={handleLogin}
              value={password}
              onChangeText={setPassword}
            />
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            className="bg-sky-500 h-14 rounded-xl items-center justify-center shadow-md shadow-sky-200 active:bg-sky-600"
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text className="text-white font-bold text-lg">Sign In</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
