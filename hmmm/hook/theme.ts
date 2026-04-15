import Colors from '../constants/Colors';
import { useColorScheme } from 'react-native';

export const useTheme = () => {
  const scheme = useColorScheme();
  return scheme === 'dark' ? Colors.dark : Colors.light;
};