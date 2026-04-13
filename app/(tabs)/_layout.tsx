import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

type Icon = React.ComponentProps<typeof Ionicons>['name'];

const TABS = [
  { name: 'map',       title: 'Map',       icon: 'map',           iconOut: 'map-outline'           },
  { name: 'itinerary', title: 'Itinerary', icon: 'calendar',      iconOut: 'calendar-outline'      },
  { name: 'planner',   title: 'Plan',      icon: 'options',       iconOut: 'options-outline'       },
  { name: 'journal',   title: 'Journal',   icon: 'camera',        iconOut: 'camera-outline'        },
  { name: 'board',     title: 'Alerts',    icon: 'warning',       iconOut: 'warning-outline'       },
] as const;

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle:            { backgroundColor: '#0D1B0F', borderTopColor: '#1E3322', height: 60 },
        tabBarActiveTintColor:  '#39FF14',
        tabBarInactiveTintColor:'#6B7280',
        tabBarLabelStyle:       { fontSize: 10, fontWeight: '600', marginBottom: 4 },
      }}
    >
      {TABS.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.title,
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={(focused ? t.icon : t.iconOut) as Icon} size={22} color={color} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
