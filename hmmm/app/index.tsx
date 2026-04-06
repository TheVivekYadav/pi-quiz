import { useTheme } from "@/hook/theme";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Button, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";


export default function Index() {

  const router = useRouter();

  const theme = useTheme();
  const insets = useSafeAreaInsets()
  // const [isActive, setIsActive] = useState("Not Active");
  // useEffect(() => {
  //   const fetchData = async () => {
  //     const resp = await fetch('http://10.223.39.190:3000')
  //     setIsActive(await resp.text())
  //   };
  //   fetchData();
  // }, [])

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: theme.background }]}>
      <StatusBar style="light" />

      <Button title="Create Form" onPress={() => router.push('/create')} />
      <View style={styles.spacer} />
      <Button title="Fill Form" onPress={() => router.push('/forms')} />

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  spacer: {
    height: 12,
  }
})