import { useColorScheme } from 'react-native';
import Colors from '../constants/Colors';

export const useTheme = () => {
  const scheme = useColorScheme(); // 'dark' or 'light'
  return scheme === 'dark' ? Colors.dark : Colors.light;
};