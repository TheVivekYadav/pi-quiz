import { Redirect } from 'expo-router';
import { isAuthenticated } from '../constants/auth-session';

export default function Index() {
  // Redirect to login or dashboard based on auth state
  if (!isAuthenticated()) {
    return <Redirect href={'/login' as any} />;
  }
  return <Redirect href={'/(tabs)' as any} />;
}