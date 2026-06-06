import React from 'react';
import { createTRPCReact } from '@trpc/react-query';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ListingsScreen } from './src/screens/ListingsScreen';
import CreateListingScreen from './src/screens/CreateListingScreen';
import { AuthProvider } from './src/contexts/AuthContext';

// Create tRPC React client
export const trpc = createTRPCReact<any>() as any;

const Stack = createNativeStackNavigator();
const queryClient = new QueryClient();

export default function App() {
  const TRPCProvider = trpc.Provider;
  return (
    <TRPCProvider client={{} as any} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <NavigationContainer>
            <Stack.Navigator initialRouteName="Listings">
              <Stack.Screen name="Listings" component={ListingsScreen} />
              <Stack.Screen name="CreateListing" component={CreateListingScreen} />
            </Stack.Navigator>
          </NavigationContainer>
        </AuthProvider>
      </QueryClientProvider>
    </TRPCProvider>
  );
}
