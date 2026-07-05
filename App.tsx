import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AddExpenseModal } from './src/screens/AddExpenseModal';
import { ChartsScreen } from './src/screens/ChartsScreen';
import { HomeScreen } from './src/screens/HomeScreen';

type RootTabParamList = {
  Home: undefined;
  Add: undefined;
  Charts: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

/** The Add slot is not a real tab — its button opens the modal instead. */
function NoopScreen() {
  return null;
}

function AddButton({ onPress }: { onPress: () => void }) {
  return (
    <View style={styles.addSlot}>
      <Pressable
        onPress={onPress}
        accessibilityLabel="Add expense"
        style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]}
      >
        <Ionicons name="add" size={34} color="#fff" />
      </Pressable>
    </View>
  );
}

export default function App() {
  const [addVisible, setAddVisible] = useState(false);

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Tab.Navigator
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: '#2563eb',
            tabBarInactiveTintColor: '#9ca3af',
          }}
        >
          <Tab.Screen
            name="Home"
            component={HomeScreen}
            options={{
              tabBarIcon: ({ color, size, focused }) => (
                <Ionicons name={focused ? 'home' : 'home-outline'} size={size} color={color} />
              ),
            }}
          />
          <Tab.Screen
            name="Add"
            component={NoopScreen}
            options={{
              tabBarButton: () => <AddButton onPress={() => setAddVisible(true)} />,
            }}
          />
          <Tab.Screen
            name="Charts"
            component={ChartsScreen}
            options={{
              tabBarIcon: ({ color, size, focused }) => (
                <Ionicons
                  name={focused ? 'pie-chart' : 'pie-chart-outline'}
                  size={size}
                  color={color}
                />
              ),
            }}
          />
        </Tab.Navigator>
        <AddExpenseModal visible={addVisible} onClose={() => setAddVisible(false)} />
      </NavigationContainer>
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  addSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -20,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  addButtonPressed: {
    opacity: 0.85,
  },
});
